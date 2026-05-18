import { Fragment, useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import PaginationControls from "../components/PaginationControls";
import { EMAIL_CONFIRMATION_CODE_TTL_MINUTES, normalizeChallengeCode } from "../utils/authSecurity";

const initial = { email: "", password: "", full_name: "", role: "", department_name: "", active: true };
const passwordInitial = { newPassword: "", confirmPassword: "" };

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" focusable="false">
      <path
        d="M13.9 2.3a2.3 2.3 0 0 1 3.2 3.2l-8 8a3 3 0 0 1-1.3.8l-3.4.9.9-3.4a3 3 0 0 1 .8-1.3l8-8Zm1.8 1.4a1 1 0 0 0-1.4 0l-1 1 1.4 1.4 1-1a1 1 0 0 0 0-1.4ZM6.2 11.8l-.4 1.6 1.6-.4 6.2-6.2-1.2-1.2-6.2 6.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M6.2 1.5h3.6l.5 1.2h2.3v1.4H3.4V2.7h2.3l.5-1.2Zm-.9 4.1h1.4v6.1H5.3V5.6Zm4 0h1.4v6.1H9.3V5.6Zm-2 0h1.4v6.1H7.3V5.6Zm-2.9-.1h7.2l-.5 8a1.3 1.3 0 0 1-1.3 1.2H6.2a1.3 1.3 0 0 1-1.3-1.2l-.5-8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function UsersView({
  users,
  userSecurityByUserId = {},
  roles = [],
  departments = [],
  permissions,
  canResetPasswords = false,
  twoFactorEnabledGlobal = false,
  emailConfirmationEnabledGlobal = false,
  pendingUserCreationEmail = "",
  onAddUser,
  onRequestAddUserEmailConfirmation,
  onConfirmAddUserEmailConfirmation,
  onCancelAddUserEmailConfirmation,
  onUpdateUser,
  onToggleUserActive,
  onDeleteUser,
  onResetUserPassword,
  onToggleUserTwoFactor,
  onResetUserTwoFactor,
  onToggleUserEmailConfirmation,
  onResendUserEmailConfirmation,
  onVerifyUserEmailConfirmation,
}) {
  const departmentOptions = useMemo(
    () => Array.from(new Set((departments || []).map((department) => String(department.name || department || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [departments],
  );
  const [form, setForm] = useState(initial);
  const [editingUserId, setEditingUserId] = useState("");
  const [editForm, setEditForm] = useState({ full_name: "", role: "", department_name: "", active: true });
  const [resettingUserId, setResettingUserId] = useState("");
  const [passwordForm, setPasswordForm] = useState(passwordInitial);
  const [createConfirmationCode, setCreateConfirmationCode] = useState("");
  const [verifyingEmailUserId, setVerifyingEmailUserId] = useState("");
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const isCreateConfirmationPending = !!pendingUserCreationEmail
    && pendingUserCreationEmail === String(form.email || "").trim().toLowerCase();

  useEffect(() => {
    if (!pendingUserCreationEmail) {
      setCreateConfirmationCode("");
    }
  }, [pendingUserCreationEmail]);

  function startEditing(user) {
    setEditingUserId(user.id);
    setEditForm({
      full_name: user.full_name || "",
      role: user.role || "",
      department_name: user.department_name || "",
      active: user.active !== false,
    });
  }

  function cancelEditing() {
    setEditingUserId("");
    setEditForm({ full_name: "", role: "", department_name: "", active: true });
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

  async function submitCreateUser() {
    if (!emailConfirmationEnabledGlobal) {
      const ok = await onAddUser?.(form);
      if (ok) {
        setForm(initial);
      }
      return;
    }

    if (isCreateConfirmationPending) {
      const ok = await onConfirmAddUserEmailConfirmation?.(form, createConfirmationCode);
      if (ok) {
        setCreateConfirmationCode("");
        setForm(initial);
      }
      return;
    }

    const requested = await onRequestAddUserEmailConfirmation?.(form);
    if (requested) {
      setCreateConfirmationCode("");
    }
  }

  async function submitExistingUserVerification(userId) {
    const ok = await onVerifyUserEmailConfirmation?.(userId, emailVerificationCode);
    if (ok) {
      setVerifyingEmailUserId("");
      setEmailVerificationCode("");
    }
  }

  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">Users</p><h2>User management</h2></div></div>
      {permissions?.create && (
      <article className="panel user-form-panel">
        <form className="form-grid user-form-grid" onSubmit={async (e) => { e.preventDefault(); await submitCreateUser(); }}>
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
          <label>
            Department
            <select value={form.department_name} onChange={(e) => setForm((p) => ({ ...p, department_name: e.target.value }))}>
              <option value="">Select department</option>
              {departmentOptions.map((departmentName) => <option key={departmentName} value={departmentName}>{departmentName}</option>)}
            </select>
          </label>
          {emailConfirmationEnabledGlobal ? (
            <label>
              Confirmation code
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={createConfirmationCode}
                onChange={(e) => setCreateConfirmationCode(normalizeChallengeCode(e.target.value))}
                placeholder="123456"
                maxLength={6}
                required={isCreateConfirmationPending}
              />
            </label>
          ) : null}
          <div className="user-form-actions">
            <button className="button button-primary" type="submit">
              {emailConfirmationEnabledGlobal
                ? isCreateConfirmationPending ? "Verify Code & Add User" : "Send Confirmation Code"
                : "Add User"}
            </button>
            {emailConfirmationEnabledGlobal && isCreateConfirmationPending ? (
              <>
                <button className="button button-secondary" type="button" onClick={() => onRequestAddUserEmailConfirmation?.(form)}>
                  Resend Code
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    onCancelAddUserEmailConfirmation?.();
                    setCreateConfirmationCode("");
                  }}
                >
                  Cancel
                </button>
              </>
            ) : null}
          </div>
          {emailConfirmationEnabledGlobal ? (
            <p className="form-hint span-2">
              {isCreateConfirmationPending
                ? `Enter the code sent to ${pendingUserCreationEmail}. Codes expire after ${EMAIL_CONFIRMATION_CODE_TTL_MINUTES} minutes.`
                : "When email confirmation is enabled, the user is created only after the email code is verified."}
            </p>
          ) : null}
        </form>
      </article>
      )}
      <article className="panel">
        {users.length ? <>
          <PaginationControls
            page={currentPage}
            pageSize={pageSize}
            totalItems={users.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          <div className="table-wrap users-table-wrap"><table className="users-table"><thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Department</th><th>Status</th><th>2FA</th><th>Email Check</th><th>Action</th></tr></thead><tbody>
          {paginatedUsers.map((u) => {
            const isEditing = editingUserId === u.id;
            const isResettingPassword = resettingUserId === u.id;
            const security = userSecurityByUserId?.[u.id] || null;
            const twoFactorEnabled = twoFactorEnabledGlobal || security?.two_factor_enabled === true;
            const emailConfirmationEnabled = emailConfirmationEnabledGlobal || security?.email_confirmation_enabled === true;
            const emailConfirmationConfirmed = !!security?.email_confirmed_at;
            return (
              <Fragment key={u.id}>
                <tr>
                  <td className="users-table__email">{u.email}</td>
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
                        value={editForm.department_name}
                        onChange={(e) => setEditForm((current) => ({ ...current, department_name: e.target.value }))}
                      >
                        <option value="">Select department</option>
                        {departmentOptions.map((departmentName) => <option key={departmentName} value={departmentName}>{departmentName}</option>)}
                      </select>
                    ) : (u.department_name || "-")}
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
                  <td className="users-table__action-cell">
                    <div className="table-actions users-table__actions users-table__actions--security">
                      {permissions?.edit ? (
                        <>
                          <button
                            className={`button ${
                              twoFactorEnabled
                                ? "button-secondary users-table__button users-table__button--success"
                                : "button-secondary users-table__button users-table__button--danger"
                            }`}
                            type="button"
                            onClick={() => onToggleUserTwoFactor?.(u.id, !twoFactorEnabled)}
                          >
                            {twoFactorEnabled ? "Disable" : "Enable"}
                          </button>
                          <button className="button button-secondary users-table__button users-table__button--secondary" type="button" disabled={!twoFactorEnabled} onClick={() => onResetUserTwoFactor?.(u.id)}>
                            Reset
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td className="users-table__action-cell">
                    <div className="table-actions users-table__actions users-table__actions--security">
                      {permissions?.edit ? (
                        <>
                          <button
                            className={`button ${
                              emailConfirmationEnabled
                                ? "button-secondary users-table__button users-table__button--success"
                                : "button-secondary users-table__button users-table__button--danger"
                            }`}
                            type="button"
                            onClick={() => onToggleUserEmailConfirmation?.(u.id, !emailConfirmationEnabled)}
                          >
                            {emailConfirmationEnabled ? "Disable" : "Enable"}
                          </button>
                          <button className="button button-secondary users-table__button users-table__button--secondary" type="button" disabled={!emailConfirmationEnabled} onClick={() => onResendUserEmailConfirmation?.(u.id)}>
                            Resend
                          </button>
                          <button
                            className={`button ${
                              emailConfirmationConfirmed
                                ? "button-secondary users-table__button users-table__button--success"
                                : "button-secondary users-table__button users-table__button--danger"
                            }`}
                            type="button"
                            disabled={!emailConfirmationEnabled || emailConfirmationConfirmed}
                            onClick={() => {
                              setVerifyingEmailUserId((current) => (current === u.id ? "" : u.id));
                              setEmailVerificationCode("");
                            }}
                          >
                            Verify
                          </button>
                        </>
                      ) : null}
                      {verifyingEmailUserId === u.id && emailConfirmationEnabled && !emailConfirmationConfirmed ? (
                        <>
                          <input
                            className="table-input"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={emailVerificationCode}
                            onChange={(e) => setEmailVerificationCode(normalizeChallengeCode(e.target.value))}
                            placeholder="123456"
                            maxLength={6}
                          />
                          <button className="button button-primary users-table__button users-table__button--primary" type="button" onClick={() => submitExistingUserVerification(u.id)}>
                            Confirm
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td className="users-table__action-cell">
                    <div className="table-actions users-table__actions users-table__actions--main">
                      {isEditing ? (
                        <>
                          <button className="button button-primary users-table__button users-table__button--primary" type="button" onClick={() => saveEditing(u.id)}>Save</button>
                          <button className="button button-secondary users-table__button users-table__button--secondary" type="button" onClick={cancelEditing}>Cancel</button>
                        </>
                      ) : (
                        <>
                          {canResetPasswords && <button className="button button-primary users-table__button users-table__button--primary" type="button" onClick={() => startPasswordReset(u.id)}>Reset Password</button>}
                          {permissions?.edit && <button className="button button-secondary users-table__button users-table__button--secondary" type="button" onClick={() => onToggleUserActive?.(u.id, !u.active)}>{u.active ? "Disable" : "Enable"}</button>}
                          {permissions?.edit && (
                            <button
                              className="button button-secondary users-table__button users-table__button--secondary users-table__button--icon"
                              type="button"
                              onClick={() => startEditing(u)}
                              aria-label="Edit user"
                              title="Edit"
                            >
                              <EditIcon />
                            </button>
                          )}
                          {permissions?.delete && (
                            <button
                              className="button button-secondary button-danger users-table__button users-table__button--danger users-table__button--icon"
                              type="button"
                              onClick={() => onDeleteUser?.(u.id)}
                              aria-label="Delete user"
                              title="Delete"
                            >
                              <DeleteIcon />
                            </button>
                          )}
                          {!permissions?.edit && !permissions?.delete && !canResetPasswords ? "-" : null}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {isResettingPassword && (
                  <tr>
                    <td colSpan={8}>
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
                          <button className="button button-primary users-table__button users-table__button--primary" type="submit">Save Password</button>
                          <button className="button button-secondary users-table__button users-table__button--secondary" type="button" onClick={cancelPasswordReset}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody></table></div>
        </> : <EmptyState message="No users found." />}
      </article>
    </section>
  );
}
