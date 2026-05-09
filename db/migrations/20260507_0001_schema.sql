-- Canonical migration 0001: base schema
-- Use this first on a fresh Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.companies (
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

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  letter_no_pattern text default '',
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.template_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  template_type_id uuid references public.template_types(id) on delete set null,
  name text not null,
  ref_code text default '',
  default_subject text default '',
  body_template text default '',
  letter_no_pattern text default '',
  design_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text default '',
  role text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null default '',
  full_name text not null default '',
  client_code text default '',
  company text default '',
  contact_name text default '',
  contact_name_secondary text default '',
  designation text default '',
  email text not null default '',
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
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_fields (
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

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  department_id uuid not null references public.departments(id),
  template_id uuid not null references public.templates(id),
  client_id uuid references public.clients(id) on delete set null,
  template_type_id uuid references public.template_types(id),
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
  issued_by_user_id uuid references public.users(id) on delete set null,
  issued_by_name text default '',
  remarks text default '',
  rendered_body text default '',
  pdf_file_name text default '',
  pdf_storage_path text default '',
  custom_fields_json jsonb not null default '{}'::jsonb,
  template_snapshot_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sequence_counters (
  key text primary key,
  current integer not null default 0
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid references public.users(id) on delete set null,
  actor_name text default '',
  entity text not null,
  entity_id uuid,
  details text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  payload jsonb default '{}'::jsonb,
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
  created_at timestamptz not null default now(),
  unique (role, module)
);

create index if not exists idx_departments_company_id on public.departments(company_id);
create index if not exists idx_templates_company_id on public.templates(company_id);
create index if not exists idx_templates_department_id on public.templates(department_id);
create index if not exists idx_letters_company_id on public.letters(company_id);
create index if not exists idx_letters_department_id on public.letters(department_id);
create index if not exists idx_letters_template_id on public.letters(template_id);
create index if not exists idx_letters_created_at on public.letters(created_at desc);
create index if not exists idx_client_fields_active on public.client_fields(is_active, sort_order);

insert into public.template_types(code, name) values
  ('LETTER', 'Letter'),
  ('AG', 'AG'),
  ('OFFER', 'Offer Letter'),
  ('WARN', 'Warning Letter'),
  ('PROM', 'Promotion Letter'),
  ('CERT', 'Certificate')
on conflict (code) do nothing;
