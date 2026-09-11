## Struktura projektu — LOYO OS — stav 2026-09-11 — FÁZE 1 + SQLite + GitAuto HOTOVO

D:\dev\loyo-os\
├──.gitignore /.env /.env.example
├── ARCHITECTURE.md / README.md / PROJECT.md / 04project.md
├── 02struktura.md / 03todolist.md
├── package.json ✅ dev:api + dev:api:clean script / pnpm-lock.yaml / pnpm-workspace.yaml
├── tsconfig.json / turbo.json ✅ json.schemaDownload.enable: false
├── start-loyo.ps1
├──.husky\pre-commit ✅ husky + lint-staged + manifest:check
│
├── data\ ✅ file-based persistence - jediný zdroj pravdy
│ ├── capabilities\ ✅ MANIFEST PATTERN
│ │ ├── agents\index.json ✅ 4 agenti kebab-case
│ │ │ ├── julia-nehledalova\ ✅ manifest.json + 01_CORE + 02_WORKFLOW + 03_GUARDRAILS + memory + audit
│ │ │ ├── kosterad-fuckstein\ ✅
│ │ │ ├── lubor-nehleda\ ✅
│ │ │ └── mary-jane\ ✅ + commands.json + scheduler_state.json
│ │ ├── cli\firmy\manifest.json ✅ 5. capability celkem
│ │ ├── mcp\index.json ✅ prázdný, čeká na browser_use
│ │ ├── loops\index.json ✅
│ │ ├── teams\index.json ✅
│ │ ├── workflows\index.json ✅
│ │ └── skills\index.json ✅
│ ├── chat_history\ ✅ 14denní rotace _a/_b + audit.jsonl
│ ├── current_state\WEEK_FOCUS.md
│ ├── ja\poznamky\ + ukoly\aktivni\ + ukoly\hotove\ + kalendar\ ✅ Tasks split
│ ├── notifications\voda.md + _pending.json ✅ persistence
│ ├── rag\index.json ✅ collections:[]
│ ├── specs\ares\AresRestApi-verejne-1_3_0.json
│ ├── reports\ ✅ živě plněno Julia /research
│ ├── leads\ ⚠ gitignore - generovaná data
│ ├── logs\runs\ ⚠ gitignore - běhy
│ ├── cache\blobs\ ⏳ Fáze 3 - handle-based sharing
│ ├── reputation\reputation.json ⏳ Fáze 3 - EWMA skóre
│ ├── index.db ✅ SQLite FTS5 cache - generováno z capabilities, <10ms search, gitignored
│ ├── index.db-wal ✅ WAL mode - gitignored
│ └── index.db-shm ✅ shared memory - gitignored
│
├── apps\
│ ├── api\src\
│ │ ├── index.ts ✅ routes: agents/activity/runs/teams/workflows/loops/mcp/rag/notifications/capabilities/cli + SSE /api/chat/watch + /api/events
│ │ ├── lib\
│ │ │ ├── dataPaths.ts ✅ DATA_DIR jediný zdroj cest, resolve z __dirname + LOYO_DATA_DIR env
│ │ │ ├── manifestDb.ts ✅ ÚKOL 7 HOTOVO: node:sqlite experimental, WAL, capabilities table, capabilities_fts FTS5, triggers insert/update/delete, search() MATCH, count:1 fix
│ │ │ ├── gitAutoCommit.ts ✅ ÚKOL 8 HOTOVO: isomorphic-git add + statusMatrix STAGE 2/3 + commit LOYO OS Bot + optional push http/node + debounce 5s + autoCommitInBackground()
│ │ │ └── manifestLoader.ts ✅ loader s Zod validací
│ │ ├── routes\
│ │ │ ├── capabilities.ts ✅ ÚKOL 7.1 HOTOVO: GET /api/capabilities?search=mary → FTS5 <10ms, count fix
│ │ │ ├── agents.ts ✅ čte capabilities/agents/index.json
│ │ │ └── ... activity, runs, teams, workflows, loops, mcp, rag, notifications, cli
│ │ └── services\ ✅ agentStats + chatHistory 14d rotace + audit.jsonl + fileUtils + finder + manifestLoader + orchestrator + runLogger + scheduler + web_search
│ ├── mcp\src\ ⚠ NENÍ propojeno s orchestrator.ts - samostatný krok Fáze 2
│ │ └── tools\index.ts ✅ tools=[] prázdné
│ └── web\src\
│ ├── App.tsx ✅ PAGE_TITLES.kalendar, Builder externalOpen/onExternalClose, useAppState
│ ├── components\
│ │ ├── builder\AgentBuilder.tsx ✅ wizard, overlay z Agents.tsx
│ │ ├── Chat.tsx ✅ SSE EventSource /api/chat/watch
│ │ ├── Header.tsx ✅ onOpenBuilderMenu + onOpenMobil
│ │ ├── Layout.tsx ✅ Tab cyklus 0-9
│ │ ├── Menu.tsx ✅ šipky kontrast fix + CLI v MENU_STRUCTURE
│ │ └── Builder.tsx ✅ importy fix
│ ├── pages\ ✅ Dashboard živě API + apiDown, Activity, Calendar grid + modal, Tasks aktivni/hotove, Notes file-backed, Agents overlay + save_agent_to_fs
│ └── src-tauri\src\main.rs ✅ AGENTS_BASE=data/capabilities/agents, LOYO_DATA_DIR env, kebab-case
│
├── packages\core\src\manifest\
│ ├── schema.ts ⏳ Fáze 2 - finalizovat Zod CapabilityManifest pro agent|rag|mcp|cli|skill|workflow|loop|team
│ ├── loader.ts ✅ načítá manifesty
│ ├── types.ts / index.ts
│ └── templates\agent\manifest.json.tmpl ✅
│
└── tools\
    ├── scripts\
    │ ├── agent-new.ts ✅ TYPE_DIR_MAP, --model/--runtime/--specialization, fix cli/ ne clis/
    │ ├── manifest-check.ts ✅ Zod validace
    │ └── dev-api-clean.ts ✅ NOVÝ 2026-09-11: kill port 3001 (netstat+taskkill PID, ne všechny node.exe), rm data/index.db*, spawn pnpm --filter api dev
    └── cli\firmy\index.ts + package.json

LEGENDA: ✅ hotovo F1 + SQLite+GitAuto | ⏳ Fáze 2/3 | ⚠ gitignore / nepropojeno
Počet capabilities: 5 (4 agents + 1 cli) - verified `pnpm dev:api:clean` → [loader] found 5 caps, 0 errors
Smazáno v F1: data/agents/ (migráno), Projekty.tsx, TASKS_BASE dead code
