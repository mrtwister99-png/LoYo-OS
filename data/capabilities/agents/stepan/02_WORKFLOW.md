# 02_WORKFLOW.md: Jak pracuješ

## Jeden běh

| Krok | Co se děje |
|---|---|
| 1 | Načti vstup: `--item` / `STEPAN_ITEM` (volný popis věci) a volitelně `--condition`. |
| 2 | Načti `config.json` (portály, prahy, koeficienty stavu, nastavení inzerátu). |
| 3 | Z popisu vyhoď balast (`prodám`, `stav`, `dohodou`, `% baterie`…) a postav dotaz na trh — max `maxQueryTokens` tokenů. |
| 4 | Urči stav: explicitní `--condition`, jinak detekce z textu (`nový`, `jako nový`, `opotřebený`, `na díly`), jinak `defaultCondition`. |
| 5 | Stáhni Sbazar (`/hledej/<dotaz>`) a Aukro (`/vyhledavani?text=<dotaz>`). Ceny filtruj lokálně. |
| 6 | Filtruj srovnatelné: musí sedět všechny tokeny s číslem (model, kapacita), aspoň jedno slovo názvu a nesmí to být příslušenství z `excludeKeywords`. |
| 7 | Když je srovnatelných méně než `minComparableCount`, zkus obecnější dotaz (4 → 3 → 2 tokeny). |
| 8 | Spočítej cenu: medián trhu (po odstranění extrémů), doporučená = medián × koeficient stavu, zaokrouhleno na `roundingCzk`; rychle = × `quickSaleFactor`, když počkáš = × `patientSaleFactor`. |
| 9 | Napiš inzerát: titulek z prvního segmentu popisu, detail ze zbytku popisu, stav, cena, předání/doprava. |
| 10 | Zapiš `inzerat_YYYY-MM-DD_HH-MM-SS.md`, `state.json` (+ `lastChatText`), `audit.json`, `memory.json`. |
| 11 | API pošle `lastChatText` do UI chatu (stejný kanál jako Lopatinka). |

## Jak se počítá cena
* **Medián** = referenční trh pro daný model. Průměr nepoužívej — přetahují ho extrémní nabídky.
* Při 5+ nabídkách se odstraní ceny mimo rozsah `medián/3 … medián×3` (aukce za 1 Kč, nesmyslně nadhodnocené kusy).
* **Koeficient stavu** posouvá medián: nový 1,10 · jako nový 1,02 · velmi dobrý 0,95 · dobrý 0,88 · opotřebený 0,75 · na díly 0,55.
* **Rychlý prodej** = doporučená − 10 %, **když počkáš** = doporučená + 10 %.
* Méně než `minComparableCount` nabídek = `lowConfidence` — cena je jen orientační a musí to být vidět.

## Co se stane, když portál neodpoví
* Fetch má 2 pokusy a timeout 20 s.
* Jeden portál může selhat, druhý běh dokončí; chyba jde do reportu, `state.json` i do chatu jako poznámka.
* Když se nenajde nic srovnatelného, inzerát se napíše s `Cena: doplň.` — žádný vymyšlený odhad.

## Spuštění
```bash
node data/capabilities/agents/stepan/run.mjs --item "iPhone 13 128 GB, baterie 89 %"
node data/capabilities/agents/stepan/run.mjs --item "PlayStation 5 Slim" --condition jako-novy
POST http://localhost:3001/api/agents/stepan/run   # body { "item": "…", "condition": "dobry" }
```

## Soubory běhu
| Soubor | Význam |
|---|---|
| `config.json` | portály, prahy, koeficienty stavu, text inzerátu — jediné místo k ladění |
| `state.json` | poslední věc, ceny, inzerát, srovnatelné nabídky, `lastChatText` |
| `audit.json` | každý běh: věc, stav, počet srovnatelných, doporučená cena |
| `memory.json` | krátká paměť posledních ocenění |
| `inzerat_*.md` | report běhu: cena, inzerát, tabulka srovnatelných nabídek |
