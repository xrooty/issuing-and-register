export const DEFAULT_TEMPLATE_DESIGN = {
  layout: "classic",
  renderMode: "standard",
  accentColor: "#0c6b58",
  secondaryColor: "#c96a3d",
  titleText: "",
  showContactLine: true,
  showSignatureLine: true,
  showDecorativeHeader: true,
  pagePaddingX: 0,
  pagePaddingY: 0,
  pageSize: "A4",
  additionalPages: 0,
  backgroundImage: {
    dataUrl: "",
    fileName: "",
    fit: "cover",
    opacity: 100,
  },
  canvas: {
    elements: [],
  },
  customFields: [],
  requiredTokenKeys: [],
};

export const DEFAULT_REFERENCE_PATTERN = "{{company_code}}/{{department_code}}/{{template_code}}/{{year}}-{{month}}/{{sequence3}}";

export const ISSUE_LETTER_TYPE_OPTIONS = [
  { value: "LETTER", label: "Letter" },
  { value: "AG", label: "AG" },
];

export const LETTER_FIELD_OPTIONS = [
  { key: "letter_no", label: "Letter Number" },
  { key: "issue_date", label: "Issue Date" },
  { key: "company_name", label: "Company Name" },
  { key: "company_code", label: "Company Code" },
  { key: "company_address", label: "Company Address" },
  { key: "company_phone", label: "Company Phone" },
  { key: "company_email", label: "Company Email" },
  { key: "department_name", label: "Department Name" },
  { key: "department_code", label: "Department Code" },
  { key: "template_name", label: "Template Name" },
  { key: "template_type", label: "Template Type" },
  { key: "template_code", label: "Template Code" },
  { key: "subject", label: "Subject" },
  { key: "recipient_name", label: "Recipient Name" },
  { key: "recipient_company", label: "Recipient Company" },
  { key: "recipient_department", label: "Recipient Department" },
  { key: "prepared_by", label: "Prepared By" },
  { key: "approved_by", label: "Approved By" },
  { key: "remarks", label: "Remarks" },
  { key: "body_notes", label: "Body Notes" },
  { key: "body_text", label: "Rendered Body Text" },
  { key: "employee_emp_id", label: "Employee ID" },
  { key: "employee_name", label: "Employee Name" },
  { key: "employee_cnic", label: "Employee CNIC" },
  { key: "employee_designation", label: "Employee Designation" },
  { key: "employee_department", label: "Employee Department" },
  { key: "employee_phone", label: "Employee Phone" },
  { key: "employee_email", label: "Employee Company Email" },
  { key: "employee_address", label: "Employee Address" },
  { key: "employee_joining_date", label: "Employee Joining Date" },
  { key: "joining_date", label: "Joining Date (Alias)" },
  { key: "employee_reporting_manager", label: "Employee Reporting Manager" },
];

const FIELD_KEY_SET = new Set(LETTER_FIELD_OPTIONS.map((option) => option.key));
const FIELD_LABEL_MAP = new Map(LETTER_FIELD_OPTIONS.map((option) => [option.key, option.label]));
const RESERVED_DYNAMIC_KEYS = new Set([
  ...FIELD_KEY_SET,
  "year",
  "yy",
  "month",
  "day",
  "year_month",
  "sequence",
  "sequence2",
  "sequence3",
  "sequence4",
  "sequence5",
  "sequence6",
  "custom_fields_block",
  "custom_fields",
  "value",
]);
const SUPPORTED_ELEMENT_TYPES = ["text", "rect", "line", "field"];
const SUPPORTED_RENDER_MODES = ["standard", "background"];
const SUPPORTED_IMAGE_FIT = ["cover", "contain", "fill"];
const SUPPORTED_ALIGNMENTS = ["left", "center", "right", "justify"];
const SUPPORTED_TEXT_DECORATIONS = ["none", "underline"];
const SUPPORTED_FONT_FAMILIES = [
  "inherit",
  "'Poppins', 'Segoe UI', sans-serif",
  "'Montserrat', 'Segoe UI', sans-serif",
  "'Inter', 'Segoe UI', sans-serif",
  "'Roboto', 'Segoe UI', sans-serif",
  "'Open Sans', 'Segoe UI', sans-serif",
  "'Lato', 'Segoe UI', sans-serif",
  "'Nunito', 'Segoe UI', sans-serif",
  "'Oswald', 'Segoe UI', sans-serif",
  "'Playfair Display', Georgia, serif",
  "'Merriweather', Georgia, serif",
  "'Segoe UI', Tahoma, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Courier New', monospace",
];
const SUPPORTED_CUSTOM_FIELD_TYPES = ["text", "textarea"];

function splitWords(value) {
  return String(value || "").match(/[A-Za-z0-9]+/g) || [];
}

function normalizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
}

export function normalizeCustomFieldKey(value, fallback = "") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return normalized || fallback;
}

function normalizeCustomFieldLabel(value, fallback) {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function normalizeCustomFieldType(value) {
  return SUPPORTED_CUSTOM_FIELD_TYPES.includes(String(value)) ? String(value) : "text";
}

function normalizeCustomFieldDefinition(field = {}, index = 0) {
  const baseLabel = normalizeCustomFieldLabel(field.label, `Custom Field ${index + 1}`);
  const key = normalizeCustomFieldKey(field.key, normalizeCustomFieldKey(baseLabel, `custom_field_${index + 1}`));

  return {
    key,
    label: baseLabel,
    placeholder: String(field.placeholder || ""),
    defaultValue: String(field.defaultValue || ""),
    type: normalizeCustomFieldType(field.type),
    required: Boolean(field.required),
  };
}

export function normalizeTemplateCustomFields(fields = []) {
  const source = Array.isArray(fields) ? fields : [];
  const usedKeys = new Set();
  const normalized = [];

  source.forEach((field, index) => {
    const next = normalizeCustomFieldDefinition(field, index);
    if (!next.key) {
      return;
    }

    let key = next.key;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${next.key}_${suffix}`;
      suffix += 1;
    }

    usedKeys.add(key);
    normalized.push({ ...next, key });
  });

  return normalized;
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

function resolveCompanyCode(company) {
  return normalizeCode(company?.shortCode) || deriveInitialCode(company?.name, { singleWordLength: 2, maxInitials: 4, fallback: "CMP" });
}

function resolveDepartmentCode(department) {
  return normalizeCode(department?.code) || deriveInitialCode(department?.name, { singleWordLength: 3, maxInitials: 4, fallback: "DEP" });
}

function deriveTemplateCode(template) {
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

function getDateParts(issueDate) {
  const safeDate = String(issueDate || getTodayIso());
  const year = safeDate.slice(0, 4);
  const yy = year.slice(-2);
  const month = safeDate.slice(5, 7);
  const day = safeDate.slice(8, 10);

  return { year, yy, month, day };
}

export function getLetterFieldLabel(fieldKey) {
  return FIELD_LABEL_MAP.get(fieldKey) || "Field";
}

export function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFieldBindingKey(value, fallback = "recipient_name") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return normalized || fallback;
}

function humanizeFieldBindingKey(fieldKey) {
  return String(fieldKey || "")
    .replace(/^cf_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function normalizeCanvasElement(element = {}, index = 0) {
  const id = element.id || createId();
  const type = SUPPORTED_ELEMENT_TYPES.includes(element.type) ? element.type : "text";
  const defaultFieldKey = "recipient_name";
  const fieldKey = normalizeFieldBindingKey(element.fieldKey, defaultFieldKey);
  const fallbackText = type === "field"
    ? (FIELD_KEY_SET.has(fieldKey) ? getLetterFieldLabel(fieldKey) : humanizeFieldBindingKey(fieldKey) || "Field")
    : type === "text"
      ? "Heading"
      : "";

  return {
    id,
    pageIndex: Math.max(0, Math.floor(toNumber(element.pageIndex, 0))),
    type,
    x: clamp(toNumber(element.x, 12), 0, 100),
    y: clamp(toNumber(element.y, 8), 0, 100),
    width: clamp(toNumber(element.width, type === "line" ? 32 : type === "field" ? 38 : 24), 1, 100),
    height: clamp(toNumber(element.height, type === "line" ? 1.4 : type === "field" ? 5 : 10), 0.8, 100),
    zIndex: toNumber(element.zIndex, index),
    text: String(element.text || fallbackText),
    fieldKey,
    color: String(element.color || "#1e2321"),
    backgroundColor: String(element.backgroundColor || (type === "rect" ? "#dbeafe" : "transparent")),
    borderColor: String(element.borderColor || "#1e2321"),
    borderWidth: clamp(toNumber(element.borderWidth, type === "line" ? 0 : 1), 0, 10),
    fontSize: clamp(toNumber(element.fontSize, type === "field" ? 14 : 18), 8, 72),
    fontFamily: SUPPORTED_FONT_FAMILIES.includes(String(element.fontFamily)) ? String(element.fontFamily) : "inherit",
    fontWeight: String(element.fontWeight) === "700" ? "700" : "400",
    textDecoration: SUPPORTED_TEXT_DECORATIONS.includes(String(element.textDecoration)) ? String(element.textDecoration) : "none",
    align: SUPPORTED_ALIGNMENTS.includes(String(element.align)) ? String(element.align) : "left",
    opacity: clamp(toNumber(element.opacity, 100), 10, 100),
    paddingX: clamp(toNumber(element.paddingX, type === "text" || type === "field" ? 6 : 0), 0, 60),
    paddingY: clamp(toNumber(element.paddingY, type === "text" || type === "field" ? 4 : 0), 0, 60),
    lineHeight: clamp(toNumber(element.lineHeight, 1.35), 0.8, 3),
    letterSpacing: clamp(toNumber(element.letterSpacing, 0), -2, 20),
  };
}

export function normalizeTemplateDesign(design = {}) {
  const merged = {
    ...DEFAULT_TEMPLATE_DESIGN,
    ...(design || {}),
  };

  const renderMode = SUPPORTED_RENDER_MODES.includes(merged.renderMode) ? merged.renderMode : "standard";
  const canvasElements = Array.isArray(merged.canvas?.elements) ? merged.canvas.elements : [];
  const sourceBackground = merged.backgroundImage || {};
  const backgroundImage = {
    dataUrl: typeof sourceBackground.dataUrl === "string" ? sourceBackground.dataUrl : "",
    fileName: typeof sourceBackground.fileName === "string" ? sourceBackground.fileName : "",
    fit: SUPPORTED_IMAGE_FIT.includes(sourceBackground.fit) ? sourceBackground.fit : "cover",
    opacity: clamp(toNumber(sourceBackground.opacity, 100), 10, 100),
  };
  const customFields = normalizeTemplateCustomFields(merged.customFields);
  const requiredTokenKeys = Array.isArray(merged.requiredTokenKeys)
    ? Array.from(
      new Set(
        merged.requiredTokenKeys
          .map((item) => normalizeCustomFieldKey(item, ""))
          .filter(Boolean),
      ),
    )
    : [];

  return {
    ...merged,
    renderMode,
    pagePaddingX: clamp(toNumber(merged.pagePaddingX, 0), 0, 25),
    pagePaddingY: clamp(toNumber(merged.pagePaddingY, 0), 0, 25),
    pageSize: String(merged.pageSize || "A4").toUpperCase() === "LEGAL" ? "LEGAL" : "A4",
    additionalPages: clamp(toNumber(merged.additionalPages, 0), 0, 50),
    backgroundImage,
    canvas: {
      elements: canvasElements
        .map((element, index) => normalizeCanvasElement(element, index))
        .sort((left, right) => (left.pageIndex - right.pageIndex) || (left.zIndex - right.zIndex))
        .map((element, index) => ({ ...element, zIndex: index })),
    },
    customFields,
    requiredTokenKeys,
  };
}

export function normalizeReferencePattern(pattern) {
  if (typeof pattern !== "string") {
    return "";
  }

  return pattern.trim();
}

export function normalizeTemplate(template) {
  return {
    ...template,
    refCode: normalizeCode(template?.refCode),
    letterNoPattern: normalizeReferencePattern(template?.letterNoPattern),
    design: normalizeTemplateDesign(template?.design),
  };
}

export function normalizeIssueLetterType(value) {
  const source = String(value || "");
  const tokens = source
    .trim()
    .toUpperCase()
    .match(/[A-Z0-9]+/g) || [];
  const compact = tokens.join("");

  return tokens.includes("AG")
    || tokens.includes("AGREEMENT")
    || tokens.includes("AGREEMENTS")
    || tokens.includes("LEGAL")
    || compact.startsWith("AGREEMENT")
    || compact.includes("LEGAL")
    ? "AG"
    : "LETTER";
}

export function getDefaultPageSizeForIssueType(value) {
  return normalizeIssueLetterType(value) === "AG" ? "LEGAL" : "A4";
}

export function normalizeTemplateDesignForIssueType(design, value) {
  return {
    ...normalizeTemplateDesign(design),
    pageSize: getDefaultPageSizeForIssueType(value),
  };
}

export function isAgTemplate(template) {
  const source = `${template?.type || ""} ${template?.name || ""}`;
  return normalizeIssueLetterType(source) === "AG";
}

export function templateMatchesIssueLetterType(template, letterType) {
  const normalizedType = normalizeIssueLetterType(letterType);
  return normalizedType === "AG" ? isAgTemplate(template) : !isAgTemplate(template);
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

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function fillPlaceholders(template, values) {
  const sourceValues = values && typeof values === "object" ? values : {};
  const normalizedValueMap = new Map();
  const lowerValueMap = new Map();

  Object.entries(sourceValues).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || "").trim();
    if (!key) {
      return;
    }

    const normalizedKey = normalizeCustomFieldKey(key, key.toLowerCase());
    if (normalizedKey) {
      normalizedValueMap.set(normalizedKey, rawValue);
    }
    lowerValueMap.set(key.toLowerCase(), rawValue);
  });

  function resolveValue(tokenKey) {
    const direct = sourceValues[tokenKey];
    if (direct !== null && direct !== undefined) {
      return direct;
    }

    const normalizedToken = normalizeCustomFieldKey(tokenKey, String(tokenKey || "").toLowerCase());
    if (normalizedToken) {
      const normalized = normalizedValueMap.get(normalizedToken);
      if (normalized !== null && normalized !== undefined) {
        return normalized;
      }

      const prefixedNormalized = normalizedValueMap.get(`cf_${normalizedToken}`);
      if (prefixedNormalized !== null && prefixedNormalized !== undefined) {
        return prefixedNormalized;
      }
    }

    const lowerToken = String(tokenKey || "").toLowerCase();
    const lower = lowerValueMap.get(lowerToken);
    if (lower !== null && lower !== undefined) {
      return lower;
    }

    const prefixedLower = lowerValueMap.get(`cf_${lowerToken}`);
    if (prefixedLower !== null && prefixedLower !== undefined) {
      return prefixedLower;
    }

    return "";
  }

  function hasTokenKey(tokenKey) {
    const directKey = String(tokenKey || "").trim();
    if (!directKey) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(sourceValues, directKey)) {
      return true;
    }

    const lowerKey = directKey.toLowerCase();
    if (lowerValueMap.has(lowerKey) || lowerValueMap.has(`cf_${lowerKey}`)) {
      return true;
    }

    const normalized = normalizeCustomFieldKey(directKey, lowerKey);
    if (!normalized) {
      return false;
    }

    return normalizedValueMap.has(normalized) || normalizedValueMap.has(`cf_${normalized}`);
  }

  function shouldRepairMalformedToken(tokenKey) {
    if (!hasTokenKey(tokenKey)) {
      return false;
    }

    const normalized = normalizeCustomFieldKey(tokenKey, String(tokenKey || "").toLowerCase());
    if (!normalized) {
      return false;
    }

    if (RESERVED_DYNAMIC_KEYS.has(normalized) || RESERVED_DYNAMIC_KEYS.has(String(tokenKey || "").toLowerCase())) {
      return false;
    }

    return true;
  }

  const standardResolved = String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => resolveValue(String(key || "")));
  const repairedSingleOpen = standardResolved.replace(/\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    const tokenKey = String(key || "").trim();
    if (!tokenKey || !shouldRepairMalformedToken(tokenKey)) {
      return match;
    }

    return String(resolveValue(tokenKey));
  });

  return repairedSingleOpen.replace(/\{\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const tokenKey = String(key || "").trim();
    if (!tokenKey || !shouldRepairMalformedToken(tokenKey)) {
      return match;
    }

    return String(resolveValue(tokenKey));
  });
}

function extractPlaceholderKeysFromText(value, output) {
  String(value || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    if (key) {
      output.add(String(key));
    }
    return _match;
  });
}

function toReadableTokenLabel(tokenKey) {
  const safe = String(tokenKey || "").replace(/^cf_/, "");
  const withSpaces = safe.replace(/_/g, " ").trim();
  if (!withSpaces) {
    return "Dynamic Value";
  }

  return withSpaces
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getTemplateDynamicTokenFields(template) {
  const normalizedTemplate = normalizeTemplate(template || {});
  const requiredTokenKeys = new Set(
    (normalizedTemplate?.design?.requiredTokenKeys || [])
      .map((key) => normalizeCustomFieldKey(key, ""))
      .filter(Boolean),
  );
  const customFields = normalizeTemplateCustomFields(normalizedTemplate?.design?.customFields || []);
  const customKeys = new Set();
  customFields.forEach((field) => {
    customKeys.add(field.key);
    customKeys.add(`cf_${field.key}`);
  });

  const tokens = new Set();
  extractPlaceholderKeysFromText(normalizedTemplate?.bodyTemplate || "", tokens);

  const canvasElements = Array.isArray(normalizedTemplate?.design?.canvas?.elements) ? normalizedTemplate.design.canvas.elements : [];
  canvasElements.forEach((element) => {
    if (!element) {
      return;
    }

    if (element.type === "text") {
      extractPlaceholderKeysFromText(element.text || "", tokens);
      return;
    }

    if (element.type === "field") {
      const key = String(element.fieldKey || "").trim();
      if (key) {
        tokens.add(key);
      }
      extractPlaceholderKeysFromText(element.text || "", tokens);
    }
  });

  const fieldMap = new Map();
  tokens.forEach((rawToken) => {
    const token = String(rawToken || "").trim();
    if (!token) {
      return;
    }

    const baseKey = token.startsWith("cf_") ? token.slice(3) : token;
    const normalizedBaseKey = normalizeCustomFieldKey(baseKey, baseKey);

    if (!normalizedBaseKey) {
      return;
    }

    if (RESERVED_DYNAMIC_KEYS.has(token) || RESERVED_DYNAMIC_KEYS.has(normalizedBaseKey)) {
      return;
    }

    if (customKeys.has(token) || customKeys.has(normalizedBaseKey) || customKeys.has(`cf_${normalizedBaseKey}`)) {
      return;
    }

    if (!fieldMap.has(normalizedBaseKey)) {
      fieldMap.set(normalizedBaseKey, {
        key: normalizedBaseKey,
        label: toReadableTokenLabel(normalizedBaseKey),
        token: `{{${token}}}`,
        required: requiredTokenKeys.has(normalizedBaseKey),
      });
    }
  });

  return Array.from(fieldMap.values());
}

function templateHasCustomFieldBindings(template, customFields) {
  const bodyTemplate = String(template?.bodyTemplate || "");
  const canvasElements = Array.isArray(template?.design?.canvas?.elements) ? template.design.canvas.elements : [];

  return customFields.some((field) => {
    const prefixedToken = `{{cf_${field.key}}}`;
    const plainToken = `{{${field.key}}}`;
    const bodyHasToken = bodyTemplate.includes(prefixedToken) || bodyTemplate.includes(plainToken);

    if (bodyHasToken) {
      return true;
    }

    return canvasElements.some((element) => {
      if (element?.type === "field") {
        return element.fieldKey === `cf_${field.key}` || element.fieldKey === field.key;
      }

      if (element?.type !== "text") {
        return false;
      }

      const text = String(element.text || "");
      return text.includes(prefixedToken) || text.includes(plainToken);
    });
  });
}

export function buildLetterValueMap({ company, department, template, values }) {
  const safeValues = values || {};
  const { year, yy, month, day } = getDateParts(safeValues.issueDate || "");
  const companyCode = resolveCompanyCode(company);
  const departmentCode = resolveDepartmentCode(department);
  const templateCode = deriveTemplateCode(template);
  const employeeName = safeValues.employeeFullName || safeValues.recipientName || "";
  const employeeDepartment = safeValues.employeeDepartmentName || safeValues.recipientDepartment || "";
  const employeeAddress = safeValues.employeeAddress || "";

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
    employee_emp_id: safeValues.employeeEmpId || "",
    employee_name: employeeName,
    employee_cnic: safeValues.employeeCnic || "",
    employee_designation: safeValues.employeeDesignation || "",
    employee_department: employeeDepartment,
    employee_phone: safeValues.employeePersonalPhone || "",
    employee_email: safeValues.employeeCompanyEmail || "",
    employee_address: employeeAddress,
    employee_joining_date: formatDate(safeValues.employeeJoiningDate || ""),
    joining_date: formatDate(safeValues.employeeJoiningDate || safeValues.joiningDate || ""),
    employee_reporting_manager: safeValues.employeeReportingManager || "",
    year,
    yy,
    month,
    day,
    year_month: `${year}-${month}`,
  };
  const customFields = normalizeTemplateCustomFields(template?.design?.customFields || []);
  const customFieldValues = typeof safeValues.customFields === "object" && safeValues.customFields !== null
    ? safeValues.customFields
    : {};
  const customMap = {};

  customFields.forEach((field) => {
    const rawValue = customFieldValues[field.key] ?? field.defaultValue ?? "";
    const textValue = String(rawValue);
    const prefixedKey = `cf_${field.key}`;
    customMap[prefixedKey] = textValue;

    if (!(field.key in valueMap)) {
      customMap[field.key] = textValue;
    }
  });

  Object.entries(customFieldValues).forEach(([rawKey, rawValue]) => {
    const keySource = String(rawKey || "").trim();
    if (!keySource) {
      return;
    }

    const normalizedKey = normalizeCustomFieldKey(keySource, keySource.toLowerCase());
    if (!normalizedKey) {
      return;
    }

    const textValue = String(rawValue ?? "");

    if (normalizedKey.startsWith("cf_")) {
      const unprefixed = normalizedKey.slice(3);
      customMap[normalizedKey] = textValue;
      if (unprefixed) {
        customMap[unprefixed] = textValue;
      }
      return;
    }

    customMap[normalizedKey] = textValue;
    customMap[`cf_${normalizedKey}`] = textValue;
  });

  const customFieldLines = customFields
    .map((field) => ({
      label: field.label,
      value: String(customFieldValues[field.key] ?? field.defaultValue ?? "").trim(),
    }))
    .filter((item) => item.value)
    .map((item) => `${item.label}: ${item.value}`);
  const customFieldsBlock = customFieldLines.join("\n");
  customMap.custom_fields_block = customFieldsBlock;
  customMap.custom_fields = customFieldsBlock;

  const resolvedBodyTemplate = fillPlaceholders(template?.bodyTemplate || "", { ...valueMap, ...customMap }).trim();
  const baseBody = resolvedBodyTemplate || valueMap.body_notes || valueMap.subject;
  const hasCustomBinding = templateHasCustomFieldBindings(template, customFields);
  const resolvedBody = !hasCustomBinding && customFieldsBlock
    ? [baseBody, customFieldsBlock].filter(Boolean).join("\n\n")
    : baseBody;

  return {
    ...valueMap,
    ...customMap,
    body_text: resolvedBody,
  };
}

function formatSequenceWithLength(sequence, length) {
  return String(sequence).padStart(length, "0");
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

function getSequenceKey({ company, department }) {
  return [company.id, department.id].join(":");
}

function getLegacyDepartmentSequenceMax(sequences, company, department) {
  const safeSequences = Array.isArray(sequences) ? sequences : [];
  const legacyPrefix = `${company.id}:${department.id}:`;
  const legacyCounters = safeSequences
    .filter((item) => String(item?.key || "").startsWith(legacyPrefix))
    .map((item) => Number(item?.current || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  return legacyCounters.length ? Math.max(...legacyCounters) : 0;
}

export function createLetterNumber({ sequences, company, department, template, issueDate, pattern }) {
  const key = getSequenceKey({ company, department });
  const nextSequences = sequences.map((item) => ({ ...item }));
  let sequence = nextSequences.find((item) => item.key === key);

  if (!sequence) {
    sequence = { key, current: getLegacyDepartmentSequenceMax(nextSequences, company, department) };
    nextSequences.push(sequence);
  }

  sequence.current += 1;

  return {
    letterNo: applyReferencePattern({
      pattern,
      company,
      department,
      template,
      issueDate,
      sequence: sequence.current,
    }),
    sequences: nextSequences,
  };
}

export function buildPreviewLetterNo({ sequences, company, department, template, issueDate, pattern }) {
  if (!company || !department || !template) {
    return "Pending";
  }

  const key = getSequenceKey({ company, department });
  const existing = sequences.find((item) => item.key === key);
  const legacyMax = getLegacyDepartmentSequenceMax(sequences, company, department);
  const next = (existing?.current || legacyMax || 0) + 1;

  return applyReferencePattern({
    pattern,
    company,
    department,
    template,
    issueDate,
    sequence: next,
  });
}

export function createIssueDraft(data, currentDraft = {}) {
  const companies = data.companies || [];
  const departments = data.departments || [];
  const templates = (data.templates || []).map(normalizeTemplate);
  const currentTemplate = templates.find((template) => template.id === currentDraft.templateId);
  const letterType = Object.prototype.hasOwnProperty.call(currentDraft, "letterType")
    ? normalizeIssueLetterType(currentDraft.letterType)
    : normalizeIssueLetterType(currentTemplate?.type || currentTemplate?.name || "LETTER");

  const companyId = companies.some((company) => company.id === currentDraft.companyId)
    ? currentDraft.companyId
    : companies[0]?.id || "";

  const departmentOptions = departments.filter((department) => department.companyId === companyId);
  const departmentId = departmentOptions.some((department) => department.id === currentDraft.departmentId)
    ? currentDraft.departmentId
    : departmentOptions[0]?.id || "";

  const templateOptions = templates.filter(
    (template) => template.companyId === companyId && template.departmentId === departmentId,
  ).filter((template) => templateMatchesIssueLetterType(template, letterType));
  const templateId = templateOptions.some((template) => template.id === currentDraft.templateId)
    ? currentDraft.templateId
    : templateOptions[0]?.id || "";

  const selectedTemplate = templateOptions.find((template) => template.id === templateId);
  const customFieldDefs = normalizeTemplateCustomFields(selectedTemplate?.design?.customFields || []);
  const runtimeTokenFields = getTemplateDynamicTokenFields(selectedTemplate);
  const currentCustomFields = typeof currentDraft.customFields === "object" && currentDraft.customFields !== null
    ? currentDraft.customFields
    : {};
  const customFields = customFieldDefs.reduce((accumulator, field) => {
    accumulator[field.key] = currentCustomFields[field.key] ?? field.defaultValue ?? "";
    return accumulator;
  }, {});
  runtimeTokenFields.forEach((field) => {
    if (!(field.key in customFields)) {
      customFields[field.key] = currentCustomFields[field.key] ?? "";
    }
  });
  Object.entries(currentCustomFields).forEach(([key, value]) => {
    if (!(key in customFields)) {
      customFields[key] = value ?? "";
    }
  });

  return {
    companyId,
    departmentId,
    letterType,
    templateId,
    clientId: currentDraft.clientId || "",
    issueDate: currentDraft.issueDate || getTodayIso(),
    subject: currentDraft.subject || selectedTemplate?.defaultSubject || selectedTemplate?.name || "",
    recipientName: currentDraft.recipientName || "",
    recipientCompany: currentDraft.recipientCompany || "",
    recipientDepartment: currentDraft.recipientDepartment || "",
    preparedBy: currentDraft.preparedBy || "",
    approvedBy: currentDraft.approvedBy || "",
    bodyNotes: currentDraft.bodyNotes || "",
    remarks: currentDraft.remarks || "",
    employeeEmpId: currentDraft.employeeEmpId || "",
    employeeFullName: currentDraft.employeeFullName || "",
    employeeCnic: currentDraft.employeeCnic || "",
    employeeDesignation: currentDraft.employeeDesignation || "",
    employeeDepartmentName: currentDraft.employeeDepartmentName || "",
    employeePersonalPhone: currentDraft.employeePersonalPhone || "",
    employeeCompanyEmail: currentDraft.employeeCompanyEmail || "",
    employeeAddress: currentDraft.employeeAddress || "",
    employeeJoiningDate: currentDraft.employeeJoiningDate || "",
    employeeReportingManager: currentDraft.employeeReportingManager || "",
    letterNoManual: currentDraft.letterNoManual || "",
    letterNoFormatOverride: currentDraft.letterNoFormatOverride || "",
    sequenceOverride: currentDraft.sequenceOverride || "",
    customFields,
  };
}

export function createLetterRecord({ data, draft }) {
  const company = data.companies.find((item) => item.id === draft.companyId);
  const department = data.departments.find((item) => item.id === draft.departmentId);
  const template = normalizeTemplate(data.templates.find((item) => item.id === draft.templateId));

  if (!company || !department || !template) {
    return null;
  }

  const patternInUse = resolveReferencePattern({
    company,
    department,
    template,
    draftPattern: draft.letterNoFormatOverride,
  });

  const numbering = createLetterNumber({
    sequences: data.sequences,
    company,
    department,
    template,
    issueDate: draft.issueDate,
    pattern: patternInUse,
  });

  const manualLetterNo = String(draft.letterNoManual || "").trim();
  const formatOverride = normalizeReferencePattern(draft.letterNoFormatOverride);
  const finalLetterNo = manualLetterNo || numbering.letterNo;
  const pdfFileName = `${finalLetterNo.replace(/\//g, "-")}-${slugify(draft.recipientName || "letter")}.pdf`;
  const renderedValues = buildLetterValueMap({
    company,
    department,
    template,
    values: {
      ...draft,
      letterNo: finalLetterNo,
    },
  });

  return {
    letter: {
      id: createId(),
      companyId: company.id,
      departmentId: department.id,
      templateId: template.id,
      letterNo: finalLetterNo,
      letterNoManual: manualLetterNo,
      letterNoFormatOverride: formatOverride,
      letterNoPatternUsed: patternInUse,
      sequenceOverride: draft.sequenceOverride || "",
      issueDate: draft.issueDate,
      recipientName: draft.recipientName,
      recipientCompany: draft.recipientCompany,
      recipientDepartment: draft.recipientDepartment,
      subject: draft.subject || template.defaultSubject || template.name,
      bodyNotes: draft.bodyNotes,
      preparedBy: draft.preparedBy,
      approvedBy: draft.approvedBy,
      remarks: draft.remarks,
      customFieldValues: typeof draft.customFields === "object" && draft.customFields !== null ? draft.customFields : {},
      renderedBody: renderedValues.body_text,
      pdfFileName,
      pdfStoragePath: `storage/pdfs/${pdfFileName}`,
      templateSnapshot: {
        name: template.name,
        type: template.type,
        refCode: template.refCode || "",
        defaultSubject: template.defaultSubject,
        bodyTemplate: template.bodyTemplate,
        letterNoPattern: template.letterNoPattern || "",
        design: normalizeTemplateDesignForIssueType(template.design, draft.letterType || template.type || template.name),
        customFieldValues: typeof draft.customFields === "object" && draft.customFields !== null ? draft.customFields : {},
        employeeData: {
          empId: draft.employeeEmpId || "",
          fullName: draft.employeeFullName || draft.recipientName || "",
          cnic: draft.employeeCnic || "",
          designation: draft.employeeDesignation || "",
          departmentName: draft.employeeDepartmentName || draft.recipientDepartment || "",
          personalPhone: draft.employeePersonalPhone || "",
          companyEmail: draft.employeeCompanyEmail || "",
          address: draft.employeeAddress || "",
          joiningDate: draft.employeeJoiningDate || "",
          reportingManager: draft.employeeReportingManager || "",
        },
      },
      createdAt: new Date().toISOString(),
    },
    sequences: numbering.sequences,
  };
}

export function buildLetterPreviewModel({ data, draft, previewLetterId }) {
  const company = data.companies.find((item) => item.id === draft.companyId);
  const department = data.departments.find((item) => item.id === draft.departmentId);
  const selectedTemplate = normalizeTemplate(data.templates.find((item) => item.id === draft.templateId));
  const currentLetter = data.letters.find((item) => item.id === previewLetterId);
  const activeTemplate = currentLetter?.templateSnapshot
    ? normalizeTemplate(currentLetter.templateSnapshot)
    : selectedTemplate;

  if (!company || !department || !activeTemplate) {
    return null;
  }

  const activeIssueType = currentLetter?.templateSnapshot?.type || draft.letterType || activeTemplate.type || activeTemplate.name;
  const previewTemplate = {
    ...activeTemplate,
    design: normalizeTemplateDesignForIssueType(activeTemplate.design, activeIssueType),
  };

  const patternInUse = resolveReferencePattern({
    company,
    department,
    template: previewTemplate,
    draftPattern: currentLetter?.letterNoFormatOverride || draft.letterNoFormatOverride,
  });

  const sequenceOverrideText = String(draft.sequenceOverride || "").trim();
  const overrideSequenceNumber = /^\d+$/.test(sequenceOverrideText) ? Number(sequenceOverrideText) : null;
  const previewLetterNo = currentLetter?.letterNo
    || String(draft.letterNoManual || "").trim()
    || (overrideSequenceNumber && overrideSequenceNumber > 0
      ? applyReferencePattern({
          pattern: patternInUse,
          company,
          department,
          template: previewTemplate,
          issueDate: draft.issueDate,
          sequence: overrideSequenceNumber,
        })
      : buildPreviewLetterNo({
          sequences: data.sequences,
          company,
          department,
          template: previewTemplate,
          issueDate: draft.issueDate,
          pattern: patternInUse,
        }));

  return {
    company,
    department,
    template: previewTemplate,
    values: {
      ...draft,
      customFields:
        currentLetter?.customFieldValues ||
        currentLetter?.templateSnapshot?.customFieldValues ||
        draft.customFields ||
        {},
      letterNo: previewLetterNo,
    },
  };
}

export function buildRegisterRows(data) {
  return data.letters
    .map((letter) => {
      const company = data.companies.find((item) => item.id === letter.companyId);
      const department = data.departments.find((item) => item.id === letter.departmentId);
      const template = data.templates.find((item) => item.id === letter.templateId);

      return {
        id: letter.id,
        companyName: company?.name || "",
        departmentName: department?.name || "",
        templateName: letter.templateSnapshot?.name || template?.name || "",
        ...letter,
      };
    })
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

export function buildRegisterExportCsv(data) {
  const rows = data.letters.map((letter) => {
    const company = data.companies.find((item) => item.id === letter.companyId);
    const department = data.departments.find((item) => item.id === letter.departmentId);
    const template = data.templates.find((item) => item.id === letter.templateId);

    const customFieldText = Object.entries(letter.customFieldValues || {})
      .filter(([, value]) => String(value || "").trim())
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | ");

    return {
      "Letter No": letter.letterNo,
      "Letter No (Manual Override)": letter.letterNoManual || "",
      "Reference Pattern Used": letter.letterNoPatternUsed || "",
      "Reference Pattern Override": letter.letterNoFormatOverride || "",
      "Issue Date": formatDate(letter.issueDate),
      Company: company?.name || "",
      Department: department?.name || "",
      Template: letter.templateSnapshot?.name || template?.name || "",
      "Template Code": letter.templateSnapshot?.refCode || "",
      "Issued To": letter.recipientName,
      "Recipient Company": letter.recipientCompany,
      "Recipient Department": letter.recipientDepartment,
      Subject: letter.subject,
      "Prepared By": letter.preparedBy,
      "Approved By": letter.approvedBy,
      "Rendered Body": letter.renderedBody || "",
      "Custom Fields": customFieldText,
      "PDF File Name": letter.pdfFileName,
      "PDF Path": letter.pdfStoragePath,
      Remarks: letter.remarks,
    };
  });

  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];

  rows.forEach((row) => {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  });

  return lines.join("\n");
}

const CLIENT_EXPORT_SYSTEM_FIELDS = [
  { key: "client_name", label: "Client Name" },
  { key: "client_code", label: "Client Code" },
  { key: "company", label: "Client Company" },
  { key: "contact_name", label: "Primary Contact Name" },
  { key: "contact_name_secondary", label: "Secondary Contact Name" },
  { key: "designation", label: "Designation" },
  { key: "email", label: "Email" },
  { key: "email_secondary", label: "Secondary Email" },
  { key: "phone", label: "Phone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "postal_code", label: "Postal Code" },
  { key: "address", label: "Address" },
  { key: "industry", label: "Industry" },
  { key: "source", label: "Source" },
  { key: "priority", label: "Priority" },
  { key: "assigned_owner", label: "Assigned Owner" },
  { key: "status", label: "Status" },
  { key: "follow_up_date", label: "Follow Up Date" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Notes" },
];

function normalizeExportLabel(value, fallback) {
  const label = String(value || "").replace(/_/g, " ").trim();
  if (!label) {
    return fallback;
  }

  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getClientExportFields(clientFields = [], clients = []) {
  const fields = [];
  const seen = new Set();

  function addField(key, label) {
    const safeKey = String(key || "").trim();
    if (!safeKey || seen.has(safeKey)) {
      return;
    }
    seen.add(safeKey);
    fields.push({ key: safeKey, label: normalizeExportLabel(label, safeKey) });
  }

  CLIENT_EXPORT_SYSTEM_FIELDS.forEach((field) => addField(field.key, field.label));

  (clientFields || [])
    .filter((field) => field?.is_active !== false)
    .slice()
    .sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
    .forEach((field) => addField(field.field_key, field.label));

  (clients || []).forEach((client) => {
    const custom = client?.custom_fields_json;
    if (!custom || typeof custom !== "object") {
      return;
    }

    Object.keys(custom).forEach((key) => addField(key, normalizeExportLabel(key, key)));
  });

  return fields;
}

function getClientExportValue(client, key) {
  if (!client || !key) {
    return "";
  }

  if (client[key] != null && String(client[key]).trim()) {
    return String(client[key]).trim();
  }

  if (key === "client_name" && client.full_name != null && String(client.full_name).trim()) {
    return String(client.full_name).trim();
  }

  const custom = client.custom_fields_json;
  if (custom && typeof custom === "object" && custom[key] != null) {
    return String(custom[key]).trim();
  }

  return "";
}

function clientMatchesLetter(client, letter) {
  if (!client || !letter) {
    return false;
  }

  if (letter.clientId && letter.clientId === client.id) {
    return true;
  }

  const clientEmail = String(client.email || client.email_secondary || "").trim().toLowerCase();
  const letterEmail = String(letter.legacyClientEmail || "").trim().toLowerCase();
  if (clientEmail && letterEmail && clientEmail === letterEmail) {
    return true;
  }

  const clientName = String(client.client_name || client.full_name || client.contact_name || "").trim().toLowerCase();
  const letterName = String(letter.legacyClientName || letter.recipientName || "").trim().toLowerCase();
  const clientCompany = String(client.company || "").trim().toLowerCase();
  const letterCompany = String(letter.legacyClientCompany || letter.recipientCompany || "").trim().toLowerCase();

  if (clientName && letterName && clientName === letterName) {
    return true;
  }

  return Boolean(clientCompany && letterCompany && clientCompany === letterCompany && clientName && letterName && clientName === letterName);
}

function resolveLetterIssueType(letter, templates = []) {
  const template = templates.find((item) => item.id === letter.templateId);
  return normalizeIssueLetterType([
    letter.templateSnapshot?.type,
    letter.templateSnapshot?.name,
    template?.type,
    template?.name,
  ].filter(Boolean).join(" "));
}

function summarizeClientLetters(client, data) {
  const clientLetters = (data.letters || []).filter((letter) => clientMatchesLetter(client, letter));
  const normalLetters = [];
  const agLetters = [];

  clientLetters.forEach((letter) => {
    const title = [letter.letterNo, letter.subject || letter.templateSnapshot?.name].filter(Boolean).join(" - ");
    if (resolveLetterIssueType(letter, data.templates || []) === "AG") {
      agLetters.push(title);
    } else {
      normalLetters.push(title);
    }
  });

  return {
    clientLetters,
    normalLetters,
    agLetters,
  };
}

function getLetterCompanyNames(letters = [], companies = []) {
  return Array.from(new Set(letters.map((letter) => companies.find((company) => company.id === letter.companyId)?.name || "").filter(Boolean)));
}

function getLetterDepartmentNames(letters = [], departments = []) {
  return Array.from(new Set(letters.map((letter) => departments.find((department) => department.id === letter.departmentId)?.name || "").filter(Boolean)));
}

function buildClientsExportRows({ data, clients, clientFields, groupCompanyName = "", groupDepartmentName = "" }) {
  const sourceClients = Array.isArray(clients) ? clients : [];
  const fields = getClientExportFields(clientFields, sourceClients);
  return sourceClients
    .slice()
    .sort((left, right) => {
      const leftName = `${groupCompanyName || left.company || ""} ${groupDepartmentName || ""} ${left.client_name || left.full_name || ""}`;
      const rightName = `${groupCompanyName || right.company || ""} ${groupDepartmentName || ""} ${right.client_name || right.full_name || ""}`;
      return leftName.localeCompare(rightName);
    })
    .map((client) => {
      const summary = summarizeClientLetters(client, data);
      const letterCompanies = getLetterCompanyNames(summary.clientLetters, data.companies || []);
      const letterDepartments = getLetterDepartmentNames(summary.clientLetters, data.departments || []);
      const row = {
        "Export Company": groupCompanyName || client.company || letterCompanies.join(" | "),
        "Export Department": groupDepartmentName || letterDepartments.join(" | "),
      };

      fields.forEach((field) => {
        row[field.label] = getClientExportValue(client, field.key);
      });

      row["Total Letters Issued"] = summary.normalLetters.length;
      row["Letter Names / Subjects"] = summary.normalLetters.join(" | ");
      row["Total AG Issued"] = summary.agLetters.length;
      row["AG Names / Subjects"] = summary.agLetters.join(" | ");
      row["All Issued Companies"] = letterCompanies.join(" | ");
      row["All Issued Departments"] = letterDepartments.join(" | ");
      row["Created Date"] = formatDate(client.created_at);
      row["Updated Date"] = formatDate(client.updated_at);

      return row;
    });
}

function buildClientsExportCsv({ data, clients, clientFields, groupCompanyName = "", groupDepartmentName = "" }) {
  const rows = buildClientsExportRows({ data, clients, clientFields, groupCompanyName, groupDepartmentName });

  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  });

  return lines.join("\n");
}

function safeFileToken(value, fallback = "unassigned") {
  return slugify(value || fallback) || fallback;
}

function getClientCompanyKeys(client, data, summary) {
  const names = new Set();
  if (String(client.company || "").trim()) {
    names.add(String(client.company).trim());
  }
  getLetterCompanyNames(summary.clientLetters, data.companies || []).forEach((name) => names.add(name));
  return Array.from(names);
}

function getClientDepartmentEntries(client, data, summary) {
  const entries = new Map();
  summary.clientLetters.forEach((letter) => {
    const company = (data.companies || []).find((item) => item.id === letter.companyId);
    const department = (data.departments || []).find((item) => item.id === letter.departmentId);
    const key = `${company?.name || client.company || "Unassigned Company"}||${department?.name || "Unassigned Department"}`;
    entries.set(key, {
      companyName: company?.name || client.company || "Unassigned Company",
      departmentName: department?.name || "Unassigned Department",
    });
  });

  if (!entries.size) {
    const companyName = client.company || "Unassigned Company";
    const departmentName = getClientExportValue(client, "department") || getClientExportValue(client, "designation") || "Unassigned Department";
    entries.set(`${companyName}||${departmentName}`, { companyName, departmentName });
  }

  return Array.from(entries.values());
}

function clientBelongsToCompany(client, company, data) {
  if (!client || !company) {
    return false;
  }

  const clientCompany = String(client.company || "").trim().toLowerCase();
  const companyName = String(company.name || "").trim().toLowerCase();
  if (clientCompany && companyName && clientCompany === companyName) {
    return true;
  }

  const summary = summarizeClientLetters(client, data);
  return summary.clientLetters.some((letter) => letter.companyId === company.id);
}

function clientBelongsToDepartment(client, department, data) {
  if (!client || !department) {
    return false;
  }

  const summary = summarizeClientLetters(client, data);
  if (summary.clientLetters.some((letter) => letter.departmentId === department.id)) {
    return true;
  }

  const clientDepartment = (
    getClientExportValue(client, "department")
    || getClientExportValue(client, "designation")
    || getClientExportValue(client, "employee_department")
  ).trim().toLowerCase();

  return Boolean(clientDepartment && clientDepartment === String(department.name || "").trim().toLowerCase());
}

function clientHasDepartmentInCompany(client, company, data) {
  const departments = (data.departments || []).filter((department) => department.companyId === company?.id);
  return departments.some((department) => clientBelongsToDepartment(client, department, data));
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeWorksheetName(value, fallback = "Sheet") {
  const clean = String(value || fallback)
    .replace(/[:\\/?*\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);

  return clean || fallback;
}

function createUniqueWorksheetName(value, usedNames) {
  const base = normalizeWorksheetName(value);
  let name = base;
  let index = 2;
  while (usedNames.has(name.toLowerCase())) {
    const suffix = ` ${index}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

function rowsToWorksheet(name, rows, usedNames) {
  const sheetName = createUniqueWorksheetName(name, usedNames);
  const headers = rows.length ? Object.keys(rows[0]) : ["No Data"];
  const bodyRows = rows.length ? rows : [{ "No Data": "No clients found for this selection." }];
  const headerXml = headers
    .map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`)
    .join("");
  const rowsXml = bodyRows
    .map((row) => `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(row[header] ?? "")}</Data></Cell>`).join("")}</Row>`)
    .join("");

  return `<Worksheet ss:Name="${xmlEscape(sheetName)}"><Table><Row>${headerXml}</Row>${rowsXml}</Table></Worksheet>`;
}

function buildExcelWorkbook(sheets) {
  const usedNames = new Set();
  const worksheetXml = sheets
    .filter((sheet) => sheet && sheet.name)
    .map((sheet) => rowsToWorksheet(sheet.name, sheet.rows || [], usedNames))
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${worksheetXml}
</Workbook>`;
}

export function buildClientExcelExport(data, options = {}) {
  const exportData = data || {};
  const clients = Array.isArray(exportData.clients) ? exportData.clients : [];
  const clientFields = Array.isArray(exportData.clientFields) ? exportData.clientFields : [];
  const dateToken = getTodayIso();

  if (!clients.length) {
    return null;
  }

  if (options.scope !== "company") {
    return {
      fileName: `all-clients-${dateToken}.xls`,
      content: buildExcelWorkbook([{
        name: "All Clients",
        rows: buildClientsExportRows({ data: exportData, clients, clientFields }),
      }]),
    };
  }

  const company = (exportData.companies || []).find((item) => item.id === options.companyId);
  if (!company) {
    return null;
  }

  const companyClients = clients.filter((client) => clientBelongsToCompany(client, company, exportData));
  const departmentId = String(options.departmentId || "ALL");

  if (departmentId !== "ALL") {
    const department = (exportData.departments || []).find((item) => item.id === departmentId && item.companyId === company.id);
    if (!department) {
      return null;
    }

    const departmentClients = companyClients.filter((client) => clientBelongsToDepartment(client, department, exportData));
    return {
      fileName: `clients-${safeFileToken(company.name)}-${safeFileToken(department.name)}-${dateToken}.xls`,
      content: buildExcelWorkbook([{
        name: department.name,
        rows: buildClientsExportRows({
          data: exportData,
          clients: departmentClients,
          clientFields,
          groupCompanyName: company.name,
          groupDepartmentName: department.name,
        }),
      }]),
    };
  }

  const companyDepartments = (exportData.departments || [])
    .filter((department) => department.companyId === company.id)
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
  const sheets = companyDepartments.map((department) => ({
    name: department.name,
    rows: buildClientsExportRows({
      data: exportData,
      clients: companyClients.filter((client) => clientBelongsToDepartment(client, department, exportData)),
      clientFields,
      groupCompanyName: company.name,
      groupDepartmentName: department.name,
    }),
  }));
  const unassignedClients = companyClients.filter((client) => !clientHasDepartmentInCompany(client, company, exportData));

  if (unassignedClients.length || !sheets.length) {
    sheets.push({
      name: "Unassigned Department",
      rows: buildClientsExportRows({
        data: exportData,
        clients: unassignedClients,
        clientFields,
        groupCompanyName: company.name,
        groupDepartmentName: "Unassigned Department",
      }),
    });
  }

  return {
    fileName: `clients-${safeFileToken(company.name)}-departments-${dateToken}.xls`,
    content: buildExcelWorkbook(sheets),
  };
}

function csvEscape(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
