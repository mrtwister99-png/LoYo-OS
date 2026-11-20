# 02_WORKFLOW.md: Jak pracuješ

## KROK 1 — Duplicity (HOTOVÝ, bez modelu)

| Krok | Co se děje |
|---|---|
| 1 | Načti `config.json` (zdrojová složka `dir`, cílové složky `targetFolders`) |
| 2 | Rekurzivně vylistuj obrázky v `dir`: `.png .jpg .jpeg .webp .bmp .gif .avif .tiff` — na rozdíl od Třídila, který bere jen kořen Downloads, ty jdeš i do podsložek, protože loot bývá v podsložkách |
| 3 | Přeskoč: skryté/systémové soubory, `desktop.ini`, a cokoliv uvnitř `data/kos/` |
| 4 | Parse názvu REKURZIVNĚ (odloupávej suffixy dokud to jde): `mec.png` → base=`mec`, num=0 · `mec (1).png` → num=1 · `mec (1) - kopie.png` → odloupni ` - kopie`, pak ` (1)` → base=`mec`, num=1 · `mec (1) (1) - kopie.png` → base=`mec` · `mec - kopie (1).png` → base=`mec` · `mec - copy (1).png` → base=`mec` |
| 5 | Seskup podle `(base_lower, ext_lower)`. V každé skupině ponech nejnižší num, zbytek k přesunu. Příklad: `mec.png` + `mec (1).png` + `mec (2).png` → zůstane `mec.png` · Jen `mec (1).png` + `mec (2).png` bez originálu → zůstane `(1)` |
| 6 | Dry-run: jen vrať plán, nic nepřesouvej. Naostro: přesuň do `data/kos/` (`rename`, přes disky `copy + unlink` jako u Třídila), při kolizi přidej ` (1)`, ` (2)` |
| 7 | Vytvoř v koši `presunute_YYYY-MM-DD_HH-MM-SS.txt`: hlavička (datum, zdroj, koš, počet) + řádky `původní -> koš | original: mec.png` |
| 8 | Ulož `state.json` (`lastRun`, `lastResult`) a vrať souhrn do UI |

## FÁZE 2 — Vision třídění (HOTOVÁ)
UI má pro každou cílovou složku **Název + Patří + Nepatří**. Patří / Nepatří se poskládají do promptu, starý `description` se bere jako Patří pro zpětnou kompatibilitu. Ty se poskládají do jednoho promptu pro Ollama vision model (default `moondream`, jde změnit v UI na např. `qwen2.5vl:7b` — musí být stažený: `ollama pull <model>`).

| Krok | Co se děje |
|---|---|
| 1 | Načti `config.json` (dir, targetFolders, visionModel, confidenceThreshold, belowThreshold) |
| 2 | Dovytvoř chybějící cílové složky (když chybí) |
| 3 | Vylistuj obrázky v `dir`, PŘESKOČ soubory co už jsou v cílové složce nebo v `data/kos/` — ty už jsou roztříděné |
| 4 | Přeskoč formáty co vision neumí: `.gif .avif .tiff` → důvod v logu |
| 5 | Pro každý obrázek: pošli base64 + prompt (všechny složky s popisy) do `ollama.chat({ model, images: [b64] })` — sekvenčně, ne paralelně |
| 6 | Model vrátí JSON `{ folder, confidence, reason }`. Neplatné JSON / neznámá složka → chyba / nízká jistota |
| 7 | `confidence >= práh` (default 60) → přesun do cílové složky (při kolizi ` (1)`, ` (2)`) · pod prahem → `belowThreshold = 'leave'` = nechat na místě, `'ostatni'` = přesunout do `ostatni` |
| 8 | Zapiš log `trideni_YYYY-MM-DD_HH-MM-SS.txt` do složky agenta + vrať souhrn do UI |

Model není stažený → běh se hned zastaví s hláškou `ollama pull <model>`, nemá cenu zkoušet další obrázky.

## Ruční spuštění
* UI: Agenti → Loot Checker → „ZKONTROLOVAT DUPLICITY“ (dry-run) / „PŘESUNOUT DO KOŠE“
* API: `POST http://localhost:3001/api/agents/loot-checker/run` body `{ dryRun: true/false }`

## Cílové složky — dovytvoření (FÁZE 2)
Když uživatel v UI zadá cílovou složku, co ještě neexistuje, služba ji dovytvoří: (1) hned při uložení configu (`POST /config`), (2) znovu při každém běhu před tříděním. `path` prázdné = `dir / name`, jinak ber `path` jak je. Bez toho by FÁZE 2 neměla kam přesouvat a selhala by.


## V5 - Behy na pozadi
1. UI POST /run nebo /sort -> API zalozí job, vrati jobId, hned odpovi.
2. API spusti runJobInBackground - vola runLootChecker / runPhase2Sort s onProgress, zapisuje progress do jobs/<id>.json.
3. UI polluje GET /jobs/:id kazde 2s, ukazuje KONTROLUJI / Pracuji + progress.
4. Po dokonceni: report .md do data/reports + job.json status done + saveChatMessage + logActivity.
5. Zavreni okna nic nezastavi. Po navratu UI GET /jobs a napoji se.
