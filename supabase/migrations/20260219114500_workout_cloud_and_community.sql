-- Workout cloud storage + community workout submissions/public list

create table if not exists public.user_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  workout_type text not null check (workout_type in ('standard', 'superset', 'circuit')),
  default_rest_time integer not null check (default_rest_time between 10 and 600),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_workout_submissions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references public.user_workouts(id) on delete set null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  status public.community_submission_status not null default 'pending',
  name text not null check (char_length(trim(name)) between 2 and 120),
  workout_type text not null check (workout_type in ('standard', 'superset', 'circuit')),
  payload jsonb not null,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_workouts (
  id uuid primary key default gen_random_uuid(),
  source_submission_id uuid unique references public.community_workout_submissions(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  workout_type text not null check (workout_type in ('standard', 'superset', 'circuit')),
  payload jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_workouts_user_updated on public.user_workouts (user_id, updated_at desc);
create index if not exists idx_workout_submissions_status_created on public.community_workout_submissions (status, created_at desc);
create index if not exists idx_community_workouts_active_created on public.community_workouts (is_active, created_at desc);

drop trigger if exists trg_user_workouts_updated_at on public.user_workouts;
create trigger trg_user_workouts_updated_at
before update on public.user_workouts
for each row execute function public.set_updated_at();

drop trigger if exists trg_community_workout_submissions_updated_at on public.community_workout_submissions;
create trigger trg_community_workout_submissions_updated_at
before update on public.community_workout_submissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_community_workouts_updated_at on public.community_workouts;
create trigger trg_community_workouts_updated_at
before update on public.community_workouts
for each row execute function public.set_updated_at();

create or replace function public.approve_workout_submission(submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.community_workout_submissions;
  new_workout_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'forbidden';
  end if;

  select * into s
  from public.community_workout_submissions
  where id = submission_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'submission_not_found_or_not_pending';
  end if;

  insert into public.community_workouts (
    source_submission_id,
    created_by,
    name,
    workout_type,
    payload,
    is_active
  ) values (
    s.id,
    s.submitted_by,
    s.name,
    s.workout_type,
    s.payload,
    true
  ) returning id into new_workout_id;

  update public.community_workout_submissions
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      rejection_reason = null
  where id = s.id;

  return new_workout_id;
end;
$$;

create or replace function public.reject_workout_submission(submission_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'forbidden';
  end if;

  update public.community_workout_submissions
  set status = 'rejected',
      rejection_reason = coalesce(reason, rejection_reason)
  where id = submission_id
    and status = 'pending';

  if not found then
    raise exception 'submission_not_found_or_not_pending';
  end if;
end;
$$;

alter table public.user_workouts enable row level security;
alter table public.community_workout_submissions enable row level security;
alter table public.community_workouts enable row level security;

create policy "user_workouts_select_own"
on public.user_workouts
for select
to authenticated
using (user_id = auth.uid());

create policy "user_workouts_insert_own"
on public.user_workouts
for insert
to authenticated
with check (user_id = auth.uid());

create policy "user_workouts_update_own"
on public.user_workouts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_workouts_delete_own"
on public.user_workouts
for delete
to authenticated
using (user_id = auth.uid());

create policy "community_workout_submissions_insert_own"
on public.community_workout_submissions
for insert
to authenticated
with check (submitted_by = auth.uid() and status = 'pending');

create policy "community_workout_submissions_select_own_or_mod"
on public.community_workout_submissions
for select
to authenticated
using (submitted_by = auth.uid() or public.is_moderator());

create policy "community_workout_submissions_update_mod"
on public.community_workout_submissions
for update
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

create policy "community_workouts_public_read"
on public.community_workouts
for select
using (is_active = true or public.is_moderator());

create policy "community_workouts_mod_write"
on public.community_workouts
for all
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

revoke all on function public.approve_workout_submission(uuid) from public;
revoke all on function public.reject_workout_submission(uuid, text) from public;
grant execute on function public.approve_workout_submission(uuid) to authenticated;
grant execute on function public.reject_workout_submission(uuid, text) to authenticated;

-- Ensure Ben has admin role (covers case where account was created after earlier migration)
insert into public.profiles (id, role)
select u.id, 'admin'::public.profile_role
from auth.users u
where lower(u.email) = lower('ben.kohler@me.com')
on conflict (id)
do update set role = 'admin'::public.profile_role;
