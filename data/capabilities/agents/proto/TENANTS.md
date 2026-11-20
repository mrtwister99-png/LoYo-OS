# TENANTS.md — pronájem dalším e-shopům

Jeden e-shop = jeden JSON v `tenants/`. Kód se nemění, jen konfigurace.
Takže jeden server může obsluhovat víc e-shopů (každý má vlastní `data-tenant` ve widgetu).

## Přidání e-shopu

1. Zkopíruj `tenants/example.json` na `tenants/muj-eshop.json`.
2. Vyplň provozní údaje — všechny jdou do promptu i do odpovědí fallbacku.
3. Nastav `allowedOrigins` na domény e-shopu (produkce, ne `*`).
4. Vlož do e-shopu:

```html
<script src="https://proto.vase-domena.cz/widget.js" data-tenant="muj-eshop"></script>
```

## Pole konfigurace

| pole | význam |
|---|---|
| `id` | musí odpovídat názvu souboru |
| `name`, `url` | jméno a web e-shopu (do promptu, do hlavičky widgetu) |
| `supportHours` | provozní doba podpory |
| `carriers` | seznam dopravců jedním stringem |
| `shipsWithin` | jak rychle expedujete |
| `freeShippingFrom` | od kolika je doprava zdarma |
| `returnDays`, `returnUrl` | lhůta a formulář vrácení |
| `claimEmail`, `pickupAddress`, `phone`, `email` | kontakty |
| `orderFormat` | ukázkový formát čísla objednávky |
| `humanSlaHours` | do kolika hodin se ozve člověk |
| `provider` | `demo` nebo `shoptet` |
| `color` | barva widgetu (hex) |
| `greeting`, `quickReplies` | úvodní zpráva a tlačítka |
| `allowedOrigins` | domény, které smí widget vložit |

`supportHours`, `phone` a `email` se **nikdy** neposílají do prohlížeče — jen `publicConfig`
(`name`, `greeting`, `color`, `quickReplies`, `supportHours`, `demo`).

## Provider dat

- `demo` — deterministická data, hodí se pro ukázku zákazníkovi a testy
- `shoptet` — reálné napojení, potřebuje `SHOPTET_API_TOKEN` a `SHOPTET_API_URL`

Pro e-shop, který není na Shoptetu, se přidá `src/providers/<nazev>.js` se stejnými
šesti metodami (`getOrder`, `getTracking`, `getProductStock`, `createReturn`,
`sendMessage`) a v konfiguraci se nastaví `provider`. Do `src/tools.js` se nic nemění.

## Dva e-shopy na jednom serveru

```
tenants/eshop-a.json   → widget data-tenant="eshop-a"
tenants/eshop-b.json   → widget data-tenant="eshop-b"
```

Session jsou oddělené podle `sessionId` (widget si ho drží per tenant v localStorage).
Tikety mají v `data/tickets.jsonl` pole `tenant`, takže se dají filtrovat.

## Co se před pronájmem musí dořešit

- smlouva a GDPR: tiketů se týká retence, viz `SECURITY.md`
- `allowedOrigins` na konkrétní domény
- vlastní `OPENAI_API_KEY` (nebo aspoň jasně daný limit, kdo platí tokeny)
- skutečný provider dat (demo data nejsou napojená na sklad)
- doména + HTTPS, viz `DEPLOY.md`

## Cena a měření

`meta.tools` a `meta.engine` u každé odpovědi umí říct, kolik dotazů agent vyřešil
bez člověka (`needHuman: false`) — to je číslo, které má smysl pronajímateli ukazovat.
