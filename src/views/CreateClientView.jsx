import { useEffect, useMemo, useState } from "react";
import ClientFieldsAdminView from "./ClientFieldsAdminView";

function buildInitialForm(fields) {
  const output = {};
  (fields || []).forEach((field) => {
    if (!field?.field_key || field.is_active === false) {
      return;
    }
    if (field.input_type === "select") {
      const firstOption = Array.isArray(field.options_json) && field.options_json.length ? String(field.options_json[0]) : "";
      output[field.field_key] = firstOption;
      return;
    }
    output[field.field_key] = "";
  });
  return output;
}

function buildInitialFormFromClient(fields, client) {
  const base = buildInitialForm(fields);
  if (!client) {
    return base;
  }
  const next = { ...base };
  (fields || []).forEach((field) => {
    const key = field.field_key;
    next[key] = client[key] ?? client.custom_fields_json?.[key] ?? next[key] ?? "";
  });
  return next;
}

export default function CreateClientView({ permissions, fieldManagerPermissions, clientFields, initialClient = null, submitLabel = "Create client", title = "Create Client", onSubmitClient, onAddClient, onAddClientField, onUpdateClientField, onDeleteClientField }) {
  const activeFields = useMemo(
    () =>
      (clientFields || [])
        .filter((field) => field.is_active !== false)
        .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100)),
    [clientFields],
  );
  const [form, setForm] = useState(() => buildInitialFormFromClient(activeFields, initialClient));
  const [showFieldManager, setShowFieldManager] = useState(false);
  const canViewFieldManager = !!fieldManagerPermissions?.view;
  useEffect(() => {
    setForm((current) => {
      const next = { ...buildInitialFormFromClient(activeFields, initialClient), ...current };
      return next;
    });
  }, [activeFields, initialClient]);

  if (!permissions?.create) {
    return (
      <section className="view is-active">
        <article className="panel"><h3>{title}</h3><p>You do not have permission to create clients.</p></article>
      </section>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    for (const field of activeFields) {
      if (field.is_required && !String(form[field.field_key] || "").trim()) {
        window.alert(`${field.label || field.field_key} is required.`);
        return;
      }
    }
    const saveHandler = onSubmitClient || onAddClient;
    const ok = await saveHandler?.(form);
    if (ok) {
      setForm(buildInitialFormFromClient(activeFields, initialClient));
    }
  }

  return (
    <section className="view is-active">
      <div className="section-heading">
        <div><p className="eyebrow">CRM</p><h2>{title}</h2></div>
        {canViewFieldManager ? (
          <button className="button button-secondary" type="button" onClick={() => setShowFieldManager((current) => !current)}>
            {showFieldManager ? "Hide Field Manager" : "Create/Edit Fields"}
          </button>
        ) : null}
      </div>

      {canViewFieldManager && showFieldManager ? (
        <ClientFieldsAdminView
          permissions={fieldManagerPermissions}
          clientFields={clientFields}
          onAddClientField={onAddClientField}
          onUpdateClientField={onUpdateClientField}
          onDeleteClientField={onDeleteClientField}
        />
      ) : null}

      <article className="panel client-form-panel">
        <form className="form-grid client-form-grid" onSubmit={handleSubmit}>
          {activeFields.map((field) => {
            const key = field.field_key;
            const label = field.label || key;
            const value = form[key] ?? "";
            const options = Array.isArray(field.options_json) ? field.options_json : [];
            const isCompactTextArea = ["address", "notes"].includes(key);
            const isWide = field.input_type === "textarea" && !isCompactTextArea;
            return (
              <label key={field.id || key} className={isWide ? "span-2" : ""}>
                {label}{field.is_required ? " *" : ""}
                {field.input_type === "textarea" ? (
                  <textarea rows={isCompactTextArea ? 1 : 3} value={value} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
                ) : field.input_type === "select" ? (
                  <select value={value} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}>
                    {!field.is_required ? <option value="">Select</option> : null}
                    {options.map((opt) => (
                      <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.input_type === "date" ? "date" : field.input_type === "email" ? "email" : "text"}
                    value={value}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  />
                )}
              </label>
            );
          })}
          <div className="client-form-actions">
            <button className="button button-primary" type="submit">{submitLabel}</button>
          </div>
        </form>
      </article>
    </section>
  );
}
