# Lopatinka

Cloudový agent LOYO OS, který každý běh projde **Sbazar** a **Aukro**, hledá elektroniku do **3 500 Kč** za kus a pošle nejvýhodnější nabídky do Telegramu.

**Jak vybírá:**

1. **3 hlavní tipy** — jen věci v pásmu **2 500–3 500 Kč** (od největší slevy): nejdřív sleva ≥ `minDiscountPercent`, pak jakákoli kladná sleva, pak cena na úrovni mediánu a teprve nakonec nabídky v pásmu nad mediánem. Levné kousky mimo pásmo hlavní tipy nikdy nezaplní, dokud je v pásmu co nabídnout.
2. **Nabídka nad mediánem** (záporná sleva) se do hlavních tipů nedostane, dokud jsou k dispozici výhodnější kousky v pásmu. Taková nabídka je v Telegramu i v reportu výslovně označená `⚠️ nad mediánem`.
3. **Až 2 bonusy navíc** — jen výhodné kousky **mimo pásmo** (sleva ≥ `minDiscountPercent`, případně kladná sleva), pořád do 3 500 Kč. V Telegramu jsou za hlavními tipy pod linkou „Bonusy mimo pásmo“.
4. Hlavní tipy jsou tedy dražší kousky z pásma, bonusy ty levnější mimo něj. Celkem **3–5 nabídek** za běh, nikdy víc než do rozpočtu.
5. Pokud pásmo nic nenabídne, hlavní tipy se doplní z hodnotných kousků mimo pásmo (krajní záchrana).

## Telegram — jak začít (5 minut)

1. **Vytvoř bota.** V Telegramu otevři [@BotFather](https://t.me/BotFather) → `/newbot` → zadej jméno a uživatelské jméno končící `bot` (např. `lopatinka_os_bot`). BotFather ti vrátí **token** ve tvaru `1234567890:AAE...` — to je `TELEGRAM_BOT_TOKEN`.
2. **Napiš svému botovi** libovolnou zprávu (např. `ahoj`). Bez toho Telegram nedovolí botovi psát ti.
3. **Zjisti chat ID.** V prohlížeči otevři:

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

   Najdi `"chat":{"id":123456789,...}` — to číslo je `TELEGRAM_CHAT_ID`. (U skupiny je záporné, např. `-1001234567890`; bota do skupiny nejdřív přidej.)
4. **Vlož obě hodnoty do `.env`** v rootu projektu:

   ```bash
   TELEGRAM_BOT_TOKEN=1234567890:AAE...
   TELEGRAM_CHAT_ID=123456789
   ```

5. **Otestuj doručení:**

   ```bash
   node data/capabilities/agents/lopatinka/run.mjs
   ```

   Zpráva musí dojít do chatu. Když ne, uvidíš v terminálu přesný důvod (špatný token / chat ID / bot blokovaný).

Token nikdy necommituj — `.env` je v `.gitignore`.

### Bot mi neodpovídá / getUpdates je prázdné

Lopatinka **vlastního bota nemá** — veškerý Telegram provoz jde přes Mary Jane (`data/capabilities/agents/mary-jane/telegram-bot.mjs`, stejný `TELEGRAM_BOT_TOKEN`). Lopatinka jen posílá tipy přes `sendMessage`; kdo drží `getUpdates` a odpovídá na příkazy, je Mary. Když tedy botovi napíšeš `/lopatinka`, odpoví Mary — a její 👍/👎 u tipů zapisuje do `feedback.json` stejně jako dřív.

Rychlá diagnostika (přečte token z `.env`, nic tajného nevypíše):

```bash
node data/capabilities/agents/lopatinka/telegram-check.mjs
```

Skript zkontroluje platnost tokenu, jestli není nastavený webhook (ten `getUpdates` vypne) a vypíše chaty, které bot vidí — první číslo je `TELEGRAM_CHAT_ID`. Doručení ověříš takto:

```bash
node data/capabilities/agents/lopatinka/telegram-check.mjs --reply
```

Když je `getUpdates` prázdné i po tom, co jsi botovi napsal: zkontroluj, že píšeš botovi se stejným `@username`, jaký skript vypíše, a že je chat otevřený tlačítkem **START** (ne jen v seznamu kontaktů).

## Lokální běh

```bash
node data/capabilities/agents/lopatinka/run.mjs --dry-run   # test: jen vypíše zprávu a report
node data/capabilities/agents/lopatinka/run.mjs             # ostrý běh → Telegram
```

Nebo z UI/API: **Agenti → Lopatinka** a tlačítka „NÁHLED“ / „SPUSTIT A POSLAT DO TELEGRAMU“. API: `POST http://localhost:3001/api/agents/lopatinka/run` s body `{ "dryRun": true }`, stav pak `GET /api/agents/lopatinka/state`.

## Cloud (cron bez desktopu)

Workflow `.github/workflows/lopatinka.yml` běží 2× denně (7:00 a 16:00 Praha) a jde spustit i ručně (`workflow_dispatch`).

1. Pushni repo na GitHub.
2. **Settings → Secrets and variables → Actions** → přidej `TELEGRAM_BOT_TOKEN` a `TELEGRAM_CHAT_ID`.
3. Hotovo — agent nepotřebuje Ollamu ani běžící desktop.

Jiný cloud (VPS, Railway, Fly) stačí spustit stejnou věcí:

```bash
node data/capabilities/agents/lopatinka/run.mjs
```

## Ladění

Všechno se nastavuje v `config.json`:

| Klíč | Význam |
|---|---|
| `budgetCzk` | strop na kus (default 3500) |
| `preferredPriceCzk` | pásmo, odkud se berou hlavní tipy (2500–3500) |
| `minPriceCzk` | spodní hranice, aby se neposílaly 1 Kč aukce a šrot |
| `pickCount` | kolik hlavních tipů poslat (default 3) |
| `bonusPickCount` | kolik výhodných kousků přidat navíc (default 2) |
| `minDiscountPercent` | od kolika % slevy vs. medián je nabídka „silná“ |
| `queries` | co hledat (`notebook`, `grafická karta`, `monitor 27`, …) |
| `excludeKeywords` | příslušenství a šrot, které se nemá posílat |

Když chceš jen levné bazary, sniž `preferredPriceCzk` (např. `{ "min": 1200, "max": 3500 }`). Když chceš víc tipů, zvedni `bonusPickCount`.

Volitelné ENV: `LOPATINKA_BUDGET`, `LOPATINKA_PICK_COUNT`, `LOPATINKA_DRY_RUN=1`.

## Soubory

- `run.mjs` — celý agent, nula závislostí (Node 20+)
- `config.json` — rozpočet, pásmo, dotazy, portály, prahy
- `state.json` — poslední běh a tipy
- `audit.json`, `memory.json` — historie běhů (gitignore)
- `nabidky_*.md` — report konkrétního běhu
