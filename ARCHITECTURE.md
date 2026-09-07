# LOYO OS — Architektura v3.0 — Manifest Pattern

> Interní dokument. Privátní, jednouživatelský, lokálně běžící OS.
> Verze: v3.0 (2026-09-07) — FÁZE 1 HOTOVO: migrace na `data/capabilities/`, kebab-case, DATA_DIR centralizace, 14denní rotace chat_history, SSE, scheduler, husky, redesign palety na hadr
> Stack: pnpm workspaces + Turborepo, React 18 + Vite + TS, Fastify API, Tauri v2 + Rust, packages/core Zod, Ollama qwen3:8b / qwen2.5-coder:3b

## 1. Filozofie — The Manifest Pattern

LOYO OS je **file-based, capability-based OS** s jedním zdrojem pravdy pro každý typ.

**Dogmata v3.0:**
1. **File-based > DB.** Vše je soubor v `data/`, verzovatelný Gitem, debuggovatelné, user vlastní data.
2. **Žádné polyglot peklo.** TS + Rust only. Žádný Python LangChain/CrewAI. Alternativa: Mastra, LangGraph.js, LlamaIndex.TS.
3. **Orchestrátor není switch.** Je to Controller s reputací, kontextem, delegací, audit trail.
4. **Všechno je Capability.** Agent, RAG, MCP, CLI, Workflow, Loop, Team, Skill = `manifest.json` validovaný Zod.

**Hlavní pravidlo:** `.tsx` nikdy nesahá na FS přímo — vždy přes REST API (`apps/api`) nebo přes Tauri `invoke()` do `main.rs`. REST je preferovaná cesta, protože je dostupné odkudkoliv (appka, builder, CLI).

## 2. Procesy (Launcher)

3 nezávislé procesy, startují společně přes `pnpm dev` nebo `.\start-loyo.ps1`:

| Proces | Popis | Port / komunikace |
|---|---|---|
| **TAURI** | Desktop appka (`apps/web` + `src-tauri`), Vite dev | `http://localhost:3000` |
| **API** | Fastify backend (`apps/api`), nezávislý na Tauri | `http://localhost:3001` |
| **MCP** | Model Context Protocol server (`apps/mcp`) | stdio (bez portu) |

Pád jednoho neshodí ostatní. Builder se může připojit jen na API (3001) bez desktopu.

## 3. Vrstvy a tok dat
UI (apps/web/src/pages/.tsx) — jen zobrazení │ fetch('/api/...') nebo Tauri invoke() ▼ REST API (apps/api/src/routes/.ts) — validace, Zod, jediný zdroj pravdy
│ fs/promises + dataPaths.ts DATA_DIR
▼
Data (data/capabilities/**/manifest.json + index.json + *.md)
│ packages/core/src/manifest/schema.ts — Zod CapabilityManifest
▼
Ollama (qwen3:8b / qwen2.5-coder:3b) + audit.json + reputation.json


**Rozdělení dnes (v3.0):**
- **Notes, Tasks, Kalendář** → Tauri `invoke()` (`list_notes/list_tasks/list_events`) + orchestrator `/note /task /kalendar` → `data/ja/*`
- **Agents, Activity, Runs, Capabilities** → REST API (`data/capabilities/agents/index.json`, `data/activity/feed.json`)
- **Teams, Loops, Workflows, MCP, Skills, CLI, RAG** → `data/capabilities/<type>/index.json` — Tauri `sync_*_from_fs`, postupně na REST
- **Chat / orchestrator** → REST `orchestrator.ts` — Mary Jane routing na Lubora/Julii nebo přímý zápis

Dlouhodobý cíl: sjednotit vše pod REST API + manifestLoader hot-reload.

## 4. Zdroj pravdy — v3.0 Manifest Pattern
data/capabilities/<type>/<kebab-id>/
├── manifest.json ← JEDINÝ ZDROJ PRAVDY (Zod validovaný)
├── 01_CORE_IDENTITY.md
├── 02_WORKFLOW.md
├── 03_GUARDRAILS.md
├── memory.json ← runtime, gitignore
└── audit.json ← každý krok: action, reasoning, confidence, timestamp, gitignore


| Doména | Soubor / zdroj | Kdo zapisuje | Kdo čte |
|---|---|---|---|
| Agenti | `data/capabilities/agents/index.json` + `*/manifest.json` | `main.rs` (`save_agent_to_fs`), `agent-new.ts`, `agentStats.ts` | `agents.ts` route, Dashboard, `manifestLoader.ts` |
| Poznámky | `data/ja/poznamky/*.md` | Tauri `save_note`, orchestrator `/note` | Tauri `list_notes` |
| Úkoly aktivní | `data/ja/ukoly/aktivni/*.md` | Tauri `save_task`, orchestrator `/task` | Tauri `list_tasks`, `/status` |
| Úkoly hotové | `data/ja/ukoly/hotove/*.md` | přesun po zaškrtnutí | Tauri `list_tasks`, `/status` |
| Kalendář | `data/ja/kalendar/*.md` | Tauri `save_event`, orchestrator `/kalendar` | Tauri `list_events` |
| Aktivita | `data/activity/feed.json` | `activity.ts` `logActivity` | `GET /activity` |
| Leady | `data/leads/*.json` | CLI `tools/cli/firmy` přes `/find` | Lubor, API — gitignore |
| Reporty | `data/reports/*.md` | `/research` Julia + web_search | ručně — gitignore |
| Run logy | `data/logs/runs/*.json` | `runLogger.ts` | `runs.ts` — gitignore |
| Chat historie | `data/chat_history/*_a/_b.json` + `audit.jsonl` | `chatHistory.ts` 14denní rotace | SSE `/api/chat/watch` — gitignore |
| Cache blobs | `data/cache/blobs/*.json` | workeři handle-based | workeři — gitignore, Fáze 3 |
| Reputation | `data/reputation/reputation.json` | orchestrator EWMA | orchestrator — Fáze 3 |
| Ostatní capability | `data/capabilities/<type>/index.json` | Tauri `sync_*_from_fs` | manifestLoader, Builder |

**Pravidlo:** při nesouladu vyhrává centrální `index.json` + `manifest.json` validovaný Zod v `packages/core/src/manifest/schema.ts`.

## 5. Orchestrator v3.0

`apps/api/src/services/orchestrator.ts` — nervová soustava.

- **Fast Path (Fáze 2):** `/note /task /kalendar /status` → přímo Mary Jane, bez LLM, bez DAG
- **Complex Path:** klíčová slova `analyzuj, research, vytvoř plán, porovnej` nebo `complex:true` → multi-worker DAG
- **Routing:** `/find` → Lubor (CLI firmy), `/research` → Julia (web_search → report)
- **Běžný chat:** MJ přes Ollama `qwen3:8b` + paměť `data/capabilities/agents/mary-jane/memory.json` (20 zpráv)
- **Audit:** každý run má `runId` → `data/logs/runs/` + `audit.json` v agentovi
- **Adversarial QA (Fáze 2/3):** výstup před odesláním projde `qwen2.5-coder:3b` — "najdi 3 chyby" → při chybě vrátí feedback původnímu agentovi

## 6. Manifest Loader + Schema

`packages/core/src/manifest/`:
- `schema.ts` — Zod `CapabilityManifest` discriminated union pro `agent|mcp|cli|rag|loop|workflow|team|skill` — id kebab-case, runtime `node|python|rust|prompt|ollama|composite`, permissions `fs:read/write:`, `net:fetch:`, `exec:`, reputation EWMA
- `loader.ts` — projde `data/capabilities/**/manifest.json`, validuje, dynamicky registruje routy/schopnosti, hot-reload přes FS watcher
- `templates/agent/manifest.json.tmpl` — šablona pro `pnpm agent:new`

`tools/scripts/`:
- `agent-new.ts` — CLI generátor s TYPE_DIR_MAP, flagy `--model --runtime --specialization`, validace
- `manifest-check.ts` — pre-commit Zod validace

## 7. MCP — připraveno, propojení ve Fázi 2

`apps/mcp/src/tools/index.ts` = `[]` — skořápka. Propojení s orchestratorem je úkol Fáze 2: orchestrator spustí MCP server přes stdio a routuje na něj nástroje.

## 8. Konvence v3.0

- **Cesty:** vždy přes `DATA_DIR` z `apps/api/src/lib/dataPaths.ts` — nikdy hardcoded `../../data`. `LOYO_DATA_DIR` env v `tauri.conf.json` + `main.rs`.
- **ID:** kebab-case `mary-jane`, `lubor-nehleda`, `kosterad-fuckstein`
- **Indexy:** `data/capabilities/<type>/index.json` — jediný registr typu
- **Rust:** `serde rename_all = camelCase`
- **Formáty:** `/note NECO.xx` → název+popis, `/task NECO.xx,yy,zz` → checklist do `aktivni/`, `/kalendar DD.MM.RRRR HH:MM popis`
- **Komentáře česky, kód anglicky**
- **Opravy jako OZNAČ/VLOŽ diff**, ne celé soubory

## 9. Barvy appky v3.0 — Hadr / Papír

Nová paleta (2026-09-07):

- `bg #ededed` — hlavní plátno, papír
- `head bottom #dbdbdb` — header, bottom, menu panel, proužky
- `modrá #040b8d` — primární akce, aktivní stav, FIRMA group
- `červená #ac0001` — destruktivní, CONFIGURATION group
- `karamelová #CDA24D` — focus, akcent, tečky, hover

Staré #0057F7/#BD0000/#7A7A7A nahrazeny. Černá odstraněna z Menu/Bottom/Layout, nahrazena #dbdbdb/#ededed s jemným grain overlay.

## 10. Co bylo vyřešeno ve Fázi 1 (v1.6 → v3.0)

- ✅ `data/agents/` → `data/capabilities/agents/` migrace, `Frantisek_Tbridil` + `Kosterad_Fuckstein` sjednoceno
- ✅ `AGENTS_BASE` v main.rs → `data/capabilities/agents`, id generování kebab-case, `prompt → prompt_file`
- ✅ `Projekty.tsx` smazán (nahrazeno jinak)
- ✅ `turbo.json` `json.schemaDownload.enable: false` fix, `TASKS_BASE` dead code smazán
- ✅ `DATA_DIR` centralizace + `LOYO_DATA_DIR` env, `dataPaths.ts` jediný zdroj cest
- ✅ `chat_history` 14denní rotace `_a/_b` + `audit.jsonl` appendFile, `pendingNotifications` persistence
- ✅ SSE `/api/chat/watch` + `/api/capabilities/watch`, `fs.watch(dataDir)` fix
- ✅ husky + lint-staged + `manifest:check` pre-commit
- ✅ `agentStats.ts` `getAgentStats+resetDailyStats` + půlnoční cron v `scheduler.ts`
- ✅ Menu CLI v `MENU_STRUCTURE`, Layout `onOpenBuilderMenu+onOpenMobil`, Agents overlay, Header/Chat lastMessage callback

## 11. Plán — Fáze 2-4

**Fáze 2 (2-3 týdny) — Lehký Agent Stack 3.0 — TEĎ:**
- schema.ts final, manifestLoader hot-reload, orchestrator Fast Path + QA hook, Builder.tsx React Flow wizard, cache/blobs + reputation příprava, MCP propojení, GitHub push

**Fáze 3 (2 týdny):** QA reviewer adversarial, EWMA reputation produkce, handle-based sharing, Fast Path 3b vs 8b

**Fáze 4 (1-2 měsíce):** Teams manifest, RAG LlamaIndex.TS, self-tooling sandbox `data/cache/draft_tools/`, `tools/sandbox/`

**Fáze ONLINE (později):** mobilní appka chat s Mary přes API 3001, auth, sync `data/ja/`