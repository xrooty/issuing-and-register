# Database Migrations (Repo-Aligned)

This migration set is aligned to `xrooty/issuing-and-register` workflows, and also includes restored admin modules (`clients`, `users`, `activity_log`, `reports`).

## Run Order

1. Run `db/schema.sql`
2. Run `db/rpc.sql`
3. Run `db/rls.sql`

## Canonical Tables

- `companies`
- `departments`
- `template_types`
- `templates`
- `letters`
- `sequence_counters`
- `clients`
- `users`
- `activity_log`
- `reports`

## CRM + Client Letter Linkage

- `clients` now includes CRM profile fields:
  `client_name, contact_name_secondary, designation, email_secondary, whatsapp, city, state, country, postal_code, address, industry, source, priority, assigned_owner, tags, notes, follow_up_date`
- `letters` now links clients:
  `client_id`
- `letters` now records issuer metadata:
  `issued_by_user_id, issued_by_name`

## Required Letter Numbering Fields

- Company: `short_code`, `letter_no_pattern`
- Department: `code`, `letter_no_pattern`
- Template: `ref_code`, `letter_no_pattern`
- Letter: `letter_no`, `letter_no_manual`, `letter_no_format_override`, `letter_no_pattern_used`

## Required Template/Versioning Fields

- Template: `body_template`, `design_json`, `template_type_id`
- Letter: `template_snapshot_json`, `custom_fields_json`, `rendered_body`, `pdf_file_name`, `pdf_storage_path`

## RPC

`next_sequence(counter_key text)` is conflict-safe via upsert and should be used for department-level sequence keys.

## Verify After Migration

1. Tables exist:
   - `companies, departments, template_types, templates, employees, letters, sequence_counters, users, activity_log`
   - `companies, departments, template_types, templates, letters, sequence_counters, clients, users, activity_log, reports`
2. RPC works:
   - `select next_sequence('TEST-KEY');`
   - run twice, expect `1` then `2`
3. RLS enabled for the canonical tables above.
