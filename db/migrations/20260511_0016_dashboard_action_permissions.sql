-- Add dashboard action permissions so admins can show/hide top-level actions.
-- These are controlled with the View checkbox in Admin > Permissions.

insert into public.permission_modules (name)
values
  ('dashboard_export_register_csv'),
  ('dashboard_backup_json'),
  ('dashboard_refresh_db')
on conflict (name) do nothing;
