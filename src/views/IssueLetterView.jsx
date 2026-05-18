import { useEffect, useMemo, useRef, useState } from "react";
import LetterPreview from "../components/LetterPreview";
import {
  DEFAULT_REFERENCE_PATTERN,
  ISSUE_LETTER_TYPE_OPTIONS,
  formatDate,
  getRegisterNumberLabel,
  getTemplateDynamicTokenFields,
  normalizeTemplateCustomFields,
  templateMatchesIssueLetterType,
  resolveReferencePattern,
} from "../utils/lettering";

export default function IssueLetterView({
  companies,
  departments,
  templates,
  clients = [],
  clientFields = [],
  letters = [],
  draft,
  preview,
  onDraftChange,
  onIssueLetter,
  onPrint,
  onEditTemplate,
  isEditingLetter,
  onCancelEditLetter,
}) {
  function getClientSearchLabel(client) {
    return `${client.client_name || client.contact_name || client.company || client.email}`;
  }

  function getClientSearchText(client) {
    return [
      client.client_name,
      client.full_name,
      client.contact_name,
      client.company,
      client.email,
      client.email_secondary,
      client.phone,
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function getLetterType(letter) {
    const template = templates.find((item) => item.id === letter.templateId);
    const typeText = String(
      template?.type
      || template?.name
      || letter?.templateSnapshot?.type
      || letter?.legacyTemplateType
      || letter?.subject
      || "",
    ).toLowerCase();
    return typeText.includes("ag") || typeText.includes("agreement") || typeText.includes("legal") ? "AG" : "LETTER";
  }

  const selectedCompany = companies.find((company) => company.id === draft.companyId) || null;
  const departmentOptions = departments.filter((department) => department.companyId === draft.companyId);
  const selectedDepartment = departmentOptions.find((department) => department.id === draft.departmentId) || null;
  const templateOptions = templates.filter(
    (template) => template.companyId === draft.companyId && template.departmentId === draft.departmentId,
  ).filter((template) => templateMatchesIssueLetterType(template, draft.letterType));
  const selectedTemplate = templateOptions.find((template) => template.id === draft.templateId) || null;
  const selectedTemplateTypeName = String(selectedTemplate?.type || selectedTemplate?.name || draft.letterType || "").trim();
  const manualNumberLabel = getRegisterNumberLabel(selectedTemplateTypeName || "Letter");
  const selectedClient = clients.find((client) => {
    if (client.id === (draft.clientId || "")) {
      return true;
    }
    const recipientName = String(draft.recipientName || draft.employeeFullName || "").trim().toLowerCase();
    const recipientCompany = String(draft.recipientCompany || "").trim().toLowerCase();
    const clientName = String(client.client_name || client.full_name || client.contact_name || "").trim().toLowerCase();
    const clientCompany = String(client.company || "").trim().toLowerCase();
    return (!draft.clientId && recipientName && clientName === recipientName)
      || (!draft.clientId && recipientCompany && clientCompany === recipientCompany);
  }) || null;
  const selectedClientSearchText = selectedClient
    ? getClientSearchLabel(selectedClient)
    : "";
  const [clientSearchQuery, setClientSearchQuery] = useState(selectedClientSearchText);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedRelatedLetterId, setSelectedRelatedLetterId] = useState("");
  const generateClickRequestedRef = useRef(false);
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

  function selectClient(client) {
    setClientSearchQuery(client ? getClientSearchLabel(client) : "");
    setShowClientSuggestions(false);
    setSelectedRelatedLetterId("");
    updateField("clientId", client?.id || "");
  }

  function searchClient() {
    const query = clientSearchQuery.trim().toLowerCase();
    if (!query) {
      selectClient(null);
      return;
    }
    const match = clients.find((client) => getClientSearchText(client).includes(query));
    if (match) {
      selectClient(match);
    }
  }

  function handleIssueSubmit(event) {
    event.preventDefault();
  }

  function handleGenerateLetterClick(event) {
    if (!generateClickRequestedRef.current) {
      return;
    }
    generateClickRequestedRef.current = false;

    const form = event.currentTarget.form;
    if (form && !form.reportValidity()) {
      return;
    }

    onIssueLetter();
  }

  useEffect(() => {
    setClientSearchQuery(selectedClientSearchText);
  }, [selectedClientSearchText]);

  useEffect(() => {
    setSelectedRelatedLetterId("");
  }, [draft.clientId]);

  const clientSuggestions = useMemo(() => {
    const query = clientSearchQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return clients
      .filter((client) => getClientSearchText(client).includes(query))
      .slice(0, 5);
  }, [clients, clientSearchQuery]);

  const selectedClientLetters = useMemo(() => {
    if (!selectedClient) {
      return [];
    }

    const clientName = String(selectedClient.client_name || selectedClient.full_name || selectedClient.contact_name || "").trim().toLowerCase();
    const clientEmail = String(selectedClient.email || "").trim().toLowerCase();
    const clientCompany = String(selectedClient.company || "").trim().toLowerCase();

    return (letters || [])
      .filter((letter) => {
        if (letter.clientId === selectedClient.id) {
          return true;
        }
        const legacyName = String(letter.legacyClientName || letter.recipientName || "").trim().toLowerCase();
        const legacyEmail = String(letter.legacyClientEmail || "").trim().toLowerCase();
        const legacyCompany = String(letter.legacyClientCompany || letter.recipientCompany || "").trim().toLowerCase();
        return (clientEmail && legacyEmail === clientEmail)
          || (clientName && legacyName === clientName)
          || (clientCompany && legacyCompany === clientCompany);
      })
      .map((letter) => ({
        ...letter,
        issueRecordType: getLetterType(letter),
      }))
      .sort((a, b) => new Date(b.createdAt || b.issueDate || 0).getTime() - new Date(a.createdAt || a.issueDate || 0).getTime());
  }, [letters, selectedClient, templates]);

  const selectedRelatedLetter = selectedClientLetters.find((letter) => letter.id === selectedRelatedLetterId) || null;
  const selectedAgRecord = selectedRelatedLetter?.issueRecordType === "AG" ? selectedRelatedLetter : null;
  const selectedClientLetterCount = selectedClientLetters.filter((letter) => letter.issueRecordType === "LETTER").length;
  const selectedClientAgCount = selectedClientLetters.filter((letter) => letter.issueRecordType === "AG").length;

  function applySelectedAgData() {
    if (!selectedAgRecord) {
      return;
    }

    const agNo = selectedAgRecord.letterNo || "";
    const agDate = selectedAgRecord.issueDate || "";
    const nextCustomFields = {
      ...(draft.customFields || {}),
      ag_number: agNo,
      ag_no: agNo,
      agreement_number: agNo,
      agreement_no: agNo,
      ag_issue_date: agDate,
      agreement_date: agDate,
    };

    onDraftChange({
      clientId: selectedClient?.id || draft.clientId || "",
      recipientName: draft.recipientName || selectedAgRecord.recipientName || "",
      recipientCompany: draft.recipientCompany || selectedAgRecord.recipientCompany || "",
      recipientDepartment: draft.recipientDepartment || selectedAgRecord.recipientDepartment || "",
      employeeEmpId: draft.employeeEmpId || selectedAgRecord.templateSnapshot?.employeeData?.empId || "",
      employeeFullName: draft.employeeFullName || selectedAgRecord.templateSnapshot?.employeeData?.fullName || selectedAgRecord.recipientName || "",
      employeeCnic: draft.employeeCnic || selectedAgRecord.templateSnapshot?.employeeData?.cnic || "",
      employeeDesignation: draft.employeeDesignation || selectedAgRecord.templateSnapshot?.employeeData?.designation || "",
      employeeDepartmentName: draft.employeeDepartmentName || selectedAgRecord.templateSnapshot?.employeeData?.departmentName || selectedAgRecord.recipientDepartment || "",
      employeePersonalPhone: draft.employeePersonalPhone || selectedAgRecord.templateSnapshot?.employeeData?.personalPhone || "",
      employeeCompanyEmail: draft.employeeCompanyEmail || selectedAgRecord.templateSnapshot?.employeeData?.companyEmail || "",
      employeeAddress: draft.employeeAddress || selectedAgRecord.templateSnapshot?.employeeData?.address || "",
      employeeJoiningDate: draft.employeeJoiningDate || selectedAgRecord.templateSnapshot?.employeeData?.joiningDate || "",
      employeeReportingManager: draft.employeeReportingManager || selectedAgRecord.templateSnapshot?.employeeData?.reportingManager || "",
      customFields: nextCustomFields,
    });
  }

  const selectedClientEntries = selectedClient
    ? clientFields
      .filter((field) => field.is_active)
      .map((field) => {
        const rawValue = selectedClient[field.field_key] ?? selectedClient.custom_fields_json?.[field.field_key];
        return {
          key: field.field_key,
          label: field.label || field.field_key,
          value: rawValue == null ? "" : String(rawValue).trim(),
        };
      })
      .filter((item) => item.value)
    : [];

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
            onSubmit={handleIssueSubmit}
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
              Letter Type
              <select
                required
                value={draft.letterType || "LETTER"}
                onChange={(event) => updateField("letterType", event.target.value)}
                disabled={!selectedCompany || !selectedDepartment}
              >
                {ISSUE_LETTER_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
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
                <option value="">{hasTemplateOptions ? "Select template" : `No ${draft.letterType === "AG" ? "AG" : "Letter"} templates available`}</option>
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.type})
                  </option>
                ))}
              </select>
            </label>
            <div className="span-2 form-field">
              <span>Client Profile (optional)</span>
              <div className="client-search-control">
                <input
                  value={clientSearchQuery}
                  onChange={(event) => {
                    const text = String(event.target.value || "");
                    setClientSearchQuery(text);
                    setShowClientSuggestions(true);
                    if (!text.trim()) {
                      updateField("clientId", "");
                    }
                  }}
                  onFocus={() => setShowClientSuggestions(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      searchClient();
                    }
                    if (event.key === "Escape") {
                      setShowClientSuggestions(false);
                    }
                  }}
                  placeholder="Search client by name / email"
                />
                <button className="button button-secondary" type="button" onClick={searchClient}>
                  Search
                </button>
                {showClientSuggestions && clientSuggestions.length ? (
                  <div className="client-search-suggestions" role="listbox">
                    {clientSuggestions.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="client-search-suggestion"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectClient(client)}
                      >
                        <strong>{getClientSearchLabel(client)}</strong>
                        <span>{[client.email, client.phone, client.company].filter(Boolean).join(" / ") || "Client profile"}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            {selectedClient ? (
              <div className="span-2 design-settings issue-client-profile">
                <div className="design-settings__header issue-client-profile__header">
                  <div>
                    <p className="eyebrow">Client Profile</p>
                    <h3>{selectedClient.client_name || selectedClient.full_name || selectedClient.company || "Selected client"}</h3>
                    <p>{[selectedClient.email, selectedClient.phone, selectedClient.company].filter(Boolean).join(" / ") || "Client selected"}</p>
                  </div>
                  <div className="issue-client-profile__stats">
                    <span><strong>{selectedClientLetters.length}</strong> Total</span>
                    <span><strong>{selectedClientLetterCount}</strong> Letters</span>
                    <span><strong>{selectedClientAgCount}</strong> AG</span>
                  </div>
                </div>
                <div className="issue-client-profile__section">
                  <div className="issue-client-profile__section-heading">
                    <h4>Profile data</h4>
                    <span>Saved client fields</span>
                  </div>
                  {selectedClientEntries.length ? (
                    <div className="issue-client-profile__grid">
                      {selectedClientEntries.map((entry) => (
                        <div key={entry.key} className="issue-client-profile__item">
                          <span>{entry.label}</span>
                          <strong>{entry.value}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="helper-note" style={{ marginTop: 0 }}>No profile fields available for this client.</p>
                  )}
                </div>
                <div className="issue-client-profile__section issue-client-history">
                  <div className="issue-client-profile__section-heading">
                    <h4>Letter / AG history</h4>
                    <span>Select an AG to reuse its number and issue date</span>
                  </div>
                  {selectedClientLetters.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Letter No</th>
                            <th>AG No</th>
                            <th>Subject</th>
                            <th>Issue Date</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedClientLetters.map((letter) => (
                            <tr key={letter.id} className={selectedRelatedLetterId === letter.id ? "is-selected-row" : ""}>
                              <td>{letter.issueRecordType}</td>
                              <td>{letter.issueRecordType === "LETTER" ? letter.letterNo : "-"}</td>
                              <td>{letter.issueRecordType === "AG" ? letter.letterNo : "-"}</td>
                              <td>{letter.subject || "-"}</td>
                              <td>{formatDate(letter.issueDate || letter.createdAt)}</td>
                              <td>
                                <button className="button button-secondary" type="button" onClick={() => setSelectedRelatedLetterId(letter.id)}>
                                  Select
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="helper-note" style={{ marginTop: 0 }}>No letter or AG records found for this client.</p>
                  )}
                </div>
                {selectedAgRecord ? (
                  <div className="issue-client-profile__section issue-ag-detail">
                    <div className="issue-client-profile__section-heading">
                      <div>
                      <p className="eyebrow">Selected AG</p>
                      <h4>{selectedAgRecord.letterNo || "AG record"}</h4>
                      </div>
                      <span>Ready to reuse</span>
                    </div>
                    <div className="issue-client-profile__grid">
                      <div className="issue-client-profile__item"><span>AG Number</span><strong>{selectedAgRecord.letterNo || "-"}</strong></div>
                      <div className="issue-client-profile__item"><span>Issue Date</span><strong>{formatDate(selectedAgRecord.issueDate || selectedAgRecord.createdAt)}</strong></div>
                      <div className="issue-client-profile__item"><span>Subject</span><strong>{selectedAgRecord.subject || "-"}</strong></div>
                      <div className="issue-client-profile__item"><span>Recipient</span><strong>{selectedAgRecord.recipientName || "-"}</strong></div>
                    </div>
                    <button className="button button-primary" type="button" onClick={applySelectedAgData}>
                      Use AG data
                    </button>
                  </div>
                ) : selectedRelatedLetter ? (
                  <p className="helper-note" style={{ marginTop: 12 }}>Selected record is a letter. Select an AG row to reuse AG number and issue date.</p>
                ) : null}
              </div>
            ) : null}
            <div className="button-row span-2">
              <button className="button button-secondary" type="button" onClick={onEditTemplate} disabled={!selectedTemplate}>
                Edit Selected Template
              </button>
            </div>
            {selectionWarning ? <p className="helper-note helper-note--warning span-2">{selectionWarning}</p> : null}
            <label className="span-2">
              {manualNumberLabel} override (optional)
              <input
                type="text"
                value={draft.letterNoManual || ""}
                onChange={(event) => updateField("letterNoManual", event.target.value)}
                placeholder={`Leave blank for auto ${manualNumberLabel.toLowerCase()}`}
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
                      {field.label} {field.required ? "*" : ""} <code>{field.token}</code>
                      <input
                        required={field.required}
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
              <button
                className="button button-primary"
                type="button"
                disabled={!canIssueLetter}
                onPointerDown={() => {
                  generateClickRequestedRef.current = true;
                }}
                onClick={handleGenerateLetterClick}
              >
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

