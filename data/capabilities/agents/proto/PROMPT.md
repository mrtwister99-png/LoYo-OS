# PROMPT.md — system prompt agenta

Kanonický prompt je v [`prompts/system.md`](prompts/system.md). Načítá ho `src/prompt.js`,
nahradí placeholdery z konfigurace e-shopu a pošle modelu jako první `system` zprávu.

## Placeholdery

| placeholder | odkud | příklad |
|---|---|---|
| `{{ESHOP_NAME}}` | `tenant.name` | Boty a trička s.r.o. |
| `{{ESHOP_URL}}` | `tenant.url` | https://boty-a-tricka.cz |
| `{{SUPPORT_HOURS}}` | `tenant.supportHours` | Po–Pá 8–17, So 9–12 |
| `{{CARRIERS}}` | `tenant.carriers` | Zásilkovna, PPL, DPD |
| `{{SHIPS_WITHIN}}` | `tenant.shipsWithin` | objednávky do 14:00 odesíláme dnes |
| `{{FREE_SHIPPING}}` | `tenant.freeShippingFrom` | 1500 Kč |
| `{{RETURN_DAYS}}` | `tenant.returnDays` | 14 |
| `{{RETURN_URL}}` | `tenant.returnUrl` | …/vraceni |
| `{{CLAIM_EMAIL}}` | `tenant.claimEmail` | reklamace@… |
| `{{PICKUP_ADDRESS}}` | `tenant.pickupAddress` | Skladová 12, Praha 9 |
| `{{CONTACT_PHONE}}` | `tenant.phone` | +420 … |
| `{{CONTACT_EMAIL}}` | `tenant.email` | podpora@… |
| `{{ORDER_FORMAT}}` | `tenant.orderFormat` | 202600123 |
| `{{HUMAN_SLA}}` | `tenant.humanSlaHours` | 2 |

Neznámý placeholder zůstane v textu doslova — to je záměr, ať je chyba vidět.

## Struktura promptu

1. **Jazyk a tón** — česky, vykat, max 4 věty, zakázané fráze, pravidlo o „jsem AI".
2. **Co o obchodě víš** — provozní data z konfigurace, žádná halucinace.
3. **Nástroje** — šest funkcí, které musí použít před odpovědí.
4. **Workflow** — A) objednávka, B) vratka, C) reklamace, D) sklad, E) faktura/dobírka.
5. **Pravidla** — PII, nadávky, dotazy mimo e-shop, délka odpovědi.
6. **Eskalace** — pět situací, kdy musí předat člověku.
7. **Metadata pro orchestraci** — intent, číslo objednávky, nástroj, výsledek, `need_human`.
8. **Demo režim** — testovací data a povinná věta na konci.
9. **Testovací scénáře** — šest dotazů, které musí zvládnout.

## Jak prompt měnit

- Změna platí pro **všechny** pronajímatele. Když se to týká jednoho e-shopu, patří to
  do `tenants/<id>.json`, ne sem.
- Po editaci projdi `node scripts/test-scenarios.mjs`. Testy jedou `rules` režim,
  takže ověří jen deterministickou část — chování modelu zkontroluj ručně v `/demo`.
- Drž číslované sekce. Orchestrace i lidé se na ně odkazují.

## Vztah promptu a fallbacku

`fallback.js` je zjednodušená verze stejných pravidel v kódu. Když v promptu změníš lhůtu,
částku nebo postup, projdi i fallback — jinak se odpovědi v `rules` a `llm` režimu rozejdou.
Společná data (lhůty, dopravci, texty) jdou z `tenant`, takže většina změn je jen v konfiguraci.

## Metadata

Model nemá za úkol vypisovat JSON — server si `meta` dopočítá sám z provedených nástrojů
(`src/brain.js`). Je to spolehlivější než parsovat odpověď modelu a zákazník nikdy
nevidí interní data.
