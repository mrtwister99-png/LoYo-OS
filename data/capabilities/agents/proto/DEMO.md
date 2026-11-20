# DEMO.md — ukázka a testovací scénáře

## Spuštění

```bash
cd data/capabilities/agents/proto
node server.js
```

- demo e-shop: http://localhost:4319/demo
- widget samostatně: http://localhost:4319/widget.js

Vpravo dole je bublina. Napiš `demo` a agent přepne do demo režimu s testovacími daty;
na konci každé odpovědi přidá „Toto byla ukázka, v reálném provozu jsem napojený na váš Shoptet."

## Šest scénářů ze zadání

| # | dotaz | co agent udělá |
|---|---|---|
| 1 | Dobrý den, kde je moje objednávka 2026001? | `getOrderStatus` + `getTracking` → „expedována, PPL, tracking 123456789, doručení zítra" + odkaz |
| 2 | Chci vrátit mikinu, je mi malá. | zeptá se na číslo objednávky, vysvětlí 14 dnů bez udání důvodu |
| 2b | …a pak pošle `2026002` | `createReturn` → číslo vratky, tři kroky, štítek, lhůta na peníze |
| 3 | Přišla mi rozbitá věc, co mám dělat? | „Mrzí mě to" + prosba o fotku + `createTicket` + 2 pracovní dny |
| 4 | Máte boty Runner ve velikosti 42? | `getProductStock` → „skladem (2 ks), do 14:00 odesíláme dnes" |
| 5 | Potřebuju fakturu, nepřišla mi. | vysvětlí e-mail/účet, zeptá se na e-mail, pak `sendSMSorEmail` |
| 6 | Jste debil, chci člověka! | zůstane klidný, `createTicket` s prioritou `high`, „ozve se do 2 hodin" |

## Automatické testy

```bash
node scripts/test-scenarios.mjs
```

Testy jedou bez LLM klíče, takže jsou deterministické. Pokrývají všech šest scénářů,
doplnění čísla objednávky v dalším dotazu a demo režim. Výsledek: `8/8 scénářů prošlo`.

## Demo data

| objednávka | stav | dopravce | tracking |
|---|---|---|---|
| 2026001 | expedována | PPL | 123456789 |
| 2026002 | přijata, čeká na expedici | — | — |
| 2026003 | doručena | Zásilkovna | ZA998877 |

Tričko Basic černé 42 ks · Boty Runner 42 2 ks · Mikina Premium 0 ks (naskladnění za 5 dnů)

## Jak demo vypadá v LLM režimu

S `OPENAI_API_KEY` v `.env` odpovídá model podle promptu, ale nad stejnými nástroji
a stejnými daty. Rozdíl je v plynulosti a v tom, jak si poradí s nečekaným dotazem.
Když klíč chybí nebo API selže, odpověď se vygeneruje fallbackem — navenek to poznáš
jen podle `meta.engine` v odpovědi API.

## Reset

Stačí smazat `data/` (tikety, vratky, logy) a restartovat server. Session jsou v paměti,
takže restart je vyčistí taky.

## Co v demu nejde

- odeslání skutečného e-mailu nebo SMS (jen se zaloguje)
- opravdová vratka ve skladu (jen záznam v `returns.jsonl`)
- reálné stavy objednávek — ty přijdou až s `provider: "shoptet"`
