import { useState } from "react";
import EmptyState from "../components/EmptyState";

const initial = { email: "", full_name: "", role: "viewer", active: true };

export default function UsersView({ users, permissions, onAddUser, onToggleUserActive }) {
  const [form, setForm] = useState(initial);

  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">Users</p><h2>User management</h2></div></div>
      {permissions?.create && (
      <article className="panel">
        <form className="form-grid" onSubmit={async (e) => { e.preventDefault(); const ok = await onAddUser(form); if (ok) setForm(initial); }}>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required /></label>
          <label>Name<input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} /></label>
          <label>Role<select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="manager">Manager</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></label>
          <button className="button button-primary" type="submit">Add User</button>
        </form>
      </article>
      )}
      <article className="panel">
        {users.length ? <div className="table-wrap"><table><thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {users.map((u) => <tr key={u.id}><td>{u.email}</td><td>{u.full_name}</td><td>{u.role}</td><td>{u.active ? "active" : "inactive"}</td><td>{permissions?.edit ? <button className="button button-secondary" type="button" onClick={() => onToggleUserActive(u.id, !u.active)}>{u.active ? "Disable" : "Enable"}</button> : "-"}</td></tr>)}
        </tbody></table></div> : <EmptyState message="No users found." />}
      </article>
    </section>
  );
}
