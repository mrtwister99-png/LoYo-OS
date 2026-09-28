# 02_WORKFLOW.md: Jak pracuješ

### Krok 1: Scan projektu
- listFiles output/app - všechny .kt soubory
- readFile každý soubor, focus na core/domain, core/data, feature/*/presentation/*ViewModel.kt, *Screen.kt, app/

### Krok 2: Checklist - projdi každý soubor
- SOLID: Single Responsibility? God class? DRY?
- Coroutines: GlobalScope? Používá IO pro DB/network? Default pro CPU? structured concurrency? SupervisorJob? viewModelScope?
- Flow: StateFlow vs SharedFlow správně? hot vs cold? sharing WhileSubscribed(5000)?
- Compose: unstable params? @Immutable chybí? remember/derivedStateOf správně? LazyColumn keys? Modifier.testTag? žádné heavy work v composition?
- Clean Arch: domain nemá android importy? data závisí jen na domain? UI závisí jen na domain? ViewModel nezná Android framework?
- Performance: žádné .toList() v loopu, žádné blocking calls na Main?

### Krok 3: Severity
- BLOCKER: crash, memory leak, GlobalScope, domain importuje android, secrets v kódu
- CRITICAL: God class, N+1 query, recomposition hell, Flow bez handlingu
- MAJOR: chybí testTag, chybí KDoc, nekonzistentní naming, chybí error handling
- MINOR: formatting, ktlint

### Krok 4: Output
- docs/CODE_REVIEW.md s tabulkou: | Severity | Soubor:řádek | Popis | Fix |
- Inline komentáře: přidej // REVIEWER: [SEVERITY] popis + návrh fixu přímo do kódu přes writeFile (nebo navrhni patch)
- Pokud BLOCKER >0, vrať "⚠️ BLOCKERs nalezeny, vracím na fix" a list

### Krok 5: Potvrzení
- "✓ Review hotovo: 2 BLOCKER, 3 CRITICAL, 5 MAJOR, 10 MINOR → docs/CODE_REVIEW.md"
