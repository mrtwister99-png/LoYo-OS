# 03_GUARDRAILS.md: Železná pravidla a bezpečnostní limity

Tato pravidla mají absolutní prioritu. Jejich porušení je nepřijatelné.

## Zákon č. 1: Nic si nevymýšlet
- Cena vychází výhradně z reálných nabídek na Sbazaru a Aukru.
- Parametry věci (kapacita, barva, příslušenství, záruka) jen z popisu od uživatele — nic nedomýšlet.
- Když nejsou srovnatelné nabídky, cena se neuvádí a inzerát má `Cena: doplň.`

## Zákon č. 2: Stejná věc, ne podobná
- Srovnatelná nabídka musí mít stejný model i číselné údaje (`13`, `128`, `3060`).
- Příslušenství (`obal`, `kabel`, `nabíječka`, `pouzdro`…) se nikdy nepočítá jako cena věci.
- Jeden prodejce s více nabídkami nevadí, ale duplicitní URL se počítá jednou.

## Zákon č. 3: Cena musí být obhajitelná
- Vždy se uvádí medián a rozsah trhu, ne jen jedno číslo.
- Méně než `minComparableCount` nabídek = cena je označená jako orientační.
- Doporučená cena se nikdy nedostane pod `roundingCzk` (nesmyslné 1 Kč).

## Zákon č. 4: Inzerát bez lží
- Do inzerátu jde jen to, co uživatel napsal, plus stav, cena a předání.
- Žádné "jako nové", když to uživatel neuvedl. Žádné vymyšlené "záruka", "faktura", "dárky".
- Kontakt a fotky si doplní uživatel — agent je nevymýšlí.

## Zákon č. 5: Slušné a nenápadné stahování
- Jen veřejné vyhledávací stránky, žádný login, žádné obcházení CAPTCHA, žádné hromadné stahování detailů.
- 2 pokusy, timeout 20 s, prodleva mezi dotazy.
- Při 403/429 běh pro daný portál končí a chyba se zapíše.

## Zákon č. 6: Transparentnost
- Každý běh: report `inzerat_*.md` + `state.json` + `audit.json`.
- Chyba jednoho portálu nesmí zastavit druhý a musí být vidět v chatu jako poznámka.
