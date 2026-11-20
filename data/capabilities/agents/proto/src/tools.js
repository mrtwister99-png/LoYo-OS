import { demoProvider } from "./providers/demo.js";
import { shoptetProvider } from "./providers/shoptet.js";
import { logMessage, mask, saveReturn, saveTicket } from "./store.js";

const providers = { demo: demoProvider, shoptet: shoptetProvider };

export function providerFor(tenant) {
  return providers[tenant.provider] || demoProvider;
}

const orderIdProp = {
  type: "string",
  description: "Číslo objednávky zákazníka, např. 2026001.",
};

export const TOOL_SPECS = [
  {
    type: "function",
    function: {
      name: "getOrderStatus",
      description: "Zjistí stav objednávky podle čísla objednávky. Použij VŽDY, než odpovíš na dotaz o objednávce.",
      parameters: {
        type: "object",
        properties: { orderId: orderIdProp },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTracking",
      description: "Zjistí tracking číslo, dopravce a odkaz na sledování zásilky.",
      parameters: {
        type: "object",
        properties: { orderId: orderIdProp },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProductStock",
      description: "Zjistí skladovou dostupnost produktu. Nikdy netvrď, že je zboží skladem bez tohoto volání.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Název nebo část názvu produktu." },
          size: { type: "string", description: "Velikost, pokud ji zákazník uvedl (např. 42, L)." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createReturn",
      description: "Vytvoří vratku zboží a připraví štítek pro zákazníka.",
      parameters: {
        type: "object",
        properties: {
          orderId: orderIdProp,
          reason: { type: "string", description: "Důvod vrácení." },
          items: { type: "array", items: { type: "string" }, description: "Co zákazník vrací." },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createTicket",
      description: "Předá případ člověku včetně přepisu konverzace. Použij při eskalaci.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Důvod předání (reklamace, naštvaný zákazník, složitý dotaz)." },
          summary: { type: "string", description: "Krátké shrnutí problému." },
          priority: { type: "string", enum: ["low", "normal", "high"], description: "Priorita." },
        },
        required: ["summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sendSMSorEmail",
      description: "Pošle zákazníkovi potvrzení, štítek nebo fakturu na e-mail/SMS.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["email", "sms"], description: "Kanál doručení." },
          to: { type: "string", description: "E-mail nebo telefon zákazníka." },
          template: { type: "string", description: "Co poslat: invoice, return_label, tracking, confirmation." },
        },
        required: ["channel", "template"],
      },
    },
  },
];

function clean(args) {
  const out = {};
  for (const [k, v] of Object.entries(args || {})) {
    if (typeof v === "string") out[k] = v.trim().slice(0, 300);
    else if (Array.isArray(v)) out[k] = v.slice(0, 20).map((x) => String(x).slice(0, 120));
    else out[k] = v;
  }
  return out;
}

/**
 * Spusti nastroj. Kazdy vysledek je plain objekt, ktery jde rovnou poslat modelu
 * i zapsat do metadat. Uklizene texty drzi PII mimo chat (maskovani).
 */
export async function runTool(name, rawArgs, ctx) {
  const args = clean(rawArgs);
  const provider = providerFor(ctx.tenant);
  const tenantId = ctx.tenant.id;
  const sessionId = ctx.session.id;

  switch (name) {
    case "getOrderStatus":
      return await provider.getOrder(args.orderId);

    case "getTracking":
      return await provider.getTracking(args.orderId);

    case "getProductStock":
      return await provider.getProductStock({ query: args.query, size: args.size });

    case "createReturn": {
      const created = await provider.createReturn({
        orderId: args.orderId,
        reason: args.reason,
        items: args.items,
      });
      const returnId = created.returnId || saveReturn({
        tenant: tenantId,
        orderId: args.orderId,
        reason: args.reason,
        items: args.items,
      });
      return {
        created: true,
        returnId,
        labelUrl: `${ctx.tenant.url.replace(/\/$/, "")}/vraceni/stitek/${returnId}`,
        refundDays: ctx.tenant.returnDays,
      };
    }

    case "createTicket": {
      const ticket = saveTicket({
        tenant: tenantId,
        sessionId,
        summary: args.summary,
        reason: args.reason || "eskalace",
        priority: args.priority || "normal",
      });
      ctx.session.lastTicket = ticket.ticketId;
      return { ...ticket, slaHours: ctx.tenant.humanSlaHours };
    }

    case "sendSMSorEmail": {
      const sent = await provider.sendMessage({
        channel: args.channel,
        to: args.to,
        template: args.template,
      });
      logMessage({ tenant: tenantId, channel: args.channel, to: args.to, template: args.template });
      return { ...sent, toMasked: mask(args.to) };
    }

    default:
      return { error: `neznámý nástroj ${name}` };
  }
}
