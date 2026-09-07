# LOYO OS v3.0 — Manifest-driven Capability OS

Privátní, lokálně běžící agentní operační systém — desktop appka (Tauri v2 + React) + REST API (Fastify) + MCP server + Ollama lokálně, postavený na **Manifest Patternu** — všechno je Capability s `manifest.json` validovaným Zod.

Žádný externí přístup se neplánuje, systém je pro jednoho uživatele. Data jsou file-based v `data/`, verzovatelná Gitem.

> Detailní architektura, dogmata, manifest pattern → viz [`ARCHITECTURE.md`](./ARCHITECTURE.md)
> Struktura projektu → `02struktura.md`, TODO → `03todolist.md`, Vize → `04project.md`

## Co to je v3.0

LOYO OS spravuje tým AI agentů (Mary Jane, Lubor Nehleda, Julia Nehledalová, Koštěrad Fuckstein), kteří se starají o poznámky, úkoly, kalendář, research, lead generation a validaci.

Cíl: plně custom OS — vlastní builder (React Flow) pro tvorbu agentů/skillů/MCP, RAG vrstva (LlamaIndex.TS), handle-based data sharing, EWMA reputace, Fast Path routing, a nakonec plná automatizace + mobilní chat s Mary přes API.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo (v3: `packageManager: pnpm@12.3.4`)
- **Frontend:** React 18 + Vite + TypeScript + Tailwind — paleta hadr #ededed/#dbdbdb/#040b8d/#ac0001/#CDA24D
- **Backend:** Fastify + SSE (`/api/chat/watch`), Zod validace
- **Desktop:** Tauri v2 + Rust — `LOYO_DATA_DIR` env, `DATA_DIR` centralizace
- **Shared:** `packages/core` — Zod `CapabilityManifest` schema + loader + templates
- **AI:** Ollama lokálně `qwen3:8b` + `qwen2.5-coder:3b`
- **Data:** file-based `data/capabilities/**/manifest.json` + 14denní rotace chat_history

## Struktura projektu v3.0
loyo-os/
├── data/
│ ├── capabilities/ ← MANIFEST PATTERN - jediné místo pro vše
│ │ ├── agents/ ← mary-jane, lubor-nehleda, julia-nehledalova, kosterad-fuckstein
│ │ │ ├── index.json ← centrální registr (kebab-case)
│ │ │ └── <id>/manifest.json + 01_CORE_IDENTITY.md + memory.json + audit.json
│ │ ├── cli/firmy/manifest.json
│ │ ├── mcp/index.json, loops/index.json, teams/index.json, workflows/index.json, skills/index.json
│ │ └── rag/index.json
│ ├── chat_history/ ← 14denní rotace _a/_b + audit.jsonl — gitignore
│ ├── ja/poznamky + ukoly/aktivni + ukoly/hotove + kalendar/ ← /note /task /kalendar
│ ├── cache/blobs/ ← handle-based sharing — Fáze 3 — gitignore
│ ├── reputation/ ← EWMA skóre — Fáze 3 — gitignore
│ └── activity/feed.json, leads/, logs/runs/, reports/ — gitignore
├── apps/
│ ├── web/ ← Tauri + React + paleta hadr — Menu, Bottom, Layout, Calendar, Tasks, Agents
│ │ └── src-tauri/src/main.rs ← AGENTS_BASE = data/capabilities/agents, LOYO_DATA_DIR
│ ├── api/ ← Fastify — routes: agents/activity/runs/teams/.../capabilities + SSE + orchestrator
│ └── mcp/ ← MCP server — tools=[] — propojení Fáze 2
├── packages/core/src/manifest/← schema.ts Zod, loader.ts hot-reload, templates/
└── tools/scripts/ ← agent-new.ts, manifest-check.ts + cli/firmy/


## Procesy

Launcher spouští 3 procesy přes `pnpm dev` nebo `.\start-loyo.ps1`:

| Proces | Popis | Adresa |
|---|---|---|
| **TAURI** | desktop appka, Vite dev | `http://localhost:3000` |
| **API** | Fastify REST backend | `http://localhost:3001` |
| **MCP** | Model Context Protocol server | stdio |

Pád jednoho neshodí ostatní. API lze používat i mimo desktop (builder, CLI).

## Spuštění

```bash
pnpm install
pnpm dev
# nebo
.\start-loyo.ps1

Env: LOYO_DATA_DIR (fallback ./data), Ollama musí běžet (ollama serve, modely qwen3:8b + qwen2.5-coder:3b).

Agenti v3.0
Agent

Role

Skills

Mary Jane

Elite Executive Assistant & Command Router — /note /task /kalendar /status + dispatcher

dispatcher, notes, calendar

Lubor Nehleda

Analytik / Lead Finder — /find → CLI firmy → report

lead-generation, cli, research

Julia Nehledalová

Deep Research Analyst — /research → web_search → report

deep-research, analysis

Koštěrad Fuckstein

Builder Agent — manifest generation & validation

manifest-generation, validation

Každý agent má data/capabilities/agents/<kebab-id>/ s manifest.json (Zod), 01_CORE_IDENTITY.md, 02_WORKFLOW.md, 03_GUARDRAILS.md, memory.json + audit.json (oba gitignore).

Příkazy (Mary Jane routing)
Příkaz

Formát

Efekt

/note

NECO.xx popis

poznámka → data/ja/poznamky/

/task

NECO.xx,yy,zz

úkol s checklist → data/ja/ukoly/aktivni/ → po splnění hotove/

/kalendar

DD.MM.RRRR HH:MM popis

událost → data/ja/kalendar/

/status

—

stav systému (aktivní/hotové úkoly)

/find

obor město

Lubor → CLI firmy → data/leads/

/research

téma

Julia → web_search → data/reports/*.md

Datová vrstva v3.0
File-based, nikdy DB. packages/core/src/manifest/schema.ts — Zod CapabilityManifest discriminated union pro 8 typů. manifestLoader.ts hot-reload. Validace v pre-commit pnpm manifest:check. DATA_DIR z dataPaths.ts — jediný zdroj cest.

Detailní tabulka kdo zapisuje/kdo čte → ARCHITECTURE.md.

Barevná paleta v3.0 — Hadr / Papír
Barva

Hex

Použití

papír bg

#ededed

hlavní plátno, itemy v menu

panel

#dbdbdb

header, bottom, menu aside, grain overlay

modrá

#040b8d

primární akce, aktivní stav, FIRMA group

červená

#ac0001

destruktivní, CONFIGURATION group

karamelová

#CDA24D

focus, akcent, tečky

Staré #0057F7/#BD0000/#7A7A7A + černá odstraněna.

Roadmapa
Fáze 1 ✅ HOTOVO (2026-09-05 až 07):

Migrace data/agents/ → data/capabilities/agents/ + kebab-case + index.json v3.0[x]
DATA_DIR centralizace + LOYO_DATA_DIR env + AGENTS_BASE fix[x]
Chat 14denní rotace _a/_b + audit.jsonl + SSE /api/chat/watch[x]
Scheduler půlnoční cron + pendingNotifications persistence + reminder|daily-brief|system[x]
husky + lint-staged + manifest:check, turbo.json fix[x]
Menu CLI + Layout/Header props + Agents overlay + Tasks split + Calendar grid + Projekty smazán[x]
Design System v3 hadr #ededed/#dbdbdb/#040b8d/#ac0001/#CDA24D[x]
Fáze 2 ⏳ TEĎ (2-3 týdny) — Lehký Agent Stack 3.0:

 schema.ts final + manifestLoader.ts hot-reload + orchestrator Fast Path + QA hook
 Builder.tsx React Flow wizard + cache/blobs/ + reputation/ příprava + MCP propojení + GitHub push
Fáze 3 (2 týdny):

 QA reviewer adversarial + EWMA reputace + handle-based sharing + Fast Path 3b vs 8b
Fáze 4 (1-2 měsíce):

 Teams manifest, RAG LlamaIndex.TS, self-tooling sandbox, tools/sandbox/
Fáze ONLINE (později):

 Mobilní appka chat s Mary přes API 3001