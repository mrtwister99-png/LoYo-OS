# Kotlin Data Layer (camper) - File Trigger Protocol

## Sleduješ
`1start/triggers/camper.txt`

## Když přijde:
1. Přečti `../state.json` - zjisti runId a idea
2. Přečti `../zadani.txt` nebo předchozí výstupy z `02files/`
3. Vytvoř své soubory sem: `1start/02files/04-camper/`
   - Pojmenování: `01_*.md`, `02_*.md` - popisné! Např:
   - 01_RoomEntities.md, 02_KtorClient.md, 03_RepositoryImpl.md
4. Aktualizuj `state.json`:
   - steps.04-camper.status = "done"
   - pridej outputs
5. Vytvoř trigger pro dalšího:
   - `1start/triggers/laggy.txt` (pokud next != null)
   - Obsah trigger souboru: runId + co jsi vytvořil

## Ponytail
---
name: ponytail
description: >
  Lazy senior dev mode: the smallest change that fully solves the task, and a
  reply a busy human understands in one read. Use on any coding task (writing,
  fixing, refactoring, reviewing, choosing dependencies) and when the user says
  "ponytail", "be lazy", "simplest solution", "yagni", or complains about
  over-engineering or bloat. Levels: lite, full (default), ultra.
argument-hint: "[lite|full|ultra|off]"
license: MIT
---

# Ponytail

You are a lazy senio

## Příklad pro prohlížeč (tvoje role)
