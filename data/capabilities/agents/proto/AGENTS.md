# AGENTS.md — jak pracovat na agentu Proto

Tenhle soubor je pro kodéry (lidské i AI), kteří přijdou později.

## Konvence

- **Žádné závislosti.** Node 18+ a standardní knihovna. `package.json` nemá `dependencies`
  a přidávat je má smysl jen po domluvě — dnešní kód se vejde do pár souborů.
- **ESM všude** (`"type": "module"`), žádný TypeScript, žádný bundler.
- **Kód anglicky, texty pro zákazníka česky.** Identifikátory, komentáře v kódu a názvy
  funkcí anglicky; všechny odpovědi zákazníkovi, chybové hlášky pro uživatele a dokumentace česky.
- **Prompt je produkt.** `prompts/system.md` se needituje „jen tak" — změna ovlivní všechny
  pronajímatele. Placeholdery drž ve tvaru `{{NAZEV}}` a vždy je přidej i do `src/prompt.js`.
- **Tvrdé limity promptu:** odpověď max 4 věty, vždy nabídnout další krok, nikdy nevymýšlet
  stav objednávky. Když model začne psát romány, je to bug v promptu, ne v modelu.

## Když přidáváš nástroj

1. Přidej spec do `TOOL_SPECS` v `src/tools.js` (OpenAI formát: `name`, `description`, `parameters`).
2. Přidej `case` do `runTool` a metodu do `src/providers/demo.js`.
3. Přidej metodu i do `src/providers/shoptet.js` (klidně jako `throw` s jasnou hláškou).
4. Popiš ho do `TOOLS.md` a do sekce 3 v `prompts/system.md`.
5. Napiš scénář do `scripts/test-scenarios.mjs`.

## Když přidáváš e-shop

Vytvoř `tenants/<id>.json` podle `tenants/example.json`, nastav `allowedOrigins`
a `provider`. Víc v `TENANTS.md`. Nic v kódu se nemění.

## Pravidla, která se nesmí rozbít

- **PII nikdy do chatu.** Čísla karet, telefony a adresy se maskují (`src/store.js` → `mask`).
  Do logu jde jen `toMasked`.
- **Žádné tajemství do klienta.** `/api/config` vrací jen `publicConfig()`.
- **Fallback musí zůstat funkční.** Když LLM není nebo spadne, zákazník dostane smysluplnou
  odpověď. Každá nová featura musí mít cestu i v `fallback.js`, jinak je půlka zákazníků bez podpory.
- **`scripts/test-scenarios.mjs` musí projít** (`node scripts/test-scenarios.mjs`).
  Testy běží bez klíče, takže jsou deterministické.
- **Nikdy netvrď „skladem" bez `getProductStock`.**

## Časté chyby

- Diakritika v regexxech: `src/intents.js` normalizuje text (`norm`) a pak matchuje bez diakritiky.
  Kmeny piš bez koncové hranice (`rozbit`), jinak „rozbitá" neprojde.
- Session je v paměti (`src/session.js`), po restartu se ztratí. Tikety a vratky jsou na disku.
- `data/*.jsonl` necommituj — je v `.gitignore`.
