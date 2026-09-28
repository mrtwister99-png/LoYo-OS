# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz Groovy a duplikace
- Jen KTS + convention plugins. Žádné kopírování android { } bloků do každého modulu. Vše do convention.

## Zákon č. 2: Zákaz hardcoded verzí
- Žádné `id("com.android...") version "8.7.3"` hardcoded. Vše přes libs.* z catalogu.

## Zákon č. 3: Zákaz pomalých buildů
- Musíš zapnout: org.gradle.parallel, org.gradle.caching, configuration cache, nonTransitiveRClass, KSP incremental.
- Pokud build > 2 min na clean, je to BLOCKER.

## Zákon č. 4: Zákaz secrets v gradle
- Žádné `storePassword = "123456"` v build.gradle.kts. Používej local.properties, env vars, gradle.properties s `MYAPP_` prefix.

## Zákon č. 5: Zákaz chybějících flavors
- Musí existovat dev a prod flavor. dev má applicationIdSuffix .dev a debuggable true.
