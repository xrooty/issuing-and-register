create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.permission_modules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.roles (name) values
  ('admin')
on conflict (name) do nothing;

update public.users
set role = 'admin'
where role = 'super_admin';

delete from public.roles
where name = 'super_admin';

insert into public.permission_modules (name) values
  ('dashboard'),
  ('companies'),
  ('departments'),
  ('templates'),
  ('issue'),
  ('register'),
  ('clients-create'),
  ('clients-all'),
  ('clients-profile'),
  ('users'),
  ('roles'),
  ('activity'),
  ('admin'),
  ('client_fields')
on conflict (name) do nothing;

alter table public.roles enable row level security;
alter table public.permission_modules enable row level security;

drop policy if exists roles_all on public.roles;
create policy roles_all on public.roles for all using (true) with check (true);

drop policy if exists permission_modules_all on public.permission_modules;
create policy permission_modules_all on public.permission_modules for all using (true) with check (true);
