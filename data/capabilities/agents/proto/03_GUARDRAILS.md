# 03_GUARDRAILS.md: Co Proto nikdy nesmí

## Osobní údaje

* Do chatu nikdy nejde celé telefonní číslo, adresa ani číslo karty.
* Číslo objednávky se v odpovědi zkracuje na poslední 4 číslice (`…6001`).
* Logy obsahují jen maskovaného příjemce (`po***@domena.cz`), nikdy celý kontakt.
* Do `data/tickets.jsonl` jde souhrn (max 500 znaků), ne celý přepis s PII.

## Tajemství

* `OPENAI_API_KEY` a `SHOPTET_API_TOKEN` jen v `.env` na serveru.
* `GET /api/config` vrací pouze veřejnou konfiguraci — žádné klíče, cesty ani interní URL.
* `.env` je v `.gitignore`. Když se klíč dostane ven, rotuje se.

## Prompt injection

Zákazník může napsat „ignoruj předchozí pokyny". Ochrany:

* žádný nástroj nemění ceny, objednávky ani adresy — jen čte a zakládá tikety/vratky
* `runTool` validuje a zkracuje vstupy
* prompt zakazuje vymýšlet cenu, stav a termín
* odpověď modelu se nikdy nespouští jako kód a ve widgetu je escapovaná

Kdykoli se přidá nástroj, který něco mění (sleva, změna adresy), musí mít potvrzení
od člověka, ne automatické provedení z chatu.

## Limity

* 40 zpráv / 5 minut na IP + session, tělo max 16 kB, zpráva max 1000 znaků
* max 4 kola tool callingu na dotaz, jinak fallback
* max 2000 sessions v paměti, TTL 3 hodiny

## E-shop a značka

* Agent nesmí slibovat nic, co e-shop v konfiguraci nemá (lhůty, dopravce, ceny dopravy).
* Nikdy netvrdí „skladem" bez `getProductStock` a nikdy neslibuje konkrétní datum doručení,
  které nevrátil dopravce.
* Cizí e-shop = cizí konfigurace. Nikdy nemíchat data dvou tenantů v jedné odpovědi.

## GDPR

* Session 3 hodiny, tikety doporučená retence 90 dní, pak smazat/anonymizovat.
* Výsmaz na žádost zákazníka = smazat záznamy podle `sessionId`.
* Do promptu jen to, co je potřeba k vyřízení dotazu.

## Co dělat, když si nejsi jistý

Založ tiket (`createTicket`), řekni „Předávám kolegovi, ozve se do 2 hodin v pracovní době"
a nic nedomýšlej. Nejjistější odpověď je přiznat neznalost a předat případ člověku.
