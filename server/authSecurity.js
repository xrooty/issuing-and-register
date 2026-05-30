import { randomInt } from "node:crypto";
import { supabase } from "./supabase.js";

const EMAIL_CONFIRMATION_TTL_MINUTES = 15;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function createEmailConfirmationCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function createExpiryIso(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function getActorFromAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) {
    throw new Error("Missing access token.");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw new Error("Invalid access token.");
  }

  const actorId = data.user.id;
  const profileResult = await supabase
    .from("users")
    .select("id, role, active, email")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error) {
    throw new Error(`Actor lookup failed: ${profileResult.error.message}`);
  }

  return {
    authUser: data.user,
    profile: profileResult.data || null,
  };
}

async function sendResendEmail({ to, subject, text }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.AUTH_EMAIL_FROM;
  if (!resendApiKey || !fromEmail) {
    return {
      delivered: false,
      provider: "console",
      reason: "Missing RESEND_API_KEY or AUTH_EMAIL_FROM",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Email send failed.");
  }

  return {
    delivered: true,
    provider: "resend",
    id: payload?.id || "",
  };
}

export async function sendUserEmailConfirmationCode({ accessToken, userId, email, fullName }) {
  const actor = await getActorFromAccessToken(accessToken);
  const isAdmin = actor.profile?.active === true && actor.profile?.role === "admin";
  if (!isAdmin) {
    throw new Error("Only admin can send confirmation codes.");
  }

  const safeUserId = String(userId || "").trim();
  const safeEmail = normalizeEmail(email);
  if (!safeUserId || !safeEmail) {
    throw new Error("User id and email are required.");
  }

  const code = createEmailConfirmationCode();
  const nowIso = new Date().toISOString();
  const expiresAt = createExpiryIso(EMAIL_CONFIRMATION_TTL_MINUTES);

  const upsertResult = await supabase
    .from("user_security")
    .upsert(
      {
        user_id: safeUserId,
        email_confirmation_enabled: true,
        email_confirmation_code: code,
        email_confirmation_sent_at: nowIso,
        email_confirmation_expires_at: expiresAt,
        email_confirmed_at: null,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );

  if (upsertResult.error) {
    throw new Error(`Security record save failed: ${upsertResult.error.message}`);
  }

  const displayName = String(fullName || "").trim() || safeEmail;
  const subject = "Your account confirmation code";
  const text = [
    `Hello ${displayName},`,
    "",
    "Your one-time confirmation code is:",
    "",
    code,
    "",
    `This code expires in ${EMAIL_CONFIRMATION_TTL_MINUTES} minutes.`,
  ].join("\n");

  let delivery = null;
  try {
    delivery = await sendResendEmail({ to: safeEmail, subject, text });
  } catch (error) {
    console.warn("Email delivery failed, confirmation code preserved in database.", error);
    delivery = {
      delivered: false,
      provider: "console",
      reason: error?.message || "Email delivery failed.",
    };
  }

  if (!delivery.delivered) {
    console.info(`Confirmation code for ${safeEmail}: ${code}`);
  }

  return {
    ok: true,
    delivered: delivery.delivered,
    provider: delivery.provider,
    expiresAt,
    previewCode: delivery.delivered ? "" : code,
  };
}
