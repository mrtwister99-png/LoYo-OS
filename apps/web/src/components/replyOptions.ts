// apps/web/src/components/replyOptions.ts
// Z odpovědi Mary vytáhne nabízené možnosti → tlačítka v chatu.
// Stejná pravidla používá Telegram bot (data/capabilities/agents/mary-jane/telegram-bot.mjs → replyOptions).
//   • řádky „/příkaz něco — popis“ (bez <zástupných> částí)  → pošle „/příkaz něco“
//   • volby „A) …  B) …“                                      → pošle „A“, „B“…
export type ReplyOption = { label: string; send: string }

export function replyOptions(text: string): ReplyOption[] {
  if (!text || /\/ano [a-z0-9]{4}\b/.test(text)) return [] // potvrzení má vlastní tlačítka
  const out: ReplyOption[] = []
  const seen = new Set<string>()
  const cmdLines = text.split('\n')
    .map((l) => l.trim().replace(/^[•\-*·]\s*/, ''))
    .map((l) => l.match(/^(\/[a-z0-9_-]+(?: [^\s—–<>|]+){0,3})\s+[—–-]\s+\S/i)?.[1])
    .filter((c): c is string => !!c && !/[<>\[\]]/.test(c))
  // velké seznamy (/vse) by byly zeď tlačítek
  if (cmdLines.length && cmdLines.length <= 12) {
    for (const c of cmdLines) if (!seen.has(c)) { seen.add(c); out.push({ label: c, send: c }) }
  }
  for (const m of text.matchAll(/(?:^|\s)([A-F])\)\s+([^\n]{1,60}?)(?=[,;]?\s+[A-F]\)\s|\.\s|\.$|\n|$)/g)) {
    if (seen.has(m[1])) continue
    seen.add(m[1])
    out.push({ label: `${m[1]}) ${m[2].replace(/[.,;]$/, '').slice(0, 40)}`, send: m[1] })
  }
  return out.slice(0, 12)
}
