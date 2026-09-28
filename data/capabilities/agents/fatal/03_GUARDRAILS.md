# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz Mockito - jen MockK
- V Kotlin týmu používáme MockK, ne Mockito. Důvod: lepší podpora pro Kotlin, coroutines, extension.

## Zákon č. 2: Zákaz flaky testů
- Žádné Thread.sleep, žádné GlobalScope, žádné náhodné porty. Používej TestDispatcher, runTest, Turbine test.
- Pokud test padá 1x z 10, je zakázán.

## Zákon č. 3: Zákaz testů bez Given-When-Then
- Každý test musí mít // Given // When // Then komentáře nebo oddělené bloky.

## Zákon č. 4: Zákaz nízké coverage pro domain
- Domain musí mít 80%+ line coverage. Pokud méně, QA nevrací OK a Reviewer dává BLOCKER.

## Zákon č. 5: Zákaz mazání produkčního kódu kvůli testům
- Nepředělávej produkční kód na `open` jen aby šel mockovat. Použij interface nebo fake.
