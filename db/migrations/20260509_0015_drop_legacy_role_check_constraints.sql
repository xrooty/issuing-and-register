-- Drop legacy hardcoded role CHECK constraints so dynamic roles can save permissions.
-- Older databases may still reject custom roles in role_permissions.role.

alter table public.users drop constraint if exists users_role_check;
alter table public.role_permissions drop constraint if exists role_permissions_role_check;
alter table public.role_data_scopes drop constraint if exists role_data_scopes_role_check;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select
      conrelid::regclass as table_name,
      conname
    from pg_constraint
    where contype = 'c'
      and conrelid in (
        'public.users'::regclass,
        'public.role_permissions'::regclass,
        'public.role_data_scopes'::regclass
      )
      and (
        conname in (
          'users_role_check',
          'role_permissions_role_check',
          'role_data_scopes_role_check'
        )
        or pg_get_constraintdef(oid) ~* '(^|[^a-z_])role([^a-z_]|$)'
      )
  loop
    execute format('alter table %s drop constraint if exists %I', constraint_record.table_name, constraint_record.conname);
  end loop;
end;
$$;
