# Database Migrations

This project now has a canonical migration order for a fresh Supabase setup, plus legacy compatibility migrations for older partially-built databases.

**Fresh Setup**

Run these in order:

1. `db/migrations/20260507_0001_schema.sql`
2. `db/migrations/20260507_0002_rpc_next_sequence.sql`
3. `db/migrations/20260507_0003_rls_open_policies.sql`
4. `db/migrations/20260507_0004_seed_client_fields.sql`
5. `db/migrations/20260507_0005_portal_schema_compat.sql`
6. `db/migrations/20260507_0006_letters_hard_fix.sql`
7. `db/migrations/20260507_0007_dynamic_roles_and_modules.sql`
8. `db/migrations/20260507_0008_letters_client_id_nullable.sql`
9. `db/migrations/20260507_0009_auth_profiles_sync.sql`
10. `db/migrations/20260508_0010_seed_letter_ag_template_types.sql`
11. `db/migrations/20260508_0010_user_permission_overrides.sql`
12. `db/migrations/20260509_0011_repair_rls_user_profiles_refs.sql`
13. `db/migrations/20260509_0012_activity_logging_setting.sql`
14. `db/migrations/20260509_0013_admin_user_auth_functions.sql`
15. `db/migrations/20260509_0014_repair_dynamic_permissions_feature_key.sql`
16. `db/migrations/20260509_0015_drop_legacy_role_check_constraints.sql`

**Older DB Compatibility**

If your live database was created from an older version of the project, run the canonical migrations through `20260508_0010_user_permission_overrides.sql`, then run `20260509_0011_repair_rls_user_profiles_refs.sql`, `20260509_0012_activity_logging_setting.sql`, `20260509_0013_admin_user_auth_functions.sql`, `20260509_0014_repair_dynamic_permissions_feature_key.sql`, and `20260509_0015_drop_legacy_role_check_constraints.sql`. The `0011` repair drops old RLS policies that may still reference `public.user_profiles` and recreates clean policies for the current `public.users` role model. The `0012` migration adds the activity-history switch while keeping existing `activity_log` rows unchanged. The `0014` and `0015` repairs remove legacy hardcoded role constraints so dynamic roles can save rows in `role_permissions`. The older `20260507_fix_clients_schema_compat.sql` is kept only as legacy history.

**Supabase Auth**

Supabase Auth itself is not created by these SQL migrations. It is provided by Supabase. This project's migrations only create the app tables that work alongside Auth, especially `users` and role-linked records.

**Canonical Tables**

- `companies`
- `departments`
- `template_types`
- `templates`
- `users`
- `clients`
- `client_fields`
- `letters`
- `sequence_counters`
- `activity_log`
- `reports`
- `role_permissions`
- `roles`
- `permission_modules`
- `app_settings`
- `role_data_scopes`
- `user_permissions`

**RPC**

- `next_sequence(counter_key text)`

**Client Form Flow**

The dynamic investment client form depends on:

- `clients.custom_fields_json`
- `client_fields`
- seeded default rows from `20260507_0004_seed_client_fields.sql`

**Verification**

After running migrations:

1. Confirm the tables above exist.
2. Run `select public.next_sequence('TEST-KEY');` twice and expect `1` then `2`.
3. Confirm `client_fields` has seeded rows such as `client_name`, `phone`, `email`, `employer_name`.
4. Hard refresh the browser if the app was already open.
5. For dynamic role access, confirm this returns no rows:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.role_permissions'::regclass
  and contype = 'c'
  and conname = 'role_permissions_role_check';
```

**Legacy Files**

These older patch files are still kept in the repo for reference/upgrade history, but they are not the canonical fresh-start order:

- `db/migrations/20260507_add_client_fields_dynamic_form.sql`
- `db/migrations/20260507_fix_clients_schema_compat.sql`
