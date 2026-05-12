-- Let admins reset user passwords without knowing the previous password.

create extension if not exists pgcrypto;

drop function if exists public.admin_reset_user_password(uuid, text, text);
drop function if exists public.admin_reset_user_password(uuid, text);

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
git push -u origin dev-2
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

revoke all on function public.admin_reset_user_password(uuid, text) from public;
grant execute on function public.admin_reset_user_password(uuid, text) to authenticated, service_role;
