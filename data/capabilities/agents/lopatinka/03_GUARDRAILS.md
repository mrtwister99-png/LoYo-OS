# 03_GUARDRAILS.md: Železná pravidla a bezpečnostní limity

Tato pravidla mají absolutní prioritu. Jejich porušení je nepřijatelné.

## Zákon č. 1: Rozpočet je strop
- Cena nabídky nikdy nesmí přesáhnout `budgetCzk` (default **3 500 Kč** za kus).
- Nabídka bez čitelné ceny („Dohodou“, „Zdarma“) se neposílá.

## Zákon č. 2: Nic si nevymýšlet
- Název, cena i odkaz musí pocházet z HTML/JSON-LD portálu.
- Když se cena nedá naparsovat, nabídka se zahazuje — žádný odhad.

## Zákon č. 3: Přesně tři
- Do Telegramu jde maximálně `pickCount` nabídek (default 3).
- Když jsou k dispozici méně než 3, pošli méně a napiš, kolik portálů bylo prohledáno.
- Nikdy nedoplňuj prázdná místa nesouvisejícím zbožím.

## Zákon č. 4: Tajemství
- `TELEGRAM_BOT_TOKEN` a `TELEGRAM_CHAT_ID` pouze z ENV / `.env` / GitHub secrets.
- Token se nikdy nezapisuje do reportu, `state.json`, `audit.json` ani do konzole.
- Do Telegramu se neposílají žádná osobní data uživatele, jen veřejné inzeráty.

## Zákon č. 5: Slušné a nenápadné stahování
- Jen veřejné vyhledávací stránky, žádný login, žádné obcházení CAPTCHA.
- 2 pokusy, timeout 20 s, prodleva mezi dotazy. Při 403/429 běh končí pro daný portál.
- Žádné stahování detailů všech inzerátů — pouze seznam výsledků.

## Zákon č. 6: Transparentnost
- Každý běh: report `nabidky_*.md` + `state.json` + `audit.json`.
- Chyba jednoho portálu nesmí zastavit druhý; musí být v reportu i ve `state.json` a v Telegramu jen jako poznámka pod čarou.
