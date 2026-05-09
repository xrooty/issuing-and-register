import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/lettering";

export default function ClientProfileView({ client, letters, users, clientFields, isEditing = false, onSaveClient, onIssueLetterForClient, onExportLetterPdf }) {
  const resolveUser = (userId) => users.find((user) => user.id === userId);
  const clientName = String(client?.client_name || client?.full_name || client?.contact_name || "").trim().toLowerCase();
  const clientEmail = String(client?.email || "").trim().toLowerCase();
  const clientCompany = String(client?.company || "").trim().toLowerCase();
  const profileFields = useMemo(
    () =>
      (clientFields || [])
        .filter((field) => field.is_active !== false)
        .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100)),
    [clientFields],
  );
  const [form, setForm] = useState({});

  if (!client) {
    return (
      <section className="view is-active">
        <article className="panel"><h3>Client Profile</h3><p>Select a client from All Clients.</p></article>
      </section>
    );
  }

  const issuedLetters = (letters || [])
    .filter((letter) => {
      if (letter.clientId === client.id) {
        return true;
      }
      const legacyName = String(letter.legacyClientName || letter.recipientName || "").trim().toLowerCase();
      const legacyEmail = String(letter.legacyClientEmail || "").trim().toLowerCase();
      const legacyCompany = String(letter.legacyClientCompany || letter.recipientCompany || "").trim().toLowerCase();
      return (clientEmail && legacyEmail === clientEmail)
        || (clientName && legacyName === clientName)
        || (clientCompany && legacyCompany === clientCompany);
    })
    .sort((a, b) => new Date(b.createdAt || b.issueDate || 0).getTime() - new Date(a.createdAt || a.issueDate || 0).getTime());
  const categorizedLetters = issuedLetters.reduce(
    (acc, letter) => {
      const type = String(letter?.templateSnapshot?.type || letter?.legacyTemplateType || letter?.subject || "").toLowerCase();
      if (type.includes("ag") || type.includes("agreement") || type.includes("legal")) {
        acc.ag.push(letter);
      } else {
        acc.letters.push(letter);
      }
      return acc;
    },
    { letters: [], ag: [] },
  );

  function resolveClientValue(fieldKey) {
    if (Object.prototype.hasOwnProperty.call(client, fieldKey)) {
      return client[fieldKey];
    }
    return client.custom_fields_json?.[fieldKey];
  }

  useEffect(() => {
    const next = {};
    profileFields.forEach((field) => {
      next[field.field_key] = resolveClientValue(field.field_key) ?? "";
    });
    setForm(next);
  }, [client, profileFields]);

  return (
    <section className="view is-active">
      <div className="section-heading">
        <div><p className="eyebrow">CRM</p><h2>Client Profile</h2></div>
        {!isEditing ? <button className="button button-primary" type="button" onClick={() => onIssueLetterForClient(client.id)}>Issue Letter</button> : null}
      </div>

      <article className="panel">
        <h3>{client.client_name}</h3>
        {isEditing ? (
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              await onSaveClient?.(form);
            }}
          >
            {profileFields.map((field) => {
              const key = field.field_key;
              const label = field.label || key;
              const value = form[key] ?? "";
              const options = Array.isArray(field.options_json) ? field.options_json : [];
              const isWide = field.input_type === "textarea";
              return (
                <label key={field.id || key} className={isWide ? "span-2" : ""}>
                  {label}
                  {field.input_type === "textarea" ? (
                    <textarea rows={3} value={value} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} />
                  ) : field.input_type === "select" ? (
                    <select value={value} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}>
                      <option value="">Select</option>
                      {options.map((option) => (
                        <option key={String(option)} value={String(option)}>{String(option)}</option>
                      ))}
                    </select>
                  ) : (
                    <input type={field.input_type === "date" ? "date" : field.input_type === "email" ? "email" : "text"} value={value} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} />
                  )}
                </label>
              );
            })}
            <div className="button-row span-2">
              <button className="button button-primary" type="submit">Save Client</button>
            </div>
          </form>
        ) : (
          <div className="card-list">
            {profileFields.map((field) => (
              <div key={field.id || field.field_key} className="register-card">
                <strong>{field.label || field.field_key}:</strong> {String(resolveClientValue(field.field_key) || "-")}
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="panel">
        <h3>Issued Letters</h3>
        {issuedLetters.length ? (
          <>
            <h4>Letter</h4>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Letter #</th><th>Status</th><th>Message</th><th>Subject</th><th>Issued On</th><th>Issued By</th><th>Actions</th></tr></thead>
              <tbody>
                {categorizedLetters.letters.map((letter) => (
                  <tr key={letter.id}>
                    <td>{letter.letterNo}</td>
                    <td>{letter.status || "issued"}</td>
                    <td>This letter has been issued</td>
                    <td>{letter.subject}</td>
                    <td>{formatDate(letter.issueDate || letter.createdAt)}</td>
                    <td>{letter.issuedByName || resolveUser(letter.issued_by_user_id)?.full_name || "-"}</td>
                    <td>
                      <button className="button button-secondary" type="button" onClick={() => onExportLetterPdf?.(letter.id)}>
                        Export PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            <h4 style={{ marginTop: 16 }}>AG / Legal</h4>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Letter #</th><th>Status</th><th>Message</th><th>Subject</th><th>Issued On</th><th>Issued By</th><th>Actions</th></tr></thead>
                <tbody>
                  {categorizedLetters.ag.map((letter) => (
                    <tr key={letter.id}>
                      <td>{letter.letterNo}</td>
                      <td>{letter.status || "issued"}</td>
                      <td>This AG has been issued</td>
                      <td>{letter.subject}</td>
                      <td>{formatDate(letter.issueDate || letter.createdAt)}</td>
                      <td>{letter.issuedByName || resolveUser(letter.issued_by_user_id)?.full_name || "-"}</td>
                      <td>
                        <button className="button button-secondary" type="button" onClick={() => onExportLetterPdf?.(letter.id)}>
                          Export PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <EmptyState message="No letters issued for this client yet." />}
      </article>
    </section>
  );
}
