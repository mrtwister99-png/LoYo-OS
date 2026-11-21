# Stěpán

Agent LOYO OS, který dělá **opak Lopatinky**: dostane věc, zjistí, co to je a za kolik se prodává, a napíše hotový **inzerát na prodej**.

## Jak to funguje

1. **Pošleš mu věc** — volný text, klidně i s detaily:
   `iPhone 13 128 GB, baterie 89 %, drobné škrábance na rámečku`
2. **Zjistí, co to je** — z popisu vytáhne název a model, vyhodí balast (`prodám`, `stav`, `dohodou`, `% baterie`).
3. **Projde trh** — Sbazar + Aukro, jen nabídky se stejným modelem a čísly (jinak se připlete obal nebo jiná kapacita).
4. **Spočítá cenu** — medián trhu, doporučená cena podle stavu, varianta na rychlý prodej a na trpělivý prodej.
5. **Napíše inzerát** — titulek, text, cena, předání. Zkopíruješ a publikuješ.

## Cena

| Stav | Koeficient |
|---|---|
| Nový | 1,10 |
| Jako nový | 1,02 |
| Velmi dobrý | 0,95 |
| Dobrý | 0,88 |
| Opotřebený | 0,75 |
| Na díly | 0,55 |

Doporučená cena = medián trhu × koeficient stavu, zaokrouhleno na 50 Kč.
`Rychle pryč` = −10 %, `když počkáš` = +10 %.

Méně než 3 srovnatelné nabídky = cena je označená jako orientační, ne jako fakt.

## Spuštění

```bash
node data/capabilities/agents/stepan/run.mjs --item "iPhone 13 128 GB, baterie 89 %"
node data/capabilities/agents/stepan/run.mjs --item "PlayStation 5 Slim" --condition jako-novy
node data/capabilities/agents/stepan/run.mjs --item "herní PC RTX 3060" --condition dobry
```

Nebo z UI: **Agenti → Stěpán** → napiš věc → **OCENIT A NAPSAT INZERÁT**.
API: `POST http://localhost:3001/api/agents/stepan/run` s body `{ "item": "…", "condition": "dobry" }`, stav `GET /api/agents/stepan/state`.

Volitelné ENV: `STEPAN_ITEM`, `STEPAN_CONDITION`.

## Ladění (`config.json`)

| Klíč | Význam |
|---|---|
| `portals` | které bazary procházet (`sbazar`, `aukro`) |
| `maxQueryTokens` | jak dlouhý dotaz na trh se staví z popisu (default 4) |
| `minPriceCzk` | spodní hranice ceny srovnatelných nabídek |
| `minComparableCount` | od kolika nabídek je cena důvěryhodná (default 3) |
| `conditions` | stav věci → koeficient ceny |
| `roundingCzk` | zaokrouhlení ceny (default 50 Kč) |
| `quickSaleFactor` / `patientSaleFactor` | rychlý vs. trpělivý prodej |
| `listing.negotiable` | přidat k ceně „(dohodou)“ |
| `listing.location` | místo osobního předání (prázdné = „po dohodě“) |
| `listing.shipping` | přidat řádek o poště / Zásilkovně |
| `stopwords` | slova, která se z popisu vyhazují před hledáním |
| `excludeKeywords` | příslušenství, které se nepočítá jako cena věci |

## Soubory

- `run.mjs` — celý agent, nula závislostí (Node 20+)
- `config.json` — portály, prahy, koeficienty stavu, nastavení inzerátu
- `state.json` — poslední věc, cena, inzerát a srovnatelné nabídky
- `inzerat_*.md` — report konkrétního běhu
- `audit.json`, `memory.json` — historie běhů (gitignore)

## Vložení na Sbazar

```
/stepan prihlasit                                   jednou: přihlásíš se v okně Edge, přihlášení zůstane
/stepan PS5 Slim, jako nový --cena 11000 --vlozit   ocení, napíše inzerát a předvyplní ho na Sbazaru
/stepan … --fotky D:\foto\ps5 --vlozit              fotky ze složky
```

Fotky můžeš i **poslat Mary do Telegramu**: uloží se do zásobníku a další `--vlozit` si je vezme. V UI (Agenti → Stěpán) je na to výběr fotek, pole na cenu a tlačítka 🔑 PŘIHLÁSIT SBAZAR / 📝 VLOŽIT POSLEDNÍ INZERÁT.

Štěpán vyplní titulek, popis, cenu a fotky a **zastaví se před zveřejněním**. Kategorii, lokalitu a zveřejnění zkontroluješ a odklikneš sám. Okno zůstane otevřené 30 minut.
