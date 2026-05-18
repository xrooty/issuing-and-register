-- Adds a global activity-history switch.
-- Existing activity_log rows are intentionally preserved.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings
  add column if not exists key text,
  add column if not exists value jsonb not null default 'null'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

insert into public.permission_modules (name) values
  ('activity_settings')
on conflict (name) do nothing;

insert into public.app_settings (key, value) values
  ('activity_logging_enabled', 'true'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_all on public.app_settings;
create policy app_settings_all on public.app_settings for all using (true) with check (true);
