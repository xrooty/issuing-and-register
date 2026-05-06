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
import { normalizeData } from "./data/seedData";
import { downloadTextFile } from "./utils/files";
import {
  applyReferencePattern,
  buildLetterPreviewModel,
  buildLetterValueMap,
  buildRegisterExportCsv,
  buildRegisterRows,
  createId,
  createIssueDraft,
  getTodayIso,
  normalizeReferencePattern,
  resolveReferencePattern,
} from "./utils/lettering";
import { supabase } from "./lib/supabaseClient";

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
  clientFields: [],
};

const CLIENT_DB_FIELDS = new Set([
  "client_name",
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
  { id: "f-company", field_key: "company", label: "Company", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 2, is_system: true },
  { id: "f-contact-name", field_key: "contact_name", label: "Contact Name", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 3, is_system: true },
  { id: "f-contact-name-secondary", field_key: "contact_name_secondary", label: "Contact Name Secondary", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 4, is_system: true },
  { id: "f-designation", field_key: "designation", label: "Designation", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 5, is_system: true },
  { id: "f-email", field_key: "email", label: "Email", input_type: "email", options_json: [], is_required: true, is_active: true, sort_order: 6, is_system: true },
  { id: "f-email-secondary", field_key: "email_secondary", label: "Email Secondary", input_type: "email", options_json: [], is_required: false, is_active: true, sort_order: 7, is_system: true },
  { id: "f-phone", field_key: "phone", label: "Phone", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 8, is_system: true },
  { id: "f-whatsapp", field_key: "whatsapp", label: "WhatsApp", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 9, is_system: true },
  { id: "f-city", field_key: "city", label: "City", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 10, is_system: true },
  { id: "f-state", field_key: "state", label: "State", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 11, is_system: true },
  { id: "f-country", field_key: "country", label: "Country", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 12, is_system: true },
  { id: "f-postal-code", field_key: "postal_code", label: "Postal Code", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 13, is_system: true },
  { id: "f-address", field_key: "address", label: "Address", input_type: "textarea", options_json: [], is_required: false, is_active: true, sort_order: 14, is_system: true },
  { id: "f-industry", field_key: "industry", label: "Industry", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 15, is_system: true },
  { id: "f-source", field_key: "source", label: "Source", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 16, is_system: true },
  { id: "f-priority", field_key: "priority", label: "Priority", input_type: "select", options_json: ["high", "medium", "low"], is_required: false, is_active: true, sort_order: 17, is_system: true },
  { id: "f-assigned-owner", field_key: "assigned_owner", label: "Assigned Owner", input_type: "text", options_json: [], is_required: false, is_active: true, sort_order: 18, is_system: true },
  { id: "f-tags", field_key: "tags", label: "Tags", input_type: "textarea", options_json: [], is_required: false, is_active: true, sort_order: 19, is_system: true },
  { id: "f-notes", field_key: "notes", label: "Notes", input_type: "textarea", options_json: [], is_required: false, is_active: true, sort_order: 20, is_system: true },
  { id: "f-follow-up-date", field_key: "follow_up_date", label: "Follow Up Date", input_type: "date", options_json: [], is_required: false, is_active: true, sort_order: 21, is_system: true },
  { id: "f-status", field_key: "status", label: "Status", input_type: "select", options_json: ["active", "on_hold", "closed"], is_required: false, is_active: true, sort_order: 22, is_system: true },
];

const VIEWS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "companies", label: "Companies" },
  { id: "departments", label: "Departments" },
  { id: "templates", label: "Templates" },
  { id: "issue", label: "Issue Letter" },
  { id: "register", label: "Register" },
  { id: "clients-create", label: "Create Client" },
  { id: "clients-all", label: "All Clients" },
  { id: "clients-profile", label: "Client Profile" },
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles" },
  { id: "activity", label: "Activity" },
  { id: "admin", label: "Admin" },
];

function normalizeTemplateTypeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
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
  return {
    id: row.id,
    name: row.name,
    shortCode: row.short_code,
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
    type: typeRef?.name || "",
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
  return {
    ...row,
    custom_fields_json: parsedCustom && typeof parsedCustom === "object" ? parsedCustom : {},
    display_name: row.client_name || row.contact_name || row.company || row.email || "Client",
  };
}

function mapUser(row) {
  return row;
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

function mapReport(row) {
  return row;
}

function mapRolePermission(row) {
  return row;
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

function ensureSupabaseSuccess(result, message) {
  if (result.error) {
    throw new Error(`${message}: ${result.error.message}`);
  }

  return result.data;
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
  const [companiesRes, departmentsRes, templateTypesRes, templatesRes, lettersRes, sequencesRes, clientsRes, usersRes, activityRes, reportsRes, rolePermissionsRes] = await Promise.all([
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

  const raw = {
    companies: (companiesRes.data || []).map(mapCompany),
    departments: (departmentsRes.data || []).map(mapDepartment),
    templates: (templatesRes.data || []).map(mapTemplate),
    letters: (lettersRes.data || []).map(mapLetter),
    sequences: (sequencesRes.data || []).map((item) => ({ key: item.key, current: Number(item.current || 0) })),
    clients: (clientsRes.data || []).map(mapClient),
    users: (usersRes.data || []).map(mapUser),
    activity: (activityRes.data || []).map(mapActivity),
    reports: (reportsRes.data || []).map(mapReport),
    rolePermissions: (rolePermissionsRes.data || []).map(mapRolePermission),
    clientFields,
  };

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
  return { dbPayload, customPayload };
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
  const [activeClientProfileId, setActiveClientProfileId] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const supabaseHost = useMemo(() => {
    try {
      return new URL(import.meta.env.VITE_SUPABASE_URL || "").host || "";
    } catch {
      return "";
    }
  }, []);

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

  async function logActivity(action, entity, details, options = {}) {
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

  const registerRows = buildRegisterRows(data);
  const recentLetters = registerRows.slice(0, 5);
  const preview = buildLetterPreviewModel({ data, draft: issueDraft, previewLetterId });
  const metrics = [
    { label: "Companies", value: data.companies.length },
    { label: "Departments", value: data.departments.length },
    { label: "Template Types", value: data.templateTypes.length },
    { label: "Templates", value: data.templates.length },
    { label: "Issued Letters", value: data.letters.length },
    { label: "Users", value: data.users.length },
    { label: "Clients", value: data.clients.length },
  ];
  const currentUserProfile = useMemo(() => {
    const email = String(session?.user?.email || "").toLowerCase();
    return data.users.find((user) => String(user.email || "").toLowerCase() === email) || null;
  }, [data.users, session?.user?.email]);
  const currentRole = currentUserProfile?.role || (session ? "super_admin" : "viewer");
  const rolePermissions = useMemo(() => {
    const matrix = {
      super_admin: { clients: { view: true, create: true, edit: true, delete: true }, users: { view: true, create: true, edit: true, delete: true } },
      admin: { clients: { view: true, create: true, edit: true, delete: true }, users: { view: true, create: true, edit: true, delete: false } },
      manager: { clients: { view: true, create: true, edit: true, delete: false }, users: { view: true, create: false, edit: false, delete: false } },
      editor: { clients: { view: true, create: true, edit: true, delete: false }, users: { view: false, create: false, edit: false, delete: false } },
      viewer: { clients: { view: true, create: false, edit: false, delete: false }, users: { view: false, create: false, edit: false, delete: false } },
    };
    const expanded = JSON.parse(JSON.stringify(matrix));
    (data.rolePermissions || []).forEach((row) => {
      if (!expanded[row.role]) expanded[row.role] = {};
      expanded[row.role][row.module] = {
        view: !!row.can_view,
        create: !!row.can_create,
        edit: !!row.can_edit,
        delete: !!row.can_delete,
      };
    });
    return expanded[currentRole] || expanded.viewer;
  }, [currentRole, data.rolePermissions]);
  const allPermissionsByRole = useMemo(() => {
    const roles = ["super_admin", "admin", "manager", "editor", "viewer"];
    const modules = ["clients", "users", "roles", "admin", "reports", "activity", "companies", "departments", "templates", "issue", "register"];
    const output = {};
    roles.forEach((role) => {
      output[role] = {};
      modules.forEach((module) => {
        output[role][module] = { view: role === "super_admin", create: role === "super_admin", edit: role === "super_admin", delete: role === "super_admin" };
      });
    });
    (data.rolePermissions || []).forEach((row) => {
      if (!output[row.role]) output[row.role] = {};
      output[row.role][row.module] = {
        view: !!row.can_view,
        create: !!row.can_create,
        edit: !!row.can_edit,
        delete: !!row.can_delete,
      };
    });
    return output;
  }, [data.rolePermissions]);
  const visibleViews = useMemo(() => {
    return VIEWS.filter((view) => {
      if (view.id === "users" || view.id === "roles" || view.id === "admin") {
        return rolePermissions.users.view;
      }
      if (view.id === "clients-create" || view.id === "clients-all" || view.id === "clients-profile") {
        return rolePermissions.clients.view;
      }
      if (view.id === "activity") {
        return true;
      }
      return true;
    });
  }, [rolePermissions]);
  useEffect(() => {
    if (!visibleViews.some((view) => view.id === activeView)) {
      setActiveView("dashboard");
    }
  }, [visibleViews, activeView]);

  useEffect(() => {
    if (activeView === "clients-profile" && !activeClientProfileId && data.clients.length) {
      setActiveClientProfileId(data.clients[0].id);
    }
  }, [activeView, activeClientProfileId, data.clients]);

  function notify(message) {
    setToast(message);
  }

  async function addCompany(form) {
    try {
      const result = await supabase
        .from("companies")
        .insert({
          id: createId(),
          name: String(form.name || "").trim(),
          short_code: String(form.shortCode || "").trim().toUpperCase(),
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
      const result = await supabase
        .from("companies")
        .update({
          name: String(form.name || "").trim(),
          short_code: String(form.shortCode || "").trim().toUpperCase(),
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

  async function duplicateTemplate(templateId) {
    const source = data.templates.find((template) => template.id === templateId);
    if (!source) {
      return false;
    }

    const baseName = String(source.name || "").trim() || "Template";
    const existingNames = new Set(
      data.templates.map((template) => String(template.name || "").trim().toLowerCase()).filter(Boolean),
    );
    let duplicateName = `${baseName} Copy`;
    let suffix = 2;
    while (existingNames.has(duplicateName.toLowerCase())) {
      duplicateName = `${baseName} Copy ${suffix}`;
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
      return true;
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
      const nextDraft = createIssueDraft(data, { ...current, ...patch });

      if ((patch.companyId || patch.departmentId || patch.templateId) && (!current.subject || current.subject === currentDefaultSubject)) {
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
      const templateTypeCode = normalizeTemplateTypeCode(template.type || template.name);
      const templateTypeId = data.templateTypes.find((item) => item.code === templateTypeCode)?.id || template.templateTypeId || null;

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
            template_snapshot_json: {
              id: template.id,
              name: template.name,
              type: template.type,
              refCode: template.refCode || "",
              defaultSubject: template.defaultSubject || "",
              bodyTemplate: template.bodyTemplate || "",
              letterNoPattern: template.letterNoPattern || "",
              design: template.design || {},
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
        template_snapshot_json: {
          id: template.id,
          name: template.name,
          type: template.type,
          refCode: template.refCode || "",
          defaultSubject: template.defaultSubject || "",
          bodyTemplate: template.bodyTemplate || "",
          letterNoPattern: template.letterNoPattern || "",
          design: template.design || {},
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
    if (!authEmail.trim() || !authPassword) {
      notify("Enter email and password.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
    if (error) notify(`Sign in failed: ${error.message}`);
    else {
      const matchedUser = data.users.find((user) => String(user.email || "").toLowerCase() === String(authEmail || "").trim().toLowerCase());
      await logActivity("LOGIN", "auth", "User signed in", {
        actorId: matchedUser?.id || null,
      });
      setAuthPassword("");
      setActiveView("dashboard");
      notify("Signed in");
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
    if (!rolePermissions.clients.create) {
      notify("You do not have permission to create clients.");
      return false;
    }
    try {
      const { dbPayload, customPayload } = splitClientPayloadByStorage(form);
      const payload = {
        ...dbPayload,
        custom_fields_json: customPayload,
        created_by: currentUserProfile?.id || null,
        updated_by: currentUserProfile?.id || null,
      };
      const result = await supabase.from("clients").insert(payload).select("id").single();
      ensureSupabaseSuccess(result, "Client save failed");
      await logActivity("CREATE_CLIENT", "clients", `Created client: ${form.client_name || form.company || form.email}`, {
        entityId: result.data.id,
        clientId: result.data.id,
        clientName: form.client_name || form.company || "",
      });
      await refreshData();
      notify("Client added");
      return true;
    } catch (error) {
      notify(`Client save failed: ${error.message}`);
      return false;
    }
  }

  async function deleteClient(id) {
    if (!rolePermissions.clients.delete) {
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
    if (!rolePermissions.clients.edit) {
      notify("You do not have permission to edit clients.");
      return false;
    }
    try {
      const currentClient = data.clients.find((client) => client.id === id);
      const { dbPayload, customPayload } = splitClientPayloadByStorage(patch);
      const payload = {
        ...dbPayload,
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
    if (currentRole !== "super_admin") {
      notify("Only super admin can create client fields.");
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
    if (currentRole !== "super_admin") {
      notify("Only super admin can edit client fields.");
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
      const result = await supabase
        .from("client_fields")
        .update({
          label: normalized.label,
          input_type: normalized.input_type,
          options_json: normalized.options_json,
          is_required: normalized.is_required,
          is_active: normalized.is_active,
          sort_order: normalized.sort_order,
        })
        .eq("id", fieldId);
      ensureSupabaseSuccess(result, "Client field update failed");
      await logActivity("UPDATE_CLIENT_FIELD", "client_fields", `Updated client field ${existing.field_key}`, { entityId: fieldId });
      await refreshData();
      notify("Client field updated");
      return true;
    } catch (error) {
      notify(`Client field update failed: ${error.message}`);
      return false;
    }
  }

  async function deleteClientField(fieldId) {
    if (currentRole !== "super_admin") {
      notify("Only super admin can delete client fields.");
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
      const result = await supabase.from("client_fields").delete().eq("id", fieldId);
      ensureSupabaseSuccess(result, "Client field delete failed");
      await logActivity("DELETE_CLIENT_FIELD", "client_fields", `Deleted client field ${target.field_key}`, { entityId: fieldId });
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
      const result = await supabase.from("users").insert(form).select("id").single();
      ensureSupabaseSuccess(result, "User save failed");
      await refreshData();
      notify("User added");
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

  function openClientProfile(clientId) {
    setActiveClientProfileId(clientId);
    setActiveView("clients-profile");
  }

  function issueLetterForClient(clientId) {
    setIssueDraft((current) => ({ ...current, clientId: clientId || "" }));
    setActiveView("issue");
  }

  function exportLetterPdfFromClientProfile(letterId) {
    openLetter(letterId, { shouldPrint: true });
  }

  async function toggleRolePermission(role, module, action, value) {
    if (currentRole !== "super_admin") {
      notify("Only super admin can change access matrix.");
      return;
    }
    const existing = (data.rolePermissions || []).find((row) => row.role === role && row.module === module);
    const patch = {
      role,
      module,
      can_view: existing?.can_view ?? false,
      can_create: existing?.can_create ?? false,
      can_edit: existing?.can_edit ?? false,
      can_delete: existing?.can_delete ?? false,
    };
    patch[`can_${action}`] = value;
    if (existing?.id) patch.id = existing.id;
    const result = await supabase.from("role_permissions").upsert(patch, { onConflict: "role,module" });
    ensureSupabaseSuccess(result, "Permission update failed");
    await logActivity("UPDATE_ROLE_PERMISSION", "role_permissions", `${role} -> ${module}.${action} = ${value}`, {
      entityId: existing?.id || null,
    });
    await refreshData();
  }

  function openLetter(letterId, options = {}) {
    const { shouldPrint = false, editMode = false } = options;
    const letter = data.letters.find((item) => item.id === letterId);
    if (!letter) {
      return;
    }

    setIssueDraft(
      createIssueDraft(data, {
        companyId: letter.companyId,
        departmentId: letter.departmentId,
        templateId: letter.templateId,
        clientId: letter.clientId || "",
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
    const csv = buildRegisterExportCsv(data);
    if (!csv) {
      notify("No letters available for export yet.");
      return;
    }

    downloadTextFile(`letter-register-${getTodayIso()}.csv`, csv, "text/csv;charset=utf-8;");
    notify("Register CSV exported.");
  }

  function exportBackup() {
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
            departments={data.departments}
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
            departments={data.departments}
            templates={data.templates}
            onAddTemplate={addTemplate}
            onUpdateTemplate={updateTemplate}
            onDeleteTemplate={deleteTemplate}
            onDuplicateTemplate={duplicateTemplate}
            onBulkDeleteTemplates={bulkDeleteTemplates}
            editTemplateId={templateEditorTargetId}
            onConsumeEditTarget={() => setTemplateEditorTargetId("")}
          />
        );
      case "issue":
        return (
          <IssueLetterView
            companies={data.companies}
            departments={data.departments}
            templates={data.templates}
            clients={data.clients}
            draft={issueDraft}
            preview={preview}
            onDraftChange={updateIssueDraft}
            onIssueLetter={issueLetter}
            onPrint={() => setPendingPrint(true)}
            onEditTemplate={() => openTemplateEditor(issueDraft.templateId)}
            onSearchEmployees={searchEmployeesFromHr}
            isEditingLetter={Boolean(editingLetterId)}
            onCancelEditLetter={cancelEditLetter}
          />
        );
      case "register":
        return (
          <RegisterView
            rows={registerRows}
            companies={data.companies}
            departments={data.departments}
            filters={filters}
            onFilterChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onEditLetter={(letterId) => openLetter(letterId, { editMode: true })}
            onPrintLetter={(letterId) => openLetter(letterId, { shouldPrint: true })}
            onDeleteLetter={deleteLetter}
            onBulkDeleteLetters={bulkDeleteLetters}
          />
        );
      case "clients-create":
        return <CreateClientView permissions={rolePermissions.clients} clientFields={data.clientFields} onAddClient={addClient} />;
      case "clients-all":
        return <AllClientsView clients={data.clients} permissions={rolePermissions.clients} onDeleteClient={deleteClient} onOpenClient={openClientProfile} />;
      case "clients-profile":
        return (
          <ClientProfileView
            client={data.clients.find((client) => client.id === activeClientProfileId) || null}
            letters={data.letters}
            users={data.users}
            clientFields={data.clientFields}
            onIssueLetterForClient={issueLetterForClient}
            onExportLetterPdf={exportLetterPdfFromClientProfile}
          />
        );
      case "users":
        return <UsersView users={data.users} permissions={rolePermissions.users} onAddUser={addUser} onToggleUserActive={toggleUserActive} />;
      case "roles":
        return <RolesView users={data.users} />;
      case "activity":
        return <ActivityView entries={data.activity} />;
      case "admin":
        return (
          <AdminView
            stats={{ users: data.users.length, clients: data.clients.length, reports: data.reports.length, activity: data.activity.length }}
            allPermissions={allPermissionsByRole}
            currentRole={currentRole}
            clientFields={data.clientFields}
            onTogglePermission={toggleRolePermission}
            onAddClientField={addClientField}
            onUpdateClientField={updateClientField}
            onDeleteClientField={deleteClientField}
          />
        );
      default:
        return <EmptyState />;
    }
  }

  if (isLoading) {
    return (
      <div className="shell">
        <section className="panel">
          <h3>Connecting to Supabase...</h3>
          <p className="hero-copy">Loading companies, departments, template types, templates, and letters directly from cloud DB.</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="shell"
        style={{
          position: "fixed",
          inset: 0,
          padding: 16,
          boxSizing: "border-box",
          display: "grid",
          placeItems: "center",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        <section
          className="panel"
          style={{
            width: "100%",
            maxWidth: 520,
            maxHeight: "100%",
            padding: 0,
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1fr",
            border: "1px solid rgba(148,163,184,0.25)",
            boxShadow: "0 22px 55px rgba(0,0,0,0.42)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ padding: 28, display: "grid", alignContent: "center", gap: 16 }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Secure Access</p>
              <h3 style={{ margin: 0, fontSize: 30 }}>Login</h3>
              <p style={{ marginTop: 8, color: "var(--app-ink-muted)", fontSize: 13 }}>
                Enter your credentials to continue.
              </p>
            </div>
            <div className="form-grid" style={{ gap: 14, display: "flex", flexDirection: "column" }}>
              <label>
                Email Address
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="username"
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
                />
              </label>
              <button className="button button-primary" type="button" onClick={signIn} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
                Sign In
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Letter Site Management</p>
          <h1>Letter management, issuing, and register</h1>
          <p className="hero-copy">
            Manage companies, departments, templates, issue letters, and keep the register clean from one simple dashboard.
          </p>
        </div>
        <div className="hero-actions" style={{ position: "relative" }}>
          <button className="button button-secondary" type="button" onClick={exportRegister}>Export Register CSV</button>
          <button className="button button-secondary" type="button" onClick={exportBackup}>Backup JSON</button>
          <button
            className="button button-secondary"
            type="button"
            onClick={async () => {
              try {
                await refreshData();
                notify("Data refreshed from DB");
              } catch (error) {
                notify(`Refresh failed: ${error.message}`);
              }
            }}
          >
            Refresh DB
          </button>
          <button className="button button-secondary" type="button" onClick={signOut}>Logout</button>
          <button className="button button-primary" type="button" onClick={() => setProfileMenuOpen((v) => !v)}>Profile</button>
          {profileMenuOpen && (
            <div style={{ position: "absolute", top: 48, right: 0, minWidth: 250, background: "var(--app-surface)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 10, display: "grid", gap: 8, zIndex: 50 }}>
              <div style={{ padding: "4px 6px" }}>
                <div style={{ fontSize: 12, color: "var(--app-ink-faint)" }}>{session?.user?.email || "-"}</div>
                <div style={{ fontSize: 12, color: "var(--app-ink-muted)" }}>Role: {currentRole}</div>
              </div>
            </div>
          )}
        </div>
      </header>

      <section className="status-bar">
        <div>
          <strong>Mode:</strong> <span>Supabase cloud data mode.</span>
          {supabaseHost ? <span> Host: <code>{supabaseHost}</code></span> : null}
        </div>
        <div>All changes sync to DB</div>
      </section>

      <nav className="tabs" aria-label="Primary">
        {visibleViews.map((view) => (
          <button
            key={view.id}
            className={`tab ${activeView === view.id ? "is-active" : ""}`}
            type="button"
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      <main>{renderActiveView()}</main>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
