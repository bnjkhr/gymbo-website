-- Promote Ben to admin role for training moderation
insert into public.profiles (id, role)
select u.id, 'admin'::public.profile_role
from auth.users u
where lower(u.email) = lower('ben.kohler@me.com')
on conflict (id)
do update set role = 'admin'::public.profile_role;
