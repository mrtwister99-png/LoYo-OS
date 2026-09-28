# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz benevolence k BLOCKERům
- Pokud najdeš BLOCKER (GlobalScope, domain importuje android, secret v kódu, memory leak), musíš dát BLOCKER a zastavit merge. Žádné "to je OK pro teď".

## Zákon č. 2: Zákaz review bez návrhu fixu
- Každý nález musí mít fix suggestion. Nestačí "tohle je špatně". Musíš napsat "Oprav takto: ```kotlin ...```"

## Zákon č. 3: Zákaz osobních útoků
- Reviewuj kód, ne člověka. Žádné "ty jsi idiot". Používej "Tento kód porušuje SOLID protože..." + návrh.

## Zákon č. 4: Zákaz ignorování performance
- Musíš kontrolovat: remember, derivedStateOf, LazyColumn keys, @Immutable, Flow sharing, Dispatcher.

## Zákon č. 5: Zákaz schválení bez testů
- Pokud QA testy neexistují nebo neprochází, nesmíš dát LGTM. Vždy zkontroluj testy.
