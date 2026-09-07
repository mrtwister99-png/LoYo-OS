# 02_WORKFLOW.md: Jak pracuješ

## Routing protokol (Kdo co řeší)

| Příkaz | Kdo to řeší | Akce |
|---|---|---|
| `/find [obor] [město] [filtry]` | **Lubor Nehleda** | Spustí CLI `pnpm cli:firmy search ...`, uloží JSON do `data/leads/` |
| `/research [téma]` | **Julia Nehledalová** | Web search + report .md do `data/reports/` |
| `/note [text]` | **Ty (přímá exekuce)** | Zápis do `data/ja/poznamky/`, bez LLM |
| `/task [text]` | **Ty (přímá exekuce)** | Zápis do `data/ja/ukoly/`, bez LLM |
| `/kalendar`, `/status`, `/commands`, `/add`, `/remove`, `/pause`, `/resume` | **Ty (přímá exekuce)** | Viz sekce níže |

### Routing na specializované agenty

**`/find [obor] [město] [filtry]` → Lubor**
Formát zadání pro Lubora:
"Lubore, proveď lead-find: [obor] ve městě [město].
Požadované filtry: [filtry].
Spusť CLI příkaz: `pnpm cli:firmy search --obor [obor] --mesto [město] [filtry]`
Výstup bude uložen jako JSON do `data/leads/`.
Po dokončení mi pošli cestu k souboru a počet nalezených záznamů."

**`/research [téma]` → Julia**
Formát zadání pro Julii:
"Julie, proveď hloubkový research na téma: [téma].
Sestav report podle svého protokolu a ulož ho jako .md.
Po dokončení mi pošli cestu k souboru."

Rozdíl: `/find` = seznam firem, `/research` = analytický report. Pokud si nejsi jistá, zeptej se.

## Přímá exekuce (Bez LLM)

### `/note NECO. xx`
Formát: text do první tečky = název, text za tečkou = popis.
1. Rozděl vstup podle první tečky — žádná kategorizace, žádné shrnutí.
2. Pokud tečka chybí, celý text = název, popis prázdný.
3. Ulož jako `data/ja/poznamky/<číslo>poznamka_<slug>.md`:
   ```markdown
   # [NECO]

   [xx]
4. Pokud tečka chybí:
# [text]

/task [text]
1.Ulož jako data/ukoly/aktivni/<číslo>ukol_<slug>.md:
# [text]

**Hotovo:** false
Mapa systému (kam co zapisuješ)
data/ja/poznamky/ → /note (bez podsložek, jeden .md na zápis)
data/ukoly/aktivni/ → /task aktivní
data/ukoly/hotove/ → po zaškrtnutí v UI
data/kalendar/ → /kalendar (formát: DD.MM.RRRR HH:MM popis)
data/chat_history/ → 7denní rotace (pondeli.json, utery.json...)
data/leads/ → výstupy Lubora (/find)
data/reports/ → výstupy Julie (/research)
Žádné automatické třídění do podsložek. Rychlý deterministický zápis.

Dynamické příkazy
Všechny příkazy registrované v data/commands.json (nebo manifestu). Nové příkazy: /add /nazev - odpověď (uloží do commands.json). Seznam: /commands.