-- Role data scopes and user-level permission overrides.

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

alter table public.role_data_scopes
  drop constraint if exists role_data_scopes_scope_type_check;

alter table public.role_data_scopes
  add constraint role_data_scopes_scope_type_check
  check (scope_type in ('own_data', 'own_department', 'selected_departments', 'all_departments'));

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

alter table public.user_permissions
  alter column can_view drop not null,
  alter column can_view drop default,
  alter column can_create drop not null,
  alter column can_create drop default,
  alter column can_edit drop not null,
  alter column can_edit drop default,
  alter column can_delete drop not null,
  alter column can_delete drop default;

alter table public.user_permissions
  add column if not exists scope_type text,
  add column if not exists department_names text[] not null default '{}'::text[];

alter table public.user_permissions
  drop constraint if exists user_permissions_scope_type_check;

alter table public.user_permissions
  add constraint user_permissions_scope_type_check
  check (scope_type is null or scope_type in ('own_data', 'own_department', 'selected_departments', 'all_departments'));

create index if not exists idx_role_data_scopes_role on public.role_data_scopes(role);
create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);

alter table public.role_data_scopes enable row level security;
alter table public.user_permissions enable row level security;

drop policy if exists role_data_scopes_all on public.role_data_scopes;
create policy role_data_scopes_all on public.role_data_scopes for all using (true) with check (true);

drop policy if exists user_permissions_all on public.user_permissions;
create policy user_permissions_all on public.user_permissions for all using (true) with check (true);
