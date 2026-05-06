-- Letterhead System: Supabase schema
-- Run this whole file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_code text not null,
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
  role text not null default 'viewer',
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
  ('OFFER', 'Offer Letter'),
  ('WARN', 'Warning Letter'),
  ('PROM', 'Promotion Letter'),
  ('CERT', 'Certificate')
on conflict (code) do nothing;
