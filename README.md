# JZARR Letter Management

A full-featured Supabase-backed letter issuing, registration, CRM and admin system.

## Features

- Dashboard, Companies, Departments, Templates, Issue Letter, Register
- Authentication with Supabase Auth and session guards
- Users list, add, edit, deactivate, `created_by` tracking
- 5-tier RBAC: super_admin → admin → manager → editor → viewer
- Activity Log audit trail for every action
- Reports with CSV export
- Super Admin Panel with impersonation and system settings
- Client Management: clients list, client detail, linked letters, pre-filled issue letter flow
- Letter number auto-generation using `sequence_counters` + `next_sequence` RPC
- Live preview, template snapshots, employee search, bulk delete, CSV export

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Run the project:
   ```bash
   npm run dev
   ```

## Database Schema

See `db/schema.sql`, `db/rls.sql`, and `db/rpc.sql` for full table definitions, policies, and RPC setup.
