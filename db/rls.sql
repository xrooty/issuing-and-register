-- Optional: Open policies for browser-anon mode
-- Run only if your tables have RLS enabled and writes are failing.
-- WARNING: This is permissive for quick setup, not enterprise security.

alter table companies enable row level security;
alter table departments enable row level security;
alter table template_types enable row level security;
alter table templates enable row level security;
alter table letters enable row level security;
alter table sequence_counters enable row level security;
alter table users enable row level security;
alter table activity_log enable row level security;
alter table clients enable row level security;
alter table client_fields enable row level security;
alter table reports enable row level security;
alter table role_permissions enable row level security;

drop policy if exists companies_all on companies;
create policy companies_all on companies for all using (true) with check (true);

drop policy if exists departments_all on departments;
create policy departments_all on departments for all using (true) with check (true);

drop policy if exists template_types_all on template_types;
create policy template_types_all on template_types for all using (true) with check (true);

drop policy if exists templates_all on templates;
create policy templates_all on templates for all using (true) with check (true);

drop policy if exists letters_all on letters;
create policy letters_all on letters for all using (true) with check (true);

drop policy if exists sequence_counters_all on sequence_counters;
create policy sequence_counters_all on sequence_counters for all using (true) with check (true);

drop policy if exists users_all on users;
create policy users_all on users for all using (true) with check (true);

drop policy if exists activity_log_all on activity_log;
create policy activity_log_all on activity_log for all using (true) with check (true);

drop policy if exists clients_all on clients;
create policy clients_all on clients for all using (true) with check (true);

drop policy if exists client_fields_all on client_fields;
create policy client_fields_all on client_fields for all using (true) with check (true);

drop policy if exists reports_all on reports;
create policy reports_all on reports for all using (true) with check (true);

drop policy if exists role_permissions_all on role_permissions;
create policy role_permissions_all on role_permissions for all using (true) with check (true);
