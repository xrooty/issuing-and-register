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
const EMPTY_EDIT_DRAFT = {
  field_key: "",
  label: "",
  input_type: "text",
  options_csv: "",
  is_required: false,
  is_active: true,
  sort_order: 100,
};
const FIELD_TYPES = ["text", "email", "textarea", "date", "select"];

function toOptionsCsv(options) {
  if (!Array.isArray(options)) {
    return "";
  }
  return options.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
}

export default function ClientFieldsAdminView({ permissions, clientFields, onAddClientField, onUpdateClientField, onDeleteClientField }) {
  const [draft, setDraft] = useState(EMPTY_FIELD);
  const [editingFieldId, setEditingFieldId] = useState("");
  const [editDraft, setEditDraft] = useState(EMPTY_EDIT_DRAFT);
  const canView = !!permissions?.view;
  const canCreate = !!permissions?.create;
  const canEdit = !!permissions?.edit;
  const canDelete = !!permissions?.delete;
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

  function startEdit(field) {
    setEditingFieldId(field.id || "");
    setEditDraft({
      field_key: field.field_key || "",
      label: field.label || "",
      input_type: FIELD_TYPES.includes(field.input_type) ? field.input_type : "text",
      options_csv: toOptionsCsv(field.options_json),
      is_required: !!field.is_required,
      is_active: field.is_active !== false,
      sort_order: Number(field.sort_order || 100),
    });
  }

  function cancelEdit() {
    setEditingFieldId("");
    setEditDraft(EMPTY_EDIT_DRAFT);
  }

  async function saveEdit(field) {
    const ok = await onUpdateClientField(field.id, {
      field_key: editDraft.field_key,
      label: editDraft.label,
      input_type: editDraft.input_type,
      options_json: String(editDraft.options_csv || "").split(",").map((item) => item.trim()).filter(Boolean),
      sort_order: Number(editDraft.sort_order || 100),
      is_required: !!editDraft.is_required,
      is_active: !!editDraft.is_active,
    });
    if (ok) {
      cancelEdit();
    }
  }

  return (
    <article className="panel">
      <h3>Client Field Manager</h3>
      {!canView ? <p>You do not have permission to view field manager.</p> : null}
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
        <button className="button button-primary" type="button" onClick={createField} disabled={!canCreate}>Create field</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Key</th><th>Label</th><th>Type</th><th>Required</th><th>Active</th><th>System</th><th>Sort</th><th>Options</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((field) => (
              <tr key={field.id}>
                <td>
                  {editingFieldId === field.id ? (
                    <input
                      className="table-input"
                      value={editDraft.field_key}
                      onChange={(e) => setEditDraft((current) => ({ ...current, field_key: e.target.value }))}
                    />
                  ) : field.field_key}
                </td>
                <td>
                  {editingFieldId === field.id ? (
                    <input
                      className="table-input"
                      value={editDraft.label}
                      onChange={(e) => setEditDraft((current) => ({ ...current, label: e.target.value }))}
                    />
                  ) : field.label}
                </td>
                <td>
                  {editingFieldId === field.id ? (
                    <select
                      className="table-input"
                      value={editDraft.input_type}
                      onChange={(e) => setEditDraft((current) => ({ ...current, input_type: e.target.value }))}
                    >
                      {FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  ) : field.input_type}
                </td>
                <td>
                  {editingFieldId === field.id ? (
                    <select
                      className="table-input"
                      value={editDraft.is_required ? "yes" : "no"}
                      onChange={(e) => setEditDraft((current) => ({ ...current, is_required: e.target.value === "yes" }))}
                    >
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  ) : (field.is_required ? "yes" : "no")}
                </td>
                <td>
                  {editingFieldId === field.id ? (
                    <select
                      className="table-input"
                      value={editDraft.is_active ? "yes" : "no"}
                      onChange={(e) => setEditDraft((current) => ({ ...current, is_active: e.target.value === "yes" }))}
                    >
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  ) : (field.is_active ? "yes" : "no")}
                </td>
                <td>{field.is_system ? "yes" : "no"}</td>
                <td>
                  {editingFieldId === field.id ? (
                    <input
                      className="table-input"
                      type="number"
                      value={editDraft.sort_order}
                      onChange={(e) => setEditDraft((current) => ({ ...current, sort_order: e.target.value }))}
                    />
                  ) : field.sort_order}
                </td>
                <td>
                  {editingFieldId === field.id ? (
                    <input
                      className="table-input"
                      value={editDraft.options_csv}
                      onChange={(e) => setEditDraft((current) => ({ ...current, options_csv: e.target.value }))}
                      placeholder="high, medium, low"
                    />
                  ) : (Array.isArray(field.options_json) && field.options_json.length ? field.options_json.join(", ") : "-")}
                </td>
                <td>
                  <div className="row-actions">
                    {editingFieldId === field.id ? (
                      <>
                        <button className="button button-primary" type="button" disabled={!canEdit} onClick={() => saveEdit(field)}>
                          Save
                        </button>
                        <button className="button button-secondary" type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="button button-secondary" type="button" disabled={!canEdit} onClick={() => onUpdateClientField(field.id, { is_active: !field.is_active })}>
                          {field.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button className="button button-secondary" type="button" disabled={!canEdit} onClick={() => startEdit(field)}>
                          Edit
                        </button>
                      </>
                    )}
                    <button className="button button-secondary" type="button" disabled={!canDelete || field.is_system} onClick={() => onDeleteClientField(field.id)}>
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
