# API.md

Base URL: `http://localhost:4319` (nebo vlastní doména). Všechny odpovědi jsou JSON
(kromě statických souborů), `cache-control: no-store`.

## GET /api/health

Kontrola, že agent žije a jestli má LLM.

```json
{ "ok": true, "agent": "proto", "version": "0.1.0", "llm": false }
```

## GET /api/config?tenant=demo

Veřejná konfigurace pro widget. **Nikdy** neobsahuje klíče ani interní cesty.

```json
{
  "id": "demo",
  "name": "Boty a trička s.r.o.",
  "greeting": "Dobrý den, jak vám mohu pomoci s objednávkou?",
  "color": "#f59e0b",
  "quickReplies": ["Kde je moje objednávka?", "Chci vrátit zboží"],
  "supportHours": "Po–Pá 8–17, So 9–12",
  "demo": true
}
```

Neznámý tenant → vrátí se `demo` (a do logu warning). `allowedOrigins` v konfiguraci
řídí CORS.

## POST /api/chat

```json
{ "tenant": "demo", "sessionId": "s_abc123", "message": "Kde je moje objednávka 2026001?" }
```

| pole | povinné | pravidla |
|---|---|---|
| `tenant` | ne | název z `tenants/`, default `PROTO_TENANT` nebo `demo` |
| `sessionId` | ne | max 64 znaků; bez něj server vygeneruje a vrátí nový |
| `message` | ano | 1–1000 znaků, delší se ořízne |

Odpověď `200`:

```json
{
  "reply": "Vaše objednávka č. …6001 je expedována. Dopravce PPL, tracking 123456789…",
  "sessionId": "s_abc123",
  "meta": {
    "intent": "order",
    "orderId": "2026001",
    "tools": ["getOrderStatus", "getTracking"],
    "needHuman": false,
    "demo": false,
    "turn": 1,
    "engine": "rules"
  }
}
```

`sessionId` je potřeba posílat další dotazy — drží kontext („a jaké je tracking?").
Widget si ho ukládá do `localStorage`.

## Chyby

| kód | `error` | kdy |
|---|---|---|
| 400 | `invalid_json` | tělo není JSON |
| 400 | `empty_message` | prázdný dotaz |
| 413 | `body_too_large` | tělo nad 16 kB |
| 429 | `rate_limited` | 40 zpráv / 5 min z jedné IP+session |
| 500 | `server_error` | neočekávaná chyba (detail jen do logu) |

Chybová odpověď má vždy i české `message`, které jde ukázat zákazníkovi.

## CORS

Povolené originy se berou z `tenant.allowedOrigins`. `["*"]` povolí vše (demo).
Pro produkci vyplň konkrétní domény e-shopu — widget pak nejde vložit na cizí web.

Preflight `OPTIONS` vrací `204` s `access-control-max-age: 600`.

## Statické soubory

| cesta | obsah |
|---|---|
| `/widget.js` | vložitelný chat, `access-control-allow-origin: *` |
| `/demo`, `/` | demo e-shop s widgetem |

Jsou to jen tyhle tři cesty — server nečte libovolnou cestu z URL.

## Rychlé ověření z terminálu

```bash
curl -s localhost:4319/api/health
curl -s -X POST localhost:4319/api/chat \
  -H 'content-type: application/json' \
  -d '{"tenant":"demo","sessionId":"t1","message":"Kde je moje objednávka 2026001?"}'
```
