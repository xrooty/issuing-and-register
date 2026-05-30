alter table public.users
  add column if not exists department_name text default '';

update public.users
set department_name = coalesce(department_name, '');

alter table public.users
  alter column department_name set default '';

update public.role_data_scopes
set scope_type = 'own_department',
    department_names = '{}'::text[],
    updated_at = now()
where scope_type = 'all_departments';

update public.user_permissions
set scope_type = 'own_department',
    department_names = '{}'::text[],
    updated_at = now()
where scope_type = 'all_departments';

alter table public.role_data_scopes
  drop constraint if exists role_data_scopes_scope_type_check;

alter table public.role_data_scopes
  add constraint role_data_scopes_scope_type_check
  check (scope_type in ('own_data', 'own_department', 'selected_departments'));

alter table public.user_permissions
  drop constraint if exists user_permissions_scope_type_check;

alter table public.user_permissions
  add constraint user_permissions_scope_type_check
  check (scope_type is null or scope_type in ('own_data', 'own_department', 'selected_departments'));

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

  insert into public.users (id, email, full_name, role, department_name, active)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), ''),
    case
      when not exists (select 1 from public.users where role = 'admin') then 'admin'
      else coalesce(requested_role, '')
    end,
    coalesce(nullif(new.raw_user_meta_data->>'department_name', ''), ''),
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
    department_name = case
      when nullif(public.users.department_name, '') is null then excluded.department_name
      else public.users.department_name
    end,
    active = true;

  return new;
end;
$$;
