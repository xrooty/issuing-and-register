-- Admin-only user account operations.
-- These functions run in the database so the browser never needs a service-role key.

create extension if not exists pgcrypto;

drop function if exists public.admin_reset_user_password(uuid, text);
drop function if exists public.admin_reset_user_password(uuid, text, text);

create or replace function public.admin_reset_user_password(target_user_id uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_is_admin boolean;
  target_email text;
begin
  actor_is_admin := exists (
    select 1
    from public.users
    where id = auth.uid()
      and active = true
      and role = 'admin'
  );

  if not actor_is_admin then
    raise exception 'Only admin can reset passwords.';
  end if;

  if length(coalesce(new_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  select public.users.email
  into target_email
  from public.users
  left join auth.users on auth.users.id = public.users.id
  where public.users.id = target_user_id;

  if target_email is null then
    raise exception 'User not found.';
  end if;

  update auth.users
  set
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'Supabase Auth user not found for %.', target_email;
  end if;
end;
$$;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_id uuid;
  actor_is_admin boolean;
  target_role text;
  target_email text;
  other_active_admins integer;
begin
  actor_id := auth.uid();

  actor_is_admin := exists (
    select 1
    from public.users
    where id = actor_id
      and active = true
      and role = 'admin'
  );

  if not actor_is_admin then
    raise exception 'Only admin can delete users.';
  end if;

  if actor_id = target_user_id then
    raise exception 'You cannot delete your own signed-in account.';
  end if;

  select role, email
  into target_role, target_email
  from public.users
  where id = target_user_id;

  if target_email is null then
    raise exception 'User not found.';
  end if;

  if target_role = 'admin' then
    select count(*)
    into other_active_admins
    from public.users
    where id <> target_user_id
      and active = true
      and role = 'admin';

    if other_active_admins < 1 then
      raise exception 'At least one active admin user is required.';
    end if;
  end if;

  delete from auth.users
  where id = target_user_id;

  delete from public.users
  where id = target_user_id;
end;
$$;

revoke all on function public.admin_reset_user_password(uuid, text) from public;
revoke all on function public.admin_delete_user(uuid) from public;

grant execute on function public.admin_reset_user_password(uuid, text) to authenticated, service_role;
grant execute on function public.admin_delete_user(uuid) to authenticated, service_role;
