import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/lettering";

export default function ClientProfileView({ client, letters, users, clientFields, onIssueLetterForClient, onExportLetterPdf }) {
  const resolveUser = (userId) => users.find((user) => user.id === userId);

  if (!client) {
    return (
      <section className="view is-active">
        <article className="panel"><h3>Client Profile</h3><p>Select a client from All Clients.</p></article>
      </section>
    );
  }

  const issuedLetters = (letters || [])
    .filter((letter) => letter.clientId === client.id)
    .sort((a, b) => new Date(b.createdAt || b.issueDate || 0).getTime() - new Date(a.createdAt || a.issueDate || 0).getTime());

  const profileFields = (clientFields || [])
    .filter((field) => field.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100));

  function resolveClientValue(fieldKey) {
    if (Object.prototype.hasOwnProperty.call(client, fieldKey)) {
      return client[fieldKey];
    }
    return client.custom_fields_json?.[fieldKey];
  }

  return (
    <section className="view is-active">
      <div className="section-heading">
        <div><p className="eyebrow">CRM</p><h2>Client Profile</h2></div>
        <button className="button button-primary" type="button" onClick={() => onIssueLetterForClient(client.id)}>Issue Letter</button>
      </div>

      <article className="panel">
        <h3>{client.client_name}</h3>
        <div className="card-list">
          {profileFields.map((field) => (
            <div key={field.id || field.field_key} className="register-card">
              <strong>{field.label || field.field_key}:</strong> {String(resolveClientValue(field.field_key) || "-")}
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <h3>Issued Letters</h3>
        {issuedLetters.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Letter #</th><th>Status</th><th>Message</th><th>Subject</th><th>Issued On</th><th>Issued By</th><th>Actions</th></tr></thead>
              <tbody>
                {issuedLetters.map((letter) => (
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
        ) : <EmptyState message="No letters issued for this client yet." />}
      </article>
    </section>
  );
}
