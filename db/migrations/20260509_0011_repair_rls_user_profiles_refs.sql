-- Repair live Supabase DBs that still have old RLS policies/functions
-- referencing public.user_profiles. The app now uses public.users.
--
-- Run this in Supabase SQL Editor after the schema migrations. It is
-- intentionally idempotent and permissive, matching the current browser-app
-- setup used by this project.

create extension if not exists pgcrypto;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.permission_modules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  module text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  unique (role, module)
);

create table if not exists public.role_data_scopes (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  module text not null,
  scope_type text not null default 'own_department',
  department_names text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, module)
);

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  module text not null,
  can_view boolean,
  can_create boolean,
  can_edit boolean,
  can_delete boolean,
  scope_type text,
  department_names text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module)
);

alter table public.roles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now();

alter table public.permission_modules
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now();

alter table public.app_settings
  add column if not exists key text,
  add column if not exists value jsonb not null default 'null'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.role_permissions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists role text,
  add column if not exists module text,
  add column if not exists can_view boolean,
  add column if not exists can_create boolean,
  add column if not exists can_edit boolean,
  add column if not exists can_delete boolean,
  add column if not exists created_at timestamptz not null default now();

alter table public.role_permissions
  alter column can_view set default false,
  alter column can_create set default false,
  alter column can_edit set default false,
  alter column can_delete set default false;

update public.role_permissions
set
  can_view = coalesce(can_view, false),
  can_create = coalesce(can_create, false),
  can_edit = coalesce(can_edit, false),
  can_delete = coalesce(can_delete, false);

alter table public.role_permissions
  alter column can_view set not null,
  alter column can_create set not null,
  alter column can_edit set not null,
  alter column can_delete set not null;

alter table public.role_data_scopes
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists role text,
  add column if not exists module text,
  add column if not exists scope_type text,
  add column if not exists department_names text[],
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.role_data_scopes
  alter column scope_type set default 'own_department',
  alter column department_names set default '{}'::text[];

update public.role_data_scopes
set
  scope_type = coalesce(scope_type, 'own_department'),
  department_names = coalesce(department_names, '{}'::text[]);

alter table public.role_data_scopes
  alter column scope_type set not null,
  alter column department_names set not null;

alter table public.user_permissions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists module text,
  add column if not exists can_view boolean,
  add column if not exists can_create boolean,
  add column if not exists can_edit boolean,
  add column if not exists can_delete boolean,
  add column if not exists scope_type text,
  add column if not exists department_names text[],
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_permissions
  alter column department_names set default '{}'::text[];

update public.user_permissions
set department_names = coalesce(department_names, '{}'::text[]);

alter table public.user_permissions
  alter column department_names set not null;

delete from public.roles target
using (
  select ctid, row_number() over (partition by name order by created_at nulls last, id::text) as rn
  from public.roles
  where name is not null
) duplicate
where target.ctid = duplicate.ctid
  and duplicate.rn > 1;

delete from public.permission_modules target
using (
  select ctid, row_number() over (partition by name order by created_at nulls last, id::text) as rn
  from public.permission_modules
  where name is not null
) duplicate
where target.ctid = duplicate.ctid
  and duplicate.rn > 1;

delete from public.role_permissions target
using (
  select ctid, row_number() over (partition by role, module order by created_at nulls last, id::text) as rn
  from public.role_permissions
  where role is not null
    and module is not null
) duplicate
where target.ctid = duplicate.ctid
  and duplicate.rn > 1;

delete from public.role_data_scopes target
using (
  select ctid, row_number() over (partition by role, module order by created_at nulls last, id::text) as rn
  from public.role_data_scopes
  where role is not null
    and module is not null
) duplicate
where target.ctid = duplicate.ctid
  and duplicate.rn > 1;

delete from public.user_permissions target
using (
  select ctid, row_number() over (partition by user_id, module order by created_at nulls last, id::text) as rn
  from public.user_permissions
  where user_id is not null
    and module is not null
) duplicate
where target.ctid = duplicate.ctid
  and duplicate.rn > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.roles'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.roles'::regclass and attname = 'name')
      ]::smallint[]
  ) then
    alter table public.roles add constraint roles_name_key unique (name);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.permission_modules'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.permission_modules'::regclass and attname = 'name')
      ]::smallint[]
  ) then
    alter table public.permission_modules add constraint permission_modules_name_key unique (name);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.role_permissions'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.role_permissions'::regclass and attname = 'role'),
        (select attnum from pg_attribute where attrelid = 'public.role_permissions'::regclass and attname = 'module')
      ]::smallint[]
  ) then
    alter table public.role_permissions add constraint role_permissions_role_module_key unique (role, module);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.role_data_scopes'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.role_data_scopes'::regclass and attname = 'role'),
        (select attnum from pg_attribute where attrelid = 'public.role_data_scopes'::regclass and attname = 'module')
      ]::smallint[]
  ) then
    alter table public.role_data_scopes add constraint role_data_scopes_role_module_key unique (role, module);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_permissions'::regclass
      and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.user_permissions'::regclass and attname = 'user_id'),
        (select attnum from pg_attribute where attrelid = 'public.user_permissions'::regclass and attname = 'module')
      ]::smallint[]
  ) then
    alter table public.user_permissions add constraint user_permissions_user_id_module_key unique (user_id, module);
  end if;
end;
$$;

insert into public.roles (name) values ('admin')
on conflict (name) do nothing;

insert into public.permission_modules (name) values
  ('dashboard'),
  ('companies'),
  ('departments'),
  ('templates'),
  ('issue'),
  ('register'),
  ('clients-create'),
  ('clients-all'),
  ('clients-profile'),
  ('users'),
  ('roles'),
  ('activity'),
  ('activity_settings'),
  ('admin'),
  ('client_fields')
on conflict (name) do nothing;

insert into public.app_settings (key, value) values
  ('activity_logging_enabled', 'true'::jsonb)
on conflict (key) do nothing;

update public.users
set role = 'admin'
where role = 'super_admin';

insert into public.role_permissions (
  role,
  module,
  can_view,
  can_create,
  can_edit,
  can_delete
)
select
  'admin',
  module,
  can_view,
  can_create,
  can_edit,
  can_delete
from public.role_permissions
where role = 'super_admin'
on conflict (role, module) do update
set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete;

delete from public.role_permissions
where role = 'super_admin';

insert into public.role_data_scopes (
  role,
  module,
  scope_type,
  department_names
)
select
  'admin',
  module,
  scope_type,
  department_names
from public.role_data_scopes
where role = 'super_admin'
on conflict (role, module) do update
set
  scope_type = excluded.scope_type,
  department_names = excluded.department_names;

delete from public.role_data_scopes
where role = 'super_admin';

delete from public.roles
where name = 'super_admin';

alter table public.users alter column role set default '';

create index if not exists idx_role_data_scopes_role on public.role_data_scopes(role);
create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);

do $$
declare
  target_table text;
  policy_record record;
begin
  foreach target_table in array array[
    'companies',
    'departments',
    'template_types',
    'templates',
    'letters',
    'sequence_counters',
    'users',
    'activity_log',
    'clients',
    'client_fields',
    'reports',
    'role_permissions',
    'role_data_scopes',
    'user_permissions',
    'roles',
    'permission_modules',
    'app_settings'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('alter table public.%I enable row level security', target_table);

      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = target_table
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, target_table);
      end loop;

      execute format(
        'create policy %I on public.%I for all using (true) with check (true)',
        target_table || '_all',
        target_table
      );
    end if;
  end loop;
end;
$$;
