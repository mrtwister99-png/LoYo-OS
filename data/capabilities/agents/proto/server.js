import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTenant, publicConfig } from "./src/tenants.js";
import { handleMessage } from "./src/brain.js";
import { getSession, rateLimit } from "./src/session.js";
import { llmEnabled } from "./src/llm.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Nacti .env, kdyz existuje (Node 20.12+). Chybejici .env neni chyba.
try {
  if (typeof process.loadEnvFile === "function") process.loadEnvFile(path.join(ROOT, ".env"));
} catch {}

// PORT=0 nebo nesmysl v prostredi nesmi znamenat nahodny port.
function resolvePort() {
  const raw = Number(process.env.PORT);
  return Number.isInteger(raw) && raw > 0 && raw < 65536 ? raw : 4319;
}

const PORT = resolvePort();
const VERSION = "0.1.0";
const MAX_BODY = 16 * 1024;

// Jen znamé soubory - zadne cteni libovolne cesty z URL.
const FILES = {
  "/": ["public/demo.html", "text/html; charset=utf-8"],
  "/demo": ["public/demo.html", "text/html; charset=utf-8"],
  "/demo.html": ["public/demo.html", "text/html; charset=utf-8"],
  "/widget.js": ["public/widget.js", "text/javascript; charset=utf-8"],
};

function corsHeaders(tenant, req) {
  const origin = req.headers.origin;
  const allowed = tenant.allowedOrigins || [];
  const allowOrigin = allowed.includes("*") ? "*" : (origin && allowed.includes(origin) ? origin : allowed[0] || "null");
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "origin",
  };
}

function sendJson(res, code, data, extraHeaders = {}) {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("body_too_large"), { code: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let tenant = null;

  try {
    if (req.method === "OPTIONS") {
      const t = getTenant(url.searchParams.get("tenant"));
      res.writeHead(204, corsHeaders(t, req));
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, agent: "proto", version: VERSION, llm: llmEnabled() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/config") {
      tenant = getTenant(url.searchParams.get("tenant"));
      sendJson(res, 200, publicConfig(tenant), corsHeaders(tenant, req));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const raw = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: "invalid_json" });
        return;
      }

      tenant = getTenant(payload.tenant);
      const headers = corsHeaders(tenant, req);

      const message = String(payload.message || "").slice(0, 1000).trim();
      if (!message) {
        sendJson(res, 400, { error: "empty_message", message: "Napište prosím dotaz." }, headers);
        return;
      }

      const sessionId = String(payload.sessionId || "").slice(0, 64) || randomUUID();
      const ip = req.socket.remoteAddress || "unknown";

      if (!rateLimit(`${ip}:${sessionId}`)) {
        sendJson(
          res,
          429,
          { error: "rate_limited", message: "Příliš mnoho zpráv za sebou. Zkuste to prosím za chvíli." },
          headers,
        );
        return;
      }

      const session = getSession(sessionId);
      const result = await handleMessage({ tenant, session, message });

      console.log(
        JSON.stringify({
          t: new Date().toISOString(),
          tenant: tenant.id,
          session: sessionId,
          intent: result.meta.intent,
          tools: result.meta.tools,
          needHuman: result.meta.needHuman,
          engine: result.engine,
        }),
      );

      sendJson(res, 200, { reply: result.text, sessionId, meta: result.meta }, headers);
      return;
    }

    const file = FILES[url.pathname];
    if (req.method === "GET" && file) {
      const data = await readFile(path.join(ROOT, file[0]));
      res.writeHead(200, {
        "content-type": file[1],
        "cache-control": "no-cache",
        ...(url.pathname === "/widget.js" ? { "access-control-allow-origin": "*" } : {}),
      });
      res.end(data);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (err) {
    if (err && err.code === 413) {
      sendJson(res, 413, { error: "body_too_large" });
      return;
    }
    console.error("[proto] chyba:", err && err.message ? err.message : err);
    sendJson(res, 500, { error: "server_error", message: "Omlouváme se, něco se pokazilo." });
  }
});

server.listen(PORT, () => {
  console.log(`[proto] agent běží na http://localhost:${PORT}`);
  console.log(`[proto] demo e-shop: http://localhost:${PORT}/demo`);
  console.log(`[proto] LLM: ${llmEnabled() ? "zapnuto" : "vypnuto (jede deterministický fallback)"}`);
});
