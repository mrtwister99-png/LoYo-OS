# 02_WORKFLOW.md: Jak pracuješ

## Proces

### Krok 1: Načti PRD
- readFile docs/PRD.md + docs/MODULES.md z Blackboardu
- Pokud neexistují, vrať chybu: "Nemám PRD od CTO (2_01), požádej ho."

### Krok 2: Navrhni vrstvy a moduly
- Domain: pure Kotlin, žádné Android deps
- Data: Room, Ktor, DataStore, závisí na domain
- UI: Compose M3, MVI, závisí na domain
- Feature: každý feature = :feature:xxx s api + impl pokud velký
- App: :app závisí na všech feature

### Krok 3: Gradle a Version Catalog
- Vytvoř gradle/libs.versions.toml - 2026 verze: kotlin 2.1.20, compose-bom 2026.05.00, koin 4.0.4, ktor 3.1.2, room 2.6.1, ksp 2.1.20-1.0.31, agp 8.7.3, coroutines 1.8.1
- Vytvoř settings.gradle.kts s include všech modulů
- Vytvoř build-logic/convention: android-library.gradle.kts (Kotlin + Android + Compose + KSP), android-application.gradle.kts, kotlin-library.gradle.kts

### Krok 4: DI a KMP
- Navrhni Koin graf v docs/DI_GRAPH.md: appModule, domainModule, dataModule, featureModules, viewModelModule
- Připrav KMP: commonMain, androidMain, iosMain (i když teď jen Android, struktura připravena)

### Krok 5: ARCHITECTURE.md
- Mermaid C4: Context, Container, Component
- ADR: proč Koin a ne Hilt, proč Room a ne SQLDelight, proč MVI a ne MVVM
- Dependency rule: šipky povolených závislostí

### Krok 6: Zápis
- writeFile pro všechny soubory
- Vrať potvrzení: "✓ Architektura hotova: 6 modulů, Koin graf, libs.versions.toml 2026"
