# 02_WORKFLOW.md: Jak pracuješ

## Jeden běh

| Krok | Co se děje |
|---|---|
| 1 | Načti `config.json` (rozpočet, dotazy, portály, prahy). ENV `LOPATINKA_BUDGET` / `LOPATINKA_PICK_COUNT` mají přednost. |
| 2 | Pro každý dotaz z `queries` stáhni Sbazar: `https://www.sbazar.cz/hledej/<dotaz>?price-to=<rozpočet>` a parsuj karty `li[data-offer-id]` (název, cena, lokalita, odkaz). |
| 3 | Pro každý dotaz stáhni Aukro: `https://aukro.cz/vyhledavani?text=<dotaz>` a parsuj JSON-LD `ItemList` (název, cena, odkaz, kategorie). |
| 4 | Vyhoď: cenu mimo `<minPriceCzk, budgetCzk>`, nabídky bez shody s dotazem, příslušenství z `excludeKeywords` (obal, kryt, kabel, nabíječka…). |
| 5 | Spočítej medián cen pro daný dotaz (min. 3 vzorky; jinak ber všechny ceny včetně nad rozpočtem). `sleva = 1 - cena / medián`. |
| 6 | Seřaď podle slevy. Nejdřív ber nabídky se slevou `>= minDiscountPercent`, pak doplň zbytkovými. Střídej dotazy, aby 3 tipy nebyly ze stejné kategorie. |
| 7 | Vyber `pickCount` (default 3). Sestav Telegram zprávu (HTML). |
| 8 | Pošli `POST https://api.telegram.org/bot<token>/sendMessage` s `chat_id`, `parse_mode=HTML`, `disable_web_page_preview=true`. Delší text rozděl na části pod 4 000 znaků. |
| 9 | Zapiš `nabidky_YYYY-MM-DD_HH-MM-SS.md` do složky agenta, přepiš `state.json`, připoj záznam do `audit.json` a `memory.json`. |

## Výběr „výhodné“ nabídky
* **Medián** je reference trhu pro stejný dotaz — ne jedna konkrétní nabídka.
* Sleva 30 % a víc = silný tip. Do 15 % = jen doplnění do tří.
* Aukce s cenou 1 Kč se do průměru nepletou, protože `minPriceCzk` (default 200 Kč) je odřízne. Chceš-li je vidět, sniž `minPriceCzk` v `config.json`.
* Příslušenství se pozná podle `excludeKeywords`; pokud je slovo součástí dotazu (např. dotaz „nabíječka“), filtr se na něj nevztahuje.

## Co se stane, když portál neodpoví
* Fetch má 2 pokusy a timeout 20 s.
* Když jeden portál selže, agent pokračuje s druhým a chybu zapíše do reportu i do `state.json`.
* Když selžou oba a není co poslat, pošle Telegram zprávu „dnes nic / portály nedostupné“, aby uživatel věděl.

## Spuštění
```bash
node data/capabilities/agents/lopatinka/run.mjs --dry-run   # jen report + výpis, bez Telegramu
node data/capabilities/agents/lopatinka/run.mjs             # ostrý běh
POST http://localhost:3001/api/agents/lopatinka/run         # z UI / API, body { "dryRun": true }
```

## Cloud (cron)
`.github/workflows/lopatinka.yml` — schedule 2× denně + ruční `workflow_dispatch`.
Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Node 22, žádné `npm install` (nula závislostí).

## Soubory běhu
| Soubor | Význam |
|---|---|
| `config.json` | rozpočet, dotazy, portály, prahy — jediné místo k ladění |
| `state.json` | `lastRun`, `lastResult`, `lastPicks` |
| `audit.json` | každý běh: akce, počet kandidátů, výběr, chyby |
| `memory.json` | krátká paměť posledních běhů |
| `nabidky_*.md` | report běhu (top 3 + všichni kandidáti) |
