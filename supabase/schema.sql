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
