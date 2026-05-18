import { Fragment, useState } from "react";
import EmptyState from "../components/EmptyState";

const initial = { email: "", password: "", full_name: "", role: "", active: true, createLogin: true };
const passwordInitial = { newPassword: "", confirmPassword: "" };

export default function UsersView({
  users,
  roles = [],
  permissions,
  canResetPasswords = false,
  onAddUser,
  onUpdateUser,
  onToggleUserActive,
  onDeleteUser,
  onResetUserPassword,
}) {
  const [form, setForm] = useState(initial);
  const [editingUserId, setEditingUserId] = useState("");
  const [editForm, setEditForm] = useState({ full_name: "", role: "", active: true });
  const [resettingUserId, setResettingUserId] = useState("");
  const [passwordForm, setPasswordForm] = useState(passwordInitial);

  function startEditing(user) {
    setEditingUserId(user.id);
    setEditForm({
      full_name: user.full_name || "",
      role: user.role || "",
      active: user.active !== false,
    });
  }

  function cancelEditing() {
    setEditingUserId("");
    setEditForm({ full_name: "", role: "", active: true });
  }

  async function saveEditing(userId) {
    const ok = await onUpdateUser?.(userId, editForm);
    if (ok) {
      cancelEditing();
    }
  }

  function startPasswordReset(userId) {
    setResettingUserId(userId);
    setPasswordForm(passwordInitial);
  }

  function cancelPasswordReset() {
    setResettingUserId("");
    setPasswordForm(passwordInitial);
  }

  async function savePasswordReset(userId) {
    const ok = await onResetUserPassword?.(userId, passwordForm);
    if (ok) {
      cancelPasswordReset();
    }
  }

  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">Users</p><h2>User management</h2></div></div>
      {permissions?.create && (
      <article className="panel">
        <form className="form-grid" onSubmit={async (e) => { e.preventDefault(); const ok = await onAddUser(form); if (ok) setForm(initial); }}>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} minLength={6} autoComplete="new-password" required /></label>
          <label>Name<input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} /></label>
          <label>
            Role
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} required>
              <option value="">Select role</option>
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.createLogin}
              onChange={(e) => setForm((p) => ({ ...p, createLogin: e.target.checked }))}
              style={{ width: "auto" }}
            />
            Create login in Supabase Auth
          </label>
          <p className="form-hint">Keep this checked for users who need to sign in. The same email is saved in Supabase Auth and public.users with the selected role.</p>
          <button className="button button-primary" type="submit">Add User</button>
        </form>
      </article>
      )}
      <article className="panel">
        {users.length ? <div className="table-wrap"><table><thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {users.map((u) => {
            const isEditing = editingUserId === u.id;
            const isResettingPassword = resettingUserId === u.id;
            return (
              <Fragment key={u.id}>
                <tr>
                  <td>{u.email}</td>
                  <td>
                    {isEditing ? (
                      <input
                        className="table-input"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm((current) => ({ ...current, full_name: e.target.value }))}
                      />
                    ) : u.full_name}
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        className="table-input"
                        value={editForm.role}
                        onChange={(e) => setEditForm((current) => ({ ...current, role: e.target.value }))}
                      >
                        <option value="">Select role</option>
                        {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    ) : u.role}
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        className="table-input"
                        value={editForm.active ? "active" : "inactive"}
                        onChange={(e) => setEditForm((current) => ({ ...current, active: e.target.value === "active" }))}
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    ) : (u.active ? "active" : "inactive")}
                  </td>
                  <td>
                    <div className="table-actions">
                      {isEditing ? (
                        <>
                          <button className="button button-primary" type="button" onClick={() => saveEditing(u.id)}>Save</button>
                          <button className="button button-secondary" type="button" onClick={cancelEditing}>Cancel</button>
                        </>
                      ) : (
                        <>
                          {permissions?.edit && <button className="button button-secondary" type="button" onClick={() => startEditing(u)}>Edit</button>}
                          {permissions?.edit && <button className="button button-secondary" type="button" onClick={() => onToggleUserActive?.(u.id, !u.active)}>{u.active ? "Disable" : "Enable"}</button>}
                          {canResetPasswords && <button className="button button-secondary" type="button" onClick={() => startPasswordReset(u.id)}>Reset Password</button>}
                          {permissions?.delete && <button className="button button-secondary button-danger" type="button" onClick={() => onDeleteUser?.(u.id)}>Delete</button>}
                          {!permissions?.edit && !permissions?.delete && !canResetPasswords ? "-" : null}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {isResettingPassword && (
                  <tr>
                    <td colSpan={5}>
                      <form className="inline-password-form" onSubmit={async (e) => { e.preventDefault(); await savePasswordReset(u.id); }}>
                        <label>
                          New password
                          <input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm((current) => ({ ...current, newPassword: e.target.value }))}
                            minLength={6}
                            autoComplete="new-password"
                            required
                          />
                        </label>
                        <label>
                          Confirm new password
                          <input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm((current) => ({ ...current, confirmPassword: e.target.value }))}
                            minLength={6}
                            autoComplete="new-password"
                            required
                          />
                        </label>
                        <div className="table-actions">
                          <button className="button button-primary" type="submit">Save Password</button>
                          <button className="button button-secondary" type="button" onClick={cancelPasswordReset}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody></table></div> : <EmptyState message="No users found." />}
      </article>
    </section>
  );
}
