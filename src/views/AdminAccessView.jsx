import { useEffect, useMemo, useState } from "react";

const ACTIONS = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
];

const SCOPE_OPTIONS = [
  { value: "own_data", label: "Own Personal Data" },
  { value: "own_department", label: "Own Department" },
  { value: "selected_departments", label: "Selected Department" },
];

const MODULE_LABELS = {
  dashboard: "Dashboard",
  dashboard_export_register_csv: "Export Register CSV",
  dashboard_backup_json: "Backup JSON",
  dashboard_refresh_db: "Refresh DB",
  companies: "Companies",
  departments: "Departments",
  templates: "Templates",
  issue: "Issue Letter",
  register: "Register",
  "clients-create": "Create Client",
  "clients-all": "All Clients",
  "clients-profile": "Client Profile",
  users: "Users",
  roles: "Roles",
  activity: "Activity",
  activity_settings: "Activity History Control",
  admin: "Admin",
  client_fields: "Client Fields",
};

function cleanDepartments(list = []) {
  return Array.from(new Set(list.map((item) => String(item || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function normalizeRoleName(role) {
  return String(role || "").trim();
}

function normalizeScopeType(scopeType) {
  return ["own_data", "own_department", "selected_departments"].includes(scopeType) ? scopeType : "own_department";
}

function buildDraft({ role, modules, allPermissions, roleDataScopes }) {
  const permissionMap = allPermissions[role] || {};
  const scopeMap = {};
  (roleDataScopes || []).forEach((row) => {
    if (normalizeRoleName(row.role) === role) {
      scopeMap[row.module] = row;
    }
  });

  return modules.map((module) => {
    const permissions = permissionMap[module] || {};
    const scope = scopeMap[module] || {};
    return {
      id: permissions.id || "",
      module,
      label: MODULE_LABELS[module] || module,
      can_view: !!permissions.view,
      can_create: !!permissions.create,
      can_edit: !!permissions.edit,
      can_delete: !!permissions.delete,
      scope_id: scope.id || "",
      scope_type: normalizeScopeType(scope.scope_type),
      department_names: normalizeScopeType(scope.scope_type) === "selected_departments" ? cleanDepartments(scope.department_names || []) : [],
    };
  });
}

function sameDraft(left = [], right = []) {
  return JSON.stringify(left.map((row) => ({
    module: row.module,
    can_view: !!row.can_view,
    can_create: !!row.can_create,
    can_edit: !!row.can_edit,
    can_delete: !!row.can_delete,
    scope_type: normalizeScopeType(row.scope_type),
    department_names: normalizeScopeType(row.scope_type) === "selected_departments" ? cleanDepartments(row.department_names || []) : [],
  }))) === JSON.stringify(right.map((row) => ({
    module: row.module,
    can_view: !!row.can_view,
    can_create: !!row.can_create,
    can_edit: !!row.can_edit,
    can_delete: !!row.can_delete,
    scope_type: normalizeScopeType(row.scope_type),
    department_names: normalizeScopeType(row.scope_type) === "selected_departments" ? cleanDepartments(row.department_names || []) : [],
  })));
}

export default function AdminAccessView({
  role,
  modules = [],
  allPermissions = {},
  roleDataScopes = [],
  departments = [],
  onSaveRoleAccess,
}) {
  const isAdminRole = normalizeRoleName(role) === "admin";
  const initialRows = useMemo(
    () => buildDraft({ role, modules, allPermissions, roleDataScopes }),
    [allPermissions, modules, role, roleDataScopes],
  );
  const [rows, setRows] = useState(initialRows);
  const [saving, setSaving] = useState(false);
  const isDirty = !sameDraft(rows, initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  function patchRow(module, patch) {
    setRows((current) => current.map((row) => {
      if (row.module !== module) return row;
      const next = { ...row, ...patch };
      if (next.can_create || next.can_edit || next.can_delete) next.can_view = true;
      if (!next.can_view) {
        next.can_create = false;
        next.can_edit = false;
        next.can_delete = false;
      }
      return next;
    }));
  }

  function setAll(value) {
    setRows((current) => current.map((row) => ({
      ...row,
      can_view: value,
      can_create: value,
      can_edit: value,
      can_delete: value,
    })));
  }

  function toggleDepartment(module, departmentName) {
    setRows((current) => current.map((row) => {
      if (row.module !== module) return row;
      const selected = new Set(row.department_names || []);
      if (selected.has(departmentName)) selected.delete(departmentName);
      else selected.add(departmentName);
      return { ...row, scope_type: "selected_departments", department_names: cleanDepartments(Array.from(selected)) };
    }));
  }

  async function save() {
    if (isAdminRole || !isDirty) return;
    setSaving(true);
    await onSaveRoleAccess?.(
      role,
      rows.map((row) => ({
        id: row.id,
        module: row.module,
        can_view: row.can_view,
        can_create: row.can_create,
        can_edit: row.can_edit,
        can_delete: row.can_delete,
      })),
      rows.map((row) => ({
        id: row.scope_id,
        module: row.module,
        scope_type: row.scope_type,
        department_names: row.scope_type === "selected_departments" ? cleanDepartments(row.department_names) : [],
      })),
    );
    setSaving(false);
  }

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Permissions</p>
          <h3>Role permissions: {role}</h3>
        </div>
        <div className="button-row">
          <button className="button button-secondary" type="button" disabled={isAdminRole || saving} onClick={() => setAll(true)}>Grant All</button>
          <button className="button button-secondary" type="button" disabled={isAdminRole || saving} onClick={() => setAll(false)}>Revoke All</button>
          <button className="button button-primary" type="button" disabled={isAdminRole || !isDirty || saving} onClick={save}>{saving ? "Saving..." : "Save Changes"}</button>
          <button className="button button-secondary" type="button" disabled={!isDirty || saving} onClick={() => setRows(initialRows)}>Reset Draft</button>
        </div>
      </div>
      {isAdminRole ? <p className="form-hint">Admin always has full access. Select another role to edit permissions.</p> : <p className="form-hint">Draft mode is active. Update permissions or data scope, then save changes.</p>}
      <div className="table-wrap admin-permissions-table">
        <table>
          <thead><tr><th>Module</th><th>Data Scope</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.module}>
                <td>{row.label}</td>
                <td>
                  <select
                    value={row.scope_type}
                    disabled={isAdminRole || saving}
                    onChange={(event) => patchRow(row.module, {
                      scope_type: event.target.value,
                      department_names: event.target.value === "selected_departments" ? row.department_names : [],
                    })}
                  >
                    {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {row.scope_type === "selected_departments" ? (
                    <div className="button-row" style={{ marginTop: 8 }}>
                      {departments.length ? departments.map((departmentName) => {
                        const on = row.department_names.includes(departmentName);
                        return (
                          <button
                            key={departmentName}
                            className={`button ${on ? "button-primary" : "button-secondary"}`}
                            type="button"
                            disabled={isAdminRole || saving}
                            onClick={() => toggleDepartment(row.module, departmentName)}
                            style={{ padding: "4px 8px", fontSize: 11 }}
                          >
                            {departmentName}
                          </button>
                        );
                      }) : <span className="form-hint">No departments found.</span>}
                    </div>
                  ) : null}
                </td>
                {ACTIONS.map((action) => (
                  <td key={`${row.module}-${action.key}`}>
                    <input
                      type="checkbox"
                      checked={row[action.key]}
                      disabled={isAdminRole || saving}
                      onChange={(event) => patchRow(row.module, { [action.key]: event.target.checked })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
