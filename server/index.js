import http from "node:http";
import { URL } from "node:url";
import { getEmployeeByEmpId, searchEmployees } from "./employees.js";
import { getHrKeyRole, getHrSupabaseHost, isHrSupabaseConfigured } from "./supabaseHr.js";

const PORT = Number(process.env.PORT || 8787);
let dbApi = null;
let dbApiLoadError = "";
let dbApiLoaded = false;

async function ensureDbApiLoaded() {
  if (dbApiLoaded) {
    return;
  }

  dbApiLoaded = true;

  try {
    const moduleRef = await import("./db.js");
    await moduleRef.initDatabase();
    dbApi = moduleRef;
    dbApiLoadError = "";
  } catch (error) {
    dbApi = null;
    dbApiLoadError = error?.message || "DB API initialization failed";
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, {
    ok: false,
    error: message,
  });
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendError(response, 400, "Invalid request");
    return;
  }

  if (request.method === "OPTIONS") {
    sendJson(response, 204, { ok: true });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (request.method === "GET" && (pathname === "/api/health" || pathname === "/api/healt")) {
      const supabaseHost = (() => {
        try {
          return new URL(process.env.SUPABASE_URL || "").host || "";
        } catch {
          return "";
        }
      })();
      sendJson(response, 200, {
        ok: true,
        service: "letterhead-db-api",
        supabaseHost,
        dbApiConfigured: Boolean(dbApi),
        dbApiLoadError,
        hrSupabaseConfigured: isHrSupabaseConfigured,
        hrSupabaseHost: getHrSupabaseHost(),
        hrKeyRole: getHrKeyRole(),
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/employees/search") {
      if (!isHrSupabaseConfigured) {
        sendError(response, 503, "HR DB is not configured on server");
        return;
      }
      const hrRole = getHrKeyRole();
      if (hrRole === "anon") {
        sendError(
          response,
          503,
          'HR key role is "anon". Set SUPABASE_HR_SERVICE_ROLE_KEY to service_role key from HR project settings.',
        );
        return;
      }
      const query = url.searchParams.get("query") || url.searchParams.get("q") || "";
      const limit = Number(url.searchParams.get("limit") || "10");
      const employees = await searchEmployees({ query, limit });
      sendJson(response, 200, {
        ok: true,
        data: { employees },
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/employees/by-emp-id") {
      if (!isHrSupabaseConfigured) {
        sendError(response, 503, "HR DB is not configured on server");
        return;
      }
      const hrRole = getHrKeyRole();
      if (hrRole === "anon") {
        sendError(
          response,
          503,
          'HR key role is "anon". Set SUPABASE_HR_SERVICE_ROLE_KEY to service_role key from HR project settings.',
        );
        return;
      }
      const empId = url.searchParams.get("empId") || "";
      if (!empId) {
        sendError(response, 400, "empId is required");
        return;
      }

      const employee = await getEmployeeByEmpId(empId);
      sendJson(response, 200, {
        ok: true,
        data: { employee },
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/bootstrap") {
      if (!dbApi) {
        sendError(response, 503, `Main DB API is not configured: ${dbApiLoadError || "missing server DB env vars"}`);
        return;
      }

      const data = await dbApi.getBootstrapData();
      sendJson(response, 200, {
        ok: true,
        data,
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/companies") {
      if (!dbApi) {
        sendError(response, 503, `Main DB API is not configured: ${dbApiLoadError || "missing server DB env vars"}`);
        return;
      }
      const body = await readJsonBody(request);
      const created = await dbApi.createCompany(body);
      const data = await dbApi.getBootstrapData();
      sendJson(response, 201, {
        ok: true,
        created,
        data,
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/departments") {
      if (!dbApi) {
        sendError(response, 503, `Main DB API is not configured: ${dbApiLoadError || "missing server DB env vars"}`);
        return;
      }
      const body = await readJsonBody(request);
      const created = await dbApi.createDepartment(body);
      const data = await dbApi.getBootstrapData();
      sendJson(response, 201, {
        ok: true,
        created,
        data,
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/templates") {
      if (!dbApi) {
        sendError(response, 503, `Main DB API is not configured: ${dbApiLoadError || "missing server DB env vars"}`);
        return;
      }
      const body = await readJsonBody(request);
      const created = await dbApi.createTemplate(body);
      const data = await dbApi.getBootstrapData();
      sendJson(response, 201, {
        ok: true,
        created,
        data,
      });
      return;
    }

    if (request.method === "PUT" && pathname.startsWith("/api/templates/")) {
      if (!dbApi) {
        sendError(response, 503, `Main DB API is not configured: ${dbApiLoadError || "missing server DB env vars"}`);
        return;
      }
      const templateId = pathname.split("/").pop();
      if (!templateId) {
        sendError(response, 400, "Template id is required");
        return;
      }

      const body = await readJsonBody(request);
      await dbApi.updateTemplate(templateId, body);
      const data = await dbApi.getBootstrapData();
      sendJson(response, 200, {
        ok: true,
        data,
      });
      return;
    }

    if (request.method === "DELETE" && pathname.startsWith("/api/templates/")) {
      if (!dbApi) {
        sendError(response, 503, `Main DB API is not configured: ${dbApiLoadError || "missing server DB env vars"}`);
        return;
      }
      const templateId = pathname.split("/").pop();
      if (!templateId) {
        sendError(response, 400, "Template id is required");
        return;
      }

      await dbApi.deleteTemplate(templateId);
      const data = await dbApi.getBootstrapData();
      sendJson(response, 200, {
        ok: true,
        data,
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/letters/issue") {
      if (!dbApi) {
        sendError(response, 503, `Main DB API is not configured: ${dbApiLoadError || "missing server DB env vars"}`);
        return;
      }
      const body = await readJsonBody(request);
      const letter = await dbApi.issueLetter(body?.draft || {});
      const data = await dbApi.getBootstrapData();
      sendJson(response, 201, {
        ok: true,
        letter,
        data,
      });
      return;
    }

    sendError(response, 404, "Route not found");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[API ${request.method || "UNKNOWN"} ${pathname}]`, error);
    const statusCode = Number(error?.statusCode);
    sendError(response, Number.isInteger(statusCode) && statusCode >= 400 ? statusCode : 500, error?.message || "Internal server error");
  }
});

async function startServer() {
  await ensureDbApiLoaded();

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Letterhead DB API running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error?.message || "Server startup failed");
  process.exit(1);
});
