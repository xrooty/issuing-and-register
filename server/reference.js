import { randomUUID } from "node:crypto";

export const DEFAULT_REFERENCE_PATTERN = "{{company_code}}/{{department_code}}/{{template_code}}/{{year}}-{{month}}/{{sequence3}}";

function splitWords(value) {
  return String(value || "").match(/[A-Za-z0-9]+/g) || [];
}

function normalizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function deriveInitialCode(value, { singleWordLength = 3, maxInitials = 4, fallback = "DOC" } = {}) {
  const words = splitWords(value);
  if (!words.length) {
    return fallback;
  }

  if (words.length === 1) {
    return normalizeCode(words[0].slice(0, singleWordLength)) || fallback;
  }

  return normalizeCode(words.map((word) => word[0]).join("").slice(0, maxInitials)) || fallback;
}

export function resolveCompanyCode(company) {
  return normalizeCode(company?.shortCode) || deriveInitialCode(company?.name, { singleWordLength: 2, maxInitials: 4, fallback: "CMP" });
}

export function resolveDepartmentCode(department) {
  return normalizeCode(department?.code) || deriveInitialCode(department?.name, { singleWordLength: 3, maxInitials: 4, fallback: "DEP" });
}

export function deriveTemplateCode(template) {
  const explicitCode = normalizeCode(template?.refCode);
  if (explicitCode) {
    return explicitCode;
  }

  const source = String(template?.type || template?.name || "").trim();
  const lowered = source.toLowerCase();

  if (lowered.includes("offer")) {
    return "OFFER";
  }

  if (lowered.includes("promotion")) {
    return "PROM";
  }

  if (lowered.includes("warning")) {
    return "WARN";
  }

  if (lowered.includes("certificate")) {
    return "CERT";
  }

  if (lowered.includes("notice")) {
    return "NOTICE";
  }

  return deriveInitialCode(source, { singleWordLength: 5, maxInitials: 5, fallback: "DOC" });
}

export function normalizeReferencePattern(pattern) {
  if (typeof pattern !== "string") {
    return "";
  }

  return pattern.trim();
}

export function resolveReferencePattern({ company, department, template, draftPattern }) {
  const preferred =
    normalizeReferencePattern(draftPattern) ||
    normalizeReferencePattern(template?.letterNoPattern) ||
    normalizeReferencePattern(department?.letterNoPattern) ||
    normalizeReferencePattern(company?.letterNoPattern);

  return preferred || DEFAULT_REFERENCE_PATTERN;
}

export function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getDateParts(issueDate) {
  const safeDate = String(issueDate || getTodayIso());
  const year = safeDate.slice(0, 4);
  const yy = year.slice(-2);
  const month = safeDate.slice(5, 7);
  const day = safeDate.slice(8, 10);

  return { year, yy, month, day };
}

function formatSequenceWithLength(sequence, length) {
  return String(sequence).padStart(length, "0");
}

function fillPlaceholders(template, values) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? "");
}

export function getSequenceKey({ company, department }) {
  return [company.id, department.id].join(":");
}

export function applyReferencePattern({ pattern, company, department, template, issueDate, sequence }) {
  const { year, yy, month, day } = getDateParts(issueDate);
  const safePattern = normalizeReferencePattern(pattern) || DEFAULT_REFERENCE_PATTERN;

  const tokenValues = {
    company_code: resolveCompanyCode(company),
    department_code: resolveDepartmentCode(department),
    template_code: deriveTemplateCode(template),
    template_name: template?.name || "",
    template_type: template?.type || template?.name || "",
    year,
    yy,
    month,
    day,
    sequence: String(sequence),
    sequence2: formatSequenceWithLength(sequence, 2),
    sequence3: formatSequenceWithLength(sequence, 3),
    sequence4: formatSequenceWithLength(sequence, 4),
    sequence5: formatSequenceWithLength(sequence, 5),
    sequence6: formatSequenceWithLength(sequence, 6),
  };

  const withNamedTokens = fillPlaceholders(safePattern, tokenValues);

  return withNamedTokens
    .replace(/_{2,}/g, (match) => formatSequenceWithLength(sequence, match.length))
    .replace(/#{2,}/g, (match) => formatSequenceWithLength(sequence, match.length));
}

export function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function buildLetterValueMap({ company, department, template, values }) {
  const safeValues = values || {};
  const { year, yy, month, day } = getDateParts(safeValues.issueDate || "");
  const companyCode = resolveCompanyCode(company);
  const departmentCode = resolveDepartmentCode(department);
  const templateCode = deriveTemplateCode(template);

  const valueMap = {
    letter_no: safeValues.letterNo || "",
    issue_date: formatDate(safeValues.issueDate || ""),
    subject: safeValues.subject || "",
    recipient_name: safeValues.recipientName || "",
    recipient_company: safeValues.recipientCompany || "",
    recipient_department: safeValues.recipientDepartment || "",
    prepared_by: safeValues.preparedBy || "",
    approved_by: safeValues.approvedBy || "",
    remarks: safeValues.remarks || "",
    body_notes: safeValues.bodyNotes || "",
    company_name: company?.name || "",
    company_code: companyCode,
    company_address: company?.address || "",
    company_phone: company?.phone || "",
    company_email: company?.email || "",
    company_footer: company?.footerText || "",
    department_name: department?.name || "",
    department_code: departmentCode,
    template_name: template?.name || "",
    template_type: template?.type || template?.name || "",
    template_code: templateCode,
    year,
    yy,
    month,
    day,
    year_month: `${year}-${month}`,
  };

  const resolvedBodyTemplate = fillPlaceholders(template?.bodyTemplate || "", valueMap).trim();
  const resolvedBody = resolvedBodyTemplate || valueMap.body_notes || valueMap.subject;

  return {
    ...valueMap,
    body_text: resolvedBody,
  };
}

export function createLetterPayload({ company, department, template, draft, letterNo, patternInUse }) {
  const values = {
    ...draft,
    letterNo,
  };

  const renderedValues = buildLetterValueMap({ company, department, template, values });
  const pdfFileName = `${letterNo.replace(/\//g, "-")}-${slugify(draft.recipientName || "letter")}.pdf`;
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    companyId: company.id,
    departmentId: department.id,
    templateId: template.id,
    templateTypeId: template.templateTypeId || null,
    letterNo,
    letterNoManual: String(draft.letterNoManual || "").trim(),
    letterNoFormatOverride: normalizeReferencePattern(draft.letterNoFormatOverride),
    letterNoPatternUsed: patternInUse,
    issueDate: draft.issueDate,
    recipientName: draft.recipientName || "",
    recipientCompany: draft.recipientCompany || "",
    recipientDepartment: draft.recipientDepartment || "",
    subject: draft.subject || template.defaultSubject || template.name || "",
    bodyNotes: draft.bodyNotes || "",
    preparedBy: draft.preparedBy || "",
    approvedBy: draft.approvedBy || "",
    remarks: draft.remarks || "",
    renderedBody: renderedValues.body_text,
    pdfFileName,
    pdfStoragePath: `storage/pdfs/${pdfFileName}`,
    templateSnapshot: {
      id: template.id,
      name: template.name,
      type: template.type,
      refCode: template.refCode || "",
      defaultSubject: template.defaultSubject || "",
      bodyTemplate: template.bodyTemplate || "",
      letterNoPattern: template.letterNoPattern || "",
      design: template.design || {},
      templateTypeId: template.templateTypeId || null,
    },
    createdAt: now,
  };
}
