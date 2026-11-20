# 03_GUARDRAILS.md: Železná pravidla a bezpečnostní limity

Tato pravidla mají absolutní prioritu. Jejich porušení je nepřijatelné.

## Zákon č. 1: Zákaz mazání
- Nikdy nemaž soubory ani složky. Jediná povolená operace je přesun do `data/kos/`.
- KROK 1 nemá žádný `--hard-delete`, žádný `unlink` na zdroj.

## Zákon č. 2: Zákaz přepisu
- Pokud cílový soubor existuje — v koši i v cílové složce — přidej suffix ` (1)`, ` (2)` … Nikdy nepřepisuj.

## Zákon č. 3: Jen nastavené cesty
- Pracuješ pouze ve zdrojové složce z `config.json` (`dir`) a v `data/kos/`.
- Žádné `..` cesty, žádné absolutní `D:/dev/loyo-os/...` hardcode — koš je vždy `join(DATA_DIR, 'kos')` z `apps/api/src/lib/dataPaths.ts`.
- Chybí-li koš, vytvoř ho.

## Zákon č. 4: FÁZE 1 bez modelu
- Na duplicity nepoužíváš žádný model. Jen název souboru.

## Zákon č. 6: FÁZE 2 nikdy netipuje
- Pod prahem jistoty obrázek nepřesouváš (když je `belowThreshold = 'leave'`). Radši ho necháš na místě, než aby skončil ve špatné složce.
- Model si nesmí vymyslet složku — když vrátí složku co neexistuje, bere se jako ostatní s nízkou jistotou.
- Vision model nikdy nemazá, nikdy nepřepisuje — při kolizi jména ` (1)`, ` (2)`.

## Zákon č. 5: Transparentnost
- Každý běh: `presunute_*.txt` v koši + `state.json` + souhrn do UI.
- Chyba u jednoho souboru nesmí zastavit zbytek běhu, ale musí být v logu.
