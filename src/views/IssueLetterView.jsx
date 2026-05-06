import { useState } from "react";
import LetterPreview from "../components/LetterPreview";
import {
  DEFAULT_REFERENCE_PATTERN,
  getTemplateDynamicTokenFields,
  normalizeTemplateCustomFields,
  resolveReferencePattern,
} from "../utils/lettering";

export default function IssueLetterView({
  companies,
  departments,
  templates,
  draft,
  preview,
  onDraftChange,
  onIssueLetter,
  onPrint,
  onEditTemplate,
  onSearchEmployees,
  isEditingLetter,
  onCancelEditLetter,
}) {
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeResults, setEmployeeResults] = useState([]);
  const [employeeLookupBusy, setEmployeeLookupBusy] = useState(false);
  const [employeeLookupError, setEmployeeLookupError] = useState("");
  const selectedCompany = companies.find((company) => company.id === draft.companyId) || null;
  const departmentOptions = departments.filter((department) => department.companyId === draft.companyId);
  const selectedDepartment = departmentOptions.find((department) => department.id === draft.departmentId) || null;
  const templateOptions = templates.filter(
    (template) => template.companyId === draft.companyId && template.departmentId === draft.departmentId,
  );
  const selectedTemplate = templateOptions.find((template) => template.id === draft.templateId) || null;
  const customFieldDefinitions = normalizeTemplateCustomFields(selectedTemplate?.design?.customFields || []);
  const dynamicTokenFields = getTemplateDynamicTokenFields(selectedTemplate);
  const previewReferenceNo = preview?.values?.letterNo || "";
  const hasCompanyOptions = companies.length > 0;
  const hasDepartmentOptions = departmentOptions.length > 0;
  const hasTemplateOptions = templateOptions.length > 0;
  const canIssueLetter = Boolean(selectedCompany && selectedDepartment && selectedTemplate);
  const selectionWarning = !hasCompanyOptions
    ? "Add at least one company to start issuing letters."
    : !hasDepartmentOptions
      ? "Selected company has no departments. Create one in Site Management."
      : !hasTemplateOptions
        ? "Selected department has no templates. Add one in Site Management."
        : "";

  const activeReferencePattern = resolveReferencePattern({
    company: selectedCompany,
    department: selectedDepartment,
    template: selectedTemplate,
    draftPattern: draft.letterNoFormatOverride,
  }) || DEFAULT_REFERENCE_PATTERN;

  function updateField(field, value) {
    onDraftChange({ [field]: value });
  }

  function updateCustomField(fieldKey, value) {
    onDraftChange({
      customFields: {
        ...(draft.customFields || {}),
        [fieldKey]: value,
      },
    });
  }

  async function searchEmployeeRecords() {
    if (!onSearchEmployees) {
      setEmployeeLookupError("Employee search is not configured.");
      return;
    }

    const query = String(employeeQuery || "").trim();
    if (!query) {
      setEmployeeLookupError("Enter employee ID, name, or CNIC to search.");
      setEmployeeResults([]);
      return;
    }

    setEmployeeLookupBusy(true);
    setEmployeeLookupError("");

    try {
      const rows = await onSearchEmployees(query);
      setEmployeeResults(rows);
      if (!rows.length) {
        setEmployeeLookupError("No employee found for this search.");
      }
    } catch (error) {
      setEmployeeResults([]);
      setEmployeeLookupError(error?.message || "Employee lookup failed.");
    } finally {
      setEmployeeLookupBusy(false);
    }
  }

  function applyEmployeeToDraft(employee) {
    const address = employee.currentAddress || employee.permanentAddress || "";

    onDraftChange({
      recipientName: employee.fullName || draft.recipientName || "",
      recipientDepartment: employee.departmentName || draft.recipientDepartment || "",
      employeeEmpId: employee.empId || "",
      employeeFullName: employee.fullName || "",
      employeeCnic: employee.cnic || "",
      employeeDesignation: employee.designation || "",
      employeeDepartmentName: employee.departmentName || "",
      employeePersonalPhone: employee.personalPhone || "",
      employeeCompanyEmail: employee.companyEmail || "",
      employeeAddress: address,
      employeeJoiningDate: employee.joiningDate || "",
      employeeReportingManager: employee.reportingManager || "",
    });
  }

  return (
    <section className="view is-active">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>{isEditingLetter ? "Edit letter" : "Issue letter"}</h2>
        </div>
      </div>

      <div className="issue-layout">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Form</p>
              <h3>Letter details</h3>
            </div>
          </div>

          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              onIssueLetter();
            }}
          >
            <label>
              Company
              <select
                required
                value={draft.companyId}
                onChange={(event) => updateField("companyId", event.target.value)}
                disabled={!hasCompanyOptions}
              >
                <option value="">{hasCompanyOptions ? "Select company" : "No companies available"}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.shortCode})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Department
              <select
                required
                value={draft.departmentId}
                onChange={(event) => updateField("departmentId", event.target.value)}
                disabled={!hasDepartmentOptions}
              >
                <option value="">{hasDepartmentOptions ? "Select department" : "No departments available"}</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name} ({department.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Template
              <select
                required
                value={draft.templateId}
                onChange={(event) => updateField("templateId", event.target.value)}
                disabled={!hasTemplateOptions}
              >
                <option value="">{hasTemplateOptions ? "Select template" : "No templates available"}</option>
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.type})
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row span-2">
              <button className="button button-secondary" type="button" onClick={onEditTemplate} disabled={!selectedTemplate}>
                Edit Selected Template
              </button>
            </div>
            {selectionWarning ? <p className="helper-note helper-note--warning span-2">{selectionWarning}</p> : null}
            <div className="design-settings span-2 employee-lookup-panel">
              <div className="design-settings__header">
                <div>
                  <p className="eyebrow">HR Sync</p>
                  <h3>Fetch employee details</h3>
                </div>
              </div>
              <div className="employee-lookup-toolbar">
                <input
                  type="text"
                  value={employeeQuery}
                  onChange={(event) => setEmployeeQuery(event.target.value)}
                  placeholder="Search by Employee ID, name, or CNIC"
                />
                <button className="button button-secondary" type="button" onClick={searchEmployeeRecords} disabled={employeeLookupBusy}>
                  {employeeLookupBusy ? "Searching..." : "Search"}
                </button>
              </div>
              {employeeLookupError ? <p className="employee-lookup-error">{employeeLookupError}</p> : null}
              {employeeResults.length ? (
                <div className="employee-lookup-results">
                  {employeeResults.map((employee) => (
                    <article className="employee-lookup-card" key={employee.id || employee.empId}>
                      <div>
                        <strong>{employee.fullName || "Unnamed Employee"}</strong>
                        <p>
                          {employee.empId || "No ID"} {employee.cnic ? `| CNIC: ${employee.cnic}` : ""}
                        </p>
                        <p>
                          {employee.departmentName || "No department"} {employee.designation ? `| ${employee.designation}` : ""}
                        </p>
                      </div>
                      <button className="button button-secondary" type="button" onClick={() => applyEmployeeToDraft(employee)}>
                        Use
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="span-2">
              Letter no override (optional)
              <input
                type="text"
                value={draft.letterNoManual || ""}
                onChange={(event) => updateField("letterNoManual", event.target.value)}
                placeholder="Leave blank for auto numbering"
              />
            </label>
            <label className="span-2">
              Serial override / start from (optional)
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.sequenceOverride || ""}
                onChange={(event) => updateField("sequenceOverride", event.target.value.replace(/\D/g, ""))}
                placeholder="Example: 102 or 0015"
              />
            </label>
            <label className="span-2">
              Reference format override (optional)
              <input
                type="text"
                value={draft.letterNoFormatOverride || ""}
                onChange={(event) => updateField("letterNoFormatOverride", event.target.value)}
                placeholder="Leave blank to use department/company format"
              />
            </label>
            <div className="helper-note span-2" style={{ marginTop: 0 }}>
              Active reference format: <code>{activeReferencePattern}</code>
              <br />
              Preview reference no: <code>{previewReferenceNo || "Pending..."}</code>
              <br />
              Tokens: <code>{"{{company_code}}"}</code>, <code>{"{{department_code}}"}</code>, <code>{"{{template_code}}"}</code>, <code>{"{{year}}"}</code>, <code>{"{{yy}}"}</code>, <code>{"{{month}}"}</code>, <code>{"{{day}}"}</code>, <code>{"{{sequence}}"}</code>, <code>{"{{sequence2}}"}</code>, <code>{"{{sequence3}}"}</code>, <code>{"{{sequence4}}"}</code>. You can also use <code>____</code> for auto sequence.
              <br />
              Sequence tracking is department-based (shared across templates in the same department).
              <br />
              Employee tokens available in templates: <code>{"{{employee_name}}"}</code>, <code>{"{{employee_emp_id}}"}</code>, <code>{"{{employee_cnic}}"}</code>, <code>{"{{employee_designation}}"}</code>, <code>{"{{employee_department}}"}</code>, <code>{"{{employee_address}}"}</code>, <code>{"{{employee_joining_date}}"}</code>, <code>{"{{joining_date}}"}</code>.
            </div>
            <label>
              Issue date
              <input required type="date" value={draft.issueDate} onChange={(event) => updateField("issueDate", event.target.value)} />
            </label>
            <label>
              Subject
              <input
                required
                type="text"
                value={draft.subject}
                onChange={(event) => updateField("subject", event.target.value)}
                placeholder="Employment Confirmation"
              />
            </label>
            <label>
              Recipient name
              <input
                required
                type="text"
                value={draft.recipientName}
                onChange={(event) => updateField("recipientName", event.target.value)}
                placeholder="Muhammad Ali"
              />
            </label>
            <label>
              Recipient company
              <input
                type="text"
                value={draft.recipientCompany}
                onChange={(event) => updateField("recipientCompany", event.target.value)}
                placeholder="ABC Traders"
              />
            </label>
            <label>
              Recipient department
              <input
                type="text"
                value={draft.recipientDepartment}
                onChange={(event) => updateField("recipientDepartment", event.target.value)}
                placeholder="Accounts"
              />
            </label>
            <label>
              Prepared by
              <input
                type="text"
                value={draft.preparedBy}
                onChange={(event) => updateField("preparedBy", event.target.value)}
                placeholder="HR Officer"
              />
            </label>
            <label>
              Approved by
              <input
                type="text"
                value={draft.approvedBy}
                onChange={(event) => updateField("approvedBy", event.target.value)}
                placeholder="GM HR"
              />
            </label>
            <label>
              Employee ID
              <input
                type="text"
                value={draft.employeeEmpId || ""}
                onChange={(event) => updateField("employeeEmpId", event.target.value)}
                placeholder="EMP-0001"
              />
            </label>
            <label>
              Employee CNIC
              <input
                type="text"
                value={draft.employeeCnic || ""}
                onChange={(event) => updateField("employeeCnic", event.target.value)}
                placeholder="42501-1234567-1"
              />
            </label>
            <label>
              Employee designation
              <input
                type="text"
                value={draft.employeeDesignation || ""}
                onChange={(event) => updateField("employeeDesignation", event.target.value)}
                placeholder="Officer / Manager"
              />
            </label>
            <label>
              Employee department (override)
              <input
                type="text"
                value={draft.employeeDepartmentName || ""}
                onChange={(event) => updateField("employeeDepartmentName", event.target.value)}
                placeholder="Human Resources"
              />
            </label>
            <label>
              Employee phone
              <input
                type="text"
                value={draft.employeePersonalPhone || ""}
                onChange={(event) => updateField("employeePersonalPhone", event.target.value)}
                placeholder="+92..."
              />
            </label>
            <label>
              Employee company email
              <input
                type="email"
                value={draft.employeeCompanyEmail || ""}
                onChange={(event) => updateField("employeeCompanyEmail", event.target.value)}
                placeholder="name@company.com"
              />
            </label>
            <label>
              Employee joining date
              <input
                type="date"
                value={draft.employeeJoiningDate || ""}
                onChange={(event) => updateField("employeeJoiningDate", event.target.value)}
              />
            </label>
            <label>
              Reporting manager
              <input
                type="text"
                value={draft.employeeReportingManager || ""}
                onChange={(event) => updateField("employeeReportingManager", event.target.value)}
                placeholder="Manager name"
              />
            </label>
            <label className="span-2">
              Employee address
              <textarea
                rows={2}
                value={draft.employeeAddress || ""}
                onChange={(event) => updateField("employeeAddress", event.target.value)}
                placeholder="Current or permanent address"
              />
            </label>
            {customFieldDefinitions.length ? (
              <div className="span-2">
                <div className="dynamic-field-heading">
                  <p className="eyebrow">Custom</p>
                  <h4>Template dynamic fields</h4>
                </div>
                <div className="dynamic-field-grid">
                  {customFieldDefinitions.map((field) => (
                    <label key={field.key} className={field.type === "textarea" ? "span-2" : ""}>
                      {field.label}
                      {field.type === "textarea" ? (
                        <textarea
                          rows={4}
                          required={field.required}
                          value={(draft.customFields && draft.customFields[field.key]) || ""}
                          onChange={(event) => updateCustomField(field.key, event.target.value)}
                          placeholder={field.placeholder || `Enter ${field.label}`}
                        />
                      ) : (
                        <input
                          required={field.required}
                          type="text"
                          value={(draft.customFields && draft.customFields[field.key]) || ""}
                          onChange={(event) => updateCustomField(field.key, event.target.value)}
                          placeholder={field.placeholder || `Enter ${field.label}`}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {dynamicTokenFields.length ? (
              <div className="span-2">
                <div className="dynamic-field-heading">
                  <p className="eyebrow">Template Tokens</p>
                  <h4>Detected token inputs</h4>
                </div>
                <div className="dynamic-field-grid">
                  {dynamicTokenFields.map((field) => (
                    <label key={field.key}>
                      {field.label} <code>{field.token}</code>
                      <input
                        type="text"
                        value={(draft.customFields && draft.customFields[field.key]) || ""}
                        onChange={(event) => updateCustomField(field.key, event.target.value)}
                        placeholder={`Enter ${field.label}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="span-2">
              Body notes
              <textarea
                rows={6}
                value={draft.bodyNotes}
                onChange={(event) => updateField("bodyNotes", event.target.value)}
                placeholder="Additional details for this specific letter"
              />
            </label>
            <label className="span-2">
              Remarks
              <textarea
                rows={3}
                value={draft.remarks}
                onChange={(event) => updateField("remarks", event.target.value)}
                placeholder="Internal note or dispatch reference"
              />
            </label>
            <div className="button-row span-2">
              <button className="button button-primary" type="submit" disabled={!canIssueLetter}>
                {isEditingLetter ? "Update letter record" : "Generate letter record"}
              </button>
              <button className="button button-secondary" type="button" onClick={onPrint} disabled={!preview}>
                Print / Save PDF
              </button>
              {isEditingLetter ? (
                <button className="button button-secondary" type="button" onClick={onCancelEditLetter}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel panel-preview">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Preview</p>
              <h3>Printable letter</h3>
            </div>
          </div>

          <div className="letter-preview">
            <LetterPreview preview={preview} />
          </div>
        </article>
      </div>
    </section>
  );
}

