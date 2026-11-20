# ARCHITECTURE.md

## Tok jednoho dotazu

```
widget.js (e-shop)
   │  POST /api/chat {tenant, sessionId, message}
   ▼
server.js ── rate limit (40 zpráv / 5 min na IP+session) ── CORS podle tenanta
   ▼
brain.js  handleMessage()
   ├─ demo trigger?        → session.demo = true
   ├─ OPENAI_API_KEY?  ─── ano → llmReply()  ──┐
   │                          │ chyba/timeout │
   │                          ▼               │
   └─ ne → fallbackReply() ◄──────────────────┘
   ▼
odpověď + meta  →  JSON zpět do widgetu
```

## Dvě cesty odpovědi

**`llm` režim** (`src/brain.js` → `llmReply`)

1. Sestaví `messages`: system prompt z `prompts/system.md` + historie session + nová zpráva.
2. Zavolá model s `TOOLS` (šest funkcí, `tool_choice: "auto"`).
3. Když model vrátí `tool_calls`, server je provede přes `runTool()`, přidá `role: "tool"`
   výsledky a zavolá model znovu. Max 4 kola, pak fallback.
4. Finální text jde zákazníkovi; provedené nástroje se zapíšou do `meta.tools`.

**`rules` režim** (`src/fallback.js`)

- `src/intents.js` rozpozná intent (objednávka, vratka, reklamace, sklad, faktura, dobírka,
  člověk, demo, pozdrav) a vytáhne číslo objednávky, e-mail a velikost.
- Session drží `pending` slot — „pošlete číslo objednávky" se doplní v dalším dotazu.
- Odpovědi skládá z dat tenanta, takže texty odpovídají konfiguraci e-shopu.
- Používá stejné nástroje jako LLM, takže tikety/vratky vznikají i bez modelu.

## Session

`src/session.js`, v paměti, TTL 3 hodiny, max 2000 sessions.

```js
{ id, history: [...], turn, strikes, demo, orderId, email, pending, lastTicket }
```

- `history` — posledních 12 zpráv, jen pro LLM
- `strikes` — kolikrát zákazník nadával; druhá nadávka = eskalace
- `pending` — `order_for_status` / `order_for_return` / `email_for_invoice`
- `orderId`, `email` — doplněné údaje, aby se zákazník neptal dvakrát

Session se po restartu ztratí (zákazník začne novou konverzaci). Tikety a vratky jsou na disku.

## Nástroje a provideři

`src/tools.js` drží schémata (`TOOL_SPECS`) i provedení (`runTool`). Data berou z providera:

- `src/providers/demo.js` — deterministická data pro demo a testy
- `src/providers/shoptet.js` — kostra reálného napojení, bez tokenu vyhodí jasnou chybu

Provider se vybírá podle `tenant.provider`. Přidání dalšího (např. WooCommerce, custom API)
znamená jeden soubor se stejnými šesti metodami.

## Úložiště

`src/store.js` zapisuje JSONL do `data/` (nebo `PROTO_DATA_DIR`):

| soubor | obsah |
|---|---|
| `tickets.jsonl` | tikety pro lidi (id, priorita, souhrn, session) |
| `returns.jsonl` | vytvořené vratky |
| `messages.jsonl` | odeslané e-maily/SMS, příjemce vždy maskovaný |

## Metadata pro orchestraci

Každá odpověď nese `meta`:

```json
{ "intent": "order", "orderId": "2026001", "tools": ["getOrderStatus", "getTracking"],
  "needHuman": false, "demo": false, "turn": 1, "engine": "rules" }
```

`needHuman` je `true`, když padl tiket, nebo to vrátí fallback (reklamace, eskalace).
`engine` říká, jestli odpovídal model (`llm`) nebo pravidla (`rules`) — hodí se pro monitoring.

## Co záměrně není

- žádná databáze (JSONL stačí do stovek tiketů denně; při větším provozu vyměnit `store.js`)
- žádné websockety (chat je request/response)
- žádný frontend build (widget je jeden soubor)
- žádná autentizace zákazníka (konverzace je anonymní, identifická je session id)
