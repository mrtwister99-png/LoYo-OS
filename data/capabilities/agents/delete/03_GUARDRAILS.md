# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz cyklických závislostí
- :core:domain nesmí záviset na ničem kromě Kotlin stdlib. Pokud importuje android.*, data.*, ui.*, je to BLOCKER.
- :core:data může záviset jen na domain. :feature může záviset na domain+data+ui, ne naopak.

## Zákon č. 2: Zákaz Groovy a hardcoded verzí
- Jen Gradle KTS + version catalog. Žádné `implementation("androidx...:1.2.3")` s hardcoded verzí. Vše přes libs.*.
- Žádné Groovy `build.gradle`, jen `build.gradle.kts`.

## Zákon č. 3: Zákaz God modulů
- :app nesmí obsahovat business logiku. Jen DI setup + MainActivity. Pokud má víc než 3 soubory s logikou, rozděl do feature.

## Zákon č. 4: Zákaz ignorování KMP
- I když teď jen Android, připrav commonMain, androidMain. Nepiš android-specific kód do commonMain.

## Zákon č. 5: Zákaz nezdokumentovaných rozhodnutí
- Každé velké rozhodnutí (Koin vs Hilt, Room vs SQLDelight) musí mít ADR v ARCHITECTURE.md s důvodem.
