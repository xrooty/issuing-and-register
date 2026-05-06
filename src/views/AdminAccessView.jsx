import { useMemo } from "react";

const MODULES = ["clients", "users", "roles", "admin", "reports", "activity", "companies", "departments", "templates", "issue", "register"];
const ACTIONS = ["view", "create", "edit", "delete"];

export default function AdminAccessView({ role, allPermissions, onTogglePermission }) {
  const rows = useMemo(() => {
    const map = allPermissions[role] || {};
    return MODULES.map((module) => ({
      module,
      can_view: map[module]?.view ?? false,
      can_create: map[module]?.create ?? false,
      can_edit: map[module]?.edit ?? false,
      can_delete: map[module]?.delete ?? false,
    }));
  }, [allPermissions, role]);

  return (
    <article className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Access Matrix</p><h3>Role permissions: {role}</h3></div></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Module</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.module}>
                <td>{row.module}</td>
                {ACTIONS.map((action) => (
                  <td key={`${row.module}-${action}`}>
                    <input
                      type="checkbox"
                      checked={row[`can_${action}`]}
                      onChange={(e) => onTogglePermission(role, row.module, action, e.target.checked)}
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
