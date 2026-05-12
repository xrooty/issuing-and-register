import { useEffect, useMemo, useState } from "react";
import EmptyState from "./components/EmptyState";
import DashboardView from "./views/DashboardView";
import CompaniesView from "./views/CompaniesView";
import DepartmentsView from "./views/DepartmentsView";
import TemplatesView from "./views/TemplatesView";
import IssueLetterView from "./views/IssueLetterView";
import RegisterView from "./views/RegisterView";
import CreateClientView from "./views/CreateClientView";
import AllClientsView from "./views/AllClientsView";
import ClientProfileView from "./views/ClientProfileView";
import UsersView from "./views/UsersView";
import RolesView from "./views/RolesView";
import ActivityView from "./views/ActivityView";
import AdminView from "./views/AdminView";
import ExportsView from "./views/ExportsView";
import { normalizeData } from "./data/seedData";
import { downloadTextFile } from "./utils/files";
import {
  applyReferencePattern,
  buildClientExcelExport,
  buildLetterPreviewModel,
  buildLetterValueMap,
  buildRegisterExportCsv,
  buildRegisterRows,
  createId,
  createIssueDraft,
  normalizeTemplateDesignForIssueType,
  getTodayIso,
  normalizeReferencePattern,
  resolveReferencePattern,
} from "./utils/lettering";
import { createIsolatedAuthClient, supabase } from "./lib/supabaseClient";

const EMPTY_DATA = {
  companies: [],
  departments: [],
  templateTypes: [],
  templates: [],
  letters: [],
  sequences: [],
  clients: [],
  users: [],
  activity: [],
  reports: [],
  rolePermissions: [],
  roleDataScopes: [],
  userPermissions: [],
  clientFields: [],
  roles: [],
  permissionModules: [],
  appSettings: {},
  accessConfigReportId: "",
};
const FULL_ACCESS_ROLE = "admin";
const DEFAULT_ROLES = [FULL_ACCESS_ROLE];
const DASHBOARD_ACTION_MODULES = {
  exportRegister: "dashboard_export_register_csv",
  backupJson: "dashboard_backup_json",
  refreshDb: "dashboard_refresh_db",
};
const DEFAULT_PERMISSION_MODULES = [
  "dashboard",
  DASHBOARD_ACTION_MODULES.exportRegister,
  DASHBOARD_ACTION_MODULES.backupJson,
  DASHBOARD_ACTION_MODULES.refreshDb,
  "companies",
  "departments",
  "templates",
  "issue",
  "register",
  "clients-create",
  "clients-all",
  "clients-profile",
  "users",
  "roles",
  "activity",
  "activity_settings",
  "admin",
  "client_fields",
];
const HIDDEN_PERMISSION_MODULES = new Set(["reports"]);
const VALID_PERMISSION_MODULES = new Set(DEFAULT_PERMISSION_MODULES);
const ACCESS_CONFIG_REPORT_TYPE = "system_access_config";
const ACTIVITY_LOGGING_SETTING_KEY = "activity_logging_enabled";

const CLIENT_DB_FIELDS = new Set([
  "client_name",
  "full_name",
  "client_code",
  "company",
  "contact_name",
  "contact_name_secondary",
  "designation",
  "email",
  "email_secondary",
  "phone",
  "whatsapp",
  "city",
  "state",
  "country",
  "postal_code",
  "address",
  "industry",
  "source",
  "priority",
  "assigned_owner",
  "tags",
  "notes",
  "follow_up_date",
  "status",
]);

const DEFAULT_CLIENT_FIELDS = [
  { id: "f-client-name", field_key: "client_name", label: "Client Name", input_type: "text", options_json: [], is_required: true, is_active: true, sort_order: 1, is_system: true },
  { id: "f-phone", field_key: "phone", label: "Phone", input_type: "text", options_json: [], is_required: true, is_active: true, sort_order: 2, is_system: true },
  { id: "f-email", field_key: "email", label: "Email", input_type: "email", options_json: [], is_required: true, is_active: true, sort_order: 3, is_system: true },
  { id: "f-cnic", field_key: "cnic", label: "CNIC / National ID", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 4, is_system: false },
  { id: "f-address", field_key: "address", label: "Address", input_type: "textarea", options_json: [], is_required: false, is_active: true, sort_order: 5, is_system: true },
  { id: "f-job-title", field_key: "job_title", label: "Job Title", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 6, is_system: false },
  { id: "f-employer", field_key: "employer_name", label: "Employer / Business Name", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 7, is_system: false },
  { id: "f-source-income", field_key: "source_of_income", label: "Source of Income", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 8, is_system: false },
  { id: "f-monthly-income", field_key: "monthly_income_range", label: "Monthly Income Range", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 9, is_system: false },
  { id: "f-bank-name", field_key: "bank_name", label: "Bank Name", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 10, is_system: false },
  { id: "f-account-title", field_key: "account_title", label: "Account Title", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 11, is_system: false },
  { id: "f-account-number", field_key: "account_number", label: "Account Number", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 12, is_system: false },
  { id: "f-iban", field_key: "iban", label: "IBAN", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 13, is_system: false },
  { id: "f-notes", field_key: "notes", label: "Notes", input_type: "textarea", options_json: [], is_required: false, is_active: true, sort_order: 14, is_system: true },
  { id: "f-status", field_key: "status", label: "Status", input_type: "select", options_json: ["active", "on_hold", "closed"], is_required: false, is_active: true, sort_order: 15, is_system: true },
];

const VIEWS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "companies", label: "Companies" },
  { id: "departments", label: "Departments" },
  { id: "templates", label: "Templates" },
  { id: "issue", label: "Issue Letter" },
  { id: "register", label: "Register" },
  { id: "exports", label: "Exports" },
  { id: "clients-create", label: "Create Client" },
  { id: "clients-all", label: "All Clients" },
  { id: "clients-profile", label: "Client Profile", showInNav: false },
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles" },
  { id: "activity", label: "Activity" },
  { id: "admin", label: "Admin" },
];
const VIEW_LABEL_MAP = Object.fromEntries(VIEWS.map((view) => [view.id, view.label]));

function normalizeTemplateTypeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function normalizeCompanyCode(value, fallbackName = "") {
  const explicitCode = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

  if (explicitCode) {
    return explicitCode;
  }

  const words = String(fallbackName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "CMP";
  }

  if (words.length === 1) {
    return words[0].replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 3) || "CMP";
  }

  return words
    .map((word) => word[0])
    .join("")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 6) || "CMP";
}

function parseJson(value, fallback) {
  if (value == null) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapCompany(row) {
  const shortCode = normalizeCompanyCode(row.short_code || row.code, row.name);

  return {
    id: row.id,
    name: row.name,
    shortCode,
    address: row.address || "",
    phone: row.phone || "",
    email: row.email || "",
    footerText: row.footer_text || "",
    letterNoPattern: row.letter_no_pattern || "",
  };
}

function mapDepartment(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    code: row.code,
    letterNoPattern: row.letter_no_pattern || "",
  };
}

function mapTemplateType(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
  };
}

function mapTemplate(row) {
  const typeRef = Array.isArray(row.template_types) ? row.template_types[0] : row.template_types;

  return {
    id: row.id,
    companyId: row.company_id,
    departmentId: row.department_id,
    templateTypeId: row.template_type_id || null,
    name: row.name,
    type: typeRef?.name || row.type || row.template_type || row.name || "",
    refCode: row.ref_code || "",
    defaultSubject: row.default_subject || "",
    bodyTemplate: row.body_template || "",
    letterNoPattern: row.letter_no_pattern || "",
    design: parseJson(row.design_json, {}),
  };
}

function mapLetter(row) {
  const templateSnapshot = parseJson(row.template_snapshot_json, null);
  const snapshotCustomValues = templateSnapshot?.customFieldValues;
  const parsedCustomValues = parseJson(row.custom_fields_json, snapshotCustomValues);
  const customFieldValues = typeof parsedCustomValues === "object" && parsedCustomValues !== null ? parsedCustomValues : {};

  return {
    id: row.id,
    companyId: row.company_id,
    departmentId: row.department_id,
    templateId: row.template_id,
    clientId: row.client_id || null,
    templateTypeId: row.template_type_id || null,
    legacyClientName: row.client_name || row.recipient_name || templateSnapshot?.clientName || "",
    legacyClientEmail: row.client_email || templateSnapshot?.clientEmail || "",
    legacyClientCompany: row.client_company || row.recipient_company || templateSnapshot?.clientCompany || "",
    legacyTemplateType: row.template_type || templateSnapshot?.type || templateSnapshot?.templateType || "",
    letterNo: row.letter_no,
    letterNoManual: row.letter_no_manual || "",
    letterNoFormatOverride: row.letter_no_format_override || "",
    letterNoPatternUsed: row.letter_no_pattern_used || "",
    issueDate: row.issue_date || "",
    recipientName: row.recipient_name || "",
    recipientCompany: row.recipient_company || "",
    recipientDepartment: row.recipient_department || "",
    subject: row.subject || "",
    bodyNotes: row.body_notes || "",
    preparedBy: row.prepared_by || "",
    approvedBy: row.approved_by || "",
    issuedByName: row.issued_by_name || "",
    issued_by_user_id: row.issued_by_user_id || null,
    remarks: row.remarks || "",
    renderedBody: row.rendered_body || "",
    pdfFileName: row.pdf_file_name || "",
    pdfStoragePath: row.pdf_storage_path || "",
    templateSnapshot,
    customFieldValues,
    createdAt: row.created_at,
  };
}

function mapClient(row) {
  const parsedCustom = parseJson(row.custom_fields_json, {});
  const resolvedClientName = row.client_name || row.full_name || "";
  return {
    ...row,
    client_name: resolvedClientName,
    full_name: row.full_name || resolvedClientName,
    custom_fields_json: parsedCustom && typeof parsedCustom === "object" ? parsedCustom : {},
    display_name: resolvedClientName || row.contact_name || row.company || row.email || "Client",
  };
}

function mapUser(row) {
  return {
    ...row,
    department_name: row.department_name || "",
  };
}

function mapActivity(row) {
  const rawDetails = row.details || "";
  let parsed = null;
  if (typeof rawDetails === "string" && rawDetails.trim().startsWith("{")) {
    try {
      parsed = JSON.parse(rawDetails);
    } catch {
      parsed = null;
    }
  }

  return {
    ...row,
    details: parsed?.message || rawDetails,
    client_name: parsed?.client_name || "",
    client_id: parsed?.client_id || null,
    issued_by_name: parsed?.issued_by_name || "",
  };
}

function hydrateActivityClientNames(activity = [], clients = []) {
  const clientById = new Map((clients || []).map((client) => [client.id, client]));
  return (activity || []).map((entry) => {
    const clientId = entry.client_id || (entry.entity === "clients" ? entry.entity_id : null);
    const client = clientId ? clientById.get(clientId) : null;
    return {
      ...entry,
      client_id: clientId || entry.client_id || null,
      client_name: entry.client_name || client?.client_name || client?.display_name || "",
    };
  });
}

function mapReport(row) {
  return row;
}

function mapRolePermission(row) {
  return row;
}

function mapUserPermission(row) {
  return {
    ...row,
    can_view: typeof row.can_view === "boolean" ? row.can_view : null,
    can_create: typeof row.can_create === "boolean" ? row.can_create : null,
    can_edit: typeof row.can_edit === "boolean" ? row.can_edit : null,
    can_delete: typeof row.can_delete === "boolean" ? row.can_delete : null,
    scope_type: row.scope_type || null,
    department_names: Array.isArray(row.department_names) ? row.department_names : [],
  };
}

function mapRoleDataScope(row) {
  return {
    ...row,
    role: normalizeRoleName(row.role),
    department_names: Array.isArray(row.department_names) ? row.department_names : [],
  };
}

function mapRole(row) {
  return row;
}

function mapPermissionModule(row) {
  return row;
}

function mapAppSetting(row) {
  return row;
}

function isActivityLoggingEnabledFromSettings(settings = {}) {
  return settings[ACTIVITY_LOGGING_SETTING_KEY] !== false;
}

function normalizeRoleName(role) {
  const value = String(role || "").trim();
  return value;
}

function normalizePermissionModuleName(module) {
  return String(module || "").trim();
}

function isValidPermissionModule(module) {
  const moduleName = normalizePermissionModuleName(module);
  return VALID_PERMISSION_MODULES.has(moduleName) && !HIDDEN_PERMISSION_MODULES.has(moduleName);
}

function hasFullAccessRole(role) {
  return normalizeRoleName(role) === FULL_ACCESS_ROLE;
}

function buildRolePermissionMatrix(roles = [], modules = [], rolePermissionRows = []) {
  const output = {};
  const moduleSet = new Set(modules);
  roles.forEach((role) => {
    output[role] = {};
    modules.forEach((module) => {
      output[role][module] = {
        view: hasFullAccessRole(role),
        create: hasFullAccessRole(role),
        edit: hasFullAccessRole(role),
        delete: hasFullAccessRole(role),
      };
    });
  });
  (rolePermissionRows || []).forEach((row) => {
    const role = normalizeRoleName(row.role);
    const module = normalizePermissionModuleName(row.module);
    if (!moduleSet.has(module)) return;
    if (!output[role]) output[role] = {};
    output[role][module] = {
      view: !!row.can_view,
      create: !!row.can_create,
      edit: !!row.can_edit,
      delete: !!row.can_delete,
    };
  });
  return output;
}

function applyUserPermissionOverrides(base = {}, overrideRows = []) {
  const output = {};
  Object.entries(base || {}).forEach(([module, permissions]) => {
    output[module] = { ...permissions };
  });
  (overrideRows || []).forEach((row) => {
    const module = normalizePermissionModuleName(row.module);
    if (!Object.prototype.hasOwnProperty.call(output, module)) return;
    const current = output[module] || { view: false, create: false, edit: false, delete: false };
    output[module] = {
      view: typeof row.can_view === "boolean" ? row.can_view : current.view,
      create: typeof row.can_create === "boolean" ? row.can_create : current.create,
      edit: typeof row.can_edit === "boolean" ? row.can_edit : current.edit,
      delete: typeof row.can_delete === "boolean" ? row.can_delete : current.delete,
    };
    if (output[module].create || output[module].edit || output[module].delete) {
      output[module].view = true;
    }
    if (!output[module].view) {
      output[module].create = false;
      output[module].edit = false;
      output[module].delete = false;
    }
  });
  return output;
}

function cleanDepartmentNames(list = []) {
  return Array.from(new Set(list.map((item) => String(item || "").trim()).filter(Boolean)));
}

function buildScopeResolver({ currentRole, currentUserProfile, roleDataScopes = [], userPermissions = [] }) {
  return function resolveScope(module) {
    if (hasFullAccessRole(currentRole)) {
      return { scope_type: "all_departments", department_names: [] };
    }

    const roleScope = (roleDataScopes || []).find((row) => normalizeRoleName(row.role) === currentRole && row.module === module);
    const userScope = currentUserProfile?.id
      ? (userPermissions || []).find((row) => row.user_id === currentUserProfile.id && row.module === module)
      : null;
    const scopeType = userScope?.scope_type || roleScope?.scope_type || "own_department";

    if (scopeType === "selected_departments") {
      return { scope_type: scopeType, department_names: cleanDepartmentNames(userScope?.department_names || roleScope?.department_names || []) };
    }
    if (scopeType === "own_data") {
      return { scope_type: scopeType, department_names: [] };
    }
    return { scope_type: "own_department", department_names: cleanDepartmentNames([currentUserProfile?.department_name]) };
  };
}

function filterDepartmentsByScope(departments = [], scope = {}) {
  if (scope.scope_type === "all_departments") {
    return departments;
  }
  const allowed = new Set(cleanDepartmentNames(scope.department_names));
  if (!allowed.size) {
    return [];
  }
  return departments.filter((department) => allowed.has(department.name));
}

function filterTemplatesByDepartments(templates = [], departments = []) {
  const ids = new Set(departments.map((department) => department.id));
  return templates.filter((template) => ids.has(template.departmentId));
}

function filterLettersByScope(letters = [], departments = [], scope = {}, currentUserProfile = null) {
  if (scope.scope_type === "all_departments") {
    return letters;
  }
  if (scope.scope_type === "own_data") {
    return letters.filter((letter) => letter.issued_by_user_id && letter.issued_by_user_id === currentUserProfile?.id);
  }
  const ids = new Set(departments.map((department) => department.id));
  return letters.filter((letter) => ids.has(letter.departmentId));
}

function filterCompaniesByDepartments(companies = [], departments = []) {
  const companyIds = new Set(departments.map((department) => department.companyId));
  return companies.filter((company) => companyIds.has(company.id));
}

function mapClientField(row) {
  return {
    ...row,
    options_json: Array.isArray(row.options_json) ? row.options_json : parseJson(row.options_json, []),
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildSequenceKey({ company, department }) {
  return [company.id, department.id].join(":");
}

function getClientValue(client, key) {
  if (!client || !key) {
    return "";
  }

  if (client[key] != null && String(client[key]).trim()) {
    return String(client[key]).trim();
  }

  if (key === "client_name" && client.full_name != null && String(client.full_name).trim()) {
    return String(client.full_name).trim();
  }

  if (key === "full_name" && client.client_name != null && String(client.client_name).trim()) {
    return String(client.client_name).trim();
  }

  const custom = client.custom_fields_json;
  if (custom && typeof custom === "object" && custom[key] != null) {
    return String(custom[key]).trim();
  }

  return "";
}

function buildIssueDraftPatchFromClient(client) {
  if (!client) {
    return {};
  }

  const recipientName = getClientValue(client, "client_name")
    || getClientValue(client, "contact_name")
    || getClientValue(client, "display_name");
  const recipientCompany = getClientValue(client, "company")
    || getClientValue(client, "employer_name");
  const recipientDepartment = getClientValue(client, "designation")
    || getClientValue(client, "department");
  const email = getClientValue(client, "email") || getClientValue(client, "email_secondary");
  const phone = getClientValue(client, "phone") || getClientValue(client, "whatsapp");
  const cnic = getClientValue(client, "cnic");
  const address = getClientValue(client, "address");

  return {
    recipientName,
    recipientCompany,
    recipientDepartment,
    employeeFullName: recipientName,
    employeeCnic: cnic,
    employeeDesignation: recipientDepartment,
    employeeDepartmentName: recipientDepartment,
    employeePersonalPhone: phone,
    employeeCompanyEmail: email,
    employeeAddress: address,
  };
}

function findLinkedClient(clients, letter) {
  const source = Array.isArray(clients) ? clients : [];
  if (!letter) {
    return null;
  }

  if (letter.clientId) {
    const direct = source.find((client) => client.id === letter.clientId);
    if (direct) {
      return direct;
    }
  }

  const byEmail = String(letter.legacyClientEmail || "").trim().toLowerCase();
  if (byEmail) {
    const emailMatch = source.find((client) => String(client.email || "").trim().toLowerCase() === byEmail);
    if (emailMatch) {
      return emailMatch;
    }
  }

  const byName = String(letter.legacyClientName || letter.recipientName || "").trim().toLowerCase();
  const byCompany = String(letter.legacyClientCompany || letter.recipientCompany || "").trim().toLowerCase();

  return source.find((client) => {
    const clientName = String(client.client_name || client.full_name || client.contact_name || "").trim().toLowerCase();
    const clientCompany = String(client.company || "").trim().toLowerCase();
    return (byName && clientName === byName) || (byCompany && clientCompany === byCompany);
  }) || null;
}

function ensureSupabaseSuccess(result, message) {
  if (result.error) {
    throw new Error(`${message}: ${result.error.message}`);
  }

  return result.data;
}

function isMissingRelationError(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("does not exist") || text.includes("could not find the table");
}

async function findUserProfileByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { data: null, error: null };
  }

  return supabase
    .from("users")
    .select("id, email, full_name, role, department_name, active")
    .ilike("email", normalizedEmail)
    .maybeSingle();
}

function findUserProfileInData(users = [], authUser = null, email = "") {
  const authId = String(authUser?.id || "").trim();
  const normalizedEmail = String(email || authUser?.email || "").trim().toLowerCase();
  return users.find((user) => authId && String(user.id || "").trim() === authId)
    || users.find((user) => normalizedEmail && String(user.email || "").trim().toLowerCase() === normalizedEmail)
    || null;
}

function getRoleNamesFromData(source = {}) {
  const dbRoles = (source.roles || []).map((row) => normalizeRoleName(row.name)).filter(Boolean);
  return Array.from(new Set([...DEFAULT_ROLES, ...dbRoles]));
}

async function ensureTemplateType(typeText) {
  const name = String(typeText || "").trim();
  if (!name) {
    throw new Error("Template type is required");
  }

  const code = normalizeTemplateTypeCode(name);
  if (!code) {
    throw new Error("Template type code is invalid");
  }

  const existing = await supabase.from("template_types").select("id, code, name").eq("code", code).maybeSingle();
  ensureSupabaseSuccess(existing, "Template type lookup failed");

  if (existing.data) {
    return existing.data;
  }

  const created = await supabase
    .from("template_types")
    .insert({
      id: createId(),
      code,
      name,
    })
    .select("id, code, name")
    .single();

  return ensureSupabaseSuccess(created, "Template type create failed");
}

async function ensureIssueReferencesPersisted({ company, department, template, templateTypeName }) {
  const typeRef = await ensureTemplateType(templateTypeName || template?.type || template?.name || "Template");
  const companyCode = normalizeCompanyCode(company.shortCode || company.code, company.name);

  const companyRes = await supabase.from("companies").upsert(
    {
      id: company.id,
      name: String(company.name || "").trim(),
      short_code: companyCode,
      code: companyCode,
      address: String(company.address || "").trim(),
      phone: String(company.phone || "").trim(),
      email: String(company.email || "").trim(),
      footer_text: String(company.footerText || "").trim(),
      letter_no_pattern: normalizeReferencePattern(company.letterNoPattern),
    },
    { onConflict: "id" },
  );
  ensureSupabaseSuccess(companyRes, "Company sync failed");

  const departmentRes = await supabase.from("departments").upsert(
    {
      id: department.id,
      company_id: company.id,
      name: String(department.name || "").trim(),
      code: String(department.code || "").trim().toUpperCase(),
      letter_no_pattern: normalizeReferencePattern(department.letterNoPattern),
    },
    { onConflict: "id" },
  );
  ensureSupabaseSuccess(departmentRes, "Department sync failed");

  const templateRes = await supabase.from("templates").upsert(
    {
      id: template.id,
      company_id: company.id,
      department_id: department.id,
      template_type_id: typeRef.id,
      name: String(template.name || "").trim(),
      ref_code: String(template.refCode || "").trim().toUpperCase(),
      default_subject: String(template.defaultSubject || "").trim(),
      body_template: String(template.bodyTemplate || ""),
      letter_no_pattern: normalizeReferencePattern(template.letterNoPattern),
      design_json: template.design || {},
    },
    { onConflict: "id" },
  );
  ensureSupabaseSuccess(templateRes, "Template sync failed");

  return typeRef;
}

async function ensureDepartmentSequenceSeed(company, department) {
  const departmentKey = buildSequenceKey({ company, department });
  const currentCounterRes = await supabase.from("sequence_counters").select("current").eq("key", departmentKey).maybeSingle();
  ensureSupabaseSuccess(currentCounterRes, "Department sequence lookup failed");

  if (currentCounterRes.data) {
    return departmentKey;
  }

  const legacyPrefix = `${company.id}:${department.id}:`;
  const legacyRes = await supabase.from("sequence_counters").select("current").like("key", `${legacyPrefix}%`);
  ensureSupabaseSuccess(legacyRes, "Legacy sequence lookup failed");
  const seedValue = Math.max(
    0,
    ...(legacyRes.data || []).map((item) => Number(item.current || 0)).filter((value) => Number.isFinite(value) && value > 0),
  );

  if (seedValue > 0) {
    const seedRes = await supabase
      .from("sequence_counters")
      .upsert({ key: departmentKey, current: seedValue }, { onConflict: "key" });
    ensureSupabaseSuccess(seedRes, "Department sequence seed failed");
  }

  return departmentKey;
}

async function fetchBootstrapData() {
  const [companiesRes, departmentsRes, templateTypesRes, templatesRes, lettersRes, sequencesRes, clientsRes, usersRes, activityRes, reportsRes, rolePermissionsRes, roleDataScopesRes, userPermissionsRes, rolesRes, permissionModulesRes, appSettingsRes] = await Promise.all([
    supabase.from("companies").select("*").order("name", { ascending: true }),
    supabase.from("departments").select("*").order("name", { ascending: true }),
    supabase.from("template_types").select("*").order("name", { ascending: true }),
    supabase
      .from("templates")
      .select(
        "id, company_id, department_id, template_type_id, name, ref_code, default_subject, body_template, letter_no_pattern, design_json, template_types(id, code, name)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("letters").select("*").order("created_at", { ascending: false }),
    supabase.from("sequence_counters").select("key, current"),
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("users").select("*").order("created_at", { ascending: false }),
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }),
    supabase.from("reports").select("*").order("created_at", { ascending: false }),
    supabase.from("role_permissions").select("*"),
    supabase.from("role_data_scopes").select("*"),
    supabase.from("user_permissions").select("*"),
    supabase.from("roles").select("*").order("name", { ascending: true }),
    supabase.from("permission_modules").select("*").order("name", { ascending: true }),
    supabase.from("app_settings").select("*"),
  ]);

  ensureSupabaseSuccess(companiesRes, "Company fetch failed");
  ensureSupabaseSuccess(departmentsRes, "Department fetch failed");
  ensureSupabaseSuccess(templateTypesRes, "Template types fetch failed");
  ensureSupabaseSuccess(templatesRes, "Templates fetch failed");
  ensureSupabaseSuccess(lettersRes, "Letters fetch failed");
  ensureSupabaseSuccess(sequencesRes, "Sequences fetch failed");
  ensureSupabaseSuccess(clientsRes, "Clients fetch failed");
  ensureSupabaseSuccess(usersRes, "Users fetch failed");
  ensureSupabaseSuccess(activityRes, "Activity fetch failed");
  ensureSupabaseSuccess(reportsRes, "Reports fetch failed");
  ensureSupabaseSuccess(rolePermissionsRes, "Role permissions fetch failed");
  if (roleDataScopesRes.error && !isMissingRelationError(roleDataScopesRes.error)) {
    ensureSupabaseSuccess(roleDataScopesRes, "Role data scopes fetch failed");
  }
  if (userPermissionsRes.error && !isMissingRelationError(userPermissionsRes.error)) {
    ensureSupabaseSuccess(userPermissionsRes, "User permissions fetch failed");
  }
  if (appSettingsRes.error && !isMissingRelationError(appSettingsRes.error)) {
    ensureSupabaseSuccess(appSettingsRes, "App settings fetch failed");
  }

  let clientFields = [];
  try {
    const clientFieldsRes = await supabase.from("client_fields").select("*").order("sort_order", { ascending: true });
    ensureSupabaseSuccess(clientFieldsRes, "Client fields fetch failed");
    clientFields = (clientFieldsRes.data || []).map(mapClientField);
    if (!clientFields.length) {
      clientFields = DEFAULT_CLIENT_FIELDS;
    }
  } catch {
    clientFields = DEFAULT_CLIENT_FIELDS;
  }

  const allReports = (reportsRes.data || []).map(mapReport);

  const raw = {
    companies: (companiesRes.data || []).map(mapCompany),
    departments: (departmentsRes.data || []).map(mapDepartment),
    templates: (templatesRes.data || []).map(mapTemplate),
    letters: (lettersRes.data || []).map(mapLetter),
    sequences: (sequencesRes.data || []).map((item) => ({ key: item.key, current: Number(item.current || 0) })),
    clients: (clientsRes.data || []).map(mapClient),
    users: (usersRes.data || []).map(mapUser),
    activity: hydrateActivityClientNames((activityRes.data || []).map(mapActivity), (clientsRes.data || []).map(mapClient)),
    reports: allReports.filter((report) => String(report.type || "") !== ACCESS_CONFIG_REPORT_TYPE),
    rolePermissions: (rolePermissionsRes.data || []).map(mapRolePermission),
    roleDataScopes: roleDataScopesRes.error ? [] : (roleDataScopesRes.data || []).map(mapRoleDataScope),
    userPermissions: userPermissionsRes.error ? [] : (userPermissionsRes.data || []).map(mapUserPermission),
    roles: rolesRes.error ? [] : (rolesRes.data || []).map(mapRole),
    permissionModules: permissionModulesRes.error ? [] : (permissionModulesRes.data || []).map(mapPermissionModule),
    appSettings: appSettingsRes.error ? [] : (appSettingsRes.data || []).map(mapAppSetting),
    accessConfigReportId: "",
    clientFields,
  };

  const appSettings = raw.appSettings.reduce((settings, row) => {
    settings[row.key] = row.value;
    return settings;
  }, {});

  const normalized = normalizeData(raw);
  return {
    ...EMPTY_DATA,
    ...normalized,
    templateTypes: (templateTypesRes.data || []).map(mapTemplateType),
    clients: raw.clients,
    users: raw.users,
    activity: raw.activity,
    reports: raw.reports,
    rolePermissions: raw.rolePermissions,
    roleDataScopes: raw.roleDataScopes,
    userPermissions: raw.userPermissions,
    roles: raw.roles,
    permissionModules: raw.permissionModules,
    appSettings,
    accessConfigReportId: raw.accessConfigReportId,
    clientFields: raw.clientFields,
  };
}

function hasMeaningfulTemplateDesign(design) {
  if (!design || typeof design !== "object") {
    return false;
  }
  const elements = Array.isArray(design?.canvas?.elements) ? design.canvas.elements.length : 0;
  const hasBackground = !!design?.backgroundImage?.dataUrl;
  const hasCustomFields = Array.isArray(design?.customFields) ? design.customFields.length : 0;
  return elements > 0 || hasBackground || hasCustomFields > 0;
}

function normalizeClientFieldDraft(draft = {}) {
  const rawKey = String(draft.field_key || draft.key || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  const safeKey = rawKey.replace(/^_+|_+$/g, "").slice(0, 40);
  const inputType = ["text", "email", "textarea", "date", "select"].includes(draft.input_type) ? draft.input_type : "text";
  const options = Array.isArray(draft.options_json) ? draft.options_json : [];
  return {
    id: draft.id || createId(),
    field_key: safeKey,
    label: String(draft.label || "").trim(),
    input_type: inputType,
    options_json: options.map((item) => String(item || "").trim()).filter(Boolean),
    is_required: !!draft.is_required,
    is_active: draft.is_active !== false,
    sort_order: Number(draft.sort_order || 100),
    is_system: !!draft.is_system,
  };
}

function splitClientPayloadByStorage(payload) {
  const dbPayload = {};
  const customPayload = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (CLIENT_DB_FIELDS.has(key)) {
      dbPayload[key] = value;
    } else {
      customPayload[key] = value;
    }
  });

  const resolvedClientName = String(dbPayload.client_name || dbPayload.full_name || "").trim();
  if (resolvedClientName) {
    dbPayload.client_name = resolvedClientName;
    dbPayload.full_name = resolvedClientName;
  }

  const resolvedClientCode = String(dbPayload.client_code || "").trim();
  if (!resolvedClientCode) {
    dbPayload.client_code = buildClientCodeBase(resolvedClientName);
  } else {
    dbPayload.client_code = normalizeClientCode(resolvedClientCode);
  }

  return { dbPayload, customPayload };
}

function normalizeClientCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);
}

function buildClientCodeBase(clientName = "") {
  const nameToken = normalizeClientCode(clientName).slice(0, 6);
  const fallbackToken = createId().replace(/-/g, "").slice(0, 6).toUpperCase();
  return nameToken || fallbackToken;
}

function buildUniqueClientCode(baseCode, clients = [], excludeClientId = "") {
  const base = normalizeClientCode(baseCode) || buildClientCodeBase();
  const usedCodes = new Set(
    (clients || [])
      .filter((client) => !excludeClientId || client.id !== excludeClientId)
      .map((client) => normalizeClientCode(client.client_code))
      .filter(Boolean),
  );

  if (!usedCodes.has(base)) {
    return base;
  }

  for (let index = 2; index < 10000; index += 1) {
    const suffix = String(index).padStart(3, "0");
    const candidate = `${base.slice(0, Math.max(1, 12 - suffix.length))}${suffix}`;
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }

  return createId().replace(/-/g, "").slice(0, 12).toUpperCase();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [activeView, setActiveView] = useState("dashboard");
  const [previewLetterId, setPreviewLetterId] = useState(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [toast, setToast] = useState("");
  const [filters, setFilters] = useState({ companyId: "", departmentId: "", search: "" });
  const [issueDraft, setIssueDraft] = useState(() => createIssueDraft(EMPTY_DATA));
  const [templateEditorTargetId, setTemplateEditorTargetId] = useState("");
  const [editingLetterId, setEditingLetterId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [activeClientProfileId, setActiveClientProfileId] = useState("");
  const [clientProfileMode, setClientProfileMode] = useState("view");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function refreshData() {
    const next = await fetchBootstrapData();
    setData(next);
    return next;
  }

  async function loadLatestData() {
    setIsRefreshingData(true);
    try {
      await refreshData();
      notify("Latest data loaded");
    } catch (error) {
      notify(`Latest data load failed: ${error.message}`);
    } finally {
      setIsRefreshingData(false);
    }
  }

  async function logActivity(action, entity, details, options = {}) {
    if (!options.force && !isActivityLoggingEnabledFromSettings(data.appSettings)) {
      return;
    }

    const actorName = currentUserProfile?.full_name || session?.user?.email || authEmail.trim() || "Unknown";
    const payloadDetails = {
      message: String(details || ""),
      client_id: options.clientId || null,
      client_name: options.clientName || "",
      issued_by_name: options.issuedByName || "",
    };

    try {
      await supabase.from("activity_log").insert({
        action,
        actor_id: currentUserProfile?.id || options.actorId || null,
        actor_name: actorName,
        entity,
        entity_id: options.entityId || null,
        details: JSON.stringify(payloadDetails),
      });
    } catch (error) {
      console.warn("Activity log write failed", error);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const next = await fetchBootstrapData();
        if (mounted) {
          setData(next);
        }
      } catch (error) {
        if (mounted) {
          setToast(`DB connection failed: ${error.message}`);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setIssueDraft((current) => {
      const next = createIssueDraft(data, current);
      if (JSON.stringify(next) === JSON.stringify(current)) {
        return current;
      }
      return next;
    });
  }, [data]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!pendingPrint || activeView !== "issue") {
      return undefined;
    }

    let isCancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const sheet = document.querySelector(".panel-preview .letter-sheet");
        if (!sheet) {
          return;
        }

        const imageNodes = Array.from(sheet.querySelectorAll("img"));
        await Promise.all(
          imageNodes.map(
            (node) =>
              new Promise((resolve) => {
                if (node.complete) {
                  resolve();
                  return;
                }

                const done = () => {
                  node.removeEventListener("load", done);
                  node.removeEventListener("error", done);
                  resolve();
                };

                node.addEventListener("load", done, { once: true });
                node.addEventListener("error", done, { once: true });
              }),
          ),
        );

        if (!isCancelled) {
          window.print();
        }
      } finally {
        if (!isCancelled) {
          setPendingPrint(false);
        }
      }
    }, 220);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [activeView, issueDraft, pendingPrint, previewLetterId]);

  const currentUserProfile = useMemo(() => {
    const profile = findUserProfileInData(data.users, session?.user, session?.user?.email);
    return profile ? { ...profile, role: normalizeRoleName(profile.role) } : null;
  }, [data.users, session?.user]);
  const roleTableRoles = useMemo(() => {
    return getRoleNamesFromData(data);
  }, [data.roles]);
  const dynamicRoles = useMemo(() => {
    const permissionRoles = (data.rolePermissions || []).map((row) => normalizeRoleName(row.role)).filter(Boolean);
    const scopeRoles = (data.roleDataScopes || []).map((row) => normalizeRoleName(row.role)).filter(Boolean);
    return Array.from(new Set([...roleTableRoles, ...permissionRoles, ...scopeRoles]));
  }, [data.roleDataScopes, data.rolePermissions, roleTableRoles]);
  const dynamicPermissionModules = useMemo(() => {
    const dbModules = (data.permissionModules || [])
      .map((row) => normalizePermissionModuleName(row.name))
      .filter(isValidPermissionModule);
    return Array.from(new Set([...DEFAULT_PERMISSION_MODULES, ...dbModules]))
      .filter(isValidPermissionModule);
  }, [data.permissionModules, data.roleDataScopes, data.rolePermissions, data.userPermissions]);
  const currentRole = normalizeRoleName(currentUserProfile?.role || "");
  const allPermissionsByRole = useMemo(() => {
    return buildRolePermissionMatrix(dynamicRoles, dynamicPermissionModules, data.rolePermissions);
  }, [data.rolePermissions, dynamicPermissionModules, dynamicRoles]);
  const rolePermissions = useMemo(() => {
    const base = allPermissionsByRole[currentRole] || {};
    const overrides = currentUserProfile?.id
      ? (data.userPermissions || []).filter((row) => row.user_id === currentUserProfile.id)
      : [];
    return applyUserPermissionOverrides(base, overrides);
  }, [allPermissionsByRole, currentRole, currentUserProfile?.id, data.userPermissions]);
  const resolveDataScope = useMemo(() => buildScopeResolver({
    currentRole,
    currentUserProfile,
    roleDataScopes: data.roleDataScopes,
    userPermissions: data.userPermissions,
  }), [currentRole, currentUserProfile, data.roleDataScopes, data.userPermissions]);
  const scopedData = useMemo(() => {
    const dashboardScope = resolveDataScope("dashboard");
    const dashboardDepartments = filterDepartmentsByScope(data.departments, dashboardScope);
    const dashboardLetters = filterLettersByScope(data.letters, dashboardDepartments, dashboardScope, currentUserProfile);
    const dashboardTemplates = filterTemplatesByDepartments(data.templates, dashboardDepartments);
    const dashboardCompanies = filterCompaniesByDepartments(data.companies, dashboardDepartments);

    const departmentScope = resolveDataScope("departments");
    const visibleDepartments = filterDepartmentsByScope(data.departments, departmentScope);

    const templateScope = resolveDataScope("templates");
    const templateDepartments = filterDepartmentsByScope(data.departments, templateScope);

    const issueScope = resolveDataScope("issue");
    const issueDepartments = filterDepartmentsByScope(data.departments, issueScope);

    const registerScope = resolveDataScope("register");
    const registerDepartments = filterDepartmentsByScope(data.departments, registerScope);
    const registerLetters = filterLettersByScope(data.letters, registerDepartments, registerScope, currentUserProfile);

    return {
      dashboard: {
        ...data,
        companies: dashboardScope.scope_type === "all_departments" ? data.companies : dashboardCompanies,
        departments: dashboardScope.scope_type === "all_departments" ? data.departments : dashboardDepartments,
        templates: dashboardScope.scope_type === "all_departments" ? data.templates : dashboardTemplates,
        letters: dashboardLetters,
      },
      departments: visibleDepartments,
      templates: filterTemplatesByDepartments(data.templates, templateDepartments),
      templateDepartments,
      issueDepartments,
      issueTemplates: filterTemplatesByDepartments(data.templates, issueDepartments),
      issueCompanies: issueScope.scope_type === "all_departments" ? data.companies : filterCompaniesByDepartments(data.companies, issueDepartments),
      register: {
        ...data,
        companies: registerScope.scope_type === "all_departments" ? data.companies : filterCompaniesByDepartments(data.companies, registerDepartments),
        departments: registerScope.scope_type === "all_departments" ? data.departments : registerDepartments,
        templates: registerScope.scope_type === "all_departments" ? data.templates : filterTemplatesByDepartments(data.templates, registerDepartments),
        letters: registerLetters,
      },
    };
  }, [currentUserProfile, data, resolveDataScope]);
  const registerRows = buildRegisterRows(scopedData.register);
  const recentLetters = buildRegisterRows(scopedData.dashboard).slice(0, 5);
  const preview = buildLetterPreviewModel({ data: { ...data, companies: scopedData.issueCompanies, departments: scopedData.issueDepartments, templates: scopedData.issueTemplates }, draft: issueDraft, previewLetterId });
  const metrics = [
    { label: "Companies", value: scopedData.dashboard.companies.length },
    { label: "Departments", value: scopedData.dashboard.departments.length },
    { label: "Template Types", value: data.templateTypes.length },
    { label: "Templates", value: scopedData.dashboard.templates.length },
    { label: "Issued Letters", value: scopedData.dashboard.letters.length },
    { label: "Users", value: data.users.length },
    { label: "Clients", value: data.clients.length },
  ];
  const activityLoggingEnabled = isActivityLoggingEnabledFromSettings(data.appSettings);
  const canManageActivityLogging = hasFullAccessRole(currentRole) || !!rolePermissions.activity_settings?.edit;
  const canManageAccess = hasFullAccessRole(currentRole);
  const canExportRegister = hasFullAccessRole(currentRole) || !!rolePermissions[DASHBOARD_ACTION_MODULES.exportRegister]?.view;
  const canExportClients = hasFullAccessRole(currentRole) || !!rolePermissions["clients-all"]?.view;
  const canExportBackup = hasFullAccessRole(currentRole) || !!rolePermissions[DASHBOARD_ACTION_MODULES.backupJson]?.view;
  const visibleViews = useMemo(() => {
    return VIEWS.filter((view) => {
      if (view.id === "admin" && canManageActivityLogging) {
        return true;
      }
      if (view.id === "exports") {
        return canExportRegister || canExportClients || canExportBackup;
      }
      return rolePermissions[view.id]?.view !== false;
    });
  }, [canExportBackup, canExportClients, canExportRegister, canManageActivityLogging, rolePermissions]);
  const navigableViews = useMemo(() => visibleViews.filter((view) => view.showInNav !== false), [visibleViews]);
  useEffect(() => {
    if (!visibleViews.some((view) => view.id === activeView)) {
      setActiveView("dashboard");
    }
  }, [visibleViews, activeView]);

  function notify(message) {
    setToast(message);
  }

  async function addCompany(form) {
    try {
      const companyCode = normalizeCompanyCode(form.shortCode, form.name);
      const result = await supabase
        .from("companies")
        .insert({
          id: createId(),
          name: String(form.name || "").trim(),
          short_code: companyCode,
          code: companyCode,
          address: String(form.address || "").trim(),
          phone: String(form.phone || "").trim(),
          email: String(form.email || "").trim(),
          footer_text: String(form.footerText || "").trim(),
          letter_no_pattern: normalizeReferencePattern(form.letterNoPattern),
        })
        .select("id")
        .single();

      const created = ensureSupabaseSuccess(result, "Company save failed");
      const next = await refreshData();
      const saved = next.companies.some((item) => item.id === created.id);
      notify(saved ? `Company saved in DB (id: ${created.id.slice(0, 8)}...)` : "Company save response received, but verify DB sync");
      return saved;
    } catch (error) {
      notify(`Company save failed: ${error.message}`);
      return false;
    }
  }

  async function updateCompany(form) {
    try {
      const companyCode = normalizeCompanyCode(form.shortCode, form.name);
      const result = await supabase
        .from("companies")
        .update({
          name: String(form.name || "").trim(),
          short_code: companyCode,
          code: companyCode,
          address: String(form.address || "").trim(),
          phone: String(form.phone || "").trim(),
          email: String(form.email || "").trim(),
          footer_text: String(form.footerText || "").trim(),
          letter_no_pattern: normalizeReferencePattern(form.letterNoPattern),
        })
        .eq("id", form.id);

      ensureSupabaseSuccess(result, "Company update failed");
      await refreshData();
      notify("Company updated in DB");
      return true;
    } catch (error) {
      notify(`Company update failed: ${error.message}`);
      return false;
    }
  }

  async function deleteCompany(companyId) {
    const target = data.companies.find((company) => company.id === companyId);
    if (!target) {
      return false;
    }

    const departmentCount = data.departments.filter((department) => department.companyId === companyId).length;
    const templateCount = data.templates.filter((template) => template.companyId === companyId).length;
    const letterCount = data.letters.filter((letter) => letter.companyId === companyId).length;

    const warningParts = [];
    if (departmentCount) warningParts.push(`${departmentCount} departments`);
    if (templateCount) warningParts.push(`${templateCount} templates`);
    if (letterCount) warningParts.push(`${letterCount} letters`);
    const warningSuffix = warningParts.length ? `\nLinked records: ${warningParts.join(", ")}.` : "";

    if (!window.confirm(`Delete company "${target.name}"?${warningSuffix}`)) {
      return false;
    }

    try {
      const result = await supabase.from("companies").delete().eq("id", companyId);
      ensureSupabaseSuccess(result, "Company delete failed");
      await refreshData();
      notify("Company deleted");
      return true;
    } catch (error) {
      notify(`Company delete failed: ${error.message}`);
      return false;
    }
  }

  async function bulkDeleteCompanies(companyIds) {
    const ids = Array.from(new Set((companyIds || []).filter(Boolean)));
    if (!ids.length) {
      return false;
    }

    const targets = data.companies.filter((company) => ids.includes(company.id));
    if (!targets.length) {
      return false;
    }

    const targetSet = new Set(targets.map((item) => item.id));
    const departmentCount = data.departments.filter((department) => targetSet.has(department.companyId)).length;
    const templateCount = data.templates.filter((template) => targetSet.has(template.companyId)).length;
    const letterCount = data.letters.filter((letter) => targetSet.has(letter.companyId)).length;
    const warningParts = [];
    if (departmentCount) warningParts.push(`${departmentCount} departments`);
    if (templateCount) warningParts.push(`${templateCount} templates`);
    if (letterCount) warningParts.push(`${letterCount} letters`);
    const warningSuffix = warningParts.length ? `\nLinked records: ${warningParts.join(", ")}.` : "";

    if (!window.confirm(`Delete ${targets.length} selected companies?${warningSuffix}`)) {
      return false;
    }

    try {
      const result = await supabase.from("companies").delete().in("id", targets.map((item) => item.id));
      ensureSupabaseSuccess(result, "Bulk company delete failed");
      await refreshData();
      notify(`${targets.length} companies deleted`);
      return true;
    } catch (error) {
      notify(`Bulk company delete failed: ${error.message}`);
      return false;
    }
  }

  async function addDepartment(form) {
    try {
      const result = await supabase
        .from("departments")
        .insert({
          id: createId(),
          company_id: form.companyId,
          name: String(form.name || "").trim(),
          code: String(form.code || "").trim().toUpperCase(),
          letter_no_pattern: normalizeReferencePattern(form.letterNoPattern),
        })
        .select("id")
        .single();

      const created = ensureSupabaseSuccess(result, "Department save failed");
      const next = await refreshData();
      const saved = next.departments.some((item) => item.id === created.id);
      notify(saved ? `Department saved in DB (id: ${created.id.slice(0, 8)}...)` : "Department save response received, but verify DB sync");
      return saved;
    } catch (error) {
      notify(`Department save failed: ${error.message}`);
      return false;
    }
  }

  async function updateDepartment(form) {
    try {
      const result = await supabase
        .from("departments")
        .update({
          company_id: form.companyId,
          name: String(form.name || "").trim(),
          code: String(form.code || "").trim().toUpperCase(),
          letter_no_pattern: normalizeReferencePattern(form.letterNoPattern),
        })
        .eq("id", form.id);

      ensureSupabaseSuccess(result, "Department update failed");
      await refreshData();
      notify("Department updated in DB");
      return true;
    } catch (error) {
      notify(`Department update failed: ${error.message}`);
      return false;
    }
  }

  async function deleteDepartment(departmentId) {
    const target = data.departments.find((department) => department.id === departmentId);
    if (!target) {
      return false;
    }

    const templateCount = data.templates.filter((template) => template.departmentId === departmentId).length;
    const letterCount = data.letters.filter((letter) => letter.departmentId === departmentId).length;
    const warningParts = [];
    if (templateCount) warningParts.push(`${templateCount} templates`);
    if (letterCount) warningParts.push(`${letterCount} letters`);
    const warningSuffix = warningParts.length ? `\nLinked records: ${warningParts.join(", ")}.` : "";

    if (!window.confirm(`Delete department "${target.name}"?${warningSuffix}`)) {
      return false;
    }

    try {
      const result = await supabase.from("departments").delete().eq("id", departmentId);
      ensureSupabaseSuccess(result, "Department delete failed");
      await refreshData();
      notify("Department deleted");
      return true;
    } catch (error) {
      notify(`Department delete failed: ${error.message}`);
      return false;
    }
  }

  async function bulkDeleteDepartments(departmentIds) {
    const ids = Array.from(new Set((departmentIds || []).filter(Boolean)));
    if (!ids.length) {
      return false;
    }

    const targets = data.departments.filter((department) => ids.includes(department.id));
    if (!targets.length) {
      return false;
    }

    const targetSet = new Set(targets.map((item) => item.id));
    const templateCount = data.templates.filter((template) => targetSet.has(template.departmentId)).length;
    const letterCount = data.letters.filter((letter) => targetSet.has(letter.departmentId)).length;
    const warningParts = [];
    if (templateCount) warningParts.push(`${templateCount} templates`);
    if (letterCount) warningParts.push(`${letterCount} letters`);
    const warningSuffix = warningParts.length ? `\nLinked records: ${warningParts.join(", ")}.` : "";

    if (!window.confirm(`Delete ${targets.length} selected departments?${warningSuffix}`)) {
      return false;
    }

    try {
      const result = await supabase.from("departments").delete().in("id", targets.map((item) => item.id));
      ensureSupabaseSuccess(result, "Bulk department delete failed");
      await refreshData();
      notify(`${targets.length} departments deleted`);
      return true;
    } catch (error) {
      notify(`Bulk department delete failed: ${error.message}`);
      return false;
    }
  }

  async function addTemplate(form) {
    try {
      const typeRef = await ensureTemplateType(form.type);
      const result = await supabase
        .from("templates")
        .insert({
          id: createId(),
          company_id: form.companyId,
          department_id: form.departmentId,
          template_type_id: typeRef.id,
          name: String(form.name || "").trim(),
          ref_code: String(form.refCode || "").trim().toUpperCase(),
          default_subject: String(form.defaultSubject || "").trim(),
          body_template: String(form.bodyTemplate || ""),
          letter_no_pattern: normalizeReferencePattern(form.letterNoPattern),
          design_json: form.design || {},
        })
        .select("id")
        .single();

      const created = ensureSupabaseSuccess(result, "Template save failed");
      await logActivity("CREATE_TEMPLATE", "templates", `Created template ${String(form.name || "").trim() || "Untitled template"}`, {
        entityId: created.id,
      });
      if (hasMeaningfulTemplateDesign(form.design)) {
        await logActivity("CREATE_DESIGN", "templates", `Created design for template ${String(form.name || "").trim() || "Untitled template"}`, {
          entityId: created.id,
        });
      }
      const next = await refreshData();
      const saved = next.templates.some((item) => item.id === created.id);
      notify(saved ? `Template saved in DB (id: ${created.id.slice(0, 8)}...)` : "Template save response received, but verify DB sync");
    } catch (error) {
      notify(`Template save failed: ${error.message}`);
    }
  }

  async function updateTemplate(form) {
    try {
      const typeRef = await ensureTemplateType(form.type);
      const result = await supabase
        .from("templates")
        .update({
          company_id: form.companyId,
          department_id: form.departmentId,
          template_type_id: typeRef.id,
          name: String(form.name || "").trim(),
          ref_code: String(form.refCode || "").trim().toUpperCase(),
          default_subject: String(form.defaultSubject || "").trim(),
          body_template: String(form.bodyTemplate || ""),
          letter_no_pattern: normalizeReferencePattern(form.letterNoPattern),
          design_json: form.design || {},
        })
        .eq("id", form.id);

      ensureSupabaseSuccess(result, "Template update failed");
      await logActivity("UPDATE_TEMPLATE", "templates", `Updated template ${String(form.name || "").trim() || form.id}`, {
        entityId: form.id,
      });
      if (hasMeaningfulTemplateDesign(form.design)) {
        await logActivity("UPDATE_DESIGN", "templates", `Updated design for template ${String(form.name || "").trim() || form.id}`, {
          entityId: form.id,
        });
      }
      await refreshData();
      notify("Template updated in DB");
    } catch (error) {
      notify(`Template update failed: ${error.message}`);
    }
  }

  async function addTemplateType(name) {
    try {
      const typeRef = await ensureTemplateType(name);
      await refreshData();
      notify(`Template type "${typeRef.name}" is ready`);
      return mapTemplateType(typeRef);
    } catch (error) {
      notify(`Template type save failed: ${error.message}`);
      return null;
    }
  }

  async function deleteTemplateType(templateTypeId) {
    const target = data.templateTypes.find((type) => type.id === templateTypeId);
    if (!target) {
      return false;
    }

    const templateCount = data.templates.filter((template) => template.templateTypeId === templateTypeId || template.type === target.name).length;
    const letterCount = data.letters.filter((letter) => letter.templateTypeId === templateTypeId).length;
    const warningParts = [];
    if (templateCount) warningParts.push(`${templateCount} templates`);
    if (letterCount) warningParts.push(`${letterCount} issued letters`);
    const warningSuffix = warningParts.length ? `\nLinked records will keep their saved content, but the type link will be removed: ${warningParts.join(", ")}.` : "";

    if (!window.confirm(`Delete template type "${target.name}"?${warningSuffix}`)) {
      return false;
    }

    try {
      const result = await supabase.from("template_types").delete().eq("id", templateTypeId);
      ensureSupabaseSuccess(result, "Template type delete failed");
      await logActivity("DELETE_TEMPLATE_TYPE", "templates", `Deleted template type ${target.name}`, {
        entityId: templateTypeId,
      });
      await refreshData();
      notify("Template type deleted");
      return true;
    } catch (error) {
      notify(`Template type delete failed: ${error.message}`);
      return false;
    }
  }

  async function deleteTemplate(templateId) {
    const target = data.templates.find((template) => template.id === templateId);
    if (!target) {
      return false;
    }

    const hasIssuedLetters = data.letters.some((letter) => letter.templateId === templateId);
    const warning = hasIssuedLetters
      ? `Delete template "${target.name}"? Issued letters will remain in register snapshots.`
      : `Delete template "${target.name}"?`;

    if (!window.confirm(warning)) {
      return false;
    }

    try {
      const result = await supabase.from("templates").delete().eq("id", templateId);
      ensureSupabaseSuccess(result, "Template delete failed");
      await logActivity("DELETE_TEMPLATE", "templates", `Deleted template ${target.name || templateId}`, {
        entityId: templateId,
      });
      await refreshData();

      if (templateEditorTargetId === templateId) {
        setTemplateEditorTargetId("");
      }

      notify("Template deleted");
      return true;
    } catch (error) {
      notify(`Template delete failed: ${error.message}`);
      return false;
    }
  }

  async function duplicateTemplate(templateId, options = {}) {
    const source = data.templates.find((template) => template.id === templateId);
    if (!source) {
      return false;
    }

    const baseName = String(source.name || "").trim() || "Template";
    const existingNames = new Set(
      data.templates.map((template) => String(template.name || "").trim().toLowerCase()).filter(Boolean),
    );
    const requestedName = String(options.name || "").trim();
    let duplicateName = requestedName || `${baseName} Copy`;
    let suffix = 2;
    while (existingNames.has(duplicateName.toLowerCase())) {
      duplicateName = requestedName ? `${requestedName} ${suffix}` : `${baseName} Copy ${suffix}`;
      suffix += 1;
    }

    try {
      const typeRef = await ensureTemplateType(source.type || source.name || "Template");
      const result = await supabase
        .from("templates")
        .insert({
          id: createId(),
          company_id: source.companyId,
          department_id: source.departmentId,
          template_type_id: typeRef.id,
          name: duplicateName,
          ref_code: String(source.refCode || "").trim().toUpperCase(),
          default_subject: String(source.defaultSubject || "").trim(),
          body_template: String(source.bodyTemplate || ""),
          letter_no_pattern: normalizeReferencePattern(source.letterNoPattern),
          design_json: JSON.parse(JSON.stringify(source.design || {})),
        })
        .select("id")
        .single();

      const created = ensureSupabaseSuccess(result, "Template duplicate failed");
      await logActivity("DUPLICATE_TEMPLATE", "templates", `Duplicated template as ${duplicateName}`, {
        entityId: created.id,
      });
      const next = await refreshData();
      const saved = next.templates.find((template) => template.id === created.id);
      if (saved) {
        setTemplateEditorTargetId(saved.id);
      }
      notify(saved ? `Template duplicated as "${duplicateName}"` : "Template duplicated, but verify DB sync");
      return saved || true;
    } catch (error) {
      notify(`Template duplicate failed: ${error.message}`);
      return false;
    }
  }

  async function bulkDeleteTemplates(templateIds) {
    const ids = Array.from(new Set((templateIds || []).filter(Boolean)));
    if (!ids.length) {
      return false;
    }

    const targets = data.templates.filter((template) => ids.includes(template.id));
    if (!targets.length) {
      return false;
    }

    const targetSet = new Set(targets.map((item) => item.id));
    const issuedCount = data.letters.filter((letter) => targetSet.has(letter.templateId)).length;
    const warning = issuedCount
      ? `Delete ${targets.length} templates? ${issuedCount} issued letter records use snapshots, so register data remains safe.`
      : `Delete ${targets.length} templates?`;

    if (!window.confirm(warning)) {
      return false;
    }

    try {
      const result = await supabase.from("templates").delete().in("id", targets.map((item) => item.id));
      ensureSupabaseSuccess(result, "Bulk template delete failed");
      await refreshData();

      if (templateEditorTargetId && targetSet.has(templateEditorTargetId)) {
        setTemplateEditorTargetId("");
      }

      notify(`${targets.length} templates deleted`);
      return true;
    } catch (error) {
      notify(`Bulk template delete failed: ${error.message}`);
      return false;
    }
  }

  function openTemplateEditor(templateId) {
    if (!templateId) {
      return;
    }

    setTemplateEditorTargetId(templateId);
    setActiveView("templates");
  }

  function updateIssueDraft(patch) {
    setPreviewLetterId(null);
    setIssueDraft((current) => {
      const currentTemplate = data.templates.find((template) => template.id === current.templateId);
      const currentDefaultSubject = currentTemplate?.defaultSubject || currentTemplate?.name || "";
      const nextRawDraft = { ...current, ...patch };

      if (Object.prototype.hasOwnProperty.call(patch, "clientId")) {
        const nextClient = data.clients.find((client) => client.id === (patch.clientId || ""));
        if (nextClient) {
          Object.assign(nextRawDraft, buildIssueDraftPatchFromClient(nextClient));
        }
      }

      const nextDraft = createIssueDraft(data, nextRawDraft);

      if ((patch.companyId || patch.departmentId || patch.letterType || patch.templateId) && (!current.subject || current.subject === currentDefaultSubject)) {
        const nextTemplate = data.templates.find((template) => template.id === nextDraft.templateId);
        nextDraft.subject = nextTemplate?.defaultSubject || nextTemplate?.name || "";
      }

      return nextDraft;
    });
  }

  async function searchEmployeesFromHr(query) {
    const term = String(query || "").trim();
    if (!term) {
      return [];
    }

    let response;
    try {
      response = await fetch(`/api/employees/search?query=${encodeURIComponent(term)}&limit=12`);
    } catch {
      throw new Error("Employee API is unreachable. Start full stack with: npm run dev:full");
    }

    const rawText = await response.text();
    let payload = {};
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = {};
    }

    if (!response.ok || !payload?.ok) {
      const rawMessage = String(payload?.error || rawText || "").trim();
      const lowerRawMessage = rawMessage.toLowerCase();

      if (lowerRawMessage.includes("econnrefused") || lowerRawMessage.includes("http proxy error")) {
        throw new Error("Employee API is offline. Start full stack with: npm run dev");
      }

      if (lowerRawMessage.includes("service_role")) {
        throw new Error("HR service key is wrong. Put HR project service_role key in SUPABASE_HR_SERVICE_ROLE_KEY, then restart dev server.");
      }

      if (lowerRawMessage.includes("permission denied")) {
        throw new Error("HR table access denied. Use service_role key or allow SELECT policy for employees table.");
      }

      const message = rawMessage || `Employee search failed (HTTP ${response.status})`;
      throw new Error(message);
    }

    return payload?.data?.employees || [];
  }

  async function issueLetter() {
    try {
      const normalizedLetterNo = (value) => String(value || "").trim();
      const hasDuplicateLetterNo = (candidate, ignoreLetterId = "") => {
        const normalizedCandidate = normalizedLetterNo(candidate).toLowerCase();
        if (!normalizedCandidate) {
          return false;
        }

        return data.letters.some((letter) => {
          if (ignoreLetterId && letter.id === ignoreLetterId) {
            return false;
          }

          return String(letter.letterNo || "").trim().toLowerCase() === normalizedCandidate;
        });
      };

      const editingLetter = editingLetterId ? data.letters.find((item) => item.id === editingLetterId) : null;
      const company = data.companies.find((item) => item.id === issueDraft.companyId);
      const department = data.departments.find((item) => item.id === issueDraft.departmentId);
      const template = data.templates.find((item) => item.id === issueDraft.templateId);

      if (!company || !department || !template) {
        notify("Please complete company, department, and template selection first.");
        return;
      }

      if (!String(issueDraft.issueDate || "").trim()) {
        notify("Issue date is required.");
        return;
      }

      if (!String(issueDraft.subject || "").trim()) {
        notify("Subject is required.");
        return;
      }

      if (!String(issueDraft.recipientName || "").trim()) {
        notify("Recipient name is required.");
        return;
      }

      const patternInUse = resolveReferencePattern({
        company,
        department,
        template,
        draftPattern: issueDraft.letterNoFormatOverride,
      });

      const manualLetterNo = String(issueDraft.letterNoManual || "").trim();
      const customFieldValues =
        typeof issueDraft.customFields === "object" && issueDraft.customFields !== null
          ? issueDraft.customFields
          : {};
      const employeeData = {
        empId: issueDraft.employeeEmpId || "",
        fullName: issueDraft.employeeFullName || issueDraft.recipientName || "",
        cnic: issueDraft.employeeCnic || "",
        designation: issueDraft.employeeDesignation || "",
        departmentName: issueDraft.employeeDepartmentName || issueDraft.recipientDepartment || "",
        personalPhone: issueDraft.employeePersonalPhone || "",
        companyEmail: issueDraft.employeeCompanyEmail || "",
        address: issueDraft.employeeAddress || "",
        joiningDate: issueDraft.employeeJoiningDate || "",
        reportingManager: issueDraft.employeeReportingManager || "",
      };
      const syncedTemplateType = await ensureIssueReferencesPersisted({
        company,
        department,
        template,
        templateTypeName: template.type || template.name,
      });
      const templateTypeCode = normalizeTemplateTypeCode(template.type || template.name);
      const templateTypeId = syncedTemplateType?.id || data.templateTypes.find((item) => item.code === templateTypeCode)?.id || template.templateTypeId || null;

      if (editingLetter) {
        const finalLetterNo = normalizedLetterNo(manualLetterNo || editingLetter.letterNo || "");
        if (!finalLetterNo) {
          notify("Letter number could not be resolved. Add manual override and try again.");
          return;
        }

        if (hasDuplicateLetterNo(finalLetterNo, editingLetter.id)) {
          notify(`Letter number "${finalLetterNo}" already exists. Use a unique number before updating.`);
          return;
        }

        const values = {
          ...issueDraft,
          letterNo: finalLetterNo,
        };
        const renderedValues = buildLetterValueMap({ company, department, template, values });
        const pdfFileName = `${(finalLetterNo || "letter").replace(/\//g, "-")}-${slugify(issueDraft.recipientName || "letter")}.pdf`;

        const updateRes = await supabase
          .from("letters")
          .update({
            company_id: company.id,
            department_id: department.id,
            template_id: template.id,
            client_id: issueDraft.clientId || null,
            template_type_id: templateTypeId,
            letter_no: finalLetterNo,
            letter_no_manual: manualLetterNo,
            letter_no_format_override: normalizeReferencePattern(issueDraft.letterNoFormatOverride),
            letter_no_pattern_used: patternInUse,
            issue_date: issueDraft.issueDate || null,
            recipient_name: issueDraft.recipientName || "",
            recipient_company: issueDraft.recipientCompany || "",
            recipient_department: issueDraft.recipientDepartment || "",
            subject: issueDraft.subject || template.defaultSubject || template.name,
            body_notes: issueDraft.bodyNotes || "",
            prepared_by: issueDraft.preparedBy || "",
            approved_by: issueDraft.approvedBy || "",
            issued_by_user_id: currentUserProfile?.id || null,
            issued_by_name: currentUserProfile?.full_name || session?.user?.email || "",
            remarks: issueDraft.remarks || "",
            rendered_body: renderedValues.body_text,
            pdf_file_name: pdfFileName,
            pdf_storage_path: `storage/pdfs/${pdfFileName}`,
            custom_fields_json: customFieldValues,
            template_snapshot_json: {
              id: template.id,
              name: template.name,
              type: template.type,
              refCode: template.refCode || "",
              defaultSubject: template.defaultSubject || "",
              bodyTemplate: template.bodyTemplate || "",
              letterNoPattern: template.letterNoPattern || "",
              design: normalizeTemplateDesignForIssueType(template.design, issueDraft.letterType || template.type || template.name),
              customFieldValues,
              employeeData,
              templateTypeId,
            },
          })
          .eq("id", editingLetter.id);
        ensureSupabaseSuccess(updateRes, "Letter update failed");
        const selectedClient = data.clients.find((client) => client.id === (issueDraft.clientId || null));
        await logActivity("UPDATE_LETTER", "letters", `Updated letter ${finalLetterNo}`, {
          entityId: editingLetter.id,
          clientId: selectedClient?.id || null,
          clientName: selectedClient?.client_name || selectedClient?.display_name || "",
          issuedByName: currentUserProfile?.full_name || session?.user?.email || "",
        });

        const nextData = await refreshData();
        const savedLetter = nextData.letters.find((item) => item.id === editingLetter.id);
        if (!savedLetter) {
          notify("Letter update response received, but verify DB sync");
          return;
        }

        setPreviewLetterId(savedLetter.id);
        setEditingLetterId("");
        setIssueDraft(
          createIssueDraft(nextData, {
            ...issueDraft,
            subject: savedLetter.subject,
            issueDate: savedLetter.issueDate || issueDraft.issueDate || getTodayIso(),
            sequenceOverride: "",
          }),
        );
        setActiveView("issue");
        notify(`Letter updated in DB as ${savedLetter.letterNo}`);
        return;
      }

      const sequenceKey = await ensureDepartmentSequenceSeed(company, department);
      const sequenceOverrideText = String(issueDraft.sequenceOverride || "").trim();
      const hasSequenceOverride = sequenceOverrideText.length > 0;
      let sequence = 0;

      if (hasSequenceOverride) {
        if (!/^\d+$/.test(sequenceOverrideText)) {
          notify("Serial override must be digits only (example: 102 or 0015).");
          return;
        }

        const requestedSequence = Number(sequenceOverrideText);
        if (!requestedSequence || requestedSequence < 1) {
          notify("Serial override must be greater than 0.");
          return;
        }

        const existingCounterRes = await supabase
          .from("sequence_counters")
          .select("current")
          .eq("key", sequenceKey)
          .maybeSingle();
        const existingCounterData = ensureSupabaseSuccess(existingCounterRes, "Sequence lookup failed");
        const existingCounter = Number(existingCounterData?.current || 0);

        if (requestedSequence <= existingCounter) {
          notify(`Serial must be greater than current sequence (${existingCounter}) for this reference format.`);
          return;
        }

        const upsertRes = await supabase
          .from("sequence_counters")
          .upsert({ key: sequenceKey, current: requestedSequence }, { onConflict: "key" });
        ensureSupabaseSuccess(upsertRes, "Sequence override update failed");
        sequence = requestedSequence;
      } else {
        const sequenceRes = await supabase.rpc("next_sequence", { counter_key: sequenceKey });
        const sequenceRaw = ensureSupabaseSuccess(sequenceRes, "Sequence increment failed");
        sequence = Number(Array.isArray(sequenceRaw) ? sequenceRaw[0] : sequenceRaw);
      }

      const autoLetterNo = applyReferencePattern({
        pattern: patternInUse,
        company,
        department,
        template,
        issueDate: issueDraft.issueDate,
        sequence,
      });

      const finalLetterNo = normalizedLetterNo(manualLetterNo || autoLetterNo);
      if (!finalLetterNo) {
        notify("Letter number could not be resolved. Check your reference format or manual override.");
        return;
      }

      if (hasDuplicateLetterNo(finalLetterNo)) {
        notify(`Letter number "${finalLetterNo}" already exists. Change serial override or manual number.`);
        return;
      }

      const values = {
        ...issueDraft,
        letterNo: finalLetterNo,
      };
      const renderedValues = buildLetterValueMap({ company, department, template, values });
      const letterId = createId();
      const pdfFileName = `${finalLetterNo.replace(/\//g, "-")}-${slugify(issueDraft.recipientName || "letter")}.pdf`;
      const createdAt = new Date().toISOString();

      const insertRes = await supabase.from("letters").insert({
        id: letterId,
        company_id: company.id,
        department_id: department.id,
        template_id: template.id,
        client_id: issueDraft.clientId || null,
        template_type_id: templateTypeId,
        letter_no: finalLetterNo,
        letter_no_manual: manualLetterNo,
        letter_no_format_override: normalizeReferencePattern(issueDraft.letterNoFormatOverride),
        letter_no_pattern_used: patternInUse,
        issue_date: issueDraft.issueDate || null,
        recipient_name: issueDraft.recipientName || "",
        recipient_company: issueDraft.recipientCompany || "",
        recipient_department: issueDraft.recipientDepartment || "",
        subject: issueDraft.subject || template.defaultSubject || template.name,
        body_notes: issueDraft.bodyNotes || "",
        prepared_by: issueDraft.preparedBy || "",
        approved_by: issueDraft.approvedBy || "",
        issued_by_user_id: currentUserProfile?.id || null,
        issued_by_name: currentUserProfile?.full_name || session?.user?.email || "",
        remarks: issueDraft.remarks || "",
        rendered_body: renderedValues.body_text,
        pdf_file_name: pdfFileName,
        pdf_storage_path: `storage/pdfs/${pdfFileName}`,
        custom_fields_json: customFieldValues,
        template_snapshot_json: {
          id: template.id,
          name: template.name,
          type: template.type,
          refCode: template.refCode || "",
          defaultSubject: template.defaultSubject || "",
          bodyTemplate: template.bodyTemplate || "",
          letterNoPattern: template.letterNoPattern || "",
          design: normalizeTemplateDesignForIssueType(template.design, issueDraft.letterType || template.type || template.name),
          customFieldValues,
          employeeData,
          templateTypeId,
        },
        created_at: createdAt,
      });

      ensureSupabaseSuccess(insertRes, "Letter save failed");
      const selectedClient = data.clients.find((client) => client.id === (issueDraft.clientId || null));
      await logActivity("ISSUE_LETTER", "letters", `Issued letter ${finalLetterNo}`, {
        entityId: letterId,
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.client_name || selectedClient?.display_name || "",
        issuedByName: currentUserProfile?.full_name || session?.user?.email || "",
      });
      const nextData = await refreshData();
      const savedLetter = nextData.letters.find((item) => item.id === letterId);

      if (!savedLetter) {
        notify("Letter save response received, but verify DB sync");
        return;
      }

      setPreviewLetterId(savedLetter.id);
      setIssueDraft(
        createIssueDraft(nextData, {
          ...issueDraft,
          subject: savedLetter.subject,
          issueDate: issueDraft.issueDate || getTodayIso(),
          sequenceOverride: "",
        }),
      );
      setActiveView("issue");
      notify(`Letter saved in DB as ${savedLetter.letterNo}`);
    } catch (error) {
      notify(`Issue failed: ${error.message}`);
    }
  }

  async function deleteLetter(letterId) {
    const target = data.letters.find((letter) => letter.id === letterId);
    if (!target) {
      return false;
    }

    if (!window.confirm(`Delete letter "${target.letterNo}" from register?`)) {
      return false;
    }

    try {
      const result = await supabase.from("letters").delete().eq("id", letterId);
      ensureSupabaseSuccess(result, "Letter delete failed");
      await logActivity("DELETE_LETTER", "letters", `Deleted letter ${target.letterNo}`, {
        entityId: letterId,
        clientId: target.clientId || null,
        clientName: data.clients.find((client) => client.id === target.clientId)?.client_name || "",
      });
      await refreshData();

      if (previewLetterId === letterId) {
        setPreviewLetterId(null);
      }
      if (editingLetterId === letterId) {
        setEditingLetterId("");
      }

      notify("Letter deleted");
      return true;
    } catch (error) {
      notify(`Letter delete failed: ${error.message}`);
      return false;
    }
  }

  async function bulkDeleteLetters(letterIds) {
    const ids = Array.from(new Set((letterIds || []).filter(Boolean)));
    if (!ids.length) {
      return false;
    }

    const targets = data.letters.filter((letter) => ids.includes(letter.id));
    if (!targets.length) {
      return false;
    }

    if (!window.confirm(`Delete ${targets.length} selected letters from register?`)) {
      return false;
    }

    try {
      const result = await supabase.from("letters").delete().in("id", targets.map((item) => item.id));
      ensureSupabaseSuccess(result, "Bulk letter delete failed");
      await refreshData();

      if (previewLetterId && ids.includes(previewLetterId)) {
        setPreviewLetterId(null);
      }
      if (editingLetterId && ids.includes(editingLetterId)) {
        setEditingLetterId("");
      }

      notify(`${targets.length} letters deleted`);
      return true;
    } catch (error) {
      notify(`Bulk letter delete failed: ${error.message}`);
      return false;
    }
  }

  async function signIn() {
    if (authSubmitting) {
      return;
    }
    if (!authEmail.trim() || !authPassword) {
      notify("Enter email and password.");
      return;
    }
    setAuthSubmitting(true);
    try {
      const email = authEmail.trim().toLowerCase();
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
      if (error) {
        const raw = String(error.message || "").toLowerCase();
        if (raw.includes("email not confirmed")) {
          notify("Sign in failed: Email is not confirmed. Check inbox and confirm first.");
        } else if (raw.includes("invalid login credentials")) {
          notify("Sign in failed: Invalid email/password, or this user was only added to the app DB and not Supabase Auth.");
        } else {
          notify(`Sign in failed: ${error.message}`);
        }
        return;
      }

      let nextData = await fetchBootstrapData();
      let matchedUser = findUserProfileInData(nextData.users, authData?.user, email);
      let profileResult = matchedUser ? { data: matchedUser, error: null } : await findUserProfileByEmail(email);
      if (profileResult.error) {
        await supabase.auth.signOut();
        notify(`Sign in failed: User profile lookup failed (${profileResult.error.message}).`);
        return;
      }
      if (!profileResult.data) {
        const isFirstVisibleUser = (nextData.users || []).length === 0;
        if (!isFirstVisibleUser) {
          await supabase.auth.signOut();
          notify("Sign in failed: No app user profile was found for this email. Create the user in the portal and assign a role first.");
          return;
        }
        const createProfileResult = await supabase
          .from("users")
          .upsert(
            {
              id: authData?.user?.id || createId(),
              email,
              full_name: authData?.user?.user_metadata?.full_name || email,
              role: FULL_ACCESS_ROLE,
              active: true,
            },
            { onConflict: "email" },
          )
          .select("id, email, full_name, role, active")
          .single();

        if (createProfileResult.error) {
          await supabase.auth.signOut();
          notify(`Sign in failed: Auth login worked, but app profile could not be created (${createProfileResult.error.message}).`);
          return;
        }

        profileResult = createProfileResult;
        nextData = await fetchBootstrapData();
      }
      if (profileResult.data.active === false) {
        await supabase.auth.signOut();
        notify("Sign in failed: This user profile is inactive.");
        return;
      }
      if (!normalizeRoleName(profileResult.data.role)) {
        await supabase.auth.signOut();
        notify("Sign in failed: This user profile has no role assigned. Assign a portal role first.");
        return;
      }
      const freshRoleTableRoles = getRoleNamesFromData(nextData);
      if (!freshRoleTableRoles.includes(normalizeRoleName(profileResult.data.role))) {
        await supabase.auth.signOut();
        notify(`Sign in failed: Role "${profileResult.data.role}" is not in the roles table. Create it in Roles first.`);
        return;
      }

      matchedUser = findUserProfileInData(nextData.users, authData?.user, email) || profileResult.data;
      await logActivity("LOGIN", "auth", "User signed in", {
        actorId: matchedUser?.id || null,
      });
      setData(nextData);
      setAuthPassword("");
      setActiveView("dashboard");
      notify(`Signed in as ${normalizeRoleName(matchedUser?.role || profileResult.data.role)}`);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function signOut() {
    if (currentUserProfile?.id) {
      await logActivity("LOGOUT", "auth", "User signed out", {
        actorId: currentUserProfile.id,
      });
    }
    const { error } = await supabase.auth.signOut();
    if (error) notify(`Sign out failed: ${error.message}`);
    else {
      setActiveView("dashboard");
      setPreviewLetterId(null);
      setEditingLetterId("");
      setActiveClientProfileId("");
      setAuthPassword("");
      notify("Signed out");
    }
  }

  async function addClient(form) {
   if (!rolePermissions["clients-create"]?.create) {
      notify("You do not have permission to create clients.");
      return false;
    }
    try {
      const { dbPayload, customPayload } = splitClientPayloadByStorage(form);
      const clientDisplayName = dbPayload.client_name || dbPayload.full_name || form.company || form.email || "Client";
      const payload = {
        ...dbPayload,
        client_code: buildUniqueClientCode(dbPayload.client_code, data.clients),
        custom_fields_json: customPayload,
        created_by: currentUserProfile?.id || null,
        updated_by: currentUserProfile?.id || null,
      };
      const result = await supabase.from("clients").insert(payload).select("id").single();
      const createdClient = ensureSupabaseSuccess(result, "Client save failed");
      const nextData = await refreshData();
      const savedClient =
        nextData.clients.find((client) => client.id === createdClient?.id)
        || nextData.clients.find((client) => String(client.email || "").trim().toLowerCase() === String(payload.email || "").trim().toLowerCase())
        || nextData.clients.find((client) => String(client.client_name || "").trim() === String(clientDisplayName || "").trim());
      await logActivity("CREATE_CLIENT", "clients", `Created client: ${clientDisplayName}`, {
        entityId: savedClient?.id || null,
        clientId: savedClient?.id || null,
        clientName: clientDisplayName,
      });
      notify("Client added");
      return true;
    } catch (error) {
      notify(`Client save failed: ${error.message}`);
      return false;
    }
  }

  async function deleteClient(id) {
    if (!rolePermissions["clients-all"]?.delete) {
      notify("You do not have permission to delete clients.");
      return false;
    }
    try {
      const result = await supabase.from("clients").delete().eq("id", id);
      ensureSupabaseSuccess(result, "Client delete failed");
      await logActivity("DELETE_CLIENT", "clients", "Deleted client record", {
        entityId: id,
        clientId: id,
        clientName: data.clients.find((client) => client.id === id)?.client_name || "",
      });
      await refreshData();
      notify("Client deleted");
      return true;
    } catch (error) {
      notify(`Client delete failed: ${error.message}`);
      return false;
    }
  }

  async function updateClient(id, patch) {
    if (!rolePermissions["clients-all"]?.edit) {

      notify("You do not have permission to edit clients.");
      return false;
    }
    try {
      const currentClient = data.clients.find((client) => client.id === id);
      const { dbPayload, customPayload } = splitClientPayloadByStorage(patch);
      const payload = {
        ...dbPayload,
        client_code: Object.prototype.hasOwnProperty.call(patch || {}, "client_code")
          ? buildUniqueClientCode(dbPayload.client_code, data.clients, id)
          : currentClient?.client_code || buildUniqueClientCode(dbPayload.client_code, data.clients, id),
        custom_fields_json: {
          ...(currentClient?.custom_fields_json || {}),
          ...customPayload,
        },
        updated_by: currentUserProfile?.id || null,
      };
      const result = await supabase.from("clients").update(payload).eq("id", id);
      ensureSupabaseSuccess(result, "Client update failed");
      await logActivity("UPDATE_CLIENT", "clients", "Updated client profile", {
        entityId: id,
        clientId: id,
        clientName: patch.client_name || data.clients.find((client) => client.id === id)?.client_name || "",
      });
      await refreshData();
      notify("Client updated");
      return true;
    } catch (error) {
      notify(`Client update failed: ${error.message}`);
      return false;
    }
  }

  async function addClientField(fieldDraft) {
    if (!(hasFullAccessRole(currentRole) || rolePermissions.client_fields?.create)) {
      notify("You do not have permission to create client fields.");
      return false;
    }
    const normalized = normalizeClientFieldDraft(fieldDraft);
    if (!normalized.field_key || !normalized.label) {
      notify("Field key and label are required.");
      return false;
    }
    if (data.clientFields.some((field) => field.field_key === normalized.field_key)) {
      notify("Field key already exists.");
      return false;
    }
    try {
      const payload = {
        ...normalized,
        options_json: normalized.options_json,
      };
      const result = await supabase.from("client_fields").insert(payload);
      ensureSupabaseSuccess(result, "Client field create failed");
      await logActivity("CREATE_CLIENT_FIELD", "client_fields", `Created client field ${normalized.field_key}`, { entityId: normalized.id });
      await refreshData();
      notify("Client field created");
      return true;
    } catch (error) {
      notify(`Client field create failed: ${error.message}`);
      return false;
    }
  }

  async function updateClientField(fieldId, patch) {
    if (!(hasFullAccessRole(currentRole) || rolePermissions.client_fields?.edit)) {
      notify("You do not have permission to edit client fields.");
      return false;
    }
    const existing = data.clientFields.find((field) => field.id === fieldId);
    if (!existing) {
      return false;
    }
    const normalized = normalizeClientFieldDraft({ ...existing, ...patch, id: existing.id, field_key: existing.field_key });
    if (existing.is_system && (existing.field_key === "client_name" || existing.field_key === "email")) {
      if (normalized.is_active === false) {
        notify(`${existing.field_key} cannot be deactivated.`);
        return false;
      }
      if (normalized.is_required === false) {
        notify(`${existing.field_key} must remain required.`);
        return false;
      }
    }
    try {
      const query = supabase
        .from("client_fields")
        .update({
          label: normalized.label,
          input_type: normalized.input_type,
          options_json: normalized.options_json,
          is_required: normalized.is_required,
          is_active: normalized.is_active,
          sort_order: normalized.sort_order,
        });
      const result = isUuid(fieldId) ? await query.eq("id", fieldId) : await query.eq("field_key", existing.field_key);
      ensureSupabaseSuccess(result, "Client field update failed");
      await logActivity("UPDATE_CLIENT_FIELD", "client_fields", `Updated client field ${existing.field_key}`, { entityId: isUuid(fieldId) ? fieldId : null });
      await refreshData();
      notify("Client field updated");
      return true;
    } catch (error) {
      notify(`Client field update failed: ${error.message}`);
      return false;
    }
  }

  async function deleteClientField(fieldId) {
    if (!(hasFullAccessRole(currentRole) || rolePermissions.client_fields?.delete)) {
      notify("You do not have permission to delete client fields.");
      return false;
    }
    const target = data.clientFields.find((field) => field.id === fieldId);
    if (!target || target.is_system) {
      notify("System fields cannot be deleted.");
      return false;
    }
    if (!window.confirm(`Delete client field "${target.label}"?`)) {
      return false;
    }
    try {
      const query = supabase.from("client_fields").delete();
      const result = isUuid(fieldId) ? await query.eq("id", fieldId) : await query.eq("field_key", target.field_key);
      ensureSupabaseSuccess(result, "Client field delete failed");
      await logActivity("DELETE_CLIENT_FIELD", "client_fields", `Deleted client field ${target.field_key}`, { entityId: isUuid(fieldId) ? fieldId : null });
      await refreshData();
      notify("Client field deleted");
      return true;
    } catch (error) {
      notify(`Client field delete failed: ${error.message}`);
      return false;
    }
  }

  async function addUser(form) {
    if (!rolePermissions.users.create) {
      notify("You do not have permission to create users.");
      return false;
    }
    try {
      const email = String(form?.email || "").trim().toLowerCase();
      const password = String(form?.password || "");
      const full_name = String(form?.full_name || "").trim();
      const requestedRole = normalizeRoleName(form?.role || "");
      const department_name = String(form?.department_name || "").trim();
      const active = form?.active !== false;

      if (!email) {
        notify("Email is required.");
        return false;
      }
      if (password.length < 6) {
        notify("Password must be at least 6 characters.");
        return false;
      }
      if (!requestedRole) {
        notify("Role is required.");
        return false;
      }
      if (!roleTableRoles.includes(requestedRole)) {
        notify("Selected role does not exist in the role table.");
        return false;
      }

      const existingUser = (data.users || []).find((user) => String(user.email || "").trim().toLowerCase() === email);
      const isCurrentSessionUser = String(session?.user?.email || "").trim().toLowerCase() === email;
      const role = isCurrentSessionUser && existingUser && hasFullAccessRole(existingUser.role)
        ? FULL_ACCESS_ROLE
        : requestedRole;

      let authResult = { data: null, error: null };
      const authClient = createIsolatedAuthClient();
      authResult = await authClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name,
            role,
            department_name,
          },
        },
      });
      if (authResult.error) {
        const raw = String(authResult.error.message || "").toLowerCase();
        if (!raw.includes("already registered") && !raw.includes("already exists")) {
          notify(`Auth user create failed: ${authResult.error.message}`);
          return false;
        }
      }

      const profilePayload = {
        email,
        full_name,
        role,
        department_name,
        active,
      };
      const syncedUserResult = existingUser
        ? { data: existingUser, error: null }
        : await findUserProfileByEmail(email);
      ensureSupabaseSuccess(syncedUserResult, "User lookup failed");
      const savedUser = syncedUserResult.data;
      const result = savedUser
        ? await supabase
          .from("users")
          .update(profilePayload)
          .eq("id", savedUser.id)
          .select("id")
          .single()
        : await supabase
          .from("users")
          .insert({
            id: authResult.data?.user?.id || createId(),
            ...profilePayload,
          })
          .select("id")
          .single();
      ensureSupabaseSuccess(result, "User save failed");
      await refreshData();
      if (existingUser) {
        notify("User login repaired and profile updated.");
      } else if (authResult.data?.session) {
        notify("User login and profile added.");
      } else {
        notify("User login and profile added. If email confirmation is enabled, confirm the email before signing in.");
      }
      return true;
    } catch (error) {
      notify(`User save failed: ${error.message}`);
      return false;
    }
  }

  async function toggleUserActive(id, active) {
    if (!rolePermissions.users.edit) {
      notify("You do not have permission to edit users.");
      return false;
    }
    const targetUser = (data.users || []).find((user) => user.id === id);
    if (!targetUser) {
      notify("User not found.");
      return false;
    }
    if (id === currentUserProfile?.id && active === false) {
      notify("You cannot disable your own account while signed in.");
      return false;
    }
    if (hasFullAccessRole(targetUser.role) && active === false) {
      const activeAdmins = (data.users || []).filter((user) => user.active !== false && hasFullAccessRole(user.role));
      if (activeAdmins.length <= 1) {
        notify("At least one active admin user is required.");
        return false;
      }
    }
    try {
      const result = await supabase.from("users").update({ active }).eq("id", id);
      ensureSupabaseSuccess(result, "User update failed");
      await refreshData();
      notify("User updated");
      return true;
    } catch (error) {
      notify(`User update failed: ${error.message}`);
      return false;
    }
  }

  async function updateUser(id, patch) {
    if (!rolePermissions.users.edit) {
      notify("You do not have permission to edit users.");
      return false;
    }
    const targetUser = (data.users || []).find((user) => user.id === id);
    if (!targetUser) {
      notify("User not found.");
      return false;
    }

    const nextRole = normalizeRoleName(patch?.role || "");
    const nextActive = patch?.active !== false;
    const full_name = String(patch?.full_name || "").trim();
    const department_name = String(patch?.department_name || "").trim();

    if (!nextRole) {
      notify("Role is required.");
      return false;
    }
    if (!roleTableRoles.includes(nextRole)) {
      notify("Selected role does not exist in the role table.");
      return false;
    }
    if (id === currentUserProfile?.id && (!nextActive || !hasFullAccessRole(nextRole))) {
      notify("You cannot remove admin access or disable your own signed-in account.");
      return false;
    }
    if (hasFullAccessRole(targetUser.role) && (!nextActive || !hasFullAccessRole(nextRole))) {
      const otherActiveAdmins = (data.users || []).filter((user) => user.id !== id && user.active !== false && hasFullAccessRole(user.role));
      if (!otherActiveAdmins.length) {
        notify("At least one active admin user is required.");
        return false;
      }
    }

    try {
      const result = await supabase
        .from("users")
        .update({ full_name, role: nextRole, department_name, active: nextActive })
        .eq("id", id);
      ensureSupabaseSuccess(result, "User update failed");
      await logActivity("UPDATE_USER", "users", `Updated user ${targetUser.email || targetUser.full_name || id}`, { entityId: id });
      await refreshData();
      notify("User updated");
      return true;
    } catch (error) {
      notify(`User update failed: ${error.message}`);
      return false;
    }
  }

  async function deleteUser(id) {
    if (!rolePermissions.users.delete) {
      notify("You do not have permission to delete users.");
      return false;
    }
    const targetUser = (data.users || []).find((user) => user.id === id);
    if (!targetUser) {
      notify("User not found.");
      return false;
    }
    if (id === currentUserProfile?.id) {
      notify("You cannot delete your own signed-in account.");
      return false;
    }
    if (hasFullAccessRole(targetUser.role)) {
      const otherActiveAdmins = (data.users || []).filter((user) => user.id !== id && user.active !== false && hasFullAccessRole(user.role));
      if (!otherActiveAdmins.length) {
        notify("At least one active admin user is required.");
        return false;
      }
    }
    const label = targetUser.email || targetUser.full_name || id;
    if (!window.confirm(`Delete user "${label}"? This removes the app profile and permission overrides.`)) {
      return false;
    }

    try {
      const result = await supabase.rpc("admin_delete_user", { target_user_id: id });
      ensureSupabaseSuccess(result, "User delete failed");
      await logActivity("DELETE_USER", "users", `Deleted user ${label}`, { entityId: id });
      await refreshData();
      notify("User deleted from app users and Supabase Auth.");
      return true;
    } catch (error) {
      notify(`User delete failed: ${error.message}`);
      return false;
    }
  }

  async function resetUserPassword(id, form = {}) {
    if (!hasFullAccessRole(currentRole)) {
      notify("Only admin can reset passwords.");
      return false;
    }
    const targetUser = (data.users || []).find((user) => user.id === id);
    const email = String(targetUser?.email || "").trim().toLowerCase();
    if (!targetUser || !email) {
      notify("User email not found.");
      return false;
    }
    const newPassword = String(form?.newPassword || "");
    const confirmPassword = String(form?.confirmPassword || "");
    if (newPassword.length < 6) {
      notify("Password must be at least 6 characters.");
      return false;
    }
    if (newPassword !== confirmPassword) {
      notify("New password and confirm password do not match.");
      return false;
    }

    try {
      const result = await supabase.rpc("admin_reset_user_password", {
        target_user_id: id,
        new_password: newPassword,
      });
      ensureSupabaseSuccess(result, "Password reset failed");
      await logActivity("RESET_USER_PASSWORD", "auth", `Admin reset password for ${email}`, { entityId: id });
      notify("Password updated.");
      return true;
    } catch (error) {
      notify(`Password reset failed: ${error.message}`);
      return false;
    }
  }

  async function toggleUserPermission(userId, module, action, value) {
    if (!hasFullAccessRole(currentRole)) {
      notify("Only admin can change user permissions.");
      return false;
    }
    if (!isValidPermissionModule(module)) {
      notify("Permission module is not valid for this app.");
      return false;
    }
    const targetUser = (data.users || []).find((user) => user.id === userId);
    if (!targetUser) {
      notify("User not found.");
      return false;
    }
    const normalizedRole = normalizeRoleName(targetUser.role);
    const existing = (data.userPermissions || []).find((row) => row.user_id === userId && row.module === module);
    const roleDefault = allPermissionsByRole[normalizedRole]?.[module] || { view: false, create: false, edit: false, delete: false };
    const patch = {
      user_id: userId,
      module,
      can_view: existing?.can_view ?? roleDefault.view,
      can_create: existing?.can_create ?? roleDefault.create,
      can_edit: existing?.can_edit ?? roleDefault.edit,
      can_delete: existing?.can_delete ?? roleDefault.delete,
      updated_at: new Date().toISOString(),
    };
    patch[`can_${action}`] = value;
    const optimisticPatch = { id: existing?.id || createId(), ...patch };

    setData((current) => ({
      ...current,
      userPermissions: existing
        ? (current.userPermissions || []).map((row) => (row.user_id === userId && row.module === module ? optimisticPatch : row))
        : [...(current.userPermissions || []), optimisticPatch],
    }));

    try {
      const result = await supabase.from("user_permissions").upsert(patch, { onConflict: "user_id,module" }).select("*").single();
      const savedPermission = ensureSupabaseSuccess(result, "User permission save failed");
      setData((current) => ({
        ...current,
        userPermissions: (current.userPermissions || []).map((row) => (row.user_id === userId && row.module === module ? savedPermission : row)),
      }));
      await logActivity("UPDATE_USER_PERMISSION", "user_permissions", `${targetUser.email || targetUser.full_name || userId} -> ${module}.${action} = ${value}`, {
        entityId: savedPermission?.id || existing?.id || null,
      });
      return true;
    } catch (error) {
      await refreshData();
      notify(`User permission save failed: ${error.message}`);
      return false;
    }
  }

  async function saveRoleAccess(role, permissionRows = [], scopeRows = []) {
    if (!hasFullAccessRole(currentRole)) {
      notify("Only admin can change access matrix.");
      return false;
    }
    const normalizedRole = normalizeRoleName(role);
    if (hasFullAccessRole(normalizedRole)) {
      notify("Admin always has full access.");
      return false;
    }

    const patches = (permissionRows || []).map((row) => ({
      role: normalizedRole,
      module: String(row.module || "").trim(),
      can_view: !!row.can_view,
      can_create: !!row.can_create,
      can_edit: !!row.can_edit,
      can_delete: !!row.can_delete,
    })).filter((row) => isValidPermissionModule(row.module));

    const cleanScopeRows = (scopeRows || []).map((row) => ({
      role: normalizedRole,
      module: String(row.module || "").trim(),
      scope_type: ["own_data", "own_department", "selected_departments"].includes(row.scope_type) ? row.scope_type : "own_department",
      department_names: row.scope_type === "selected_departments" && Array.isArray(row.department_names) ? row.department_names : [],
      updated_at: new Date().toISOString(),
    })).filter((row) => isValidPermissionModule(row.module));

    try {
      let savedPermissions = patches;
      let savedScopeRows = cleanScopeRows;
      const roleResult = await supabase.from("roles").upsert({ name: normalizedRole }, { onConflict: "name" });
      ensureSupabaseSuccess(roleResult, "Role save failed");

      const permissionDeleteResult = await supabase.from("role_permissions").delete().eq("role", normalizedRole);
      ensureSupabaseSuccess(permissionDeleteResult, "Role permission cleanup failed");
      if (patches.length) {
        const permissionSaveResult = await supabase.from("role_permissions").insert(patches).select("*");
        savedPermissions = ensureSupabaseSuccess(permissionSaveResult, "Role permission save failed") || patches;
      }

      const scopeDeleteResult = await supabase.from("role_data_scopes").delete().eq("role", normalizedRole);
      ensureSupabaseSuccess(scopeDeleteResult, "Role data scope cleanup failed");
      if (cleanScopeRows.length) {
        const result = await supabase.from("role_data_scopes").insert(cleanScopeRows).select("*");
        savedScopeRows = ensureSupabaseSuccess(result, "Role data scope save failed") || cleanScopeRows;
      }
      setData((current) => ({
        ...current,
        roles: Array.from(new Set([...(current.roles || []).map((row) => row.name), normalizedRole])).map((name) => ({ id: name, name })),
        rolePermissions: [
          ...(current.rolePermissions || []).filter((row) => normalizeRoleName(row.role) !== normalizedRole),
          ...savedPermissions,
        ],
        roleDataScopes: [
          ...(current.roleDataScopes || []).filter((row) => normalizeRoleName(row.role) !== normalizedRole),
          ...savedScopeRows,
        ],
      }));
      await logActivity("UPDATE_ROLE_ACCESS", "role_permissions", `Saved permissions and scopes for ${normalizedRole}`);
      notify("Role access saved.");
      return true;
    } catch (error) {
      await refreshData();
      notify(`Role access save failed: ${error.message}`);
      return false;
    }
  }

  async function saveUserPermissionOverrides(userId, overrideRows = []) {
    if (!hasFullAccessRole(currentRole)) {
      notify("Only admin can change user permissions.");
      return false;
    }
    const targetUser = (data.users || []).find((user) => user.id === userId);
    if (!targetUser) {
      notify("User not found.");
      return false;
    }
    if (hasFullAccessRole(targetUser.role)) {
      notify("Admin users always have full access.");
      return false;
    }

    const rows = (overrideRows || []).map((row) => ({
      user_id: userId,
      module: String(row.module || "").trim(),
      can_view: typeof row.can_view === "boolean" ? row.can_view : null,
      can_create: typeof row.can_create === "boolean" ? row.can_create : null,
      can_edit: typeof row.can_edit === "boolean" ? row.can_edit : null,
      can_delete: typeof row.can_delete === "boolean" ? row.can_delete : null,
      scope_type: ["own_data", "own_department", "selected_departments"].includes(row.scope_type) ? row.scope_type : null,
      department_names: row.scope_type === "selected_departments" && Array.isArray(row.department_names) ? row.department_names : [],
      updated_at: new Date().toISOString(),
    })).filter((row) => isValidPermissionModule(row.module));

    const rowsToSave = rows.filter((row) => (
      typeof row.can_view === "boolean"
      || typeof row.can_create === "boolean"
      || typeof row.can_edit === "boolean"
      || typeof row.can_delete === "boolean"
      || !!row.scope_type
    ));
    const existingForUser = (data.userPermissions || []).filter((row) => row.user_id === userId);

    try {
      const deleteResult = await supabase.from("user_permissions").delete().eq("user_id", userId);
      ensureSupabaseSuccess(deleteResult, "User permission cleanup failed");
      let savedRows = rowsToSave;
      if (rowsToSave.length) {
        const saveResult = await supabase.from("user_permissions").upsert(rowsToSave, { onConflict: "user_id,module" }).select("*");
        savedRows = ensureSupabaseSuccess(saveResult, "User permission save failed") || rowsToSave;
      }
      setData((current) => ({
        ...current,
        userPermissions: [
          ...(current.userPermissions || []).filter((row) => row.user_id !== userId),
          ...savedRows,
        ],
      }));
      await logActivity(
        existingForUser.length || rowsToSave.length ? "UPDATE_USER_OVERRIDES" : "RESET_USER_PERMISSIONS",
        "user_permissions",
        `Saved overrides for ${targetUser.email || targetUser.full_name || userId}`,
      );
      notify("User overrides saved.");
      return true;
    } catch (error) {
      await refreshData();
      notify(`User override save failed: ${error.message}`);
      return false;
    }
  }

  async function resetUserPermissions(userId) {
    if (!hasFullAccessRole(currentRole)) {
      notify("Only admin can reset user permissions.");
      return false;
    }
    const targetUser = (data.users || []).find((user) => user.id === userId);
    if (!targetUser) {
      notify("User not found.");
      return false;
    }
    try {
      const result = await supabase.from("user_permissions").delete().eq("user_id", userId);
      ensureSupabaseSuccess(result, "User permission reset failed");
      setData((current) => ({
        ...current,
        userPermissions: (current.userPermissions || []).filter((row) => row.user_id !== userId),
      }));
      await logActivity("RESET_USER_PERMISSIONS", "user_permissions", `Reset user permissions for ${targetUser.email || targetUser.full_name || userId}`);
      notify("User permissions reset to role defaults.");
      return true;
    } catch (error) {
      notify(`User permission reset failed: ${error.message}`);
      return false;
    }
  }

  async function resetRoleUserPermissions(role) {
    if (!hasFullAccessRole(currentRole)) {
      notify("Only admin can apply role defaults.");
      return false;
    }
    const normalizedRole = normalizeRoleName(role);
    const roleUsers = (data.users || []).filter((user) => normalizeRoleName(user.role) === normalizedRole);
    const userIds = roleUsers.map((user) => user.id).filter(Boolean);
    if (!userIds.length) {
      notify("No users found for this role.");
      return false;
    }
    try {
      const result = await supabase.from("user_permissions").delete().in("user_id", userIds);
      ensureSupabaseSuccess(result, "Role user permission reset failed");
      setData((current) => ({
        ...current,
        userPermissions: (current.userPermissions || []).filter((row) => !userIds.includes(row.user_id)),
      }));
      await logActivity("APPLY_ROLE_DEFAULTS", "user_permissions", `Applied ${normalizedRole} role defaults to ${userIds.length} user(s)`);
      notify(`Role defaults applied to ${userIds.length} user(s).`);
      return true;
    } catch (error) {
      notify(`Role defaults apply failed: ${error.message}`);
      return false;
    }
  }

  async function addReport(form) {
    try {
      const result = await supabase.from("reports").insert(form).select("id").single();
      ensureSupabaseSuccess(result, "Report save failed");
      await refreshData();
      notify("Report saved");
      return true;
    } catch (error) {
      notify(`Report save failed: ${error.message}`);
      return false;
    }
  }

  async function updateActivityLoggingEnabled(enabled) {
    if (!canManageActivityLogging) {
      notify("You do not have permission to change activity history settings.");
      return false;
    }

    const nextValue = !!enabled;
    const previousValue = activityLoggingEnabled;
    const patch = {
      key: ACTIVITY_LOGGING_SETTING_KEY,
      value: nextValue,
      updated_at: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      appSettings: {
        ...(current.appSettings || {}),
        [ACTIVITY_LOGGING_SETTING_KEY]: nextValue,
      },
    }));

    try {
      const result = await supabase.from("app_settings").upsert(patch, { onConflict: "key" });
      ensureSupabaseSuccess(result, "Activity setting save failed");
      if (previousValue) {
        await logActivity(
          nextValue ? "ENABLE_ACTIVITY_HISTORY" : "DISABLE_ACTIVITY_HISTORY",
          "app_settings",
          nextValue ? "Enabled activity history storage" : "Disabled activity history storage",
          { entityId: null },
        );
      }
      notify(nextValue ? "Activity history storage enabled." : "Activity history storage disabled.");
      return true;
    } catch (error) {
      await refreshData();
      notify(`Activity setting save failed: ${error.message}`);
      return false;
    }
  }

  function openClientProfile(clientId) {
    setActiveClientProfileId(clientId);
    setClientProfileMode("view");
    setActiveView("clients-profile");
  }

  function openClientEditor(clientId) {
    setActiveClientProfileId(clientId);
    setClientProfileMode("edit");
    setActiveView("clients-profile");
  }

  function issueLetterForClient(clientId) {
    const selectedClient = data.clients.find((client) => client.id === (clientId || ""));
    setIssueDraft((current) =>
      createIssueDraft(data, {
        ...current,
        clientId: clientId || "",
        ...buildIssueDraftPatchFromClient(selectedClient),
      }),
    );
    setActiveView("issue");
  }

  function exportLetterPdfFromClientProfile(letterId) {
    openLetter(letterId, { shouldPrint: true });
  }

  async function toggleRolePermission(role, module, action, value) {
    if (!hasFullAccessRole(currentRole)) {
      notify("Only admin can change access matrix.");
      return;
    }
    if (!isValidPermissionModule(module)) {
      notify("Permission module is not valid for this app.");
      return;
    }
    const normalizedRole = normalizeRoleName(role);
    const existing = (data.rolePermissions || []).find((row) => normalizeRoleName(row.role) === normalizedRole && row.module === module);
    const patch = {
      role: normalizedRole,
      module,
      can_view: existing?.can_view ?? false,
      can_create: existing?.can_create ?? false,
      can_edit: existing?.can_edit ?? false,
      can_delete: existing?.can_delete ?? false,
    };
    patch[`can_${action}`] = value;
    const optimisticPatch = { id: existing?.id || createId(), ...patch };
    const nextPermissions = existing
      ? (data.rolePermissions || []).map((row) => (normalizeRoleName(row.role) === normalizedRole && row.module === module ? optimisticPatch : row))
      : [...(data.rolePermissions || []), optimisticPatch];
    setData((current) => ({ ...current, rolePermissions: nextPermissions }));
    try {
      const result = await supabase.from("role_permissions").upsert(patch, { onConflict: "role,module" }).select("*").single();
      const savedPermission = ensureSupabaseSuccess(result, "Role permission save failed");
      setData((current) => ({
        ...current,
        rolePermissions: (current.rolePermissions || []).map((row) => (
          normalizeRoleName(row.role) === normalizedRole && row.module === module ? savedPermission : row
        )),
      }));
      await logActivity("UPDATE_ROLE_PERMISSION", "role_permissions", `${normalizedRole} -> ${module}.${action} = ${value}`, {
        entityId: savedPermission?.id || existing?.id || null,
      });
    } catch (error) {
      await refreshData();
      notify(`Role permission save failed: ${error.message}`);
    }
  }

  async function addRole(name) {
    const roleName = normalizeRoleName(String(name || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"));
    if (!roleName) {
      notify("Role name is required.");
      return false;
    }
    if (roleName.replace(/_/g, "") === "superadmin") {
      notify("Use admin for full access.");
      return false;
    }
    if (roleTableRoles.includes(roleName)) {
      notify("Role already exists.");
      return false;
    }
    try {
      const result = await supabase.from("roles").insert({ name: roleName });
      ensureSupabaseSuccess(result, "Role create failed");
      await refreshData();
      await logActivity("CREATE_ROLE", "roles", `Created role ${roleName}`);
      notify("Role created");
      return true;
    } catch (error) {
      notify(`Role create failed: ${error.message}`);
      return false;
    }
  }

  async function deleteRole(name) {
    const roleName = normalizeRoleName(name);
    if (!roleName || hasFullAccessRole(roleName)) {
      notify("This role cannot be deleted.");
      return false;
    }
    if (!window.confirm(`Delete role "${roleName}"?`)) {
      return false;
    }
    const assignedUsers = (data.users || []).filter((user) => normalizeRoleName(user.role) === roleName);
    if (assignedUsers.length) {
      notify(`Cannot delete role "${roleName}" because ${assignedUsers.length} user(s) are using it.`);
      return false;
    }
    try {
      const permissionResult = await supabase.from("role_permissions").delete().eq("role", roleName);
      ensureSupabaseSuccess(permissionResult, "Role permission delete failed");
      const scopeResult = await supabase.from("role_data_scopes").delete().eq("role", roleName);
      ensureSupabaseSuccess(scopeResult, "Role scope delete failed");
      const roleResult = await supabase.from("roles").delete().eq("name", roleName);
      ensureSupabaseSuccess(roleResult, "Role delete failed");
      await refreshData();
      await logActivity("DELETE_ROLE", "roles", `Deleted role ${roleName}`);
      notify("Role deleted");
      return true;
    } catch (error) {
      notify(`Role delete failed: ${error.message}`);
      return false;
    }
  }

  async function addPermissionModule(name) {
    const moduleName = String(name || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!moduleName) {
      notify("Module name is required.");
      return false;
    }
    if (!isValidPermissionModule(moduleName)) {
      notify("Only current app modules can be added to permissions.");
      return false;
    }
    if (dynamicPermissionModules.includes(moduleName)) {
      notify("Module already exists.");
      return false;
    }
    try {
      const result = await supabase.from("permission_modules").insert({ name: moduleName });
      ensureSupabaseSuccess(result, "Permission module create failed");
      await refreshData();
      notify("Permission module created");
      return true;
    } catch (error) {
      notify(`Permission module create failed: ${error.message}`);
      return false;
    }
  }

  async function deletePermissionModule(name) {
    const moduleName = String(name || "").trim();
    if (!moduleName) {
      return false;
    }
    if (!isValidPermissionModule(moduleName)) {
      notify("Only current app modules can be removed from permissions.");
      return false;
    }
    if (!window.confirm(`Delete module "${moduleName}" from access matrix?`)) {
      return false;
    }
    try {
      const permRes = await supabase.from("role_permissions").delete().eq("module", moduleName);
      ensureSupabaseSuccess(permRes, "Module permission delete failed");
      const moduleRes = await supabase.from("permission_modules").delete().eq("name", moduleName);
      ensureSupabaseSuccess(moduleRes, "Module delete failed");
      await refreshData();
      notify("Permission module deleted");
      return true;
    } catch (error) {
      notify(`Permission module delete failed: ${error.message}`);
      return false;
    }
  }

  function openLetter(letterId, options = {}) {
    const { shouldPrint = false, editMode = false } = options;
    const letter = data.letters.find((item) => item.id === letterId);
    if (!letter) {
      return;
    }
    const linkedClient = findLinkedClient(data.clients, letter);

    setIssueDraft(
      createIssueDraft(data, {
        companyId: letter.companyId,
        departmentId: letter.departmentId,
        templateId: letter.templateId,
        clientId: linkedClient?.id || letter.clientId || "",
        issueDate: letter.issueDate,
        subject: letter.subject,
        recipientName: letter.recipientName,
        recipientCompany: letter.recipientCompany,
        recipientDepartment: letter.recipientDepartment,
        preparedBy: letter.preparedBy,
        approvedBy: letter.approvedBy,
        bodyNotes: letter.bodyNotes,
        remarks: letter.remarks,
        employeeEmpId: letter.templateSnapshot?.employeeData?.empId || "",
        employeeFullName: letter.templateSnapshot?.employeeData?.fullName || "",
        employeeCnic: letter.templateSnapshot?.employeeData?.cnic || "",
        employeeDesignation: letter.templateSnapshot?.employeeData?.designation || "",
        employeeDepartmentName: letter.templateSnapshot?.employeeData?.departmentName || "",
        employeePersonalPhone: letter.templateSnapshot?.employeeData?.personalPhone || "",
        employeeCompanyEmail: letter.templateSnapshot?.employeeData?.companyEmail || "",
        employeeAddress: letter.templateSnapshot?.employeeData?.address || "",
        employeeJoiningDate: letter.templateSnapshot?.employeeData?.joiningDate || "",
        employeeReportingManager: letter.templateSnapshot?.employeeData?.reportingManager || "",
        customFields: letter.customFieldValues || letter.templateSnapshot?.customFieldValues || {},
        letterNoManual: editMode ? letter.letterNoManual || letter.letterNo || "" : letter.letterNoManual || "",
        letterNoFormatOverride: letter.letterNoFormatOverride || "",
        sequenceOverride: "",
      }),
    );
    setPreviewLetterId(letterId);
    setEditingLetterId(editMode ? letterId : "");
    setActiveView("issue");
    if (shouldPrint) {
      setPendingPrint(true);
    }
  }

  function cancelEditLetter() {
    setEditingLetterId("");
    setPreviewLetterId(null);
    setIssueDraft(createIssueDraft(data));
  }

  function exportRegister() {
    if (!canExportRegister) {
      notify("You do not have permission to export the register.");
      return;
    }

    const csv = buildRegisterExportCsv(scopedData.register);
    if (!csv) {
      notify("No letters available for export yet.");
      return;
    }

    downloadTextFile(`letter-register-${getTodayIso()}.csv`, csv, "text/csv;charset=utf-8;");
    notify("Register CSV exported.");
  }

  function exportClients(options = {}) {
    if (!canExportClients) {
      notify("You do not have permission to export clients.");
      return;
    }

    if (options.scope === "company" && !options.companyId) {
      notify("Select a company before exporting.");
      return;
    }

    const file = buildClientExcelExport(data, {
      scope: options.scope || "all",
      companyId: options.companyId || "",
      departmentId: options.departmentId || "ALL",
    });
    if (!file) {
      notify("No clients available for this export.");
      return;
    }

    downloadTextFile(file.fileName, file.content, "application/vnd.ms-excel;charset=utf-8;");
    notify("Clients Excel file exported.");
  }

  function exportBackup() {
    if (!canExportBackup) {
      notify("You do not have permission to export backups.");
      return;
    }

    downloadTextFile(
      `letterhead-backup-${getTodayIso()}.json`,
      JSON.stringify(data, null, 2),
      "application/json;charset=utf-8;",
    );
    notify("Backup JSON exported.");
  }

  function renderActiveView() {
    switch (activeView) {
      case "dashboard":
        return <DashboardView metrics={metrics} recentLetters={recentLetters} />;
      case "companies":
        return (
          <CompaniesView
            companies={data.companies}
            onAddCompany={addCompany}
            onUpdateCompany={updateCompany}
            onDeleteCompany={deleteCompany}
            onBulkDeleteCompanies={bulkDeleteCompanies}
          />
        );
      case "departments":
        return (
          <DepartmentsView
            companies={data.companies}
            departments={scopedData.departments}
            onAddDepartment={addDepartment}
            onUpdateDepartment={updateDepartment}
            onDeleteDepartment={deleteDepartment}
            onBulkDeleteDepartments={bulkDeleteDepartments}
          />
        );
      case "templates":
        return (
          <TemplatesView
            companies={data.companies}
            departments={scopedData.templateDepartments}
            templateTypes={data.templateTypes}
            templates={scopedData.templates}
            onAddTemplate={addTemplate}
            onUpdateTemplate={updateTemplate}
            onDeleteTemplate={deleteTemplate}
            onDuplicateTemplate={duplicateTemplate}
            onBulkDeleteTemplates={bulkDeleteTemplates}
            onAddTemplateType={addTemplateType}
            onDeleteTemplateType={deleteTemplateType}
            editTemplateId={templateEditorTargetId}
            onConsumeEditTarget={() => setTemplateEditorTargetId("")}
          />
        );
      case "issue":
        return (
          <IssueLetterView
            companies={scopedData.issueCompanies}
            departments={scopedData.issueDepartments}
            templates={scopedData.issueTemplates}
            clients={data.clients}
            clientFields={data.clientFields}
            letters={data.letters}
            draft={issueDraft}
            preview={preview}
            onDraftChange={updateIssueDraft}
            onIssueLetter={issueLetter}
            onPrint={() => setPendingPrint(true)}
            onEditTemplate={() => openTemplateEditor(issueDraft.templateId)}
            isEditingLetter={Boolean(editingLetterId)}
            onCancelEditLetter={cancelEditLetter}
          />
        );
      case "register":
        return (
          <RegisterView
            rows={registerRows}
            companies={scopedData.register.companies}
            departments={scopedData.register.departments}
            filters={filters}
            onFilterChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onEditLetter={(letterId) => openLetter(letterId, { editMode: true })}
            onPrintLetter={(letterId) => openLetter(letterId, { shouldPrint: true })}
            onDeleteLetter={deleteLetter}
            onBulkDeleteLetters={bulkDeleteLetters}
          />
        );
      case "exports":
        return (
          <ExportsView
            companies={data.companies}
            departments={data.departments}
            canExportRegister={canExportRegister}
            canExportClients={canExportClients}
            canExportBackup={canExportBackup}
            onExportRegister={exportRegister}
            onExportClients={exportClients}
            onExportBackup={exportBackup}
          />
        );
      case "clients-create":
        return (
          <CreateClientView
            permissions={rolePermissions["clients-create"] || { view: false, create: false, edit: false, delete: false }}
            fieldManagerPermissions={hasFullAccessRole(currentRole) ? { view: true, create: true, edit: true, delete: true } : { view: false, create: false, edit: false, delete: false }}
            clientFields={data.clientFields}
            onAddClient={addClient}
            onAddClientField={addClientField}
            onUpdateClientField={updateClientField}
            onDeleteClientField={deleteClientField}
          />
        );
      case "clients-all":
        return <AllClientsView clients={data.clients} permissions={rolePermissions["clients-all"] || { view: false, create: false, edit: false, delete: false }} onDeleteClient={deleteClient} onOpenClient={openClientProfile} onEditClient={openClientEditor} />;
      case "clients-profile":
        return (
          <ClientProfileView
            client={data.clients.find((client) => client.id === activeClientProfileId) || null}
            letters={data.letters}
            users={data.users}
            clientFields={data.clientFields}
            isEditing={clientProfileMode === "edit"}
            onSaveClient={async (patch) => {
              const ok = await updateClient(activeClientProfileId, patch);
              if (ok) {
                setClientProfileMode("view");
              }
              return ok;
            }}
            onIssueLetterForClient={issueLetterForClient}
            onExportLetterPdf={exportLetterPdfFromClientProfile}
          />
        );
      case "users":
        return (
          <UsersView
            users={data.users}
            roles={roleTableRoles}
            departments={data.departments}
            permissions={rolePermissions.users || { view: false, create: false, edit: false, delete: false }}
            canResetPasswords={hasFullAccessRole(currentRole)}
            onAddUser={addUser}
            onUpdateUser={updateUser}
            onToggleUserActive={toggleUserActive}
            onDeleteUser={deleteUser}
            onResetUserPassword={resetUserPassword}
          />
        );
      case "roles":
        return <RolesView users={data.users} roles={roleTableRoles} onAddRole={addRole} onDeleteRole={deleteRole} />;
      case "activity":
        return <ActivityView entries={data.activity} />;
      case "admin":
        return (
          <AdminView
            stats={{ users: data.users.length, clients: data.clients.length, activity: data.activity.length }}
            roles={roleTableRoles}
            modules={dynamicPermissionModules}
            users={data.users}
            allPermissions={allPermissionsByRole}
            roleDataScopes={data.roleDataScopes}
            userPermissions={data.userPermissions}
            departments={data.departments.map((department) => department.name).filter(Boolean)}
            activityLoggingEnabled={activityLoggingEnabled}
            canManageAccess={canManageAccess}
            canManageActivityLogging={canManageActivityLogging}
            onSaveRoleAccess={saveRoleAccess}
            onSaveUserPermissionOverrides={saveUserPermissionOverrides}
            onUpdateActivityLoggingEnabled={updateActivityLoggingEnabled}
          />
        );
      default:
        return <EmptyState />;
    }
  }

  if (isLoading) {
    return (
      <div className="shell">
        <section className="panel loading-panel">
          <div className="loading-mark" aria-hidden="true" />
          <div>
            <h3>Connecting to Supabase...</h3>
            <p className="hero-copy">Loading companies, departments, template types, templates, and letters directly from cloud DB.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <section className="panel auth-card">
          <div className="auth-card__brand">
            <span className="brand-symbol">JZ</span>
            <div>
              <p className="eyebrow">Secure Access</p>
              <h3>Login</h3>
              <p>
                Enter your credentials to continue.
              </p>
            </div>
          </div>
          <div className="auth-card__body">
            <div className="auth-card__summary">
              <strong>Letter Site Management</strong>
              <span>Cloud register, templates, CRM, users, and access control.</span>
            </div>
            <form
              className="form-grid auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                signIn();
              }}
            >
              <label>
                Email Address
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="button button-primary auth-submit" type="submit" disabled={authSubmitting}>
                {authSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="app-navbar">
        <span className="brand-symbol">JZ</span>

        <nav className="tabs navbar-tabs" aria-label="Primary">
          {navigableViews.map((view) => (
            <button
              key={view.id}
              className={`tab ${activeView === view.id ? "is-active" : ""}`}
              type="button"
              aria-current={activeView === view.id ? "page" : undefined}
              onClick={() => setActiveView(view.id)}
            >
              <span>{view.label}</span>
            </button>
          ))}
        </nav>

        <div className="navbar-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={loadLatestData}
            disabled={isRefreshingData}
          >
            {isRefreshingData ? "Loading..." : "Load Latest Data"}
          </button>

          <button className="button button-secondary" type="button" onClick={signOut}>Logout</button>
          <div className="menu-anchor">
            <button className="button button-primary" type="button" onClick={() => setProfileMenuOpen((v) => !v)}>Profile</button>
            {profileMenuOpen && (
              <div className="floating-menu profile-menu">
                <div>
                  <span className="profile-menu__label">Signed in as</span>
                  <strong>{session?.user?.email || "-"}</strong>
                </div>
                <div>
                  <span className="profile-menu__label">Role</span>
                  <strong>{currentRole}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">{renderActiveView()}</main>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
