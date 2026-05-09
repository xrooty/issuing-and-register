-- Canonical migration 0009: keep Supabase Auth users and app profiles aligned.
--
-- Important: SQL migrations cannot create password logins in auth.users.
-- Password accounts must still be created through Supabase Auth/signup.
-- This migration fixes the opposite problem: Auth accounts that exist but
-- are missing or mismatched in public.users.

insert into public.roles (name) values
  ('admin')
on conflict (name) do nothing;

update public.users
set role = 'admin'
where role = 'super_admin';

delete from public.roles
where name = 'super_admin';

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := nullif(new.raw_user_meta_data->>'role', '');

  if requested_role = 'super_admin' then
    requested_role := 'admin';
  end if;

  insert into public.users (id, email, full_name, role, active)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), ''),
    case
      when not exists (select 1 from public.users where role = 'admin') then 'admin'
      else coalesce(requested_role, '')
    end,
    true
  )
  on conflict (email) do update
  set
    full_name = case
      when nullif(public.users.full_name, '') is null then excluded.full_name
      else public.users.full_name
    end,
    role = case
      when public.users.role = 'super_admin' then 'admin'
      else public.users.role
    end,
    active = true;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.sync_auth_user_profile();

with auth_profiles as (
  select
    auth_users.id,
    lower(auth_users.email) as email,
    coalesce(nullif(auth_users.raw_user_meta_data->>'full_name', ''), '') as full_name,
    case
      when auth_users.raw_user_meta_data->>'role' = 'super_admin' then 'admin'
      else coalesce(nullif(auth_users.raw_user_meta_data->>'role', ''), '')
    end as requested_role,
    row_number() over (order by auth_users.created_at, auth_users.id) as auth_order
  from auth.users as auth_users
  where auth_users.email is not null
)
insert into public.users (id, email, full_name, role, active)
select
  auth_profiles.id,
  auth_profiles.email,
  auth_profiles.full_name,
  case
    when auth_profiles.auth_order = 1
      and not exists (select 1 from public.users where role = 'admin')
      then 'admin'
    else auth_profiles.requested_role
  end,
  true
from auth_profiles
on conflict (email) do update
set
  full_name = case
    when nullif(public.users.full_name, '') is null then excluded.full_name
    else public.users.full_name
  end,
  role = case
    when public.users.role = 'super_admin' then 'admin'
    else public.users.role
  end,
  active = true;

update public.users
set role = 'admin'
where id = (
  select id
  from public.users
  where active = true
  order by created_at nulls last, email
  limit 1
)
and not exists (
  select 1
  from public.users
  where role = 'admin'
);
