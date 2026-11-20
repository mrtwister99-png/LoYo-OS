/** Rozpoznavani umyslu a vytahovani udaju z textu. Zadna zavislost, zadny model. */

const PROFANITY = /\b(debil|kreten|kokot|picus|pica|vole|idiot|dement|svine|hovado|zmrd|bitch|fuck)\b/;
const HUMAN = /\b(clovek|cloveka|clovekem|operator|operatorku|predat|predej)\b/;

export function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isAngry(message) {
  return PROFANITY.test(norm(message));
}

export function classify(message) {
  const t = norm(message);

  if (HUMAN.test(t)) return "human";
  if (/\b(vratit|vraceni|vratka|vratku|vratim|vratite)\b/.test(t)) return "return";
  // Kmeny bez koncove hranice - "rozbitá", "rozbité", "nefunguje"...
  if (/\b(reklamac|rozbit|poskoz|vadn|nefunguj|praskl|ulomen)/.test(t)) return "complaint";
  if (/\b(faktur|faktura|fakturu|potvrzeni o platbe)\b/.test(t)) return "invoice";
  if (/\b(dobirka|dobirkou|dobirku)\b/.test(t)) return "cod";
  if (/\b(demo|ukazka|test)\b/.test(t)) return "demo";
  if (/\b(skladem|sklad|dostupn|velikost|velikosti)\b/.test(t)) return "stock";
  if (/\b(objednavk|objednavka|objednavku|tracking|zasilka|balik|balicek|kde je)\b/.test(t)) return "order";
  if (/^(ahoj|dobry den|zdravim|cau|hello|hi)\b/.test(t.trim())) return "greeting";
  return "other";
}

export function extractOrderId(message) {
  const m = String(message || "").match(/\b(\d{6,12})\b/);
  return m ? m[1] : null;
}

export function extractEmail(message) {
  const m = String(message || "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

export function extractSize(message) {
  const t = norm(message);
  const explicit = t.match(/(?:velikost|velikosti|size)\s*([0-9]{2}|xs|s|m|l|xl|xxl)\b/);
  if (explicit) return explicit[1].toUpperCase();
  const numeric = t.match(/\b([2-5][0-9])\b/);
  return numeric ? numeric[1] : null;
}

/** Z dotazu udela hledany vyraz pro sklad: "Máte boty Runner ve velikosti 42?" -> "boty runner". */
export function productQuery(message) {
  const stop = new Set([
    "mate", "mas", "mam", "prosim", "dobry", "den", "ahoj", "zdravim", "chci", "chtel",
    "bych", "je", "jsou", "skladem", "skladu", "velikost", "velikosti", "size", "na",
    "ve", "v", "a", "nebo", "pro", "se", "to", "ten", "ta", "ty", "jestli", "mate",
    "nemate", "prosim", "diky", "dekuji", "cau", "ahojte", "kdy", "bude", "zbozi",
  ]);
  const words = norm(message)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w) && !/^\d+$/.test(w));
  return words.join(" ");
}
