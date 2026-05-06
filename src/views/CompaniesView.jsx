import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState";
import { DEFAULT_REFERENCE_PATTERN } from "../utils/lettering";

const initialForm = {
  name: "",
  shortCode: "",
  address: "",
  phone: "",
  email: "",
  footerText: "",
  letterNoPattern: DEFAULT_REFERENCE_PATTERN,
};

export default function CompaniesView({
  companies,
  onAddCompany,
  onUpdateCompany,
  onDeleteCompany,
  onBulkDeleteCompanies,
}) {
  const [form, setForm] = useState(initialForm);
  const [editingCompanyId, setEditingCompanyId] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState([]);

  useEffect(() => {
    const companySet = new Set(companies.map((company) => company.id));
    setSelectedCompanyIds((current) => current.filter((id) => companySet.has(id)));

    if (editingCompanyId && !companySet.has(editingCompanyId)) {
      setEditingCompanyId("");
      setForm(initialForm);
    }
  }, [companies, editingCompanyId]);

  function resetCreateMode() {
    setEditingCompanyId("");
    setForm(initialForm);
  }

  function loadCompanyForEdit(company) {
    if (!company) {
      return;
    }

    setEditingCompanyId(company.id);
    setForm({
      name: company.name || "",
      shortCode: company.shortCode || "",
      address: company.address || "",
      phone: company.phone || "",
      email: company.email || "",
      footerText: company.footerText || "",
      letterNoPattern: company.letterNoPattern || DEFAULT_REFERENCE_PATTERN,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (editingCompanyId && onUpdateCompany) {
      const updated = await onUpdateCompany({
        id: editingCompanyId,
        ...form,
      });

      if (updated) {
        resetCreateMode();
      }

      return;
    }

    await onAddCompany(form);
    setForm(initialForm);
  }

  async function handleDeleteCurrentCompany() {
    if (!editingCompanyId || !onDeleteCompany) {
      return;
    }

    const deleted = await onDeleteCompany(editingCompanyId);
    if (!deleted) {
      return;
    }

    setSelectedCompanyIds((current) => current.filter((id) => id !== editingCompanyId));
    resetCreateMode();
  }

  async function handleDeleteCompanyById(companyId) {
    if (!onDeleteCompany) {
      return;
    }

    const deleted = await onDeleteCompany(companyId);
    if (!deleted) {
      return;
    }

    setSelectedCompanyIds((current) => current.filter((id) => id !== companyId));
    if (editingCompanyId === companyId) {
      resetCreateMode();
    }
  }

  function toggleCompanySelection(companyId) {
    setSelectedCompanyIds((current) =>
      current.includes(companyId) ? current.filter((id) => id !== companyId) : [...current, companyId],
    );
  }

  function toggleSelectAllCompanies() {
    if (!companies.length) {
      return;
    }

    setSelectedCompanyIds((current) => (current.length === companies.length ? [] : companies.map((company) => company.id)));
  }

  async function handleBulkDeleteCompanies() {
    if (!onBulkDeleteCompanies || !selectedCompanyIds.length) {
      return;
    }

    const deleted = await onBulkDeleteCompanies(selectedCompanyIds);
    if (!deleted) {
      return;
    }

    const deletedSet = new Set(selectedCompanyIds);
    setSelectedCompanyIds([]);
    if (editingCompanyId && deletedSet.has(editingCompanyId)) {
      resetCreateMode();
    }
  }

  return (
    <section className="view is-active">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Site Management</p>
          <h2>Companies</h2>
        </div>
      </div>

      <div className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingCompanyId ? "Edit" : "Create"}</p>
              <h3>{editingCompanyId ? "Edit company" : "Add company"}</h3>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Company name
              <input
                required
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Crescent Textile Group"
              />
            </label>
            <label>
              Short code
              <input
                required
                type="text"
                maxLength={6}
                value={form.shortCode}
                onChange={(event) => setForm((current) => ({ ...current, shortCode: event.target.value.toUpperCase() }))}
                placeholder="CTG"
              />
            </label>
            <label className="span-2">
              Reference no format (default)
              <input
                type="text"
                value={form.letterNoPattern}
                onChange={(event) => setForm((current) => ({ ...current, letterNoPattern: event.target.value }))}
                placeholder="{{company_code}}/{{department_code}}/{{template_code}}/{{year}}-{{month}}/{{sequence3}}"
              />
            </label>
            <label className="span-2">
              Address
              <textarea
                rows={3}
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="Street, city, country"
              />
            </label>
            <label>
              Phone
              <input
                type="text"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+92 300 0000000"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="hr@company.com"
              />
            </label>
            <label className="span-2">
              Footer text
              <textarea
                rows={3}
                value={form.footerText}
                onChange={(event) => setForm((current) => ({ ...current, footerText: event.target.value }))}
                placeholder="Official footer or disclaimer"
              />
            </label>
            <div className="button-row span-2">
              <button className="button button-primary" type="submit">
                {editingCompanyId ? "Update company" : "Save company"}
              </button>
              {editingCompanyId ? (
                <>
                  <button className="button button-secondary" type="button" onClick={resetCreateMode}>
                    Cancel edit
                  </button>
                  <button className="button button-secondary" type="button" onClick={handleDeleteCurrentCompany}>
                    Delete company
                  </button>
                </>
              ) : null}
            </div>
          </form>

          <div className="helper-note" style={{ marginTop: 14 }}>
            Format tokens: <code>{"{{company_code}}"}</code>, <code>{"{{department_code}}"}</code>, <code>{"{{template_code}}"}</code>,{" "}
            <code>{"{{year}}"}</code>, <code>{"{{yy}}"}</code>, <code>{"{{month}}"}</code>, <code>{"{{day}}"}</code>, <code>{"{{sequence}}"}</code>,{" "}
            <code>{"{{sequence3}}"}</code>, <code>{"{{sequence4}}"}</code>. You can also use underscores like <code>____</code> for auto numbering.
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Directory</p>
              <h3>Company list</h3>
            </div>
            {companies.length ? (
              <div className="row-actions">
                <button className="button button-secondary" type="button" onClick={toggleSelectAllCompanies}>
                  {selectedCompanyIds.length === companies.length ? "Clear all" : "Select all"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={handleBulkDeleteCompanies}
                  disabled={!selectedCompanyIds.length}
                >
                  Delete selected ({selectedCompanyIds.length})
                </button>
              </div>
            ) : null}
          </div>

          {companies.length ? (
            <div className="card-list">
              {companies.map((company) => {
                const isSelected = selectedCompanyIds.includes(company.id);

                return (
                  <article className="entity-card" key={company.id}>
                    <div className="template-select-row">
                      <label className="template-select-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompanySelection(company.id)}
                        />
                        <span>Select</span>
                      </label>
                    </div>
                    <h4>{company.name}</h4>
                    <p>{company.address || "No address added"}</p>
                    <div className="entity-meta">
                      <span className="chip">{company.shortCode}</span>
                      {company.email ? <span className="chip">{company.email}</span> : null}
                      {company.letterNoPattern ? <span className="chip chip--tone">Ref: {company.letterNoPattern}</span> : null}
                    </div>
                    <div className="row-actions">
                      <button className="button button-secondary" type="button" onClick={() => loadCompanyForEdit(company)}>
                        Edit
                      </button>
                      <button className="button button-secondary" type="button" onClick={() => handleDeleteCompanyById(company.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState message="Add the first company to start building the system." />
          )}
        </article>
      </div>
    </section>
  );
}
