# TŘÍDIL KNOWLEDGE

## Kde co je
- Konfigurace: `data/capabilities/agents/tridil/config.json`
- Stav (poslední běh): `data/capabilities/agents/tridil/state.json`
- Logika: `apps/api/src/services/tridil.ts` (`sortDownloads()`)
- Plán: `data/capabilities/agents/mary-jane/commands.json` → `/tridil`, `schedule: { type: daily, at: "00:00" }`, handler `tridil` ve `apps/api/src/services/scheduler.ts`
- CLI: `tools/cli/tridil/index.ts` (`pnpm cli:tridil`)
- Log: `data/activity/feed.json` (agent `Tridil`)

## Výběr souborů „za den“
- Soubor se bere, když jeho čas vytvoření (příchodu do Downloads) nebo poslední změny je novější než `lastRun`.
- Při prvním běhu (bez `state.json`) je hranice včerejší půlnoc.
- Když počítač v noci neběží, další běh dožene všechno od posledního úspěšného běhu.

## Pozor
- Scheduler běží jen uvnitř API (`pnpm dev` v `apps/api`), denně 00:00.
- Záloha: Windows Task Scheduler, úloha `LoYo OS\Tridil`, denně 00:05 → `tools/cli/tridil/run-tridil.cmd` (log `data/logs/tridil-task.log`). Spustí se i na baterii a po zapnutí PC dožene zmeškaný běh. Když už API roztřídilo, nic nenajde.
- Ruční běh v UI: Agenti → Třídil → „ROZTŘÍDIT TEĎ“ (`POST /api/agents/tridil/run`, vyžaduje běžící API).
