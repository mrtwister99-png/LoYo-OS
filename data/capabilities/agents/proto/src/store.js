import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = process.env.PROTO_DATA_DIR || path.join(ROOT, "data");

fs.mkdirSync(DATA, { recursive: true });

function append(file, record) {
  fs.appendFileSync(path.join(DATA, file), JSON.stringify(record) + "\n");
}

/** Zalozi tiket pro cloveka. Vraci jen to, co muze jit zakaznikovi do chatu. */
export function saveTicket({ tenant, sessionId, summary, reason, priority = "normal", transcript = null }) {
  const ticketId = `T-${randomBytes(3).toString("hex").toUpperCase()}`;
  const createdAt = new Date().toISOString();
  append("tickets.jsonl", {
    ticketId,
    createdAt,
    status: "open",
    priority,
    tenant,
    sessionId,
    reason,
    summary: String(summary || "").slice(0, 500),
    transcript,
  });
  return { ticketId, createdAt, priority };
}

/** Zalozi vratku a vrati cislo + odkaz na stitek. */
export function saveReturn({ tenant, orderId, reason, items }) {
  const returnId = `VR${new Date().getFullYear()}${randomBytes(2).toString("hex").toUpperCase()}`;
  append("returns.jsonl", {
    returnId,
    createdAt: new Date().toISOString(),
    tenant,
    orderId,
    reason: String(reason || "").slice(0, 300),
    items: Array.isArray(items) ? items.slice(0, 20) : [],
  });
  return returnId;
}

/** Zaloguje odeslanou zpravu (SMS/e-mail) - v demu jen do souboru. */
export function logMessage({ tenant, channel, to, template }) {
  append("messages.jsonl", {
    sentAt: new Date().toISOString(),
    tenant,
    channel,
    template,
    toMasked: mask(to),
  });
}

export function mask(value) {
  const s = String(value || "");
  if (s.includes("@")) {
    const [user, domain] = s.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return s.length > 4 ? `***${s.slice(-4)}` : "***";
}

export function dataDir() {
  return DATA;
}
