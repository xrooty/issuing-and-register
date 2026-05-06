import { useMemo, useState } from "react";

const EMPTY_FIELD = {
  field_key: "",
  label: "",
  input_type: "text",
  options_csv: "",
  is_required: false,
  is_active: true,
  sort_order: 100,
};

export default function ClientFieldsAdminView({ currentRole, clientFields, onAddClientField, onUpdateClientField, onDeleteClientField }) {
  const [draft, setDraft] = useState(EMPTY_FIELD);
  const canManage = currentRole === "super_admin";
  const rows = useMemo(
    () => (clientFields || []).slice().sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100)),
    [clientFields],
  );

  async function createField() {
    const ok = await onAddClientField({
      field_key: draft.field_key,
      label: draft.label,
      input_type: draft.input_type,
      options_json: draft.options_csv.split(",").map((item) => item.trim()).filter(Boolean),
      is_required: draft.is_required,
      is_active: draft.is_active,
      sort_order: Number(draft.sort_order || 100),
      is_system: false,
    });
    if (ok) setDraft(EMPTY_FIELD);
  }

  async function editField(field) {
    const nextLabel = window.prompt("Field label", field.label || "");
    if (nextLabel == null) return;
    const nextType = window.prompt("Field type (text,email,textarea,date,select)", field.input_type || "text");
    if (nextType == null) return;
    const currentOptions = Array.isArray(field.options_json) ? field.options_json.join(",") : "";
    const nextOptions = window.prompt("Options (comma-separated, for select)", currentOptions);
    if (nextOptions == null) return;
    const nextSortRaw = window.prompt("Sort order", String(field.sort_order || 100));
    if (nextSortRaw == null) return;
    await onUpdateClientField(field.id, {
      label: nextLabel,
      input_type: nextType,
      options_json: String(nextOptions).split(",").map((item) => item.trim()).filter(Boolean),
      sort_order: Number(nextSortRaw || 100),
    });
  }

  return (
    <article className="panel">
      <h3>Client Field Manager</h3>
      {!canManage ? <p>Only super_admin can manage dynamic client fields.</p> : null}
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <label>Field Key<input value={draft.field_key} onChange={(e) => setDraft((p) => ({ ...p, field_key: e.target.value }))} placeholder="e.g. portfolio_size" /></label>
        <label>Label<input value={draft.label} onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Portfolio Size" /></label>
        <label>Type
          <select value={draft.input_type} onChange={(e) => setDraft((p) => ({ ...p, input_type: e.target.value }))}>
            <option value="text">text</option>
            <option value="email">email</option>
            <option value="textarea">textarea</option>
            <option value="date">date</option>
            <option value="select">select</option>
          </select>
        </label>
        <label>Options (comma-separated)<input value={draft.options_csv} onChange={(e) => setDraft((p) => ({ ...p, options_csv: e.target.value }))} placeholder="high,medium,low" /></label>
        <label>Sort Order<input type="number" value={draft.sort_order} onChange={(e) => setDraft((p) => ({ ...p, sort_order: e.target.value }))} /></label>
        <label>Required
          <select value={draft.is_required ? "yes" : "no"} onChange={(e) => setDraft((p) => ({ ...p, is_required: e.target.value === "yes" }))}>
            <option value="no">no</option>
            <option value="yes">yes</option>
          </select>
        </label>
        <button className="button button-primary" type="button" onClick={createField} disabled={!canManage}>Create field</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Key</th><th>Label</th><th>Type</th><th>Required</th><th>Active</th><th>System</th><th>Sort</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((field) => (
              <tr key={field.id}>
                <td>{field.field_key}</td>
                <td>{field.label}</td>
                <td>{field.input_type}</td>
                <td>{field.is_required ? "yes" : "no"}</td>
                <td>{field.is_active ? "yes" : "no"}</td>
                <td>{field.is_system ? "yes" : "no"}</td>
                <td>{field.sort_order}</td>
                <td>
                  <div className="row-actions">
                    <button className="button button-secondary" type="button" disabled={!canManage} onClick={() => onUpdateClientField(field.id, { is_active: !field.is_active })}>
                      {field.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button className="button button-secondary" type="button" disabled={!canManage} onClick={() => editField(field)}>
                      Edit
                    </button>
                    <button className="button button-secondary" type="button" disabled={!canManage || field.is_system} onClick={() => onDeleteClientField(field.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
