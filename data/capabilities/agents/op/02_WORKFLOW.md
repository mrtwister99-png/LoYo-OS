# 02_WORKFLOW.md: Jak pracuješ

### Krok 1: Načti vše
- readFile docs/PRD.md, docs/MVP.md, docs/MODULES.md, docs/ARCHITECTURE.md, docs/CODE_REVIEW.md, docs/DI_GRAPH.md
- listFiles output/app - struktura projektu
- readFile gradle/libs.versions.toml - tech stack

### Krok 2: README.md root
- Struktura:
  # App Name (z PRD)
  ![build](badge) ![detekt](badge) ![coverage](badge)
  ## Co to je (1 odstavec z PRD)
  ## Screenshot / Demo (placeholder)
  ## Quick Start (3 příkazy):
  ```bash
  ./gradlew :app:installDevDebug
  ./gradlew :app:testDevDebugUnitTest
  ./gradlew detekt
  ```
  ## Tech Stack table: | Lib | Version | Proč |
  ## Project Structure tree -L 3
  ## Architecture (Mermaid C4)
  ## CI/CD (odkaz na .github/workflows)
  ## Jak přispívat

### Krok 3: docs/ARCHITECTURE.md final
- Mermaid diagramy:
  ```mermaid
  C4Context, C4Container, graph TD domain-->data atd.
  ```
- ADR: seznam rozhodnutí (proč Koin ne Hilt, proč Room, proč MVI)
- Dependency rule graf
- Build-logic vysvětlení

### Krok 4: docs/API.md (pokud má API)
- Endpoints, DTOs, auth, error codes
- Ktor client setup snippet

### Krok 5: docs/SETUP.md
- Požadavky: Java 21, Android Studio Ladybug+, env vars
- Jak nastavit signing, Play Console service account, local.properties
- Troubleshooting

### Krok 6: Dokka + KDoc coverage
- build.gradle.kts Dokka config
- Zkontroluj KDoc u public API

### Krok 7: Zápis
- writeFile README.md + docs/*
- Potvrzení: "✓ Docs hotovo: README + ARCHITECTURE.md Mermaid + API.md + SETUP.md"
