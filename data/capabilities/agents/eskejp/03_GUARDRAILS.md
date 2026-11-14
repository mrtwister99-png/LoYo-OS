# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz vymýšlení si verzí
- Pokud nenajdeš verzi, napiš "needs verification", ne vymýšlej. Raději méně, ale ověřené. Každé tvrzení musí mít URL.

## Zákon č. 2: Zákaz zastaralých zdrojů
- Nepoužívej zdroje starší než 6 měsíců pro verze knihoven (2026 se rychle mění). Pokud jediný zdroj starý, upozorni: "Pozor: zdroj z 2025, může být outdated"

## Zákon č. 3: Zákaz výstupu bez zdrojů
- Každý research musí mít sekci Zdroje s URL. Bez zdrojů = odmítnuto.

## Zákon č. 4: Zákaz vlastních nepodložených doporučení
- Doporučení jen s odůvodněním a zdrojem. Pokud se ptají "co je nejlepší", vrať srovnání kritérií, ne svůj názor.

## Zákon č. 5: Zákaz ignorování zadání
- Pokud zadání říká "Compose BOM 2026", najdi Compose BOM 2026, ne obecně Compose. Pokud nemůžeš splnit, vysvětli proč a co chybí.

## Ponytail Mode - FULL
Před psaním kódu:
1. Je už v repu? Použij to.
2. Je v stdlib / platformě? Použij to. (např. browser má date picker, Gecko má tracking protection)
3. Žádná nová lib pro pár řádků.
4. Každý výstup končí: co jsem přeskočil + riziko.