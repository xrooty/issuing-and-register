import { useEffect, useMemo, useState } from "react";

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

export default function CreateClientView({ permissions, clientFields, onAddClient }) {
  const activeFields = useMemo(
    () =>
      (clientFields || [])
        .filter((field) => field.is_active !== false)
        .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100)),
    [clientFields],
  );
  const [form, setForm] = useState(() => buildInitialForm(activeFields));
  useEffect(() => {
    setForm((current) => {
      const next = { ...buildInitialForm(activeFields), ...current };
      return next;
    });
  }, [activeFields]);

  if (!permissions?.create) {
    return (
      <section className="view is-active">
        <article className="panel"><h3>Create Client</h3><p>You do not have permission to create clients.</p></article>
      </section>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    for (const field of activeFields) {
      if (field.is_required && !String(form[field.field_key] || "").trim()) {
        return;
      }
    }
    const ok = await onAddClient(form);
    if (ok) {
      setForm(buildInitialForm(activeFields));
    }
  }

  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">CRM</p><h2>Create Client</h2></div></div>
      <article className="panel">
        <form className="form-grid" onSubmit={handleSubmit}>
          {activeFields.map((field) => {
            const key = field.field_key;
            const label = field.label || key;
            const value = form[key] ?? "";
            const options = Array.isArray(field.options_json) ? field.options_json : [];
            const isWide = field.input_type === "textarea";
            return (
              <label key={field.id || key} className={isWide ? "span-2" : ""}>
                {label}{field.is_required ? " *" : ""}
                {field.input_type === "textarea" ? (
                  <textarea rows={3} value={value} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
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
          <button className="button button-primary" type="submit">Create client</button>
        </form>
      </article>
    </section>
  );
}
