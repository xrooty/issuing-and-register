-- Repair older permission schemas that used feature_key instead of module.
-- The app now uses dynamic permission_modules.name values stored in module.
-- This migration is intentionally idempotent for existing Supabase projects.

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

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  module text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.role_data_scopes (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  module text not null,
  scope_type text not null default 'own_department',
  department_names text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  updated_at timestamptz not null default now()
);

alter table public.roles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now();

alter table public.permission_modules
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now();

alter table public.role_permissions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists role text,
  add column if not exists module text,
  add column if not exists can_view boolean,
  add column if not exists can_create boolean,
  add column if not exists can_edit boolean,
  add column if not exists can_delete boolean,
  add column if not exists created_at timestamptz not null default now();

alter table public.role_data_scopes
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists role text,
  add column if not exists module text,
  add column if not exists scope_type text,
  add column if not exists department_names text[],
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'role_permissions'
      and column_name = 'feature_key'
  ) then
    update public.role_permissions
    set module = feature_key
    where nullif(trim(coalesce(module, '')), '') is null
      and nullif(trim(coalesce(feature_key, '')), '') is not null;

    update public.role_permissions
    set feature_key = module
    where nullif(trim(coalesce(feature_key, '')), '') is null
      and nullif(trim(coalesce(module, '')), '') is not null;

    alter table public.role_permissions alter column feature_key drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'role_data_scopes'
      and column_name = 'feature_key'
  ) then
    update public.role_data_scopes
    set module = feature_key
    where nullif(trim(coalesce(module, '')), '') is null
      and nullif(trim(coalesce(feature_key, '')), '') is not null;

    update public.role_data_scopes
    set feature_key = module
    where nullif(trim(coalesce(feature_key, '')), '') is null
      and nullif(trim(coalesce(module, '')), '') is not null;

    alter table public.role_data_scopes alter column feature_key drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_permissions'
      and column_name = 'feature_key'
  ) then
    update public.user_permissions
    set module = feature_key
    where nullif(trim(coalesce(module, '')), '') is null
      and nullif(trim(coalesce(feature_key, '')), '') is not null;

    update public.user_permissions
    set feature_key = module
    where nullif(trim(coalesce(feature_key, '')), '') is null
      and nullif(trim(coalesce(module, '')), '') is not null;

    alter table public.user_permissions alter column feature_key drop not null;
  end if;
end;
$$;

update public.users
set role = 'admin'
where role = 'super_admin';

-- Older installs used hardcoded role CHECK constraints. Dynamic roles are now
-- stored in public.roles, so these checks must not block custom role names.
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select
      conrelid::regclass as table_name,
      conname
    from pg_constraint
    where contype = 'c'
      and conrelid in (
        'public.users'::regclass,
        'public.role_permissions'::regclass,
        'public.role_data_scopes'::regclass
      )
      and pg_get_constraintdef(oid) ~* '\mrole\M'
  loop
    execute format('alter table %s drop constraint if exists %I', constraint_record.table_name, constraint_record.conname);
  end loop;
end;
$$;

insert into public.roles (name)
select 'admin'
where not exists (
  select 1 from public.roles where name = 'admin'
);

insert into public.roles (name)
select source.name
from (
  select distinct trim(role) as name
  from public.users
  where nullif(trim(coalesce(role, '')), '') is not null

  union

  select distinct trim(role) as name
  from public.role_permissions
  where nullif(trim(coalesce(role, '')), '') is not null

  union

  select distinct trim(role) as name
  from public.role_data_scopes
  where nullif(trim(coalesce(role, '')), '') is not null
) source
where not exists (
  select 1
  from public.roles existing
  where existing.name = source.name
);

insert into public.permission_modules (name)
select seed.name
from (
  values
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
) as seed(name)
where not exists (
  select 1
  from public.permission_modules existing
  where existing.name = seed.name
);

insert into public.permission_modules (name)
select source.name
from (
  select distinct trim(module) as name
  from public.role_permissions
  where nullif(trim(coalesce(module, '')), '') is not null
) source
where not exists (
  select 1
  from public.permission_modules existing
  where existing.name = source.name
);

insert into public.permission_modules (name)
select source.name
from (
  select distinct trim(module) as name
  from public.role_data_scopes
  where nullif(trim(coalesce(module, '')), '') is not null
) source
where not exists (
  select 1
  from public.permission_modules existing
  where existing.name = source.name
);

insert into public.permission_modules (name)
select source.name
from (
  select distinct trim(module) as name
  from public.user_permissions
  where nullif(trim(coalesce(module, '')), '') is not null
) source
where not exists (
  select 1
  from public.permission_modules existing
  where existing.name = source.name
);

delete from public.role_permissions
where nullif(trim(coalesce(role, '')), '') is null
   or nullif(trim(coalesce(module, '')), '') is null;

delete from public.role_data_scopes
where nullif(trim(coalesce(role, '')), '') is null
   or nullif(trim(coalesce(module, '')), '') is null;

delete from public.user_permissions
where user_id is null
   or nullif(trim(coalesce(module, '')), '') is null;

alter table public.role_permissions
  alter column role set not null,
  alter column module set not null,
  alter column can_view set default false,
  alter column can_create set default false,
  alter column can_edit set default false,
  alter column can_delete set default false;

update public.role_permissions
set
  role = trim(role),
  module = trim(module),
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
  alter column role set not null,
  alter column module set not null,
  alter column scope_type set default 'own_department',
  alter column department_names set default '{}'::text[];

update public.role_data_scopes
set
  role = trim(role),
  module = trim(module),
  scope_type = case
    when scope_type in ('own_data', 'own_department', 'selected_departments', 'all_departments') then scope_type
    else 'own_department'
  end,
  department_names = coalesce(department_names, '{}'::text[]),
  updated_at = coalesce(updated_at, now());

alter table public.role_data_scopes
  alter column scope_type set not null,
  alter column department_names set not null;

alter table public.user_permissions
  alter column user_id set not null,
  alter column module set not null,
  alter column department_names set default '{}'::text[];

update public.user_permissions
set
  module = trim(module),
  scope_type = case
    when scope_type in ('own_data', 'own_department', 'selected_departments', 'all_departments') then scope_type
    else null
  end,
  department_names = coalesce(department_names, '{}'::text[]),
  updated_at = coalesce(updated_at, now());

alter table public.user_permissions
  alter column department_names set not null;

alter table public.role_data_scopes
  drop constraint if exists role_data_scopes_scope_type_check;

alter table public.role_data_scopes
  add constraint role_data_scopes_scope_type_check
  check (scope_type in ('own_data', 'own_department', 'selected_departments', 'all_departments'));

alter table public.user_permissions
  drop constraint if exists user_permissions_scope_type_check;

alter table public.user_permissions
  add constraint user_permissions_scope_type_check
  check (scope_type is null or scope_type in ('own_data', 'own_department', 'selected_departments', 'all_departments'));

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
) duplicate
where target.ctid = duplicate.ctid
  and duplicate.rn > 1;

delete from public.role_data_scopes target
using (
  select ctid, row_number() over (partition by role, module order by created_at nulls last, id::text) as rn
  from public.role_data_scopes
) duplicate
where target.ctid = duplicate.ctid
  and duplicate.rn > 1;

delete from public.user_permissions target
using (
  select ctid, row_number() over (partition by user_id, module order by created_at nulls last, id::text) as rn
  from public.user_permissions
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

create index if not exists idx_role_data_scopes_role on public.role_data_scopes(role);
create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);

alter table public.roles enable row level security;
alter table public.permission_modules enable row level security;
alter table public.role_permissions enable row level security;
alter table public.role_data_scopes enable row level security;
alter table public.user_permissions enable row level security;

drop policy if exists roles_all on public.roles;
drop policy if exists roles_read_all on public.roles;
drop policy if exists roles_admin_write on public.roles;
create policy roles_read_all on public.roles for select using (true);
create policy roles_admin_write on public.roles for all
using (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
))
with check (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
));

drop policy if exists permission_modules_all on public.permission_modules;
drop policy if exists permission_modules_read_all on public.permission_modules;
drop policy if exists permission_modules_admin_write on public.permission_modules;
create policy permission_modules_read_all on public.permission_modules for select using (true);
create policy permission_modules_admin_write on public.permission_modules for all
using (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
))
with check (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
));

drop policy if exists role_permissions_all on public.role_permissions;
drop policy if exists role_permissions_read_all on public.role_permissions;
drop policy if exists role_permissions_admin_write on public.role_permissions;
create policy role_permissions_read_all on public.role_permissions for select using (true);
create policy role_permissions_admin_write on public.role_permissions for all
using (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
))
with check (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
));

drop policy if exists role_data_scopes_all on public.role_data_scopes;
drop policy if exists role_data_scopes_read_all on public.role_data_scopes;
drop policy if exists role_data_scopes_admin_write on public.role_data_scopes;
create policy role_data_scopes_read_all on public.role_data_scopes for select using (true);
create policy role_data_scopes_admin_write on public.role_data_scopes for all
using (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
))
with check (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
));

drop policy if exists user_permissions_all on public.user_permissions;
drop policy if exists user_permissions_read_all on public.user_permissions;
drop policy if exists user_permissions_admin_write on public.user_permissions;
create policy user_permissions_read_all on public.user_permissions for select using (true);
create policy user_permissions_admin_write on public.user_permissions for all
using (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
))
with check (exists (
  select 1
  from public.users
  where users.id = auth.uid()
    and users.active = true
    and users.role = 'admin'
));
