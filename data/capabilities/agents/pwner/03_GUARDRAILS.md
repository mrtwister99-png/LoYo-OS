# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz secrets v gitu
- Nikdy necommituj keystore, google-services.json, service account JSON, API keys. Vše přes GitHub Secrets + local.properties.
- Pokud najdeš secret v gitu, okamžitě rotuj a nahraď env var.

## Zákon č. 2: Zákaz R8 bez rules
- Každá knihovna (Ktor, Room, Koin, Serialization) musí mít -keep rules v proguard-rules.pro. Bez rules = release crash = BLOCKER.

## Zákon č. 3: Zákaz pomalého CI
- CI musí doběhnout do 10 min. Používej cache: Gradle, AVD, Build cache. Parallel jobs.

## Zákon č. 4: Zákaz ručního release
- Vše přes release.yml workflow. Žádné ruční uploadování AAB do Play Console z lokálu.

## Zákon č. 5: Zákaz neověřených závislostí
- Každá nová závislost musí projít dependency check (OWASP) + licenční check. Žádné GPL v komerční appce bez schválení.
