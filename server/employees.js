import { hrSupabase, isHrSupabaseConfigured } from "./supabaseHr.js";

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function ensureHrConfigured() {
  if (!isHrSupabaseConfigured || !hrSupabase) {
    throw createHttpError("HR DB is not configured. Set SUPABASE_HR_URL and SUPABASE_HR_SERVICE_ROLE_KEY in .env", 503);
  }
}

function toSearchTerm(value) {
  return String(value || "")
    .trim()
    .replace(/[\r\n]+/g, " ");
}

function mapEmployee(row) {
  return {
    id: row.id,
    empId: row.emp_id || "",
    fullName: row.full_name || "",
    cnic: row.cnic || "",
    departmentName: row.department_name || "",
    designation: row.designation || "",
    personalPhone: row.personal_phone || "",
    companyEmail: row.company_email || "",
    permanentAddress: row.permanent_address || "",
    currentAddress: row.current_address || "",
    joiningDate: row.joining_date || "",
    reportingManager: row.reporting_manager || "",
    status: row.current_status || "",
  };
}

function throwSupabaseQueryError(context, queryError) {
  const message = String(queryError?.message || "Unknown HR DB error");
  const code = String(queryError?.code || "");
  const details = String(queryError?.details || "");
  const hint = String(queryError?.hint || "");
  const lowerMessage = message.toLowerCase();
  const lowerDetails = details.toLowerCase();

  if (code === "42501" || lowerMessage.includes("permission denied") || lowerDetails.includes("permission denied")) {
    throw createHttpError(
      "HR DB access denied. Use SUPABASE_HR_SERVICE_ROLE_KEY (service_role key) or update RLS policy for employees table.",
      403,
    );
  }

  if (code === "PGRST205" || lowerMessage.includes("relation") || lowerMessage.includes("does not exist")) {
    throw createHttpError("HR employees table not found. Verify the table name is public.employees in HR Supabase.", 500);
  }

  const hintText = hint ? ` Hint: ${hint}` : "";
  throw createHttpError(`Employee search failed (${context}): ${message}.${hintText}`.trim(), 500);
}

export async function searchEmployees({ query, limit = 10 }) {
  ensureHrConfigured();

  const term = toSearchTerm(query);
  if (!term) {
    return [];
  }

  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(Math.max(Number(limit), 1), 25) : 10;
  const pattern = `%${term}%`;

  const [byEmpId, byName, byCnic] = await Promise.all([
    hrSupabase.from("employees").select("*").ilike("emp_id", pattern).limit(safeLimit),
    hrSupabase.from("employees").select("*").ilike("full_name", pattern).limit(safeLimit),
    hrSupabase.from("employees").select("*").ilike("cnic", pattern).limit(safeLimit),
  ]);

  if (byEmpId.error) {
    throwSupabaseQueryError("emp_id", byEmpId.error);
  }
  if (byName.error) {
    throwSupabaseQueryError("full_name", byName.error);
  }
  if (byCnic.error) {
    throwSupabaseQueryError("cnic", byCnic.error);
  }

  const merged = new Map();
  [...(byEmpId.data || []), ...(byName.data || []), ...(byCnic.data || [])].forEach((row) => {
    if (!row?.id) {
      return;
    }
    if (!merged.has(row.id)) {
      merged.set(row.id, row);
    }
  });

  return Array.from(merged.values())
    .sort((left, right) => String(left.full_name || "").localeCompare(String(right.full_name || "")))
    .slice(0, safeLimit)
    .map(mapEmployee);
}

export async function getEmployeeByEmpId(empId) {
  ensureHrConfigured();

  const value = String(empId || "").trim();
  if (!value) {
    throw createHttpError("Employee ID is required", 400);
  }

  const result = await hrSupabase
    .from("employees")
    .select("*")
    .eq("emp_id", value)
    .maybeSingle();

  if (result.error) {
    throwSupabaseQueryError("emp_id exact", result.error);
  }

  return result.data ? mapEmployee(result.data) : null;
}
