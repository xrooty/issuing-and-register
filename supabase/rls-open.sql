-- Optional: Open policies for browser-anon mode
-- Run only if your tables have RLS enabled and writes are failing.
-- WARNING: This is permissive for quick setup, not enterprise security.

alter table companies enable row level security;
alter table departments enable row level security;
alter table template_types enable row level security;
alter table templates enable row level security;
alter table letters enable row level security;
alter table sequence_counters enable row level security;

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
