// Env se cte az pri volani, aby fungovalo i nacteni .env po startu (process.loadEnvFile).
function baseUrl() {
  return (process.env.OPENAI_BASE_URL || "https://freebuff.com/api/v1/paid").replace(/\/$/, "");
}

function apiKey() {
  return process.env.OPENAI_API_KEY || "";
}

function model() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export function llmEnabled() {
  return Boolean(apiKey());
}

/** Jedno kolo konverzace s modelem. Vraci message (muze obsahovat tool_calls). */
export async function chatModel(messages, tools) {
  if (!apiKey()) throw new Error("chybí OPENAI_API_KEY");

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: model(),
      messages,
      temperature: 0.3,
      max_tokens: 400,
      ...(tools && tools.length ? { tools, tool_choice: "auto" } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  if (!message) throw new Error("LLM nevrátil zprávu");
  return message;
}

export function safeJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}
