import { fallbackReply } from "./fallback.js";
import { classify, norm } from "./intents.js";
import { chatModel, llmEnabled, safeJson } from "./llm.js";
import { buildSystemPrompt } from "./prompt.js";
import { TOOL_SPECS, runTool } from "./tools.js";

const DEMO_TRIGGER = /\b(demo|ukazka|test)\b/;
const DEMO_SUFFIX = "Toto byla ukázka, v reálném provozu jsem napojený na váš Shoptet.";
const MAX_TOOL_ROUNDS = 4;

export async function handleMessage({ tenant, session, message }) {
  if (DEMO_TRIGGER.test(norm(message))) session.demo = true;

  const ctx = {
    tenant,
    session,
    message,
    runTool: (name, args) => runTool(name, args, { tenant, session }),
  };

  let engine = "rules";
  let result;

  if (llmEnabled()) {
    try {
      result = await llmReply(ctx);
      engine = "llm";
    } catch (err) {
      console.warn("[proto] LLM selhal, pouzivam fallback:", err && err.message ? err.message : err);
      result = await fallbackReply(ctx);
    }
  } else {
    result = await fallbackReply(ctx);
  }

  let text = String(result.text || "").trim();
  if (!text) text = "Ověřím to a hned se ozvu.";

  if (session.demo && !text.includes(DEMO_SUFFIX)) {
    text = `${text} ${DEMO_SUFFIX}`;
  }

  session.history.push({ role: "user", content: message });
  session.history.push({ role: "assistant", content: text });
  session.history = session.history.slice(-12);
  session.turn += 1;

  const tools = (result.used || []).map((t) => t.name);
  const needHuman = Boolean(result.needHuman) || tools.includes("createTicket");

  return {
    text,
    engine,
    meta: {
      intent: result.intent || classify(message),
      orderId: session.orderId || null,
      tools,
      needHuman,
      demo: Boolean(session.demo),
      turn: session.turn,
      engine,
    },
  };
}

async function llmReply(ctx) {
  const { tenant, session, message } = ctx;

  const messages = [
    { role: "system", content: buildSystemPrompt(tenant) },
    ...session.history,
    { role: "user", content: message },
  ];

  const used = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const msg = await chatModel(messages, TOOL_SPECS);
    const calls = msg.tool_calls || [];

    if (!calls.length) {
      return { text: String(msg.content || ""), used, intent: classify(message) };
    }

    messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });

    for (const call of calls) {
      const name = call.function?.name;
      const args = safeJson(call.function?.arguments);
      let toolResult;
      try {
        toolResult = await ctx.runTool(name, args);
      } catch (err) {
        toolResult = { error: String(err && err.message ? err.message : err) };
      }
      used.push({ name, args, result: toolResult });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(toolResult) });
    }
  }

  throw new Error("model nezavolal konec po limitu nastroju");
}
