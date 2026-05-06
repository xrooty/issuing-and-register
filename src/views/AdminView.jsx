import { useState } from "react";
import AdminAccessView from "./AdminAccessView";
import ClientFieldsAdminView from "./ClientFieldsAdminView";

export default function AdminView({ stats, allPermissions, currentRole, clientFields, onTogglePermission, onAddClientField, onUpdateClientField, onDeleteClientField }) {
  const [selectedRole, setSelectedRole] = useState("super_admin");
  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">Admin</p><h2>System control panel</h2></div></div>
      <article className="panel">
        <div className="metrics-grid">
          <article className="metric-card"><span className="metric-label">Users</span><strong className="metric-value">{stats.users}</strong></article>
          <article className="metric-card"><span className="metric-label">Clients</span><strong className="metric-value">{stats.clients}</strong></article>
          <article className="metric-card"><span className="metric-label">Reports</span><strong className="metric-value">{stats.reports}</strong></article>
          <article className="metric-card"><span className="metric-label">Activity</span><strong className="metric-value">{stats.activity}</strong></article>
        </div>
      </article>
      <article className="panel">
        <div className="filters">
          <label>Role
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              <option value="super_admin">super_admin</option>
              <option value="admin">admin</option>
              <option value="manager">manager</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
        </div>
      </article>
      <AdminAccessView role={selectedRole} allPermissions={allPermissions} onTogglePermission={onTogglePermission} />
      <ClientFieldsAdminView
        currentRole={currentRole}
        clientFields={clientFields}
        onAddClientField={onAddClientField}
        onUpdateClientField={onUpdateClientField}
        onDeleteClientField={onDeleteClientField}
      />
    </section>
  );
}
