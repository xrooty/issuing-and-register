import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";

const ACTIONS = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
];

const SCOPE_OPTIONS = [
  { value: "", label: "Role Default" },
  { value: "own_data", label: "Own Personal Data" },
  { value: "own_department", label: "Own Department" },
  { value: "selected_departments", label: "Selected Departments" },
  { value: "all_departments", label: "All Departments" },
];

const MODULE_LABELS = {
  dashboard: "Dashboard",
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
};

function normalizeRoleName(role) {
  return String(role || "").trim();
}

function cleanDepartments(list = []) {
  return Array.from(new Set(list.map((item) => String(item || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function emptyOverride(module) {
  return {
    id: "",
    module,
    can_view: null,
    can_create: null,
    can_edit: null,
    can_delete: null,
    scope_type: "",
    department_names: [],
  };
}

function normalizeOverride(row = {}) {
  const next = {
    id: row.id || "",
    module: row.module || "",
    can_view: typeof row.can_view === "boolean" ? row.can_view : null,
    can_create: typeof row.can_create === "boolean" ? row.can_create : null,
    can_edit: typeof row.can_edit === "boolean" ? row.can_edit : null,
    can_delete: typeof row.can_delete === "boolean" ? row.can_delete : null,
    scope_type: row.scope_type || "",
    department_names: row.scope_type === "selected_departments" ? cleanDepartments(row.department_names || []) : [],
  };
  if (next.can_create === true || next.can_edit === true || next.can_delete === true) {
    next.can_view = true;
  }
  if (next.can_view === false) {
    next.can_create = false;
    next.can_edit = false;
    next.can_delete = false;
  }
  return {
    ...next,
  };
}

function sameDraft(left = [], right = []) {
  return JSON.stringify(left.map(normalizeOverride)) === JSON.stringify(right.map(normalizeOverride));
}

function overrideLabel(value) {
  if (value === true) return "Grant";
  if (value === false) return "Deny";
  return "Role Default";
}

function overrideClass(value) {
  if (value === true) return "button-primary";
  if (value === false) return "button-secondary";
  return "button-secondary";
}

function cycle(value) {
  if (value === null) return true;
  if (value === true) return false;
  return null;
}

function buildUserDraft(userId, modules, userPermissions) {
  const map = {};
  (userPermissions || []).forEach((row) => {
    if (row.user_id === userId) {
      map[row.module] = normalizeOverride(row);
    }
  });
  return modules.map((module) => ({ ...emptyOverride(module), ...(map[module] || {}) }));
}

export default function AdminRoleUsersView({
  role,
  users = [],
  modules = [],
  userPermissions = [],
  departments = [],
  onSaveUserPermissionOverrides,
}) {
  const roleUsers = useMemo(() => users.filter((user) => normalizeRoleName(user.role) === role), [role, users]);
  const isAdminRole = normalizeRoleName(role) === "admin";
  const [selectedUserId, setSelectedUserId] = useState("");
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roleUsers.length || isAdminRole) {
      setSelectedUserId("");
      return;
    }
    if (!roleUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(roleUsers[0].id);
    }
  }, [isAdminRole, roleUsers, selectedUserId]);

  const selectedUser = roleUsers.find((user) => user.id === selectedUserId) || null;
  const initialRows = useMemo(
    () => (selectedUserId ? buildUserDraft(selectedUserId, modules, userPermissions) : []),
    [modules, selectedUserId, userPermissions],
  );
  const dirtyCount = rows.filter((row, index) => !sameDraft([row], [initialRows[index] || emptyOverride(row.module)])).length;
  const isDirty = dirtyCount > 0;
  const hasAnyOverride = initialRows.some((row) => (
    typeof row.can_view === "boolean"
    || typeof row.can_create === "boolean"
    || typeof row.can_edit === "boolean"
    || typeof row.can_delete === "boolean"
    || !!row.scope_type
  ));

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const overrideCounts = useMemo(() => userPermissions.reduce((map, row) => {
    map[row.user_id] = (map[row.user_id] || 0) + 1;
    return map;
  }, {}), [userPermissions]);

  function patchRow(module, patch) {
    setRows((current) => current.map((row) => (row.module === module ? normalizeOverride({ ...row, ...patch }) : row)));
  }

  function toggleDepartment(module, departmentName) {
    setRows((current) => current.map((row) => {
      if (row.module !== module) return row;
      const selected = new Set(row.department_names || []);
      if (selected.has(departmentName)) selected.delete(departmentName);
      else selected.add(departmentName);
      return normalizeOverride({ ...row, scope_type: "selected_departments", department_names: Array.from(selected) });
    }));
  }

  function resetDraft() {
    setRows(modules.map((module) => emptyOverride(module)));
  }

  async function save() {
    if (!selectedUserId || !isDirty || isAdminRole) return;
    setSaving(true);
    await onSaveUserPermissionOverrides?.(selectedUserId, rows);
    setSaving(false);
  }

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Overrides</p>
          <h3>User overrides: {role}</h3>
        </div>
        <div className="button-row">
          <button className="button button-secondary" type="button" disabled={!selectedUser || saving || (!isDirty && !hasAnyOverride)} onClick={resetDraft}>Reset Draft</button>
          <button className="button button-primary" type="button" disabled={!selectedUser || saving || !isDirty || isAdminRole} onClick={save}>{saving ? "Saving..." : `Save (${dirtyCount})`}</button>
        </div>
      </div>
      {isAdminRole ? <p className="form-hint">Admin users always have full access, so overrides are disabled for this role.</p> : <p className="form-hint">Click a permission cell to cycle Role Default, Grant, and Deny. Save applies only the selected user override.</p>}

      {!isAdminRole && roleUsers.length ? (
        <>
          <div className="button-row" style={{ marginBottom: 16 }}>
            {roleUsers.map((user) => (
              <button
                key={user.id}
                className={`button ${selectedUserId === user.id ? "button-primary" : "button-secondary"}`}
                type="button"
                onClick={() => setSelectedUserId(user.id)}
              >
                {user.full_name || user.email || user.id}
                {overrideCounts[user.id] ? ` (${overrideCounts[user.id]})` : ""}
              </button>
            ))}
          </div>

          {selectedUser ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Module</th><th>Data Scope Override</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.module}>
                      <td>{MODULE_LABELS[row.module] || row.module}</td>
                      <td>
                        <select
                          value={row.scope_type || ""}
                          disabled={saving}
                          onChange={(event) => patchRow(row.module, {
                            scope_type: event.target.value,
                            department_names: event.target.value === "selected_departments" ? row.department_names : [],
                          })}
                        >
                          {SCOPE_OPTIONS.map((option) => <option key={option.value || "default"} value={option.value}>{option.label}</option>)}
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
                                  disabled={saving}
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
                          <button
                            className={`button ${overrideClass(row[action.key])}`}
                            type="button"
                            disabled={saving}
                            onClick={() => patchRow(row.module, { [action.key]: cycle(row[action.key]) })}
                            style={{ minWidth: 104, justifyContent: "center" }}
                          >
                            {overrideLabel(row[action.key])}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : !isAdminRole ? (
        <EmptyState message="No users found for this role." />
      ) : null}
    </article>
  );
}
