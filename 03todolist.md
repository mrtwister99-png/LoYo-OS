## TODO list — LOYO OS — FÁZE 1 ✅ + FÁZE 2 PRŮBĚŽNĚ — stav 2026-09-11

### ✅ FÁZE 1 - KRITICKÉ - HOTOVO 100% (2026-09-05 až 2026-09-07)
- [x] data/agents/ → data/capabilities/agents/ migrace + kebab-case
- [x] index.json všechna id opravena + agents.ts čte z capabilities
- [x] main.rs AGENTS_BASE + kebab-case gen + prompt_file + LOYO_DATA_DIR env + list/save/delete_event + sync_agents
- [x] manifest.json.tmpl + agent-new.ts TYPE_DIR_MAP + --model/--runtime/--specialization + validace
- [x] agentStats.ts getAgentStats+resetDailyStats null-safe + scheduler půlnoční cron
- [x] dataPaths.ts DATA_DIR konstanty + tauri.conf.json LOYO_DATA_DIR
- [x] pendingNotifications persistence + tick() → scheduler.ts + type reminder|daily-brief|system
- [x] chatHistory.ts 14denní rotace _a/_b + audit.jsonl appendFile
- [x] SSE /api/chat/watch + /api/capabilities/watch + fs.watch fix
- [x] turbo.json json.schemaDownload.enable:false + husky pre-commit + manifest:check
- [x] Menu.tsx CLI + šipky fix + Page typ + Layout onOpenBuilderMenu/onOpenMobil
- [x] Agents.tsx NOVÝ AGENT overlay + ULOŽIT ZMĚNY save_agent_to_fs
- [x] AgentBuilder API volání místo Tauri invoke
- [x] Header.tsx rebuild props + Chat.tsx lastMessage callback
- [x] Projekty.tsx smazán, Tasks aktivni/hotove, Notes file-backed, Calendar grid

### ✅ ÚKOL 3,7,7.1,8 - SQLite + Search + GitAuto - HOTOVO 2026-09-11
- [x] ÚKOL 3: `node:sqlite` bez native bindings - odstraněn better-sqlite3, použit `node:sqlite` experimental, WAL mode, `data/index.db` generováno
- [x] ÚKOL 7: SQLite FTS5 - `manifestDb.ts` - table capabilities + virtual table capabilities_fts FTS5, triggers after insert/update/delete, search() <10ms, `index.db ready → 5 capabilities`
- [x] ÚKOL 7.1: `?search=mary` fix - `capabilities.ts` - count:1 místo duplikátů, test `?search=mary` → 1 výsledek
- [x] ÚKOL 8: Git auto-commit - `gitAutoCommit.ts` - `isomorphic-git` + `http/node` client, `add()` + `statusMatrix()` STAGE 2/3 filter, `commit()` LOYO OS Bot, optional `push()` na origin/main s `GITHUB_TOKEN`, debounce 5s, `autoCommitInBackground()` voláno po reindexu
- [x] Fix `isomorphic-git` instalace - `apps/api/package.json` name `api` ne `@loyo/api`, `pnpm add isomorphic-git` v `apps/api`, přidán `@ts-ignore` pro http/node typy
- [x] Dev script `dev:api:clean` - `tools/scripts/dev-api-clean.ts` - kill port 3001 přes netstat (ne všechny node.exe), rm data/index.db*, spawn pnpm --filter api dev, package.json root `dev:api` + `dev:api:clean`
- [x] Ověřeno: `pnpm dev:api:clean` → [loader] found 5 caps, 0 errors [julija, kosterad, lubor, mary-jane, firmy] + [manifestDb] index.db ready + [scheduler] started + [gitAuto] committed (když změny)

### ⏳ FÁZE 2 - Lehký Agent Stack 3.0 (2-3 týdny) - PRŮBĚŽNĚ
Pořadí aktualizováno po SQLite:

1. **schema.ts - finalizovat Zod CapabilityManifest** [NEJKRITIČTĚJŠÍ - ZBÝVÁ]
   - pokrýt: agent | rag | mcp | cli | skill | workflow | loop | team
   - pole: id kebab-case, type, version semver, runtime ollama|node|rust, model, entrypoint, permissions fs:read/write net:fetch, reputation, freshness_ttl_hours
   - soubor: `packages/core/src/manifest/schema.ts`

2. **manifestLoader.ts - hot-reload** [ČÁSTEČNĚ - manifestDb.ts hotovo]
   - ✅ FS scan + Zod validace + SQLite cache
   - ⏳ FS watcher na změny manifestů, invalidate cache + autoCommit

3. **orchestrator.ts - Fast Path + Adversarial QA základ** [ZBÝVÁ]
   - Fast Path: /note /task /kalendar → rovnou Mary Jane bez DAG
   - Complex flag: pokud "analyzuj, research, plán, porovnej" → multi-worker DAG
   - QA hook placeholder: volání qwen2.5-coder:3b "najdi 3 chyby"

4. **Builder.tsx - Visual wizard** [ZBÝVÁ]
   - React Flow plátno: levý panel komponenty z manifestů, prostředek DAG, pravý editor manifest.json + MD
   - Uložení → zapíše do data/capabilities/ → hot-reload ho vidí → gitAuto commit

5. **data/cache/blobs/ + data/reputation/ - příprava F3** [ZBÝVÁ]
   - založit prázdné složky +.gitkeep
   - blob: worker uloží {uuid}.json, vrátí handle
   - reputation.json struktura: { agentId: { taskType: { success, fail, avgConfidence, ewma } } }

6. **apps/mcp/ propojení s orchestrator.ts** [ZBÝVÁ]
   - tools/index.ts naplnit browser_use + propojit do orchestrator routy

7. **GitHub cleanup + push** [DALŠÍ KROK]
   - vyčistit dist/.turbo/target/node_modules/data/agents/Projekty.tsx
   - `pnpm build` verify
   - commit ÚKOL 3,7,7.1,8 + dev:api:clean
   - aktualizovat README + ARCHITECTURE +.gitignore (index.db* už gitignored)

### FÁZE 3 (2 týdny po F2)
- QA reviewer agent adversarial + EWMA reputation produkce + Fast Path 3b vs 8b model + handle-based sharing produkce
- `GET /api/git/log` endpoint pro zobrazení auto-commitů v Agents.tsx

### FÁZE 4 (1-2 měsíce)
- Teams manifest, RAG LlamaIndex.TS, tools/sandbox self-tooling, tools/cli/firmy produkce

---
Aktuální stav 2026-09-11 10:30:
- API běží na :3001, 5 caps, index.db ready, scheduler started
- dev:api:clean funguje (kill :3001, ne self-kill)
- isomorphic-git 1.35+ v apps/api/package.json
- další krok: `git status` + `git log --oneline -5` + `pnpm build` + push
