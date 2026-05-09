import { useEffect, useState } from "react";
import AdminAccessView from "./AdminAccessView";
import AdminRoleUsersView from "./AdminRoleUsersView";

export default function AdminView({
  stats,
  roles = [],
  modules = [],
  users = [],
  allPermissions = {},
  roleDataScopes = [],
  userPermissions = [],
  departments = [],
  activityLoggingEnabled = true,
  canManageAccess = false,
  canManageActivityLogging = false,
  onSaveRoleAccess,
  onSaveUserPermissionOverrides,
  onUpdateActivityLoggingEnabled,
}) {
  const [tab, setTab] = useState("permissions");
  const [selectedRole, setSelectedRole] = useState(roles.find((role) => role !== "admin") || roles[0] || "admin");
  const [savingActivitySetting, setSavingActivitySetting] = useState(false);
  useEffect(() => {
    if (roles.length && !roles.includes(selectedRole)) {
      setSelectedRole(roles.find((role) => role !== "admin") || roles[0]);
    }
  }, [roles, selectedRole]);
  const activeTab = tab === "overrides" ? "overrides" : "permissions";
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
      {canManageActivityLogging ? (
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Activity History</p>
              <h3>History storage</h3>
            </div>
            <button
              className={`button ${activityLoggingEnabled ? "button-primary" : "button-secondary"}`}
              type="button"
              disabled={savingActivitySetting}
              onClick={async () => {
                setSavingActivitySetting(true);
                await onUpdateActivityLoggingEnabled?.(!activityLoggingEnabled);
                setSavingActivitySetting(false);
              }}
            >
              {savingActivitySetting ? "Saving..." : activityLoggingEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <p className="form-hint">
            Existing activity rows stay saved. This switch only controls whether new history entries are stored.
          </p>
        </article>
      ) : null}
      {canManageAccess ? (
        <>
          <article className="panel">
            <div className="button-row" style={{ marginBottom: 16 }}>
              <button className={`button ${activeTab === "permissions" ? "button-primary" : "button-secondary"}`} type="button" onClick={() => setTab("permissions")}>
                Permissions
              </button>
              <button className={`button ${activeTab === "overrides" ? "button-primary" : "button-secondary"}`} type="button" onClick={() => setTab("overrides")}>
                Overrides
              </button>
            </div>
            <div className="filters">
              <label>Role
                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                  {roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>
            </div>
          </article>
          {activeTab === "permissions" ? (
            <AdminAccessView
              role={selectedRole}
              modules={modules}
              allPermissions={allPermissions}
              roleDataScopes={roleDataScopes}
              departments={departments}
              onSaveRoleAccess={onSaveRoleAccess}
            />
          ) : (
            <AdminRoleUsersView
              role={selectedRole}
              users={users}
              modules={modules}
              userPermissions={userPermissions}
              departments={departments}
              onSaveUserPermissionOverrides={onSaveUserPermissionOverrides}
            />
          )}
        </>
      ) : !canManageActivityLogging ? (
        <article className="panel">
          <p className="form-hint">You do not have access to admin settings.</p>
        </article>
      ) : null}
    </section>
  );
}
