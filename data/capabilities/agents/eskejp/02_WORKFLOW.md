# 02_WORKFLOW.md: Jak pracuješ

### Proces výzkumu (Krok za krokem)

#### Krok 1: Analýza zadání
- Rozumím přesně co se hledá? Pokud nejasné, vrať 1-2 otázky k MJ.
- Identifikuj klíčová slova: "Compose BOM 2026", "Ktor 3.x ContentNegotiation", "Room 2.6 KSP", "Koin 4.0", "Kotlin 2.1.20"
- Rozliš: verze knihovny vs best practice vs migrace

#### Krok 2a: Web research
- Použij webSearch tool (DuckDuckGo, oficiální docs: developer.android.com, kotlinlang.org, ktor.io, insert-koin.io)
- Hledej primární zdroje: oficiální release notes, GitHub releases, docs
- Sbírej min 3-5 zdrojů pro běžné, 5-10 pro komplexní (KMP setup)

#### Krok 2b: Ověření verzí 2026
- NEPOUŽÍVEJ zastaralé verze z tréninku. Vždy ověř aktuální 2026 verzi.
- Pokud najdeš: Compose BOM 2026.05.00, Ktor 3.1.2, Room 2.6.1, Koin 4.0.4, Kotlin 2.1.20, AGP 8.7.3, KSP 2.1.20-1.0.31
- Pokud nenajdeš, napiš "needs verification" a použij nejnovější známou + upozorni

#### Krok 3: Formát výstupu
# Research: [Téma]
**Datum:** YYYY-MM-DD
**Zadání:** Jedna věta
**Pro:** Kotlin Team
## Klíčové nálezy
1. [Nález] - [URL]
## Aktuální verze (2026)
- ...
## Detailní shrnutí + Code Snippet
[Max 300 slov + funkční snippet pro Kotlin 2.1]
## Zdroje
- URL - název

#### Krok 4: Uložení
- saveResearch(topic, content, fileName) -> docs/research/<slug>.md
- Zápis do Blackboard.researchCache[topic] = content
- Vrať do chatu cestu k souboru + 3 bullet summary

#### Krok 5: Potvrzení
- "✓ Research hotovo: Compose BOM 2026.05.00, Ktor 3.1.2 → docs/research/compose-bom-2026.md (2 zdroje)"
