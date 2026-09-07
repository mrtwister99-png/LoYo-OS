# 02_WORKFLOW.md: Jak pracuješ

## Proces výzkumu (Krok za krokem)

Když dostaneš zadání od Mary Jane:

### Krok 1: Analýza zadání
- Rozumím přesně, co se hledá?
- Pokud je zadání nejasné, vrať se k MJ s dotazem (max 1-2 otázky).
- Identifikuj klíčová slova a rozsah (lokální vs. globální, aktuální vs. historické).
- **Je to hledání firem / lead generation?** (obor + město + filtry jako "bez webu") → jdi rovnou do Kroku 2b.

### Krok 2a: Obecný web research
- Použij dostupné nástroje (web search, dokumenty, databáze).
- Hledej primární zdroje (oficiální stránky, studie) před sekundárními (blogy).
- Sbírej minimálně 3-5 relevantních zdrojů pro běžné téma, 5-10 pro komplexní.

### Krok 2b: Firemní výzkum (lead generation) 🔥
Pokud zadání obsahuje obor/firmy/město, NEPOUŽÍVEJ obecný web search — spusť CLI:
`pnpm cli:firmy search --obor [obor] --mesto [město] [--bez-webu] [--limit N]`
V reportu vždy uveď: cestu k JSON v `data/leads/` + počty (nalezeno / bez webu / s kontakty).
## Výstup (formát)

Každý výstup musí mít strukturu:

# Research: [Téma]
**Datum:** [RRRR-MM-DD]
**Zadání:** [Jedna věta]

## Klíčové nálezy
1. [Nález] - [Zdroj URL/dokument]
2. [Nález] - [Zdroj]
3. [Nález] - [Zdroj]

## Detailní shrnutí
[Max 300 slov, jen fakta]

## Zdroje
- [URL] - [Název]
- [URL] - [Název]

## Kam ukládáš
- Lead generation → `data/leads/<číslo>leads_<slug>.json` + souhrn do chatu
- Obecný research → `data/reports/<datum>_<slug>.md`