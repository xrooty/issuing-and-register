-- Add user-specific auth security data and global auth feature settings.

create table if not exists public.user_security (
  user_id uuid primary key references public.users(id) on delete cascade,
  two_factor_enabled boolean not null default false,
  two_factor_secret text default '',
  two_factor_verified_at timestamptz,
  email_confirmation_enabled boolean not null default false,
  email_confirmation_code text default '',
  email_confirmation_sent_at timestamptz,
  email_confirmation_expires_at timestamptz,
  email_confirmed_at timestamptz,
  reset_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_security_two_factor_enabled on public.user_security(two_factor_enabled);
create index if not exists idx_user_security_email_confirmation_enabled on public.user_security(email_confirmation_enabled);

insert into public.user_security (user_id)
select public.users.id
from public.users
left join public.user_security on public.user_security.user_id = public.users.id
where public.user_security.user_id is null;

insert into public.app_settings(key, value, updated_at)
values
  ('auth_2fa_enabled_global', 'false'::jsonb, now()),
  ('auth_email_confirmation_enabled_global', 'false'::jsonb, now())
on conflict (key) do nothing;

alter table public.user_security enable row level security;

drop policy if exists user_security_all on public.user_security;
drop policy if exists user_security_self_read on public.user_security;
drop policy if exists user_security_self_write on public.user_security;
drop policy if exists user_security_admin_all on public.user_security;

create policy user_security_self_read on public.user_security for select
using (user_id = auth.uid());

create policy user_security_self_write on public.user_security for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy user_security_admin_all on public.user_security for all
using (
  exists (
    select 1 from public.users
    where public.users.id = auth.uid()
      and public.users.active = true
      and public.users.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.users
    where public.users.id = auth.uid()
      and public.users.active = true
      and public.users.role = 'admin'
  )
);
