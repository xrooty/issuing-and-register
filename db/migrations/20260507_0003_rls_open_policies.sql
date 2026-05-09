-- Canonical migration 0003: permissive RLS for quick setup
-- Replace with stricter policies later if needed.

alter table public.companies enable row level security;
alter table public.departments enable row level security;
alter table public.template_types enable row level security;
alter table public.templates enable row level security;
alter table public.letters enable row level security;
alter table public.sequence_counters enable row level security;
alter table public.users enable row level security;
alter table public.activity_log enable row level security;
alter table public.clients enable row level security;
alter table public.client_fields enable row level security;
alter table public.reports enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists companies_all on public.companies;
create policy companies_all on public.companies for all using (true) with check (true);

drop policy if exists departments_all on public.departments;
create policy departments_all on public.departments for all using (true) with check (true);

drop policy if exists template_types_all on public.template_types;
create policy template_types_all on public.template_types for all using (true) with check (true);

drop policy if exists templates_all on public.templates;
create policy templates_all on public.templates for all using (true) with check (true);

drop policy if exists letters_all on public.letters;
create policy letters_all on public.letters for all using (true) with check (true);

drop policy if exists sequence_counters_all on public.sequence_counters;
create policy sequence_counters_all on public.sequence_counters for all using (true) with check (true);

drop policy if exists users_all on public.users;
create policy users_all on public.users for all using (true) with check (true);

drop policy if exists activity_log_all on public.activity_log;
create policy activity_log_all on public.activity_log for all using (true) with check (true);

drop policy if exists clients_all on public.clients;
create policy clients_all on public.clients for all using (true) with check (true);

drop policy if exists client_fields_all on public.client_fields;
create policy client_fields_all on public.client_fields for all using (true) with check (true);

drop policy if exists reports_all on public.reports;
create policy reports_all on public.reports for all using (true) with check (true);

drop policy if exists role_permissions_all on public.role_permissions;
create policy role_permissions_all on public.role_permissions for all using (true) with check (true);
