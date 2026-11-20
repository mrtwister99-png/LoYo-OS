import { classify, extractEmail, extractOrderId, extractSize, isAngry, productQuery } from "./intents.js";
import { mask } from "./store.js";

const shortOrder = (id) => `…${String(id || "").slice(-4)}`;

/**
 * Deterministicky rezim. Bezi vzdy, kdyz neni OPENAI_API_KEY, a jako zaloha,
 * kdyz LLM selze. Umyslne resi stejne scenare jako prompt, jen bez modelu.
 */
export async function fallbackReply(ctx) {
  const used = [];
  const call = async (name, args) => {
    const result = await ctx.runTool(name, args);
    used.push({ name, args, result });
    return result;
  };
  return await route({ ...ctx, call, used });
}

async function route({ tenant, session, message, call, used }) {
  const intent = classify(message);
  const orderId = extractOrderId(message);
  const email = extractEmail(message);

  if (orderId) session.orderId = orderId;
  if (email) session.email = email;
  if (isAngry(message)) session.strikes = (session.strikes || 0) + 1;

  const done = (text, extra = {}) => ({
    text,
    used,
    intent: extra.intent || intent,
    needHuman: Boolean(extra.needHuman),
  });

  /* --- 1) clovek nebo druha nadavka -> eskalace --- */
  if (intent === "human" || session.strikes >= 2) {
    const ticket = await call("createTicket", {
      summary: message.slice(0, 200),
      reason: intent === "human" ? "zákazník chce člověka" : "opakované nadávky",
      priority: "high",
    });
    return done(
      `Rozumím, že vás to štve, předávám to kolegovi, který to vyřeší přednostně. `
      + `Číslo tiketu ${ticket.ticketId}, ozve se do ${tenant.humanSlaHours} hodin v pracovní době.`,
      { needHuman: true, intent: "human" },
    );
  }

  /* --- 2) doplneni chybejiciho udaje z predchoziho dotazu --- */
  if (session.pending === "order_for_status" && orderId) {
    session.pending = null;
    return await orderStatus({ tenant, session, call, done });
  }
  if (session.pending === "order_for_return" && orderId) {
    session.pending = null;
    return await createReturn({ tenant, session, call, done });
  }
  if (session.pending === "email_for_invoice" && session.email) {
    session.pending = null;
    return await invoice({ tenant, session, call, done });
  }

  switch (intent) {
    case "order":
      return await orderStatus({ tenant, session, call, done });
    case "return":
      return await createReturn({ tenant, session, call, done });
    case "complaint":
      return await complaint({ tenant, session, message, call, done });
    case "stock":
      return await stock({ message, call, done });
    case "invoice":
      return await invoice({ tenant, session, call, done });
    case "cod":
      return done(
        "Dobírku po odeslání změnit na kartu nelze, ale při další objednávce si můžete vybrat platbu kartou. "
        + "Mám vám poradit ještě s něčím?",
      );
    case "demo":
      return done(
        "Demo režim je zapnutý. Zkuste třeba: „Kde je moje objednávka 2026001?“ nebo „Máte boty Runner ve velikosti 42?“",
      );
    case "greeting":
      return done(tenant.greeting);
    default:
      return done(
        "Tohle bohužel neřeším, ale s objednávkou vám rád pomohu. "
        + "Mám vám zjistit stav zásilky, nebo vytvořit vratku?",
      );
  }
}

async function orderStatus({ tenant, session, call, done }) {
  if (!session.orderId) {
    session.pending = "order_for_status";
    return done(
      `Mohu poprosit o číslo objednávky? Má formát ${tenant.orderFormat}. `
      + "Stačí číslo, nic dalšího nepotřebuju.",
    );
  }

  const order = await call("getOrderStatus", { orderId: session.orderId });
  if (!order.found) {
    return done(
      `Objednávku ${shortOrder(session.orderId)} v systému nevidím. `
      + "Zkontrolujete prosím číslo, nebo to mám předat kolegovi?",
    );
  }

  const tracking = await call("getTracking", { orderId: session.orderId });
  const parts = [`Vaše objednávka č. ${shortOrder(order.orderId)} je ${order.state}.`];
  if (order.carrier) {
    const trackingPart = tracking.tracking ? `, tracking ${tracking.tracking}` : "";
    const etaPart = order.eta ? `, předpokládané doručení ${order.eta}` : "";
    parts.push(`Dopravce ${order.carrier}${trackingPart}${etaPart}.`);
  }
  if (tracking.url) parts.push(`Sledovat můžete tady: ${tracking.url}`);
  parts.push("Mám vám poslat tracking zvlášť, nebo potřebujete ještě něco?");
  return done(parts.join(" "));
}

async function createReturn({ tenant, session, call, done }) {
  if (!session.orderId) {
    session.pending = "order_for_return";
    return done(
      `Rádi to vyřešíme. Vrácení jde do ${tenant.returnDays} dnů od převzetí, bez udání důvodu. `
      + "Mohu poprosit o číslo objednávky?",
    );
  }

  const created = await call("createReturn", {
    orderId: session.orderId,
    reason: "vrácení zboží",
  });
  return done(
    `Vratku jsem vytvořil, číslo ${created.returnId}. `
    + `1) Zboží zabalte, 2) nalepte štítek z e-mailu, 3) odnesete ho na Zásilkovnu nebo PPL. `
    + `Peníze vracíme do ${tenant.returnDays} dnů od přijetí vratky na stejný způsob platby. `
    + `Štítek: ${created.labelUrl}`,
  );
}

async function complaint({ tenant, session, message, call, done }) {
  let priority = "normal";
  if (session.orderId) {
    const order = await call("getOrderStatus", { orderId: session.orderId });
    if (order.found && Number(order.total) > 5000) priority = "high";
  }

  const ticket = await call("createTicket", {
    summary: message.slice(0, 200),
    reason: "reklamace",
    priority,
  });
  const sla = priority === "high" ? tenant.humanSlaHours : 48;
  return done(
    `Mrzí mě to, vyřešíme to. Pošlete prosím fotku zboží, ať to kolegové vidí. `
    + `Založil jsem tiket ${ticket.ticketId}, ozveme se do ${sla === 48 ? "2 pracovních dnů" : `${sla} hodin`} s řešením.`,
    { needHuman: true },
  );
}

async function stock({ message, call, done }) {
  const size = extractSize(message);
  const query = productQuery(message);
  const result = await call("getProductStock", { query, size });

  if (!result.found) {
    return done(
      "Tuhle položku v katalogu nevidím. Pošlete mi prosím přesný název nebo odkaz na produkt a ověřím to.",
    );
  }
  if (result.inStock) {
    return done(
      `${result.name} je skladem${result.quantity ? ` (${result.quantity} ks)` : ""}. `
      + "Při objednání do 14:00 odesíláme dnes. Mám vám poslat odkaz na produkt?",
    );
  }
  return done(
    `${result.name} momentálně není skladem, naskladnění očekáváme `
    + `${result.restockInDays ? `za ${result.restockInDays} dnů` : "v následujících dnech"}. `
    + "Mám vám napsat, jakmile bude?",
  );
}

async function invoice({ tenant, session, call, done }) {
  if (!session.email) {
    session.pending = "email_for_invoice";
    return done(
      "Fakturu posíláme e-mailem po odeslání objednávky a najdete ji i ve svém účtu. "
      + "Na jaký e-mail ji mám poslat znovu?",
    );
  }
  const sent = await call("sendSMSorEmail", {
    channel: "email",
    to: session.email,
    template: "invoice",
  });
  if (sent.sent === false) {
    return done(
      `Fakturu vám pošle kolega ručně na ${mask(session.email)}, systémové odeslání teď není dostupné. `
      + `Kdyby nedorazila do zítra, napište prosím na ${tenant.claimEmail}.`,
    );
  }
  return done(
    `Fakturu jsem poslal znovu na ${mask(session.email)}. `
    + "Když do pár minut nedorazí, zkontrolujte prosím spam, nebo mi napište znovu.",
  );
}
