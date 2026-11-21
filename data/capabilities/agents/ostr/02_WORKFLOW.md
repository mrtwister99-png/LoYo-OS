# 02_WORKFLOW.md: Jak pracuješ

## Kontrola ceny (`--check` / `mode: "check"`)

| Krok | Co se děje |
|---|---|
| 1 | Vstup: `OSTR_ITEM` / `--check` (věc nebo celý text inzerátu), volitelně `OSTR_PRICE` / `--price`. |
| 2 | Titulek = první řádek před čárkou, bez „prodám / nabízím“ a bez ceny. Z něj se staví dotaz. |
| 3 | Cena: explicitní, jinak se najde v textu (`9 500 Kč`, `9.500,-`, `cena 9500`). |
| 4 | `scanMarket` (`data/lib/market.mjs`): Sbazar + Aukro, od 4 tokenů → 3 → 2, dokud nejsou ≥ 3 srovnatelné. |
| 5 | Filtr srovnatelných: všechny číselné tokeny, aspoň jedno slovo, žádné příslušenství (`excludeKeywords`), žádná jiná varianta (`variantKeywords`: mini, pro, max, ti…). |
| 6 | `priceStats` (`data/lib/pricing.mjs`): ořez extrémů, medián, p25, p75. |
| 7 | Verdikt (viz tabulka níže) + protinabídka + max. 3 levnější nabídky. |
| 8 | Varovná slova (`redFlagKeywords`) v textu. Když jsou a cena je nízká, verdikt dostane 🚩. |
| 9 | Zápis: `kontrola_*.md`, `state.json` (`check`, `lastChatText`), `audit.json`. |

### Verdikt

| Cena vs. trh | Verdikt |
|---|---|
| < medián × `suspiciousBelowMedian` (0,45) | 🚩 Podezřele levné |
| ≤ 25. percentil | 🟢 Výhodné |
| ≤ 75. percentil | 🟡 Férové, protinabídka = p25 |
| ≤ maximum trhu | 🟠 Předražené, protinabídka = medián |
| > maximum trhu | 🔴 Nad celým trhem |

## Hlídání (`--watch` / `mode: "watch"`)

| Krok | Co se děje |
|---|---|
| 1 | Načti `watchlist.json` (`items[]`: `id`, `query`, `targetPrice`, `active`). |
| 2 | Pro každou věc `scanMarket` + `priceStats`. |
| 3 | Nejlevnější **poctivá** nabídka = nejlevnější nad hranicí podezření. Podezřelé se jen počítají. |
| 4 | Porovnání s posledním záznamem v `history.json`. |
| 5 | Upozornění: 🎯 nejlevnější ≤ cíl · 📉/📈 změna mediánu ≥ `alertDropPercent` (5 %) · 🆕 nová nejlevnější (jiná URL, nižší cena) · 🚩 podezřelé kusy. |
| 6 | Do `history.json` jde nový bod (max `historyLimit` = 90 na věc). |
| 7 | Chat: nejdřív věci s novinkou, pak zbytek. Odkaz jen u 🎯 a 🆕. |
| 8 | Zápis: `hlidani_*.md`, `state.json` (`watch`, `lastChatText`), `audit.json`. |

## Watchlist
* `--add "věc" --target 4500`: přidá věc, nebo aktualizuje cíl, když už tam je (porovnává se bez diakritiky).
* `--remove <id nebo název>`: odebere.
* API: `POST /api/agents/ostr/watchlist` `{ query, targetPrice? }` · `POST /api/agents/ostr/watchlist/remove` `{ id }`.

## Když portál neodpoví
* 2 pokusy, timeout 20 s. Při 403/429 se portál do konce běhu přeskočí.
* Chyba jednoho portálu nezastaví druhý a ukáže se v chatu jako poznámka.
* Bez srovnatelných nabídek: žádný verdikt, jen „nevím, zkus přesnější model“.

## Exit kódy
* `0` OK · `2` špatný vstup (zpráva jde i do `lastChatText`) · `1` pád (detail v `audit.json`).

## Soubory
| Soubor | Význam |
|---|---|
| `config.json` | prahy verdiktu, hlídání, varovná slova, varianty, stopwords. Jediné místo k ladění. |
| `watchlist.json` | co hlídám a za kolik |
| `history.json` | časová řada trhu pro každou hlídanou věc |
| `state.json` | poslední kontrola / hlídání + `lastChatText` |
| `audit.json` | každý běh a každá změna watchlistu |
| `kontrola_*.md`, `hlidani_*.md` | reporty běhů |
