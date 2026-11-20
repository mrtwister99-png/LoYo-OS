# LOOT CHECKER KNOWLEDGE

## Kde co je — přesně jako u Třídila, žádná `ui/` složka v agentovi
- Konfigurace: `data/capabilities/agents/loot-checker/config.json`
- Stav: `data/capabilities/agents/loot-checker/state.json`
- Prompty: `01_CORE_IDENTITY.md`, `02_WORKFLOW.md`, `03_GUARDRAILS.md`
- Logika: `apps/api/src/services/lootChecker.ts` (`runLootChecker()`, `findDuplicates()`)
- API: `apps/api/src/routes/lootChecker.ts` → registrace v `apps/api/src/index.ts` (viz `index-PATCH-loot-checker.txt`)
- UI: `apps/web/src/components/LootCheckerPanel.tsx` — NENÍ v agentovi, je v `apps/web/src/components/` jako `TridilPanel.tsx`
- Napojení UI: `apps/web/src/pages/Agents.tsx` → řádek `{selectedAgent.id === 'loot-checker' && <LootCheckerPanel />}` hned pod řádek s `tridil` (viz `Agents-PATCH-loot-checker.txt`)
- Koš: `data/kos/` — už existuje v projektu jako prázdná složka, `.gitkeep` ji drží v gitu. V kódu vždy `join(DATA_DIR, 'kos')`, nikdy hardcode `D:/...`.

## Proč NENÍ `ui/` v agentovi
Žádný agent v `data/capabilities/agents/*` nemá `ui/` složku. UI patří do `apps/web/src/components/`, logika do `apps/api/src/services/`. Agent je jen prompt + config + state.

## Proč NENÍ Python ani Next.js
- Projekt nemá Python runtime — vše je Node/TS (`apps/api` Fastify + `apps/web` Vite + React + Tauri).
- Projekt nemá Next.js — web je Vite, stránky jsou `apps/web/src/pages/*.tsx`, API je Fastify na `http://localhost:3001`, frontend volá `http://localhost:3001/api/...`, Vite proxy `/api -> 3001`.

## Rozdíl Loot Checker vs Třídil
- Třídil: třídí Downloads podle **přípony**, jen kořen složky, běží v noci 00:00.
- Loot Checker: KROK 1 hledá **duplicity podle názvu (1)(2)**, rekurzivně, přesouvá do `data/kos/` + `.txt`. KROK 2 bude třídit podle **obsahu obrázku** (vision model + Název/Popis z UI). Nekolidují — Třídil sahá do Downloads, Loot Checker do složky z `config.json` (`dir`).

## FÁZE 2
- Logika: `apps/api/src/services/lootChecker.ts` → `runPhase2Sort()` — `ollama.chat({ model, images: [base64] })`, model default `moondream`, prompt se staví z `targetFolders` (Název + Popis).
- API: `POST /api/agents/loot-checker/sort` body `{ dryRun, model, threshold }`, config: `POST /api/agents/loot-checker/config` umí i `visionModel`, `confidenceThreshold`, `belowThreshold`.
- UI: `LootCheckerPanel.tsx` → sekce FÁZE 2: vision model, práh, pod prahem, tlačítka ZKONTROLOVAT TŘÍDĚNÍ / TŘÍDIT OBRÁZKY.
- Log: `data/capabilities/agents/loot-checker/trideni_*.txt`. Soubory už v cílové složce se znovu netřídí.

## V4.1 UI
- Vision model je select: moondream / qwen2.5vl:7b, ukládá se hned při výběru.
- Cílová složka má 2 pole: Patří (belongs) + Nepatří (notBelongs). Backend je spojí do promptu, description se drží v syncu pro staré configy.
- Smazáno: hláška 'Nejdřív spusť FÁZI 1...' a hláška 'Když model chybí, ollama pull...'.

## V4.3 Animace tlacitek
- KONTROLUJI: po kliku na ZKONTROLOVAT DUPLICITY / ZKONTROLOVAT TRIDENI se text zmeni na KONTROLUJI. -> .. -> ... -> . dokola (450ms), zelena barva #22c55e, az to dodela vrati se zpet na puvodni text.
- Pracuji: po kliku na PRESUNOUT DO KOSE / TRIDIT OBRAZKY se text zmeni na Pracuji. -> .. -> ... -> . dokola, cervena barva #ff5555, az to dodela vrati se zpet.
- Behem behu jsou vsechny 4 tlacitka disabled, aby neslo spustit dve veci najednou.

## V4.4 Persistencia slozek
- ULOZIT SLOZKY zapisuje do data/capabilities/agents/loot-checker/config.json + zalohu do localStorage (klic loot-checker-targetFolders). Pri nacitani: kdyz API vrati prazdne slozky a zalohaha existuje, UI ji obnovi a zapise zpet na disk.
- Zip od V4.4 config.json NEOBSAHUJE, jen config.example.json - rozbaleni nove verze uz nikdy neprepise uzivatelovy slozky. Prazdne radky se pred ulozenim filtruji, at jeden nevyplneny radek neshodi cele ulozeni (400).
- UI po ulozeni ukazuje: pocet slozek, nazvy, cas ulozeni, text ze zustanou i po restartu.

## V4.5 ULOZIT = vytvorit
- Tlacitko prejmenovano na ULOZIT + VYTVORIT SLOZKY. Klik = zapis do config.json + localStorage + ensureTargetFolders() na backendu (vytvori chybejici slozky pod dir). API vraci createdFolders, UI je ukaze: Vytvoreno na disku: X nove slozky (...) nebo Vsechny slozky uz existuji. Chyba vytvoreni se ukaze jako ✕.

## V5 Pozadi + Chat + Aktivity (fix zavreneho okna)
- POST /run a /sort uz neceka na dokonceni. Jen zalozí job (jobs/<id>.json) a hned vrati jobId. Frontend polluje GET /jobs/:id kazde 2s.
- Job bezi na API, ne ve frontendu - zavreni okna agenta ho nezastavi. Po navratu panel nacte GET /jobs, napoji se na bezici job (banner BEZI NA POZADI + progress bar + aktualni soubor) a ukaze posledni dokonceny vysledek + report.
- Po dokonceni job vzdy zapise: .md report do data/reports + job.json + zpravu do chatu (saveChatMessage mary) + aktivitu (logActivity Loot_Checker). I kdyz se okno zavre, report + chat + aktivita zustanou.
- Reporty obnoveny (V4.2 se ztratil pri kopirovani): FÁZE 1 duplicity_*.md, FÁZE 2 trideni_*.md, s overenim ze cile existuji a sekci Nic nebylo smazano.
- Progress: onProgress(done,total,current) se propisuje do job.json.
- sync=true = stary synchronni rezim pro CLI.
