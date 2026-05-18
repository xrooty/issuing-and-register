-- Migration: 20260507_add_client_fields_dynamic_form
-- Purpose: add dynamic client form field support

-- 1) Add dynamic custom field storage to clients
alter table public.clients
add column if not exists custom_fields_json jsonb not null default '{}'::jsonb;

-- 2) Create dynamic client field definitions table
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

create index if not exists idx_client_fields_active
on public.client_fields(is_active, sort_order);

-- 3) Enable RLS + open policy (matches existing project policy style)
alter table public.client_fields enable row level security;

drop policy if exists client_fields_all on public.client_fields;
create policy client_fields_all
on public.client_fields
for all
using (true)
with check (true);
