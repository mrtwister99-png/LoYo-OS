# IIAA Team - Kotlin Factory (11 agentů) - File Trigger Edition

## Pipeline (file-trigger)
User Idea -> `1start/zadani.txt` -> watcher -> `1start/triggers/nofps.txt` -> 

1. **nofps** (CTO/Product) -> PRD, MVP, MODULES
2. **delete** (System Architect) -> ARCHITECTURE.md, modules.yaml
3. **cheater** (Domain) -> Entities, UseCases
4. **camper** (Data) -> Room, Ktor, RepoImpl
5. **laggy** (UI) -> Compose MVI
6. **error** (Build) -> Gradle KTS, Version Catalog
7. **fatal** (QA) -> Tests MockK/Turbine
8. **cancel** (Reviewer) -> CODE_REVIEW.md
9. **pwner** (DevOps) -> CI/CD, R8
10. **op** (Doc) -> README, final docs
11. **eskejp** (Research) on-demand - kdokoliv vytvoří `eskejp.txt` s dotazem

## File protocol
Každý agent sleduje `1start/triggers/<jeho-id>.txt`

Když soubor vznikne:
1. Přečte `state.json` + předchozí výstupy z `02files/`
2. Vytvoří své výstupy do `1start/02files/{order}-{id}/` jako `01_*.md`, `02_*.md`
3. Aktualizuje `state.json` (status: done, outputs: [...])
4. Vytvoří trigger pro dalšího agenta: `triggers/<next-id>.txt`

Výstupní pojmenování: `01_PRD.md`, `02_MVP.md` - ne `01jedna.md`. Ať je to čitelné.

Příklad pro delete:
- Dostane `triggers/delete.txt`
- Vytvoří `02files/02-delete/01_ARCHITECTURE.md`, `02_modules.yaml`, `03_DI_GRAPH.md`
- Vytvoří `triggers/cheater.txt`

Paralelní varianta: delete může vytvořit 4 triggery najednou (cheater, camper, laggy, error) a fatal čeká na všechny 4 v state.json.
