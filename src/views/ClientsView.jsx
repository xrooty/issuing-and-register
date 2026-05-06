import { useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/lettering";

const INITIAL_FORM = {
  client_name: "",
  company: "",
  contact_name: "",
  contact_name_secondary: "",
  designation: "",
  email: "",
  email_secondary: "",
  phone: "",
  whatsapp: "",
  city: "",
  state: "",
  country: "",
  postal_code: "",
  address: "",
  industry: "",
  source: "",
  priority: "medium",
  assigned_owner: "",
  tags: "",
  notes: "",
  follow_up_date: "",
  status: "active",
};

export default function ClientsView({ clients, letters, users, permissions, onAddClient, onDeleteClient, onUpdateClient }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeClientId, setActiveClientId] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editDraft, setEditDraft] = useState({});

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matchStatus = !statusFilter || String(client.status || "").toLowerCase() === statusFilter.toLowerCase();
      if (!needle) return matchStatus;
      const hay = [
        client.client_name,
        client.company,
        client.contact_name,
        client.email,
        client.phone,
        client.city,
        client.industry,
      ].join(" ").toLowerCase();
      return matchStatus && hay.includes(needle);
    });
  }, [clients, query, statusFilter]);

  const activeClient = clients.find((item) => item.id === activeClientId) || null;
  const clientLetters = useMemo(() => {
    if (!activeClient) return [];
    return letters
      .filter((letter) => letter.clientId === activeClient.id)
      .sort((a, b) => new Date(b.createdAt || b.issueDate || 0).getTime() - new Date(a.createdAt || a.issueDate || 0).getTime());
  }, [letters, activeClient]);

  const resolveUser = (userId) => users.find((user) => user.id === userId);

  return (
    <section className="view is-active">
      <div className="section-heading">
        <div><p className="eyebrow">CRM</p><h2>Clients</h2></div>
      </div>

      {permissions?.create && (
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Create</p><h3>New client profile</h3></div></div>
          <form className="form-grid" onSubmit={async (event) => {
            event.preventDefault();
            const ok = await onAddClient(form);
            if (ok) setForm(INITIAL_FORM);
          }}>
            {Object.keys(INITIAL_FORM).map((key) => (
              <label key={key} className={["notes", "address", "tags"].includes(key) ? "span-2" : ""}>
                {key.replace(/_/g, " ")}
                {key === "notes" || key === "address" || key === "tags" ? (
                  <textarea rows={key === "notes" ? 3 : 2} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
                ) : key === "status" ? (
                  <select value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}>
                    <option value="active">active</option>
                    <option value="on_hold">on_hold</option>
                    <option value="closed">closed</option>
                  </select>
                ) : key === "follow_up_date" ? (
                  <input type="date" value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
                ) : (
                  <input type={key.includes("email") ? "email" : "text"} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
                )}
              </label>
            ))}
            <button className="button button-primary" type="submit">Create client</button>
          </form>
        </article>
      )}

      <article className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Directory</p><h3>All clients data</h3></div>
        </div>
        <div className="filters">
          <label>Search<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, company, email, phone..." /></label>
          <label>Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="active">active</option>
              <option value="on_hold">on_hold</option>
              <option value="closed">closed</option>
            </select>
          </label>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Company</th><th>Email</th><th>Phone</th><th>Status</th><th>Follow-up</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <td>{client.client_name}</td>
                    <td>{client.company}</td>
                    <td>{client.email}</td>
                    <td>{client.phone}</td>
                    <td>{client.status}</td>
                    <td>{client.follow_up_date || "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="button button-secondary" type="button" onClick={() => setActiveClientId(client.id)}>Profile</button>
                        {permissions?.edit && <button className="button button-secondary" type="button" onClick={() => { setEditClientId(client.id); setEditDraft(client); }}>Edit</button>}
                        {permissions?.delete && <button className="button button-secondary" type="button" onClick={() => onDeleteClient(client.id)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState message="No clients found." />}
      </article>

      {editClientId && permissions?.edit && (
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Edit</p><h3>Update client</h3></div></div>
          <form className="form-grid" onSubmit={async (event) => {
            event.preventDefault();
            const ok = await onUpdateClient(editClientId, editDraft);
            if (ok) { setEditClientId(""); setEditDraft({}); }
          }}>
            {Object.keys(INITIAL_FORM).map((key) => (
              <label key={key} className={["notes", "address", "tags"].includes(key) ? "span-2" : ""}>
                {key.replace(/_/g, " ")}
                {key === "notes" || key === "address" || key === "tags" ? (
                  <textarea rows={key === "notes" ? 3 : 2} value={editDraft[key] || ""} onChange={(e) => setEditDraft((p) => ({ ...p, [key]: e.target.value }))} />
                ) : key === "status" ? (
                  <select value={editDraft[key] || "active"} onChange={(e) => setEditDraft((p) => ({ ...p, [key]: e.target.value }))}>
                    <option value="active">active</option>
                    <option value="on_hold">on_hold</option>
                    <option value="closed">closed</option>
                  </select>
                ) : key === "follow_up_date" ? (
                  <input type="date" value={editDraft[key] || ""} onChange={(e) => setEditDraft((p) => ({ ...p, [key]: e.target.value }))} />
                ) : (
                  <input type={key.includes("email") ? "email" : "text"} value={editDraft[key] || ""} onChange={(e) => setEditDraft((p) => ({ ...p, [key]: e.target.value }))} />
                )}
              </label>
            ))}
            <div className="button-row span-2">
              <button className="button button-primary" type="submit">Save update</button>
              <button className="button button-secondary" type="button" onClick={() => { setEditClientId(""); setEditDraft({}); }}>Cancel</button>
            </div>
          </form>
        </article>
      )}

      {activeClient && (
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Profile</p><h3>{activeClient.client_name}</h3></div></div>
          <div className="card-list">
            <div className="register-card"><strong>Company:</strong> {activeClient.company || "-"}</div>
            <div className="register-card"><strong>Primary contact:</strong> {activeClient.contact_name || "-"}</div>
            <div className="register-card"><strong>Email:</strong> {activeClient.email || "-"}</div>
            <div className="register-card"><strong>Status:</strong> {activeClient.status || "-"}</div>
            <div className="register-card"><strong>Notes:</strong> {activeClient.notes || "-"}</div>
          </div>
          <h4 style={{ marginTop: 16 }}>Issued letters for this client</h4>
          {clientLetters.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Letter #</th><th>Subject</th><th>Issued On</th><th>Issued By</th><th>Prepared By</th></tr></thead>
                <tbody>
                  {clientLetters.map((letter) => (
                    <tr key={letter.id}>
                      <td>{letter.letterNo}</td>
                      <td>{letter.subject}</td>
                      <td>{formatDate(letter.issueDate || letter.createdAt)}</td>
                      <td>{letter.issuedByName || resolveUser(letter.issued_by_user_id)?.full_name || "-"}</td>
                      <td>{letter.preparedBy || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState message="No letters issued for this client yet." />}
        </article>
      )}
    </section>
  );
}
