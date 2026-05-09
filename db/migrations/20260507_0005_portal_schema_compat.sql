-- Canonical migration 0005: compatibility layer for older live databases
-- Run this after 0001-0004 when upgrading an older DB.

create extension if not exists pgcrypto;

-- Companies compatibility
alter table public.companies add column if not exists name text not null default '';
alter table public.companies add column if not exists short_code text not null default '';
alter table public.companies add column if not exists code text not null default '';
alter table public.companies add column if not exists address text default '';
alter table public.companies add column if not exists phone text default '';
alter table public.companies add column if not exists email text default '';
alter table public.companies add column if not exists footer_text text default '';
alter table public.companies add column if not exists letter_no_pattern text default '';
alter table public.companies add column if not exists created_at timestamptz not null default now();

update public.companies
set short_code = coalesce(nullif(trim(short_code), ''), nullif(trim(code), ''), '')
where short_code is distinct from coalesce(nullif(trim(short_code), ''), nullif(trim(code), ''), '');

update public.companies
set code = coalesce(nullif(trim(code), ''), nullif(trim(short_code), ''), '')
where code is distinct from coalesce(nullif(trim(code), ''), nullif(trim(short_code), ''), '');

-- Departments compatibility
alter table public.departments add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.departments add column if not exists name text not null default '';
alter table public.departments add column if not exists code text not null default '';
alter table public.departments add column if not exists letter_no_pattern text default '';
alter table public.departments add column if not exists created_at timestamptz not null default now();

-- Clients compatibility
alter table public.clients add column if not exists client_name text not null default '';
alter table public.clients add column if not exists full_name text not null default '';
alter table public.clients add column if not exists client_code text default '';
alter table public.clients add column if not exists company text default '';
alter table public.clients add column if not exists contact_name text default '';
alter table public.clients add column if not exists contact_name_secondary text default '';
alter table public.clients add column if not exists designation text default '';
alter table public.clients add column if not exists email text not null default '';
alter table public.clients add column if not exists email_secondary text default '';
alter table public.clients add column if not exists phone text default '';
alter table public.clients add column if not exists whatsapp text default '';
alter table public.clients add column if not exists city text default '';
alter table public.clients add column if not exists state text default '';
alter table public.clients add column if not exists country text default '';
alter table public.clients add column if not exists postal_code text default '';
alter table public.clients add column if not exists address text default '';
alter table public.clients add column if not exists industry text default '';
alter table public.clients add column if not exists source text default '';
alter table public.clients add column if not exists priority text default 'medium';
alter table public.clients add column if not exists assigned_owner text default '';
alter table public.clients add column if not exists tags text default '';
alter table public.clients add column if not exists notes text default '';
alter table public.clients add column if not exists custom_fields_json jsonb not null default '{}'::jsonb;
alter table public.clients add column if not exists follow_up_date date;
alter table public.clients add column if not exists status text not null default 'active';
alter table public.clients add column if not exists created_by uuid references public.users(id) on delete set null;
alter table public.clients add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.clients add column if not exists created_at timestamptz not null default now();
alter table public.clients add column if not exists updated_at timestamptz not null default now();

update public.clients
set client_name = coalesce(nullif(trim(client_name), ''), nullif(trim(full_name), ''), '')
where client_name is distinct from coalesce(nullif(trim(client_name), ''), nullif(trim(full_name), ''), '');

update public.clients
set full_name = coalesce(nullif(trim(full_name), ''), nullif(trim(client_name), ''), '')
where full_name is distinct from coalesce(nullif(trim(full_name), ''), nullif(trim(client_name), ''), '');

update public.clients
set client_code = coalesce(nullif(trim(client_code), ''), upper(substr(replace(id::text, '-', ''), 1, 6)))
where coalesce(trim(client_code), '') = '';

alter table public.clients alter column client_name set default '';
alter table public.clients alter column full_name set default '';
alter table public.clients alter column email set default '';
alter table public.clients alter column client_name set not null;
alter table public.clients alter column full_name set not null;
alter table public.clients alter column email set not null;

-- Client field manager compatibility
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

create index if not exists idx_client_fields_active on public.client_fields(is_active, sort_order);

-- Letters compatibility
alter table public.letters add column if not exists client_id uuid;
alter table public.letters add column if not exists template_type_id uuid;
alter table public.letters add column if not exists letter_no_manual text default '';
alter table public.letters add column if not exists letter_no_format_override text default '';
alter table public.letters add column if not exists letter_no_pattern_used text default '';
alter table public.letters add column if not exists issue_date date;
alter table public.letters add column if not exists recipient_name text default '';
alter table public.letters add column if not exists recipient_company text default '';
alter table public.letters add column if not exists recipient_department text default '';
alter table public.letters add column if not exists subject text default '';
alter table public.letters add column if not exists body_notes text default '';
alter table public.letters add column if not exists prepared_by text default '';
alter table public.letters add column if not exists approved_by text default '';
alter table public.letters add column if not exists issued_by_user_id uuid references public.users(id) on delete set null;
alter table public.letters add column if not exists issued_by_name text default '';
alter table public.letters add column if not exists remarks text default '';
alter table public.letters add column if not exists rendered_body text default '';
alter table public.letters add column if not exists pdf_file_name text default '';
alter table public.letters add column if not exists pdf_storage_path text default '';
alter table public.letters add column if not exists custom_fields_json jsonb not null default '{}'::jsonb;
alter table public.letters add column if not exists template_snapshot_json jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'letters_client_id_fkey'
  ) then
    alter table public.letters
      add constraint letters_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'letters_template_type_id_fkey'
  ) then
    alter table public.letters
      add constraint letters_template_type_id_fkey
      foreign key (template_type_id) references public.template_types(id) on delete set null;
  end if;
end $$;

-- Template compatibility
alter table public.templates add column if not exists template_type_id uuid references public.template_types(id) on delete set null;
alter table public.templates add column if not exists ref_code text default '';
alter table public.templates add column if not exists default_subject text default '';
alter table public.templates add column if not exists body_template text default '';
alter table public.templates add column if not exists letter_no_pattern text default '';
alter table public.templates add column if not exists design_json jsonb not null default '{}'::jsonb;
