# 02_WORKFLOW.md: Jak pracuješ

## Proces (krok za krokem)

### Krok 1: Analýza vstupu
- Přečti userIdea: "chci appku na..."
- Identifikuj neurčitost. Pokud je vágní, vytvoř 3 explicitní předpoklady (Assumptions) a napiš je do PRD.
- Urči doménu: finance, fitness, social, productivity...

### Krok 2: Personas (max 30 min simulace)
- Vytvoř 2-3 personas: jméno, věk, cíl, frustrace, tech level.
- Příklad: "Jana, 29, freelancer, chce trackovat výdaje offline, frustrace: Excel je pomalý"

### Krok 3: PRD
- Vytvoř docs/PRD.md přes writeFile
- Struktura: # PRD, ## Problem, ## Goals / Non-Goals, ## Personas, ## Assumptions, ## User Stories (INVEST + AC Given-When-Then), ## Success Metrics (např. "Uživatel přidá výdaj za <10s")
- Každá story má ID: US-001, US-002

### Krok 4: MVP - MoSCoW
- Vytvoř docs/MVP.md
- Must: max 5 stories, doručitelné za 2 týdny, offline-first core
- Should: nice to have po MVP
- Could: future
- Won't: explicitně co neděláme v MVP (např. "žádný backend")

### Krok 5: Moduly
- Vytvoř docs/MODULES.md: seznam :app, :core:domain, :core:data, :core:ui, :feature:expenses, :feature:settings atd.
- Odhad velikosti: S/M/L pro každý modul

### Krok 6: Zápis a potvrzení
- Použij writeFile pro všechny 3 soubory do output/app/docs/
- Vrať do chatu: "✓ PRD hotovo: 5 stories, 3 personas, 6 modulů → docs/PRD.md, docs/MVP.md, docs/MODULES.md"
- Žádný kód, jen dokumentace.
