# Proto — AI podpora na pronájem pro české e-shopy

Chatbot, kterého vložíš do e-shopu jedním `<script>` tagem a který vyřeší většinu
zákaznických dotazů: stav objednávky, tracking, vratky, reklamace, sklad, faktury.
Mluví česky, vyká, drží se promptu e-shopu a složité případy předává člověku.

Postavené na Node.js, **bez jediné závislosti** — žádný React, žádný build krok.

## Rychlý start

```bash
cd data/capabilities/agents/proto
node server.js
```

- demo e-shop: http://localhost:4319/demo
- API: http://localhost:4319/api/health

Agent funguje ve dvou režimech:

| režim | kdy | co dělá |
|---|---|---|
| `rules` | bez `OPENAI_API_KEY` | deterministický český fallback, projde všech 6 scénářů ze zadání |
| `llm` | s `OPENAI_API_KEY` | model s tool callingem nad stejným promptem a stejnými nástroji |

Když LLM selže (timeout, 401, limit), request se automaticky překlopí do `rules` —
zákazník nikdy nedostane chybu.

## Vložení do e-shopu

```html
<script src="https://proto.vase-domena.cz/widget.js" data-tenant="example"></script>
```

`data-tenant` je název souboru v `tenants/` bez `.json`. Widget si sám načte
veřejnou konfiguraci (jméno e-shopu, barvu, úvodní zprávu, rychlé odpovědi).

## Co umí

- **stav objednávky + tracking** — `getOrderStatus`, `getTracking`, vrátí dopravce, číslo a odkaz
- **vratky** — `createReturn`, tři kroky + štítek + lhůta na peníze
- **reklamace** — `createTicket` s prioritou podle částky, „ozveme se do 2 pracovních dnů"
- **sklad a velikosti** — `getProductStock`, nikdy netvrdí „skladem", když nástroj říká opak
- **faktura / dobírka** — `sendSMSorEmail`, vysvětlení pravidel
- **eskalace** — chce člověka, druhá nadávka, velká objednávka, nejistota
- **demo režim** — napiš `demo` a agent přepne na testovací objednávky 2026001–2026003
- **PII** — do chatu nikdy nejde celé telefonní číslo, adresa ani číslo karty

## Struktura

```
data/capabilities/agents/proto/
  server.js              # HTTP server, routy, CORS, rate limit
  prompts/system.md      # kanonický system prompt (placeholdery {{ESHOP_NAME}}…)
  src/
    brain.js             # orchestrace: LLM + tool calling, fallback, metadata
    fallback.js          # deterministický režim bez LLM
    intents.js           # rozpoznání intentu, čísla objednávky, velikosti
    tools.js             # definice a provedení 6 nástrojů
    llm.js               # OpenAI-kompatibilní klient
    tenants.js           # konfigurace e-shopů (pronajímatelů)
    session.js           # paměť konverzace + rate limiting
    store.js             # tikety, vratky, logy (data/*.jsonl)
    providers/
      demo.js            # demo objednávky a produkty
      shoptet.js         # kostra napojení na Shoptet
  public/
    widget.js            # vložitelný chat (Shadow DOM, bez závislostí)
    demo.html            # demo e-shop
  tenants/               # jeden JSON = jeden pronajímatel
  scripts/test-scenarios.mjs
```

## Testy

```bash
node scripts/test-scenarios.mjs   # 8/8 scénářů ze zadání
```

## Konfigurace

Zkopíruj `.env.example` na `.env`. Server si `.env` načte sám (`process.loadEnvFile`).

```
OPENAI_API_KEY=...        # volitelné, bez něj jede rules režim
OPENAI_BASE_URL=https://freebuff.com/api/v1/paid
OPENAI_MODEL=gpt-4o-mini
PROTO_TENANT=demo
SHOPTET_API_TOKEN=...     # jen pro tenanta s "provider": "shoptet"
```

## Další dokumentace

`PROMPT.md` (prompt a placeholdery) · `ARCHITECTURE.md` (tok requestu) ·
`API.md` (endpointy) · `TOOLS.md` (nástroje) · `TENANTS.md` (pronájem dalšímu e-shopu) ·
`DEPLOY.md` (nasazení) · `SECURITY.md` (PII, klíče, limity) · `DEMO.md` (ukázka a scénáře).
