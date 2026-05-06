export default function RolesView({ users }) {
  const roles = ["super_admin", "admin", "manager", "editor", "viewer"];
  const counts = roles.map((role) => ({ role, count: users.filter((u) => u.role === role).length }));

  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">Roles</p><h2>Role summary</h2></div></div>
      <article className="panel">
        <div className="metrics-grid">
          {counts.map((item) => (
            <article className="metric-card" key={item.role}>
              <span className="metric-label">{item.role}</span>
              <strong className="metric-value">{item.count}</strong>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
