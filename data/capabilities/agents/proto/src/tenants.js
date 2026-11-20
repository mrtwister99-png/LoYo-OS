import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "tenants");
const cache = new Map();

export const DEFAULT_TENANT_ID = process.env.PROTO_TENANT || "demo";

function defaults() {
  return {
    id: "demo",
    name: "Demo e-shop",
    url: "https://example.cz",
    supportHours: "Po–Pá 8–17, So 9–12",
    carriers: "Zásilkovna, PPL, DPD, Česká pošta, osobní odběr",
    shipsWithin: "objednávky do 14:00 odesíláme ten samý den, jinak další pracovní den",
    freeShippingFrom: "1500 Kč",
    returnDays: 14,
    returnUrl: "https://example.cz/vraceni",
    claimEmail: "reklamace@example.cz",
    pickupAddress: "Skladová 1, Praha",
    phone: "+420 777 000 000",
    email: "podpora@example.cz",
    orderFormat: "202600123",
    humanSlaHours: 2,
    provider: "demo",
    color: "#f59e0b",
    greeting: "Dobrý den, jak vám mohu pomoci s objednávkou?",
    quickReplies: [
      "Kde je moje objednávka?",
      "Chci vrátit zboží",
      "Reklamace",
      "Máte zboží skladem?",
      "Ukázka (demo)",
    ],
    allowedOrigins: ["*"],
  };
}

/** Nacte konfiguraci pronajimatele (jednoho e-shopu) z tenants/<id>.json. */
export function getTenant(id) {
  const requested = String(id || DEFAULT_TENANT_ID).replace(/[^a-z0-9_-]/gi, "");
  const key = requested || DEFAULT_TENANT_ID;

  if (cache.has(key)) return cache.get(key);

  const file = path.join(DIR, `${key}.json`);
  let json = {};
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    if (key !== DEFAULT_TENANT_ID) {
      console.warn(`[proto] tenant "${key}" nenalezen, pouzivam "${DEFAULT_TENANT_ID}"`);
      return getTenant(DEFAULT_TENANT_ID);
    }
  }

  const tenant = { ...defaults(), ...json, id: key };
  cache.set(key, tenant);
  return tenant;
}

/** Jen to, co muze videt prohlizec - zadne klice, zadne interni cesty. */
export function publicConfig(tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    greeting: tenant.greeting,
    color: tenant.color,
    quickReplies: tenant.quickReplies,
    supportHours: tenant.supportHours,
    demo: tenant.provider !== "shoptet",
  };
}
