import { randomUUID } from "node:crypto";
import {
  applyReferencePattern,
  createLetterPayload,
  deriveTemplateCode,
  getSequenceKey,
  normalizeReferencePattern,
  resolveReferencePattern,
} from "./reference.js";
import { supabase } from "./supabase.js";

function toErrorMessage(prefix, error) {
  const message = error?.message || "Unknown database error";
  return `${prefix}: ${message}`;
}

function throwIfError(prefix, error) {
  if (error) {
    throw new Error(toErrorMessage(prefix, error));
  }
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

function normalizeTemplateTypeName(value) {
  return String(value || "").trim();
}

function normalizeTemplateTypeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function toTemplateTypeRef(row) {
  if (!row) {
    return null;
  }

  if (Array.isArray(row)) {
    return row[0] || null;
  }

  return row;
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
  const typeRef = toTemplateTypeRef(row.template_types);

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
    templateSnapshot: parseJson(row.template_snapshot_json, null),
    createdAt: row.created_at,
  };
}

async function ensureTemplateType(nameOrCode) {
  const rawName = normalizeTemplateTypeName(nameOrCode);
  if (!rawName) {
    return null;
  }

  const code = normalizeTemplateTypeCode(rawName);
  if (!code) {
    return null;
  }

  const existing = await supabase
    .from("template_types")
    .select("id, code, name")
    .eq("code", code)
    .maybeSingle();

  throwIfError("Template type lookup failed", existing.error);

  if (existing.data) {
    return mapTemplateType(existing.data);
  }

  const inserted = await supabase
    .from("template_types")
    .insert({
      id: randomUUID(),
      code,
      name: rawName,
    })
    .select("id, code, name")
    .single();

  throwIfError("Template type insert failed", inserted.error);
  return mapTemplateType(inserted.data);
}

async function listCompanies() {
  const result = await supabase.from("companies").select("*").order("name", { ascending: true });
  throwIfError("Company list fetch failed", result.error);
  return (result.data || []).map(mapCompany);
}

async function listDepartments() {
  const result = await supabase.from("departments").select("*").order("name", { ascending: true });
  throwIfError("Department list fetch failed", result.error);
  return (result.data || []).map(mapDepartment);
}

async function listTemplateTypes() {
  const result = await supabase.from("template_types").select("*").order("name", { ascending: true });
  throwIfError("Template type list fetch failed", result.error);
  return (result.data || []).map(mapTemplateType);
}

async function listTemplates() {
  const result = await supabase
    .from("templates")
    .select(
      "id, company_id, department_id, template_type_id, name, ref_code, default_subject, body_template, letter_no_pattern, design_json, template_types(id, code, name)",
    )
    .order("created_at", { ascending: false });

  throwIfError("Template list fetch failed", result.error);
  return (result.data || []).map(mapTemplate);
}

async function listLetters() {
  const result = await supabase.from("letters").select("*").order("created_at", { ascending: false });
  throwIfError("Letter list fetch failed", result.error);
  return (result.data || []).map(mapLetter);
}

async function listSequences() {
  const result = await supabase.from("sequence_counters").select("key, current");
  throwIfError("Sequence list fetch failed", result.error);
  return (result.data || []).map((row) => ({ key: row.key, current: Number(row.current || 0) }));
}

async function getCompanyById(id) {
  const result = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  throwIfError("Company fetch failed", result.error);
  return result.data ? mapCompany(result.data) : null;
}

async function getDepartmentById(id) {
  const result = await supabase.from("departments").select("*").eq("id", id).maybeSingle();
  throwIfError("Department fetch failed", result.error);
  return result.data ? mapDepartment(result.data) : null;
}

async function getTemplateById(id) {
  const result = await supabase
    .from("templates")
    .select(
      "id, company_id, department_id, template_type_id, name, ref_code, default_subject, body_template, letter_no_pattern, design_json, template_types(id, code, name)",
    )
    .eq("id", id)
    .maybeSingle();

  throwIfError("Template fetch failed", result.error);
  return result.data ? mapTemplate(result.data) : null;
}

async function nextSequence(counterKey) {
  const result = await supabase.rpc("next_sequence", { counter_key: counterKey });
  throwIfError("Sequence increment failed", result.error);
  return Number(result.data || 1);
}

async function ensureDepartmentSequenceSeed(company, department) {
  const departmentKey = getSequenceKey({ company, department });
  const currentCounterRes = await supabase.from("sequence_counters").select("current").eq("key", departmentKey).maybeSingle();
  throwIfError("Department sequence lookup failed", currentCounterRes.error);

  if (currentCounterRes.data) {
    return departmentKey;
  }

  const legacyPrefix = `${company.id}:${department.id}:`;
  const legacyRes = await supabase.from("sequence_counters").select("current").like("key", `${legacyPrefix}%`);
  throwIfError("Legacy sequence lookup failed", legacyRes.error);

  const seedValue = Math.max(
    0,
    ...(legacyRes.data || []).map((row) => Number(row.current || 0)).filter((value) => Number.isFinite(value) && value > 0),
  );

  if (seedValue > 0) {
    const seedRes = await supabase
      .from("sequence_counters")
      .upsert({ key: departmentKey, current: seedValue }, { onConflict: "key" });
    throwIfError("Department sequence seed failed", seedRes.error);
  }

  return departmentKey;
}

async function insertLetter(letter) {
  const row = {
    id: letter.id,
    company_id: letter.companyId,
    department_id: letter.departmentId,
    template_id: letter.templateId,
    template_type_id: letter.templateTypeId,
    letter_no: letter.letterNo,
    letter_no_manual: letter.letterNoManual,
    letter_no_format_override: letter.letterNoFormatOverride,
    letter_no_pattern_used: letter.letterNoPatternUsed,
    issue_date: letter.issueDate || null,
    recipient_name: letter.recipientName,
    recipient_company: letter.recipientCompany,
    recipient_department: letter.recipientDepartment,
    subject: letter.subject,
    body_notes: letter.bodyNotes,
    prepared_by: letter.preparedBy,
    approved_by: letter.approvedBy,
    remarks: letter.remarks,
    rendered_body: letter.renderedBody,
    pdf_file_name: letter.pdfFileName,
    pdf_storage_path: letter.pdfStoragePath,
    template_snapshot_json: letter.templateSnapshot,
    created_at: letter.createdAt,
  };

  const result = await supabase.from("letters").insert(row);
  throwIfError("Letter insert failed", result.error);
}

export async function createCompany(input) {
  const payload = {
    id: randomUUID(),
    name: String(input.name || "").trim(),
    short_code: String(input.shortCode || "").trim().toUpperCase(),
    address: String(input.address || "").trim(),
    phone: String(input.phone || "").trim(),
    email: String(input.email || "").trim(),
    footer_text: String(input.footerText || "").trim(),
    letter_no_pattern: normalizeReferencePattern(input.letterNoPattern),
  };

  if (!payload.name || !payload.short_code) {
    throw new Error("Company name and short code are required");
  }

  const result = await supabase.from("companies").insert(payload).select("*").single();
  throwIfError("Company insert failed", result.error);
  return mapCompany(result.data);
}

export async function createDepartment(input) {
  const payload = {
    id: randomUUID(),
    company_id: String(input.companyId || "").trim(),
    name: String(input.name || "").trim(),
    code: String(input.code || "").trim().toUpperCase(),
    letter_no_pattern: normalizeReferencePattern(input.letterNoPattern),
  };

  if (!payload.company_id || !payload.name || !payload.code) {
    throw new Error("Department company, name, and code are required");
  }

  const result = await supabase.from("departments").insert(payload).select("*").single();
  throwIfError("Department insert failed", result.error);
  return mapDepartment(result.data);
}

export async function createTemplate(input) {
  const templateType = await ensureTemplateType(input.type);
  if (!templateType) {
    throw new Error("Template type is required");
  }

  const payload = {
    id: randomUUID(),
    company_id: String(input.companyId || "").trim(),
    department_id: String(input.departmentId || "").trim(),
    template_type_id: templateType.id,
    name: String(input.name || "").trim(),
    ref_code: String(input.refCode || "").trim().toUpperCase(),
    default_subject: String(input.defaultSubject || "").trim(),
    body_template: String(input.bodyTemplate || ""),
    letter_no_pattern: normalizeReferencePattern(input.letterNoPattern),
    design_json: input.design || {},
  };

  if (!payload.company_id || !payload.department_id || !payload.name) {
    throw new Error("Template company, department, and name are required");
  }

  const result = await supabase
    .from("templates")
    .insert(payload)
    .select(
      "id, company_id, department_id, template_type_id, name, ref_code, default_subject, body_template, letter_no_pattern, design_json, template_types(id, code, name)",
    )
    .single();
  throwIfError("Template insert failed", result.error);
  return mapTemplate(result.data);
}

export async function updateTemplate(templateId, input) {
  const existing = await getTemplateById(templateId);
  if (!existing) {
    throw new Error("Template not found");
  }

  const templateType = await ensureTemplateType(input.type || existing.type);
  if (!templateType) {
    throw new Error("Template type is required");
  }

  const payload = {
    company_id: String(input.companyId || existing.companyId).trim(),
    department_id: String(input.departmentId || existing.departmentId).trim(),
    template_type_id: templateType.id,
    name: String(input.name || existing.name).trim(),
    ref_code: String(input.refCode ?? existing.refCode ?? "").trim().toUpperCase(),
    default_subject: String(input.defaultSubject ?? existing.defaultSubject ?? "").trim(),
    body_template: String(input.bodyTemplate ?? existing.bodyTemplate ?? ""),
    letter_no_pattern: normalizeReferencePattern(input.letterNoPattern ?? existing.letterNoPattern),
    design_json: input.design ?? existing.design ?? {},
  };

  const result = await supabase.from("templates").update(payload).eq("id", templateId);
  throwIfError("Template update failed", result.error);
}

export async function deleteTemplate(templateId) {
  const result = await supabase.from("templates").delete().eq("id", templateId);
  throwIfError("Template delete failed", result.error);
}

export async function issueLetter(draftInput) {
  const draft = {
    companyId: String(draftInput.companyId || "").trim(),
    departmentId: String(draftInput.departmentId || "").trim(),
    templateId: String(draftInput.templateId || "").trim(),
    issueDate: String(draftInput.issueDate || "").trim(),
    subject: String(draftInput.subject || "").trim(),
    recipientName: String(draftInput.recipientName || "").trim(),
    recipientCompany: String(draftInput.recipientCompany || "").trim(),
    recipientDepartment: String(draftInput.recipientDepartment || "").trim(),
    preparedBy: String(draftInput.preparedBy || "").trim(),
    approvedBy: String(draftInput.approvedBy || "").trim(),
    bodyNotes: String(draftInput.bodyNotes || ""),
    remarks: String(draftInput.remarks || ""),
    letterNoManual: String(draftInput.letterNoManual || "").trim(),
    letterNoFormatOverride: normalizeReferencePattern(draftInput.letterNoFormatOverride),
  };

  const [company, department, template] = await Promise.all([
    getCompanyById(draft.companyId),
    getDepartmentById(draft.departmentId),
    getTemplateById(draft.templateId),
  ]);

  if (!company || !department || !template) {
    throw new Error("Company, department, and template are required");
  }

  const patternInUse = resolveReferencePattern({
    company,
    department,
    template,
    draftPattern: draft.letterNoFormatOverride,
  });

  const sequenceKey = await ensureDepartmentSequenceSeed(company, department);

  const sequence = await nextSequence(sequenceKey);

  const autoLetterNo = applyReferencePattern({
    pattern: patternInUse,
    company,
    department,
    template,
    issueDate: draft.issueDate,
    sequence,
  });

  const finalLetterNo = draft.letterNoManual || autoLetterNo;

  const letter = createLetterPayload({
    company,
    department,
    template: {
      ...template,
      templateTypeId: template.templateTypeId,
      refCode: template.refCode || deriveTemplateCode(template),
    },
    draft,
    letterNo: finalLetterNo,
    patternInUse,
  });

  await insertLetter(letter);
  return letter;
}

export async function getBootstrapData() {
  const [companies, departments, templateTypes, templates, letters, sequences] = await Promise.all([
    listCompanies(),
    listDepartments(),
    listTemplateTypes(),
    listTemplates(),
    listLetters(),
    listSequences(),
  ]);

  return {
    companies,
    departments,
    templateTypes,
    templates,
    letters,
    sequences,
  };
}

export async function initDatabase() {
  const probe = await supabase.from("companies").select("id", { head: true, count: "exact" });
  throwIfError("Supabase connection failed", probe.error);
}
