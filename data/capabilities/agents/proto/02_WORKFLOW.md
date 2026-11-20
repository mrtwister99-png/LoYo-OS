# 02_WORKFLOW.md: Jak Proto pracuje

## Spuštění a ověření

```bash
cd data/capabilities/agents/proto
node server.js                  # http://localhost:4319
curl -s localhost:4319/api/health
node scripts/test-scenarios.mjs # 8/8 scénářů
```

Stav LLM poznáš z `health`: `{"llm": false}` znamená deterministický režim.
Klíč patří do `.env` (viz `.env.example`), nikdy do kódu ani do gitu.

## Vložení do e-shopu

```html
<script src="https://proto.vase-domena.cz/widget.js" data-tenant="muj-eshop"></script>
```

`data-tenant` = soubor v `tenants/` bez `.json`. Nový e-shop znamená nový JSON,
žádnou změnu kódu (viz `TENANTS.md`).

## Workflow podle dotazu

| dotaz | postup | nástroje |
|---|---|---|
| kde je objednávka | číslo objednávky → stav → tracking → odkaz | `getOrderStatus`, `getTracking` |
| chci vrátit | číslo objednávky → 3 kroky → štítek → lhůta na peníze | `createReturn` |
| reklamace | „Mrzí mě to" → fotka → tiket → 2 pracovní dny | `createTicket` |
| máte skladem | dotaz na produkt a velikost → sklad → nabídka hlídání | `getProductStock` |
| faktura / dobírka | vysvětlení + případné znovuposlání | `sendSMSorEmail` |
| chce člověka / nadává | klidná odpověď → tiket → SLA | `createTicket` |

## Eskalace (vždy tiket)

- zákazník chce člověka
- druhá nadávka v konverzaci
- objednávka nad 10 000 Kč s problémem
- reklamace nad 5 000 Kč (priorita `high`)
- nástroj selhal nebo si agent není jistý

## Demo režim

Slovo `demo`, `ukázka` nebo `test` přepne konverzaci na testovací data:
objednávky 2026001 (expedována, PPL, 123456789), 2026002 (přijata), 2026003 (doručena),
produkty Tričko Basic / Boty Runner 42 (2 ks) / Mikina Premium (0 ks, 5 dnů).
Na konci odpovědi vždy „Toto byla ukázka, v reálném provozu jsem napojený na váš Shoptet."

## Dvě cesty odpovědi

1. **LLM** — `OPENAI_API_KEY` + tool calling, max 4 kola, prompt z `prompts/system.md`.
2. **Rules** — bez klíče nebo při chybě modelu. `src/fallback.js` + `src/intents.js`,
   stejné nástroje, stejná data z tenanta.

Když LLM spadne, request se překlopí do rules. Zákazník nikdy nedostane chybu.

## Metadata pro orchestrátor

Každá odpověď nese `meta`: `intent`, `orderId`, `tools`, `needHuman`, `demo`, `turn`, `engine`.
`needHuman: false` je metrika „vyřešeno bez člověka" — to se ukazuje pronajímateli.

## Úložiště

`data/tickets.jsonl`, `data/returns.jsonl`, `data/messages.jsonl` (maskovaný příjemce).
Session je v paměti s TTL 3 hodiny. Reset dema = smazat `data/` a restartovat.

## Testovací scénáře (must pass)

1. „Dobrý den, kde je moje objednávka 2026001?" → expedována, PPL, tracking, zítra
2. „Chci vrátit mikinu, je mi malá." → dotaz na číslo, 14 dnů, bez udání důvodu
3. „Přišla mi rozbitá věc, co mám dělat?" → empatie, fotka, tiket, 2 pracovní dny
4. „Máte boty Runner ve velikosti 42?" → skladem 2 ks, dnes odesíláme
5. „Potřebuju fakturu, nepřišla mi." → e-mail/účet, dotaz na adresu
6. „Jste debil, chci člověka!" → klid, tiket, 2 hodiny
