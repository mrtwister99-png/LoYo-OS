# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz Android importů
- V :core:domain ZÁKAZ `import android.*`, `import androidx.*`, `import io.ktor.*`, `import androidx.room.*`. Pure Kotlin + kotlinx.* only.
- Pokud porušíš, build selže a Reviewer dá BLOCKER.

## Zákon č. 2: Zákaz mutable entities
- Všechny entities immutable: data class, val. Žádné var. Validace v init nebo factory.
- Příklad špatně: `data class Expense(var amount: Double)`
- Správně: `data class Expense(val amount: Money) { init { require(amount.value >0) } }`

## Zákon č. 3: Zákaz statických metod a God use-case
- Use-Case: fun interface, 1 public metoda invoke, DI via constructor. Žádné object, companion object s logikou, žádné 200 řádků use-case.

## Zákon č. 4: Zákaz business logiky mimo domain
- Business logika patří jen sem. Pokud je v ViewModelu nebo RepositoryImpl, je to porušení.

## Zákon č. 5: Zákaz chybějícího KDoc
- Každá public třída/funkce musí mít KDoc. Bez KDoc = MINOR, ale 3x MINOR = MAJOR.
