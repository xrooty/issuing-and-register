import { useEffect, useMemo, useState } from "react";
import EmptyState from "./components/EmptyState";
import DashboardView from "./views/DashboardView";
import CompaniesView from "./views/CompaniesView";
import DepartmentsView from "./views/DepartmentsView";
import TemplatesView from "./views/TemplatesView";
import IssueLetterView from "./views/IssueLetterView";
import RegisterView from "./views/RegisterView";
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
};

const VIEWS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "companies", label: "Companies" },
  { id: "departments", label: "Departments" },
  { id: "templates", label: "Templates" },
  { id: "issue", label: "Issue Letter" },
  { id: "register", label: "Register" },
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
    remarks: row.remarks || "",
    renderedBody: row.rendered_body || "",
    pdfFileName: row.pdf_file_name || "",
    pdfStoragePath: row.pdf_storage_path || "",
    templateSnapshot,
    customFieldValues,
    createdAt: row.created_at,
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
  const [companiesRes, departmentsRes, templateTypesRes, templatesRes, lettersRes, sequencesRes] = await Promise.all([
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
  ]);

  ensureSupabaseSuccess(companiesRes, "Company fetch failed");
  ensureSupabaseSuccess(departmentsRes, "Department fetch failed");
  ensureSupabaseSuccess(templateTypesRes, "Template types fetch failed");
  ensureSupabaseSuccess(templatesRes, "Templates fetch failed");
  ensureSupabaseSuccess(lettersRes, "Letters fetch failed");
  ensureSupabaseSuccess(sequencesRes, "Sequences fetch failed");

  const raw = {
    companies: (companiesRes.data || []).map(mapCompany),
    departments: (departmentsRes.data || []).map(mapDepartment),
    templates: (templatesRes.data || []).map(mapTemplate),
    letters: (lettersRes.data || []).map(mapLetter),
    sequences: (sequencesRes.data || []).map((item) => ({ key: item.key, current: Number(item.current || 0) })),
  };

  const normalized = normalizeData(raw);
  return {
    ...EMPTY_DATA,
    ...normalized,
    templateTypes: (templateTypesRes.data || []).map(mapTemplateType),
  };
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

  const supabaseHost = useMemo(() => {
    try {
      return new URL(import.meta.env.VITE_SUPABASE_URL || "").host || "";
    } catch {
      return "";
    }
  }, []);

  async function refreshData() {
    const next = await fetchBootstrapData();
    setData(next);
    return next;
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
  ];

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
        <div className="hero-actions">
          <button className="button button-primary" type="button" onClick={exportRegister}>
            Export Register CSV
          </button>
          <button className="button button-secondary" type="button" onClick={exportBackup}>
            Backup JSON
          </button>
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
        {VIEWS.map((view) => (
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
