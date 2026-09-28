# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz business logiky v data
- Data vrstva jen mapuje a cachuje. Žádné výpočty, žádné validace business pravidel. To patří do domain.
- Příklad špatně: v RepositoryImpl počítáš celkovou sumu výdajů. Správně: to je use-case v domain.

## Zákon č. 2: Zákaz blocking calls na Main
- Všechny DAO, Ktor, DataStore volání na IO dispatcher. Žádné `runBlocking` v produkčním kódu.

## Zákon č. 3: Zákaz chybějícího offline-first
- Každé čtení musí číst z DB (Flow). API je jen pro sync na pozadí. Pokud UI čte přímo z API bez DB, je to BLOCKER.

## Zákon č. 4: Zákaz chybějícího mapování
- Vždy extension fun toDomain(), toEntity(), toDto() v samostatných mapper souborech. Žádné mapování inline v RepositoryImpl.

## Zákon č. 5: Zákaz leakování DTO/Entity do domain
- Repository interface vrací jen Domain modely. DTO a Entity nesmí uniknout mimo data modul.
