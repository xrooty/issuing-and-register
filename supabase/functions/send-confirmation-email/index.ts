const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type EmailType = "email_confirmation" | "2fa_reset";
type RequestBody = {
  email?: string;
  code?: string;
  type?: EmailType;
};

const DEFAULT_AUTH_EMAIL_FROM = "hello@jzarrtech.com";

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders,
  });
}

function buildEmailContent(type: EmailType, code: string) {
  if (type === "2fa_reset") {
    return {
      subject: "Your 2FA reset code",
      text: [
        "Your two-factor authentication reset code is:",
        "",
        code,
        "",
        "Use this code to complete your 2FA reset process.",
      ].join("\n"),
    };
  }

  return {
    subject: "Your email confirmation code",
    text: [
      "Your email confirmation code is:",
      "",
      code,
      "",
      "Enter this code to confirm and activate your account.",
    ].join("\n"),
  };
}

function normalizeType(value: unknown): EmailType | null {
  if (value === "email_confirmation" || value === "2fa_reset") {
    return value;
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      error: "Method not allowed. Use POST.",
    });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, {
      success: false,
      error: "Invalid JSON body.",
    });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const code = String(body?.code || "").trim();
  const type = normalizeType(body?.type);

  if (!email) {
    return jsonResponse(400, {
      success: false,
      error: "Missing email.",
    });
  }

  if (!code) {
    return jsonResponse(400, {
      success: false,
      error: "Missing code.",
    });
  }

  if (!type) {
    return jsonResponse(400, {
      success: false,
      error: 'Invalid type. Expected "email_confirmation" or "2fa_reset".',
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const authEmailFrom = Deno.env.get("AUTH_EMAIL_FROM") || DEFAULT_AUTH_EMAIL_FROM;

  if (!resendApiKey) {
    return jsonResponse(500, {
      success: false,
      error: "Missing required function secret: RESEND_API_KEY.",
    });
  }

  const emailContent = buildEmailContent(type, code);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: authEmailFrom,
      to: [email],
      subject: emailContent.subject,
      text: emailContent.text,
    }),
  });

  const resendPayload = await resendResponse.json().catch(() => null);

  if (!resendResponse.ok) {
    return jsonResponse(502, {
      success: false,
      error: "Failed to send email via Resend.",
      details: resendPayload,
    });
  }

  return jsonResponse(200, {
    success: true,
    message: "Email sent successfully.",
    data: resendPayload,
  });
});
