import { useState } from "react";

export default function RolesView({ users, roles = [], onAddRole, onDeleteRole }) {
  const [newRole, setNewRole] = useState("");
  const counts = roles.map((role) => ({ role, count: users.filter((u) => u.role === role).length }));

  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">Roles</p><h2>Role summary</h2></div></div>
      <article className="panel">
        <div className="button-row" style={{ marginBottom: 12 }}>
          <input type="text" value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="new_role_name" />
          <button className="button button-primary" type="button" onClick={async () => {
            const ok = await onAddRole?.(newRole);
            if (ok) {
              setNewRole("");
            }
          }}
          >
            Add role
          </button>
        </div>
        <div className="metrics-grid">
          {counts.map((item) => (
            <article className="metric-card" key={item.role}>
              <span className="metric-label">{item.role}</span>
              <strong className="metric-value">{item.count}</strong>
              {item.role !== "admin" ? (
                <button className="button button-secondary" type="button" onClick={() => onDeleteRole?.(item.role)}>
                  Delete
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
