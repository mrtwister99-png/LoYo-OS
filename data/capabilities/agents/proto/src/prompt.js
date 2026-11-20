import { readFileSync } from "node:fs";

const RAW = readFileSync(new URL("../prompts/system.md", import.meta.url), "utf8");

/** Nahradi {{PLACEHOLDERY}} hodnotami z konfigurace e-shopu. */
export function buildSystemPrompt(tenant) {
  const values = {
    ESHOP_NAME: tenant.name,
    ESHOP_URL: tenant.url,
    SUPPORT_HOURS: tenant.supportHours,
    CARRIERS: tenant.carriers,
    SHIPS_WITHIN: tenant.shipsWithin,
    FREE_SHIPPING: tenant.freeShippingFrom,
    RETURN_DAYS: String(tenant.returnDays),
    RETURN_URL: tenant.returnUrl,
    CLAIM_EMAIL: tenant.claimEmail,
    PICKUP_ADDRESS: tenant.pickupAddress,
    CONTACT_PHONE: tenant.phone,
    CONTACT_EMAIL: tenant.email,
    ORDER_FORMAT: tenant.orderFormat,
    HUMAN_SLA: String(tenant.humanSlaHours),
  };

  return RAW.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  ));
}

export const PROMPT_SOURCE = "prompts/system.md";
