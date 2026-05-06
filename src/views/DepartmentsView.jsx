import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState";

const initialForm = {
  companyId: "",
  name: "",
  code: "",
  letterNoPattern: "",
};

export default function DepartmentsView({
  companies,
  departments,
  onAddDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  onBulkDeleteDepartments,
}) {
  const [form, setForm] = useState(initialForm);
  const [editingDepartmentId, setEditingDepartmentId] = useState("");
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState([]);

  useEffect(() => {
    if (!form.companyId && companies[0]?.id) {
      setForm((current) => ({ ...current, companyId: companies[0].id }));
    }
  }, [companies, form.companyId]);

  useEffect(() => {
    const departmentSet = new Set(departments.map((department) => department.id));
    setSelectedDepartmentIds((current) => current.filter((id) => departmentSet.has(id)));

    if (editingDepartmentId && !departmentSet.has(editingDepartmentId)) {
      setEditingDepartmentId("");
      setForm((current) => ({
        ...initialForm,
        companyId: current.companyId || companies[0]?.id || "",
      }));
    }
  }, [companies, departments, editingDepartmentId]);

  function resetCreateMode() {
    setEditingDepartmentId("");
    setForm((current) => ({
      ...initialForm,
      companyId: current.companyId || companies[0]?.id || "",
    }));
  }

  function loadDepartmentForEdit(department) {
    if (!department) {
      return;
    }

    setEditingDepartmentId(department.id);
    setForm({
      companyId: department.companyId || "",
      name: department.name || "",
      code: department.code || "",
      letterNoPattern: department.letterNoPattern || "",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (editingDepartmentId && onUpdateDepartment) {
      const updated = await onUpdateDepartment({
        id: editingDepartmentId,
        ...form,
      });

      if (updated) {
        resetCreateMode();
      }

      return;
    }

    await onAddDepartment(form);
    setForm((current) => ({
      ...initialForm,
      companyId: current.companyId || companies[0]?.id || "",
    }));
  }

  async function handleDeleteCurrentDepartment() {
    if (!editingDepartmentId || !onDeleteDepartment) {
      return;
    }

    const deleted = await onDeleteDepartment(editingDepartmentId);
    if (!deleted) {
      return;
    }

    setSelectedDepartmentIds((current) => current.filter((id) => id !== editingDepartmentId));
    resetCreateMode();
  }

  async function handleDeleteDepartmentById(departmentId) {
    if (!onDeleteDepartment) {
      return;
    }

    const deleted = await onDeleteDepartment(departmentId);
    if (!deleted) {
      return;
    }

    setSelectedDepartmentIds((current) => current.filter((id) => id !== departmentId));
    if (editingDepartmentId === departmentId) {
      resetCreateMode();
    }
  }

  function toggleDepartmentSelection(departmentId) {
    setSelectedDepartmentIds((current) =>
      current.includes(departmentId) ? current.filter((id) => id !== departmentId) : [...current, departmentId],
    );
  }

  function toggleSelectAllDepartments() {
    if (!departments.length) {
      return;
    }

    setSelectedDepartmentIds((current) =>
      current.length === departments.length ? [] : departments.map((department) => department.id),
    );
  }

  async function handleBulkDeleteDepartments() {
    if (!onBulkDeleteDepartments || !selectedDepartmentIds.length) {
      return;
    }

    const deleted = await onBulkDeleteDepartments(selectedDepartmentIds);
    if (!deleted) {
      return;
    }

    const deletedSet = new Set(selectedDepartmentIds);
    setSelectedDepartmentIds([]);
    if (editingDepartmentId && deletedSet.has(editingDepartmentId)) {
      resetCreateMode();
    }
  }

  return (
    <section className="view is-active">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Site Management</p>
          <h2>Departments</h2>
        </div>
      </div>

      <div className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingDepartmentId ? "Edit" : "Create"}</p>
              <h3>{editingDepartmentId ? "Edit department" : "Add department"}</h3>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="span-2">
              Company
              <select
                required
                value={form.companyId}
                onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))}
                disabled={!companies.length}
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.shortCode})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Department name
              <input
                required
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Human Resources"
              />
            </label>
            <label>
              Department code
              <input
                required
                type="text"
                maxLength={6}
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="HR"
              />
            </label>
            <label className="span-2">
              Reference no format override (optional)
              <input
                type="text"
                value={form.letterNoPattern}
                onChange={(event) => setForm((current) => ({ ...current, letterNoPattern: event.target.value }))}
                placeholder="Leave blank to use company default format"
              />
            </label>
            <div className="button-row span-2">
              <button className="button button-primary" type="submit" disabled={!companies.length}>
                {editingDepartmentId ? "Update department" : "Save department"}
              </button>
              {editingDepartmentId ? (
                <>
                  <button className="button button-secondary" type="button" onClick={resetCreateMode}>
                    Cancel edit
                  </button>
                  <button className="button button-secondary" type="button" onClick={handleDeleteCurrentDepartment}>
                    Delete department
                  </button>
                </>
              ) : null}
            </div>
          </form>

          <div className="helper-note" style={{ marginTop: 14 }}>
            Department format has higher priority than company format. Example:{" "}
            <code>{"{{company_code}}/{{department_code}}/{{template_code}}/{{year}}-{{month}}/{{sequence3}}"}</code>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Directory</p>
              <h3>Department list</h3>
            </div>
            {departments.length ? (
              <div className="row-actions">
                <button className="button button-secondary" type="button" onClick={toggleSelectAllDepartments}>
                  {selectedDepartmentIds.length === departments.length ? "Clear all" : "Select all"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={handleBulkDeleteDepartments}
                  disabled={!selectedDepartmentIds.length}
                >
                  Delete selected ({selectedDepartmentIds.length})
                </button>
              </div>
            ) : null}
          </div>

          {departments.length ? (
            <div className="card-list">
              {departments.map((department) => {
                const company = companies.find((item) => item.id === department.companyId);
                const isSelected = selectedDepartmentIds.includes(department.id);

                return (
                  <article className="entity-card" key={department.id}>
                    <div className="template-select-row">
                      <label className="template-select-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDepartmentSelection(department.id)}
                        />
                        <span>Select</span>
                      </label>
                    </div>
                    <h4>{department.name}</h4>
                    <p>{company?.name || "Unknown company"}</p>
                    <div className="entity-meta">
                      <span className="chip">{department.code}</span>
                      {department.letterNoPattern ? <span className="chip chip--tone">Ref: {department.letterNoPattern}</span> : null}
                    </div>
                    <div className="row-actions">
                      <button className="button button-secondary" type="button" onClick={() => loadDepartmentForEdit(department)}>
                        Edit
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => handleDeleteDepartmentById(department.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState message="Departments will appear here after the first one is added." />
          )}
        </article>
      </div>
    </section>
  );
}
