/**
 * Testovaci scenare ze zadani. Bezi bez LLM (deterministicky fallback),
 * takze vysledek je stabilni a da se poustet v CI i na stroji bez klice.
 *
 *   node scripts/test-scenarios.mjs
 */
import { handleMessage } from "../src/brain.js";
import { getSession } from "../src/session.js";
import { getTenant } from "../src/tenants.js";

delete process.env.OPENAI_API_KEY;

const tenant = getTenant("demo");

const cases = [
  {
    name: "1 — stav objednávky",
    messages: ["Dobrý den, kde je moje objednávka 2026001?"],
    expect: ["expedována", "PPL", "123456789", "zítra"],
  },
  {
    name: "2 — vrácení zboží",
    messages: ["Chci vrátit mikinu, je mi malá."],
    expect: ["14 dnů", "objednávky"],
  },
  {
    name: "2b — vrácení s číslem objednávky",
    messages: ["Chci vrátit mikinu, je mi malá.", "2026002"],
    expect: ["Vratku jsem vytvořil", "Zásilkovnu", "štítek"],
  },
  {
    name: "3 — reklamace",
    messages: ["Přišla mi rozbitá věc, co mám dělat?"],
    expect: ["Mrzí", "tiket", "2 pracovních"],
  },
  {
    name: "4 — sklad a velikost",
    messages: ["Máte boty Runner ve velikosti 42?"],
    expect: ["skladem", "2 ks"],
  },
  {
    name: "5 — faktura",
    messages: ["Potřebuju fakturu, nepřišla mi."],
    expect: ["fakturu", "e-mail"],
  },
  {
    name: "6 — naštvaný zákazník",
    messages: ["Jste debil, chci člověka!"],
    expect: ["kolegovi", "tiket"],
  },
  {
    name: "7 — demo režim",
    messages: ["demo"],
    expect: ["Toto byla ukázka"],
  },
];

let failed = 0;

for (const testCase of cases) {
  const session = getSession(`test_${Math.random().toString(36).slice(2)}`);
  let last = null;

  for (const message of testCase.messages) {
    last = await handleMessage({ tenant, session, message });
  }

  const reply = last.text;
  const lower = reply.toLowerCase();
  const missing = testCase.expect.filter((needle) => !lower.includes(needle.toLowerCase()));

  if (missing.length) {
    failed += 1;
    console.log(`FAIL ${testCase.name}`);
    console.log(`  chybi: ${missing.join(", ")}`);
    console.log(`  odpoved: ${reply}`);
  } else {
    console.log(`OK   ${testCase.name}`);
    console.log(`  -> ${reply.slice(0, 160)}${reply.length > 160 ? "…" : ""}`);
  }
}

const meta = cases.length;
console.log(`\n${meta - failed}/${meta} scénářů prošlo`);

if (failed > 0) {
  process.exit(1);
}
