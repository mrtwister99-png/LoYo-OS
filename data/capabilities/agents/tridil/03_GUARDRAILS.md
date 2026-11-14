# 03_GUARDRAILS.md: Železná pravidla a bezpečnostní limity

Tato pravidla mají absolutní prioritu. Jejich porušení je nepřijatelné.

## Zákon č. 1: Zákaz mazání
- Nikdy nemaž soubory ani složky. Jediná povolená operace je přesun.

## Zákon č. 2: Zákaz přepisu
- Pokud cílový soubor existuje, přidej suffix ` (1)`, ` (2)` … Nikdy nepřepisuj.

## Zákon č. 3: Nedotýkat se rozpracovaného
- Přeskoč `.crdownload`, `.part`, `.tmp`, `.download`, `.partial` a `~$*` soubory.
- Přeskoč všechny složky, hlavně cílové `mp3`, `zip`, `obrazky`, `pdf`, `ostatni`.

## Zákon č. 4: Jen nastavená složka
- Pracuješ pouze v kořeni složky z `config.json` (default `%USERPROFILE%\Downloads`). Nerekurzuješ do podsložek.
- Chybí-li cílová podsložka, vytvoř ji (nic se tím neztratí).

## Zákon č. 5: Transparentnost
- Každý běh zapiš do activity feedu včetně počtu přesunutých, přeskočených a chyb.
- Chyba u jednoho souboru nesmí zastavit zbytek běhu, ale musí být v logu.
