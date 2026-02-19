-- GymBo training community schema
-- Includes submissions, approved exercises, votes, reports, moderation helpers, and RLS.

create extension if not exists pgcrypto;

create type public.community_submission_status as enum ('pending', 'approved', 'rejected');
create type public.community_report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.profile_role as enum ('user', 'moderator', 'admin');
create type public.equipment_type as enum ('Freie Gewichte', 'Kardio', 'Koerpergewicht', 'Maschine');
create type public.difficulty_level as enum ('Anfaenger', 'Fortgeschritten', 'Profi');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.profile_role not null default 'user',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_exercise_submissions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  status public.community_submission_status not null default 'pending',
  name_de text not null check (char_length(trim(name_de)) between 2 and 120),
  name_en text not null check (char_length(trim(name_en)) between 2 and 120),
  name_de_norm text generated always as (lower(regexp_replace(trim(name_de), '\\s+', ' ', 'g'))) stored,
  name_en_norm text generated always as (lower(regexp_replace(trim(name_en), '\\s+', ' ', 'g'))) stored,
  description_de text not null default '',
  description_en text not null default '',
  instructions_de text[] not null default '{}',
  instructions_en text[] not null default '{}',
  muscle_groups text[] not null check (array_length(muscle_groups, 1) >= 1),
  equipment_type public.equipment_type not null,
  difficulty public.difficulty_level not null,
  moderation_note text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_exercises (
  id uuid primary key default gen_random_uuid(),
  source_submission_id uuid unique references public.community_exercise_submissions(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  name_de text not null check (char_length(trim(name_de)) between 2 and 120),
  name_en text not null check (char_length(trim(name_en)) between 2 and 120),
  name_de_norm text generated always as (lower(regexp_replace(trim(name_de), '\\s+', ' ', 'g'))) stored,
  name_en_norm text generated always as (lower(regexp_replace(trim(name_en), '\\s+', ' ', 'g'))) stored,
  description_de text not null default '',
  description_en text not null default '',
  instructions_de text[] not null default '{}',
  instructions_en text[] not null default '{}',
  muscle_groups text[] not null check (array_length(muscle_groups, 1) >= 1),
  equipment_type public.equipment_type not null,
  difficulty public.difficulty_level not null,
  score integer not null default 0,
  reports_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_exercise_votes (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.community_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_id, user_id)
);

create table if not exists public.community_exercise_reports (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.community_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('wrong_data', 'duplicate', 'unsafe', 'spam', 'other')),
  details text,
  status public.community_report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_id, user_id)
);

create index if not exists idx_submissions_status_created_at
  on public.community_exercise_submissions (status, created_at desc);
create index if not exists idx_submissions_created_by
  on public.community_exercise_submissions (created_by, created_at desc);
create index if not exists idx_exercises_score_created_at
  on public.community_exercises (score desc, created_at desc);
create index if not exists idx_exercises_name_de_norm
  on public.community_exercises (name_de_norm);
create index if not exists idx_exercises_name_en_norm
  on public.community_exercises (name_en_norm);
create index if not exists idx_reports_status_created_at
  on public.community_exercise_reports (status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.recalculate_exercise_score(target_exercise_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score integer;
begin
  select coalesce(sum(vote), 0)
  into v_score
  from public.community_exercise_votes
  where exercise_id = target_exercise_id;

  update public.community_exercises
  set score = v_score
  where id = target_exercise_id;
end;
$$;

create or replace function public.recalculate_reports_count(target_exercise_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer
  into v_count
  from public.community_exercise_reports
  where exercise_id = target_exercise_id
    and status in ('open', 'reviewing');

  update public.community_exercises
  set reports_count = v_count
  where id = target_exercise_id;
end;
$$;

create or replace function public.votes_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_exercise_score(old.exercise_id);
    return old;
  end if;

  perform public.recalculate_exercise_score(new.exercise_id);
  if tg_op = 'UPDATE' and old.exercise_id <> new.exercise_id then
    perform public.recalculate_exercise_score(old.exercise_id);
  end if;

  return new;
end;
$$;

create or replace function public.reports_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_reports_count(old.exercise_id);
    return old;
  end if;

  perform public.recalculate_reports_count(new.exercise_id);
  if tg_op = 'UPDATE' and old.exercise_id <> new.exercise_id then
    perform public.recalculate_reports_count(old.exercise_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_submissions_updated_at on public.community_exercise_submissions;
create trigger trg_submissions_updated_at
before update on public.community_exercise_submissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_exercises_updated_at on public.community_exercises;
create trigger trg_exercises_updated_at
before update on public.community_exercises
for each row execute function public.set_updated_at();

drop trigger if exists trg_votes_updated_at on public.community_exercise_votes;
create trigger trg_votes_updated_at
before update on public.community_exercise_votes
for each row execute function public.set_updated_at();

drop trigger if exists trg_reports_updated_at on public.community_exercise_reports;
create trigger trg_reports_updated_at
before update on public.community_exercise_reports
for each row execute function public.set_updated_at();

drop trigger if exists trg_votes_after_change on public.community_exercise_votes;
create trigger trg_votes_after_change
after insert or update or delete on public.community_exercise_votes
for each row execute function public.votes_after_change();

drop trigger if exists trg_reports_after_change on public.community_exercise_reports;
create trigger trg_reports_after_change
after insert or update or delete on public.community_exercise_reports
for each row execute function public.reports_after_change();

create or replace function public.approve_submission(submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.community_exercise_submissions;
  new_exercise_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'forbidden';
  end if;

  select * into s
  from public.community_exercise_submissions
  where id = submission_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'submission_not_found_or_not_pending';
  end if;

  insert into public.community_exercises (
    source_submission_id,
    created_by,
    name_de,
    name_en,
    description_de,
    description_en,
    instructions_de,
    instructions_en,
    muscle_groups,
    equipment_type,
    difficulty,
    is_active
  )
  values (
    s.id,
    s.created_by,
    s.name_de,
    s.name_en,
    s.description_de,
    s.description_en,
    s.instructions_de,
    s.instructions_en,
    s.muscle_groups,
    s.equipment_type,
    s.difficulty,
    true
  )
  returning id into new_exercise_id;

  update public.community_exercise_submissions
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      rejection_reason = null
  where id = s.id;

  return new_exercise_id;
end;
$$;

create or replace function public.reject_submission(submission_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'forbidden';
  end if;

  update public.community_exercise_submissions
  set status = 'rejected',
      rejection_reason = coalesce(reason, rejection_reason)
  where id = submission_id
    and status = 'pending';

  if not found then
    raise exception 'submission_not_found_or_not_pending';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.community_exercise_submissions enable row level security;
alter table public.community_exercises enable row level security;
alter table public.community_exercise_votes enable row level security;
alter table public.community_exercise_reports enable row level security;

-- profiles
create policy "profiles_select_own_or_mod"
on public.profiles
for select
using (id = auth.uid() or public.is_moderator());

create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- submissions
create policy "submissions_insert_authenticated"
on public.community_exercise_submissions
for insert
to authenticated
with check (created_by = auth.uid() and status = 'pending');

create policy "submissions_select_own_or_mod"
on public.community_exercise_submissions
for select
using (created_by = auth.uid() or public.is_moderator());

create policy "submissions_update_mod_only"
on public.community_exercise_submissions
for update
using (public.is_moderator())
with check (public.is_moderator());

-- approved exercises
create policy "community_exercises_public_read"
on public.community_exercises
for select
using (is_active = true or public.is_moderator());

create policy "community_exercises_mod_write"
on public.community_exercises
for all
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

-- votes
create policy "votes_read_all"
on public.community_exercise_votes
for select
using (true);

create policy "votes_insert_own"
on public.community_exercise_votes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "votes_update_own"
on public.community_exercise_votes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "votes_delete_own"
on public.community_exercise_votes
for delete
to authenticated
using (user_id = auth.uid());

-- reports
create policy "reports_insert_own"
on public.community_exercise_reports
for insert
to authenticated
with check (user_id = auth.uid());

create policy "reports_select_own_or_mod"
on public.community_exercise_reports
for select
to authenticated
using (user_id = auth.uid() or public.is_moderator());

create policy "reports_update_mod_only"
on public.community_exercise_reports
for update
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

-- RPC permissions
revoke all on function public.approve_submission(uuid) from public;
revoke all on function public.reject_submission(uuid, text) from public;
grant execute on function public.approve_submission(uuid) to authenticated;
grant execute on function public.reject_submission(uuid, text) to authenticated;
