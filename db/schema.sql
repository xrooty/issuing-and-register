-- Letterhead System: Supabase schema
-- Run this whole file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_code text not null,
  code text not null,
  address text default '',
  phone text default '',
  email text default '',
  footer_text text default '',
  letter_no_pattern text default '',
  created_at timestamptz not null default now()
);

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  code text not null,
  letter_no_pattern text default '',
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists template_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  template_type_id uuid references template_types(id) on delete set null,
  name text not null,
  ref_code text default '',
  default_subject text default '',
  body_template text default '',
  letter_no_pattern text default '',
  design_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists letters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  department_id uuid not null references departments(id),
  template_id uuid not null references templates(id),
  client_id uuid,
  template_type_id uuid references template_types(id),
  letter_no text not null,
  letter_no_manual text default '',
  letter_no_format_override text default '',
  letter_no_pattern_used text default '',
  issue_date date,
  recipient_name text default '',
  recipient_company text default '',
  recipient_department text default '',
  subject text default '',
  body_notes text default '',
  prepared_by text default '',
  approved_by text default '',
  issued_by_user_id uuid references users(id) on delete set null,
  issued_by_name text default '',
  remarks text default '',
  rendered_body text default '',
  pdf_file_name text default '',
  pdf_storage_path text default '',
  custom_fields_json jsonb not null default '{}'::jsonb,
  template_snapshot_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sequence_counters (
  key text primary key,
  current integer not null default 0
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text default '',
  role text not null default '',
  department_name text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid references users(id) on delete set null,
  actor_name text default '',
  entity text not null,
  entity_id uuid,
  details text default '',
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_code text default '',
  company text default '',
  contact_name text default '',
  contact_name_secondary text default '',
  designation text default '',
  email text not null,
  email_secondary text default '',
  phone text default '',
  whatsapp text default '',
  city text default '',
  state text default '',
  country text default '',
  postal_code text default '',
  address text default '',
  industry text default '',
  source text default '',
  priority text default 'medium',
  assigned_owner text default '',
  tags text default '',
  notes text default '',
  custom_fields_json jsonb not null default '{}'::jsonb,
  follow_up_date date,
  status text not null default 'active',
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists client_fields (
  id uuid primary key default gen_random_uuid(),
  field_key text not null unique,
  label text not null,
  input_type text not null default 'text',
  options_json jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_fields_active on client_fields(is_active, sort_order);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists role_permissions (
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

create table if not exists role_data_scopes (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  module text not null,
  scope_type text not null default 'own_department',
  department_names text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, module),
  constraint role_data_scopes_scope_type_check check (scope_type in ('own_data', 'own_department', 'selected_departments'))
);

create table if not exists user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  module text not null,
  can_view boolean,
  can_create boolean,
  can_edit boolean,
  can_delete boolean,
  scope_type text,
  department_names text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module),
  constraint user_permissions_scope_type_check check (scope_type is null or scope_type in ('own_data', 'own_department', 'selected_departments'))
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists permission_modules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'letters_client_id_fkey'
  ) then
    alter table letters
      add constraint letters_client_id_fkey
      foreign key (client_id) references clients(id) on delete set null;
  end if;
end $$;

create index if not exists idx_departments_company_id on departments(company_id);
create index if not exists idx_templates_company_id on templates(company_id);
create index if not exists idx_templates_department_id on templates(department_id);
create index if not exists idx_letters_company_id on letters(company_id);
create index if not exists idx_letters_department_id on letters(department_id);
create index if not exists idx_letters_template_id on letters(template_id);
create index if not exists idx_letters_created_at on letters(created_at desc);
create index if not exists idx_role_data_scopes_role on role_data_scopes(role);
create index if not exists idx_user_permissions_user_id on user_permissions(user_id);

create or replace function next_sequence(counter_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare next_value integer;
begin
  insert into sequence_counters(key, current)
  values (counter_key, 1)
  on conflict (key)
  do update set current = sequence_counters.current + 1
  returning current into next_value;

  return next_value;
end;
$$;

revoke all on function next_sequence(text) from public;
grant execute on function next_sequence(text) to anon, authenticated, service_role;

insert into template_types(code, name) values
  ('LETTER', 'Letter'),
  ('AG', 'AG'),
  ('OFFER', 'Offer Letter'),
  ('WARN', 'Warning Letter'),
  ('PROM', 'Promotion Letter'),
  ('CERT', 'Certificate')
on conflict (code) do nothing;

insert into roles(name) values
  ('admin')
on conflict (name) do nothing;

update users
set role = 'admin'
where role = 'super_admin';

delete from roles
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

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.sync_auth_user_profile();

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

with auth_profiles as (
  select
    auth_users.id,
    lower(auth_users.email) as email,
    coalesce(nullif(auth_users.raw_user_meta_data->>'full_name', ''), '') as full_name,
    coalesce(nullif(auth_users.raw_user_meta_data->>'department_name', ''), '') as department_name,
    case
      when auth_users.raw_user_meta_data->>'role' = 'super_admin' then 'admin'
      else coalesce(nullif(auth_users.raw_user_meta_data->>'role', ''), '')
    end as requested_role,
    row_number() over (order by auth_users.created_at, auth_users.id) as auth_order
  from auth.users as auth_users
  where auth_users.email is not null
)
insert into public.users (id, email, full_name, role, department_name, active)
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
  auth_profiles.department_name,
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
  department_name = case
    when nullif(public.users.department_name, '') is null then excluded.department_name
    else public.users.department_name
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

insert into permission_modules(name) values
  ('dashboard_export_register_csv'),
  ('dashboard_backup_json'),
  ('dashboard_refresh_db'),
  ('clients-create'),
  ('clients-all'),
  ('clients-profile'),
  ('users'),
  ('roles'),
  ('admin'),
  ('activity_settings'),
  ('activity'),
  ('companies'),
  ('departments'),
  ('templates'),
  ('issue'),
  ('register'),
  ('client_fields')
on conflict (name) do nothing;

insert into app_settings(key, value) values
  ('activity_logging_enabled', 'true'::jsonb)
on conflict (key) do nothing;
