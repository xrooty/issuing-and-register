import { useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";

export default function ExportsView({
  companies = [],
  departments = [],
  canExportRegister,
  canExportClients,
  canExportBackup,
  onExportRegister,
  onExportClients,
  onExportBackup,
}) {
  const [clientExportScope, setClientExportScope] = useState("all");
  const [companyId, setCompanyId] = useState("");
  const [departmentId, setDepartmentId] = useState("ALL");

  const companyDepartments = useMemo(
    () => departments.filter((department) => department.companyId === companyId),
    [companyId, departments],
  );

  if (!canExportRegister && !canExportClients && !canExportBackup) {
    return (
      <section className="view is-active">
        <EmptyState title="No export access" message="You do not have permission to export data." />
      </section>
    );
  }

  return (
    <section className="view is-active">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Exports</p>
          <h2>Data export center</h2>
        </div>
      </div>

      <div className="content-grid">
        {canExportClients ? (
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Excel</p>
                <h3>Clients data</h3>
              </div>
            </div>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                onExportClients({
                  scope: clientExportScope,
                  companyId,
                  departmentId,
                });
              }}
            >
              <label className="span-2">
                Export type
                <select
                  value={clientExportScope}
                  onChange={(event) => {
                    const nextScope = event.target.value;
                    setClientExportScope(nextScope);
                    if (nextScope === "all") {
                      setCompanyId("");
                      setDepartmentId("ALL");
                    }
                  }}
                >
                  <option value="all">All clients</option>
                  <option value="company">Company / department</option>
                </select>
              </label>

              {clientExportScope === "company" ? (
                <>
                  <label>
                    Company
                    <select
                      value={companyId}
                      onChange={(event) => {
                        setCompanyId(event.target.value);
                        setDepartmentId("ALL");
                      }}
                    >
                      <option value="">Select company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Department
                    <select
                      value={departmentId}
                      onChange={(event) => setDepartmentId(event.target.value)}
                      disabled={!companyId}
                    >
                      <option value="ALL">All departments</option>
                      {companyDepartments.map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              <div className="button-row span-2">
                <button className="button button-primary" type="submit">Export Clients Excel</button>
              </div>
            </form>
          </article>
        ) : null}

        {canExportRegister ? (
          <article className="panel panel-accent">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">CSV</p>
                <h3>Letter register</h3>
              </div>
            </div>
            <div className="button-row">
              <button className="button button-secondary" type="button" onClick={onExportRegister}>
                Export Register CSV
              </button>
            </div>
          </article>
        ) : null}

        {canExportBackup ? (
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">JSON</p>
                <h3>Full system backup</h3>
              </div>
            </div>
            <div className="button-row">
              <button className="button button-secondary" type="button" onClick={onExportBackup}>
                Backup JSON
              </button>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
