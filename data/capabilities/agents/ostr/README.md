# Ostř

Hlídač a kontrolor cen v LOYO OS. **Lopatinka hledá, Stěpán prodává, Ostř kontroluje.**

## Co umí

**Kontrola ceny.** Pošleš věc a cenu, nebo vložíš celý cizí inzerát:

```
/ostr iPhone 13 128 GB --cena 9500
/ostr Prodám iPhone 13 128 GB, cena 4 500 Kč, jen záloha předem
```

Vrátí verdikt proti trhu Sbazar + Aukro:

| | |
|---|---|
| 🟢 Výhodné | v nejlevnější čtvrtině trhu |
| 🟡 Férové | běžná cena, dostaneš protinabídku |
| 🟠 Předražené | dražší než 3/4 trhu |
| 🔴 Nad celým trhem | dražší než cokoli srovnatelného |
| 🚩 Podezřele levné | pod 45 % mediánu: podvod, replika, blokace, díly |

Navíc hlídá **varovná slova** v textu (záloha předem, iCloud, replika, bez dokladu…). Levná cena + varovné slovo = 🚩, nikdy 🟢.

**Hlídání.** Watchlist s cílovou cenou a historií trhu:

```
/ostr hlidej RTX 3060 12GB --cil 4500
/ostr hlidani
/ostr seznam
/ostr nehlidej <id>
```

Hlásí 🎯 cíl splněn, 📉/📈 změnu mediánu o 5 % a víc, 🆕 novou nejlevnější nabídku. Podezřele levné kusy cíl nikdy nespustí.

## Stejná věc, ne podobná
Do trhu jde jen stejný model, stejná čísla a stejná varianta. `iPhone 13` ≠ `13 mini` / `Pro`, `RTX 3060` ≠ `3060 Ti`. Příslušenství a díly pryč. Varianty a varovná slova se ladí v `config.json`.

## Soubory
`run.mjs` · `config.json` · `watchlist.json` · `history.json` · `state.json` · `audit.json` · reporty `kontrola_*.md` a `hlidani_*.md`.
Sdílené: `data/lib/market.mjs` (stahování a srovnatelnost), `data/lib/pricing.mjs` (medián, percentily).

Podrobně: [01_CORE_IDENTITY.md](01_CORE_IDENTITY.md) · [02_WORKFLOW.md](02_WORKFLOW.md) · [03_GUARDRAILS.md](03_GUARDRAILS.md)
