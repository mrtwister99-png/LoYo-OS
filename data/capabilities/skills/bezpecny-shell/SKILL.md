# Bezpečný shell

Pravidla pro terminál (`/terminal`, `/ps`) a příkazy agentů (`| ps:` / `| cmd:`).
Vynucuje je kód (`apps/api/src/services/shellPolicy.ts`), pravidla jsou v `rules.json` vedle — uprav je tam.

## Tři úrovně
- **⛔ Zakázané** — nespustí se nikdy, ani s potvrzením: formát disku, oddíly, zavaděč, mazání záloh,
  `iwr … | iex` (spuštění kódu z internetu), mazání kořene disku / Windows / Program Files, systémový registr,
  mazání účtů, vypnutí antiviru / firewallu.
- **⚠ S potvrzením** — Mary se zeptá a spustí až po `/ano <kód>` (platí 10 minut, jen jednou):
  mazání, přesun, přepis souboru (`>`), ukončení procesu, vypnutí / restart PC, registr, služby,
  instalace (winget, npm, pip…), nevratné git operace (`push`, `reset --hard`…), stahování souborů.
- **✓ Volné** — všechno ostatní: výpisy (`dir`, `Get-ChildItem`), čtení, `cd`, `git status`, spouštění skriptů…

## Pro agenty
- Agent nikdy nespouští zakázané příkazy a nesnaží se pravidla obejít (base64, skládání řetězců…).
- U potvrzovaných příkazů vždy napiš, co přesně se stane, a počkej na `/ano`.
- `/ne <kód>` potvrzení zahodí. Seznam čekajících: `/ano`.
