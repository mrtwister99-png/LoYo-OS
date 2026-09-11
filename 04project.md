## LOYO OS — Project Brief — v3.2 SQLite + Git Auto — stav 2026-09-11

### Co je LOYO OS
Lokální, file-based, agentický OS. Žádná databáze jako zdroj pravdy, žádný cloud vendor lock. Vše je soubor v `data/`, verzovatelný Gitem, vlastněný uživatelem. Index `data/index.db` je generovaný cache (FTS5) pro rychlé vyhledávání <10ms. Běží na Ollama (qwen3:8b + qwen2.5-coder:3b), Tauri v2 desktop, Fastify API + node:sqlite, React+Vite frontend, isomorphic-git auto-commit.

### Stack
- **Monorepo:** pnpm 12.3.4 workspaces + Turborepo 2.3.3
- **Frontend:** React 18 + Vite + TypeScript + Tailwind
- **Backend:** Fastify 5.3.2 + TypeScript + SSE + `node:sqlite` (experimental, WAL) + FTS5 fulltext + `isomorphic-git` 1.35+ + `http/node` client
- **Desktop:** Tauri v2 + Rust
- **Shared:** packages/core - Zod schémata + loader + templates
- **Data:** JSON + MD files v `data/` = source of truth, `data/index.db` = generated SQLite FTS5 index (gitignored), 14denní rotace chat_history
- **AI:** Ollama lokálně - žádné API klíče
- **Validace:** husky + lint-staged + manifest:check
- **GitOps:** LOYO OS Bot auto-commit po reindexu, optional auto-push na origin/main

### Konvence (dogma)
1. **Cesty vždy přes DATA_DIR** z `apps/api/src/lib/dataPaths.ts`. Nikdy hardcoded `../../data`.
2. **ID kebab-case:** `mary-jane`, `lubor-nehleda`, ne `Mary_Jane`.
3. **Index soubory:** `data/capabilities/<type>/index.json` jediný registr daného typu + `data/index.db` je jen cache.
4. **Rust serde:** `rename_all = camelCase`.
5. **Komentáře česky, kód anglicky.**
6. **Opravy jako OZNAČ/VLOŽ diff**, ne celé soubory.
7. **DB je cache:** Vždy lze smazat `data/index.db*` a zrekonstruovat z `data/capabilities/**/manifest.json`.

### Dogmata v3.2 (nikdy neporušovat)
1. **File-based > DB.** DB je jen urychlovač. Debuggovatelné, diffovatelné, user vlastní data.
2. **Žádné polyglot peklo.** TS/Rust only. Žádný Python LangChain/CrewAI.
3. **Orchestrátor není switch.** Je to Controller s reputací, kontextem, delegací, audit trail.
4. **Všechno je Capability.** Agent, RAG, MCP, CLI, Workflow, Loop, Team = manifest.json.
5. **Rychlost z SQLite.** `?search=mary` <10ms přes FTS5, ne grep po disku.

### The Manifest Pattern + SQLite Index
data/capabilities/<type>/<kebab-name>/
├── manifest.json ← JEDINÝ ZDROJ PRAVDY (Zod validovaný)
├── 01_CORE_IDENTITY.md
├── 02_WORKFLOW.md
├── 03_GUARDRAILS.md
├── memory.json
└── audit.json

data/index.db (generováno)
├── table capabilities (id, type, name, description, tags, ...)
├── virtual table capabilities_fts (FTS5)
├── triggers: after insert/update/delete sync FTS
└── query: SELECT * FROM capabilities_fts WHERE capabilities_fts MATCH 'mary'

manifest.json příklad:
```json
{
  "id": "mary-jane",
  "type": "agent",
  "version": "3.0.0",
  "runtime": "ollama",
  "model": "qwen3:8b",
  "entrypoint": "services/agents/mary_handler.ts",
  "permissions": ["fs:read:data/ja", "fs:write:data/ja/ukoly"],
  "reputation": { "organize": 0.95, "avg_latency_ms": 1200 },
  "freshness_ttl_hours": 1
}
```

### Git Auto-commit
`apps/api/src/lib/gitAutoCommit.ts`:
- walk `data/capabilities/**/manifest.json`
- `git.add()` + `statusMatrix()` filter STAGE 2/3
- `commit()` jako `LOYO OS Bot`
- optional `push()` s `isomorphic-git/http/node` + `GITHUB_TOKEN` + debounce 5s
- voláno z `manifestDb.ts` po reindexu přes `autoCommitInBackground()`

### Dev Workflow 2026-09-11
```powershell
pnpm dev:api:clean  # kill :3001 + rm data/index.db* + pnpm --filter api dev
pnpm dev:api        # jen api bez čištění
pnpm dev            # turbo run dev vše
```
