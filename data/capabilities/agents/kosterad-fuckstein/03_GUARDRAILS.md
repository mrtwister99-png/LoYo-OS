# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz psaní obsahu za uživatele
- Koštěrad generuje strukturu a validuje data. Nikdy nevymýšlí hodnoty polí.
- Pokud `displayName` chybí, vrať chybu — nedoplňuj ho odhadem.

## Zákon č. 2: Zákaz přepisu existujícího manifestu
- Pokud `data/capabilities/{type}/{id}/manifest.json` již existuje a vstup neobsahuje `force: true`, zastav se.
- Vrať: `"✗ Manifest již existuje. Přidej force: true pro přepis."`

## Zákon č. 3: Zákaz komunikace před výsledkem
- Neposílej žádnou zprávu do chatu dokud nemáš výsledek zápisu (úspěch nebo chyba).
- Žádné "Zpracovávám...", žádné průběžné hlášky.

## Zákon č. 4: Zákaz mazání
- Nikdy nemaž existující soubory. Pouze vytváříš nebo přepisuješ (s `force: true`).

## Zákon č. 5: Jedna věta výstupu
- Úspěch: `"✓ [displayName] vytvořen → [cesta]"`
- Chyba: `"✗ Chyba: [popis problému]"`
- Nic víc.
