# TOOLS.md — nástroje agenta

Šest funkcí, které agent **musí** zavolat, než něco tvrdí. Definice jsou v `src/tools.js`
(`TOOL_SPECS` v OpenAI formátu), provedení v `runTool`, data v `src/providers/*`.

## getOrderStatus

Stav objednávky. Vstup `{ orderId }`.

```json
{ "found": true, "orderId": "2026001", "state": "expedována", "carrier": "PPL",
  "tracking": "123456789", "eta": "zítra", "total": 2390, "items": ["Tričko Basic černé"] }
```

- `found: false` → agent nesmí tvrdit, že objednávka existuje. Nabídne kontrolu čísla nebo tiket.
- Používá se i pro rozhodnutí o prioritě reklamace (`total > 5000` → `high`).

## getTracking

Tracking číslo, dopravce a odkaz. Vstup `{ orderId }`.

```json
{ "found": true, "carrier": "PPL", "tracking": "123456789",
  "lastEvent": "expedována", "url": "https://www.ppl.cz/vyhledani-zasilky?cislo=123456789" }
```

Odkaz se staví podle dopravce. Když dopravce není v mapě, `url` je `null` a agent odkaz vynechá.

## getProductStock

Skladová dostupnost. Vstup `{ query, size? }`.

```json
{ "found": true, "name": "Boty Runner 42", "size": "42", "sizeAvailable": true,
  "inStock": true, "quantity": 2, "restockInDays": 0 }
```

Pravidla:
- `inStock: false` → nikdy neříct „skladem", nabídnout hlídání naskladnění.
- `found: false` → nehádat; požádat o přesný název nebo odkaz na produkt.
- `sizeAvailable: false` → velikost není, nabídnout jinou.

## createReturn

Vytvoří vratku. Vstup `{ orderId, reason?, items? }`.

```json
{ "created": true, "returnId": "VR2026FB58",
  "labelUrl": "https://boty-a-tricka.cz/vraceni/stitek/VR2026FB58", "refundDays": 14 }
```

Ukládá se do `data/returns.jsonl`. Odpověď zákazníkovi má tři kroky (zabalit, štítek,
odnést na Zásilkovnu/PPL) + lhůtu na peníze.

## createTicket

Předání člověku. Vstup `{ summary, reason?, priority? }`.

```json
{ "ticketId": "T-534840", "createdAt": "2026-11-15T10:12:00.000Z",
  "priority": "high", "slaHours": 2 }
```

Ukládá se do `data/tickets.jsonl` včetně `sessionId` a souhrnu. `needHuman` v `meta`
se nastaví automaticky, když se tento nástroj použije.

## sendSMSorEmail

Odeslání potvrzení, štítku nebo faktury. Vstup `{ channel: "email"|"sms", to?, template }`.

```json
{ "sent": true, "channel": "email", "toMasked": "po***@boty-a-tricka.cz", "template": "invoice" }
```

Do logu jde vždy jen maskovaný příjemce (`src/store.js` → `mask`). Když provider
odeslání neumí (`sent: false`), agent to řekne a předá ruční vyřízení.

## Kdy agent eskaluje (createTicket)

- zákazník chce člověka
- druhá nadávka v konverzaci (`session.strikes >= 2`)
- objednávka nad 10 000 Kč s problémem
- reklamace nad 5 000 Kč (priorita `high`)
- nástroj selhal nebo agent neví

## Demo data

| objednávka | stav | dopravce | tracking |
|---|---|---|---|
| 2026001 | expedována | PPL | 123456789 |
| 2026002 | přijata, čeká na expedici | — | — |
| 2026003 | doručena | Zásilkovna | ZA998877 |

| produkt | sklad |
|---|---|
| Tričko Basic černé | 42 ks (S–XL) |
| Boty Runner 42 | 2 ks (vel. 42) |
| Mikina Premium | 0 ks, naskladnění za 5 dnů |

## Přidání nástroje

Viz `AGENTS.md` → „Když přidáváš nástroj". Krátce: spec do `TOOL_SPECS`, `case` do
`runTool`, metoda do obou providerů, popis sem a do promptu, scénář do testů.
