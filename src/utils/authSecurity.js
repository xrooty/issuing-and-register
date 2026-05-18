const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TWO_FACTOR_GLOBAL_SETTING_KEY = "auth_2fa_enabled_global";
export const EMAIL_CONFIRMATION_GLOBAL_SETTING_KEY = "auth_email_confirmation_enabled_global";
export const EMAIL_CONFIRMATION_CODE_TTL_MINUTES = 15;

function normalizeByteArray(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  return new Uint8Array(input);
}

function utf8ToBytes(value) {
  return new TextEncoder().encode(String(value || ""));
}

export function normalizeBooleanSetting(value) {
  return value === true;
}

export function isTwoFactorGloballyEnabled(settings = {}) {
  return normalizeBooleanSetting(settings[TWO_FACTOR_GLOBAL_SETTING_KEY]);
}

export function isEmailConfirmationGloballyEnabled(settings = {}) {
  return normalizeBooleanSetting(settings[EMAIL_CONFIRMATION_GLOBAL_SETTING_KEY]);
}

export function createQrCodeUrl(content) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(String(content || ""))}`;
}

export function createEmailConfirmationCode() {
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, "0");
}

export function generateTwoFactorSecret(byteLength = 20) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return encodeBase32(bytes);
}

export function createOtpAuthUri({ issuer, email, secret }) {
  const safeIssuer = String(issuer || "Letter Site Management").trim() || "Letter Site Management";
  const safeEmail = String(email || "user").trim() || "user";
  const safeSecret = String(secret || "").trim().replace(/\s+/g, "");
  const label = `${safeIssuer}:${safeEmail}`;
  const params = new URLSearchParams({
    secret: safeSecret,
    issuer: safeIssuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function encodeBase32(input) {
  const bytes = normalizeByteArray(input);
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function decodeBase32(input) {
  const normalized = String(input || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      continue;
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

function dynamicTruncate(bytes) {
  const offset = bytes[bytes.length - 1] & 15;
  return (
    ((bytes[offset] & 127) << 24)
    | ((bytes[offset + 1] & 255) << 16)
    | ((bytes[offset + 2] & 255) << 8)
    | (bytes[offset + 3] & 255)
  );
}

async function signHmacSha1(secretBytes, counterBytes) {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, counterBytes);
  return new Uint8Array(signature);
}

function createCounterBytes(counter) {
  const bytes = new Uint8Array(8);
  let working = BigInt(counter);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(working & 255n);
    working >>= 8n;
  }
  return bytes;
}

export async function generateTotpCode(secret, timestamp = Date.now()) {
  const secretBytes = decodeBase32(secret);
  if (!secretBytes.length) {
    throw new Error("Missing 2FA secret.");
  }
  const counter = Math.floor(timestamp / 30000);
  const signature = await signHmacSha1(secretBytes, createCounterBytes(counter));
  const codeInt = dynamicTruncate(signature) % 1000000;
  return String(codeInt).padStart(6, "0");
}

export async function verifyTotpCode(secret, code, options = {}) {
  const normalizedCode = String(code || "").replace(/\D/g, "").slice(0, 6);
  if (normalizedCode.length !== 6) {
    return false;
  }

  const driftWindows = Number.isFinite(options.window) ? Math.max(0, Number(options.window)) : 1;
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();

  for (let offset = -driftWindows; offset <= driftWindows; offset += 1) {
    const candidate = await generateTotpCode(secret, now + offset * 30000);
    if (candidate === normalizedCode) {
      return true;
    }
  }

  return false;
}

export function getEffectiveTwoFactorEnabled(settings = {}, securityRow = null) {
  return isTwoFactorGloballyEnabled(settings) || securityRow?.two_factor_enabled === true;
}

export function getEffectiveEmailConfirmationEnabled(settings = {}, securityRow = null) {
  return isEmailConfirmationGloballyEnabled(settings) || securityRow?.email_confirmation_enabled === true;
}

export function isEmailConfirmationPending(settings = {}, securityRow = null) {
  return getEffectiveEmailConfirmationEnabled(settings, securityRow) && !securityRow?.email_confirmed_at;
}

export function buildEmailConfirmationMessage(code) {
  return [
    "Your confirmation code is:",
    "",
    String(code || ""),
    "",
    `This code expires in ${EMAIL_CONFIRMATION_CODE_TTL_MINUTES} minutes.`,
  ].join("\n");
}

export function normalizeChallengeCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

export function buildRecoveryKeyPreview(secret) {
  const normalized = String(secret || "").replace(/\s+/g, "");
  return normalized.replace(/(.{4})/g, "$1 ").trim();
}

export function toIsoMinutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function hashComparableCode(value) {
  return utf8ToBytes(value);
}
