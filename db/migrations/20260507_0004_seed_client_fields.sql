-- Canonical migration 0004: seed default dynamic client fields

insert into public.client_fields (
  field_key,
  label,
  input_type,
  options_json,
  is_required,
  is_active,
  sort_order,
  is_system
)
values
  ('client_name', 'Client Name', 'text', '[]'::jsonb, true, true, 1, true),
  ('phone', 'Phone', 'text', '[]'::jsonb, true, true, 2, true),
  ('email', 'Email', 'email', '[]'::jsonb, true, true, 3, true),
  ('cnic', 'CNIC / National ID', 'text', '[]'::jsonb, false, true, 4, false),
  ('address', 'Address', 'textarea', '[]'::jsonb, false, true, 5, true),
  ('job_title', 'Job Title', 'text', '[]'::jsonb, false, true, 6, false),
  ('employer_name', 'Employer / Business Name', 'text', '[]'::jsonb, false, true, 7, false),
  ('source_of_income', 'Source of Income', 'text', '[]'::jsonb, false, true, 8, false),
  ('monthly_income_range', 'Monthly Income Range', 'text', '[]'::jsonb, false, true, 9, false),
  ('bank_name', 'Bank Name', 'text', '[]'::jsonb, false, true, 10, false),
  ('account_title', 'Account Title', 'text', '[]'::jsonb, false, true, 11, false),
  ('account_number', 'Account Number', 'text', '[]'::jsonb, false, true, 12, false),
  ('iban', 'IBAN', 'text', '[]'::jsonb, false, true, 13, false),
  ('notes', 'Notes', 'textarea', '[]'::jsonb, false, true, 14, true),
  ('status', 'Status', 'select', '["active","on_hold","closed"]'::jsonb, false, true, 15, true)
on conflict (field_key) do update
set
  label = excluded.label,
  input_type = excluded.input_type,
  options_json = excluded.options_json,
  is_required = excluded.is_required,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  is_system = excluded.is_system,
  updated_at = now();

