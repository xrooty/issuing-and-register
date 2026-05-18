import { createClient } from "@supabase/supabase-js";

const hrSupabaseUrl = process.env.SUPABASE_HR_URL || process.env.HR_SUPABASE_URL || "";
const hrServiceRoleKey =
  process.env.SUPABASE_HR_SERVICE_ROLE_KEY || process.env.HR_SUPABASE_SERVICE_ROLE_KEY || "";

export const isHrSupabaseConfigured = Boolean(hrSupabaseUrl && hrServiceRoleKey);

export const hrSupabase = isHrSupabaseConfigured
  ? createClient(hrSupabaseUrl, hrServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export function getHrSupabaseHost() {
  if (!hrSupabaseUrl) {
    return "";
  }

  try {
    return new URL(hrSupabaseUrl).host || "";
  } catch {
    return "";
  }
}

export function getHrKeyRole() {
  if (!hrServiceRoleKey) {
    return "";
  }

  try {
    const parts = hrServiceRoleKey.split(".");
    if (parts.length < 2) {
      return "";
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return String(payload?.role || "");
  } catch {
    return "";
  }
}
