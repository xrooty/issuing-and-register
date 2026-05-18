-- Migration: 20260507_fix_clients_schema_compat
-- Purpose: align existing live DB schema with current app expectations

-- Ensure required extension for UUID generation exists.
create extension if not exists pgcrypto;

-- Ensure clients table exists.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid()
);

-- Ensure all app-expected client columns exist.
alter table public.clients add column if not exists client_name text not null default '';
alter table public.clients add column if not exists full_name text not null default '';
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
alter table public.clients add column if not exists follow_up_date date;
alter table public.clients add column if not exists status text not null default 'active';
alter table public.clients add column if not exists created_by uuid references public.users(id) on delete set null;
alter table public.clients add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.clients add column if not exists created_at timestamptz not null default now();
alter table public.clients add column if not exists updated_at timestamptz not null default now();
alter table public.clients add column if not exists custom_fields_json jsonb not null default '{}'::jsonb;

-- Keep old/new naming compatible so inserts from either shape work.
update public.clients
set client_name = coalesce(nullif(trim(client_name), ''), nullif(trim(full_name), ''), '')
where client_name is distinct from coalesce(nullif(trim(client_name), ''), nullif(trim(full_name), ''), '');

update public.clients
set full_name = coalesce(nullif(trim(full_name), ''), nullif(trim(client_name), ''), '')
where full_name is distinct from coalesce(nullif(trim(full_name), ''), nullif(trim(client_name), ''), '');

alter table public.clients alter column client_name set default '';
alter table public.clients alter column full_name set default '';
alter table public.clients alter column client_name set not null;
alter table public.clients alter column full_name set not null;

-- Ensure client_fields table exists for dynamic field manager.
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

-- RLS policies (kept open to match existing project approach).
alter table public.clients enable row level security;
alter table public.client_fields enable row level security;

drop policy if exists clients_all on public.clients;
create policy clients_all on public.clients for all using (true) with check (true);

drop policy if exists client_fields_all on public.client_fields;
create policy client_fields_all on public.client_fields for all using (true) with check (true);
