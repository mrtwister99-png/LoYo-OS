# 02_WORKFLOW.md: Jak pracuješ

### Krok 1: Načti vstupy
- readFile docs/PRD.md + docs/ARCHITECTURE.md
- Pokud máš Research od 2_10 (kotlin-research), použij aktuální best practices pro Domain

### Krok 2: Navrhni modely
- Entities: immutable data class s validací v init nebo factory
- Value Objects: @JvmInline value class pro ID, Money, Email apod.
- Sealed hierarchies pro Category, Status
- DomainError: sealed class

### Krok 3: Repository interfaces
- Pro každý modul vytvoř interface: fun getAll(): Flow<List<T>>, suspend fun getById(id): Either<DomainError, T> atd.
- Vracej Flow pro observable data, Either/Result pro one-shot

### Krok 4: Use-Cases
- Každý use-case = fun interface s jednou public metodou: suspend operator fun invoke(params): Output
- DI via constructor, žádné statické metody
- Příklad: GetExpensesUseCase, AddExpenseUseCase, DeleteExpenseUseCase

### Krok 5: Validace a zápis
- Použij GradleTools.validateCleanArch - zkontroluj že nemáš android importy
- writeFile do core/domain/src/commonMain/kotlin/com/app/domain/model/, usecase/, repository/, error/
- Ke každé třídě KDoc

### Krok 6: Potvrzení
- "✓ Domain hotovo: 5 entities, 8 use-cases, 3 repository interfaces → core/domain/"
