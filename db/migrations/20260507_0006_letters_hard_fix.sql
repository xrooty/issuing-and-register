-- Canonical migration 0006: hard repair for older letters tables
-- Run this when Issue Letter fails because live public.letters is missing current columns.

create extension if not exists pgcrypto;

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid()
);

alter table public.letters add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.letters add column if not exists department_id uuid references public.departments(id) on delete set null;
alter table public.letters add column if not exists template_id uuid references public.templates(id) on delete set null;
alter table public.letters add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.letters add column if not exists template_type_id uuid references public.template_types(id) on delete set null;
alter table public.letters add column if not exists letter_no text not null default '';
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
alter table public.letters add column if not exists created_at timestamptz not null default now();

alter table public.letters alter column letter_no set default '';
alter table public.letters alter column letter_no set not null;
alter table public.letters alter column template_id drop not null;

-- Remove legacy foreign key if letters.template_id points to the old letter_templates table.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'letters_template_id_fkey'
      and conrelid = 'public.letters'::regclass
  ) then
    alter table public.letters drop constraint letters_template_id_fkey;
  end if;
end $$;

-- Clear stale template references from older databases before re-adding the FK.
update public.letters
set template_id = null
where template_id is not null
  and template_id not in (select id from public.templates);

-- Recreate template foreign key against the canonical templates table.
alter table public.letters
  add constraint letters_template_id_fkey
  foreign key (template_id) references public.templates(id) on delete set null;

create index if not exists idx_letters_company_id on public.letters(company_id);
create index if not exists idx_letters_department_id on public.letters(department_id);
create index if not exists idx_letters_template_id on public.letters(template_id);
create index if not exists idx_letters_created_at on public.letters(created_at desc);
