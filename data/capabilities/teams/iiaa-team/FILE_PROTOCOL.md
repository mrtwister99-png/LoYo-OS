
# FILE PROTOCOL pro všechny agenty IIAA-Team

Každý agent musí mít v 02_WORKFLOW.md na začátku:

### Krok 0: File Trigger Watch
- Sleduješ soubor: `data/capabilities/teams/iiaa-team/1start/triggers/<tvoje-id>.txt`
- Když existuje, začni práci.
- Tools: readFile(state.json), readFile(zadani.txt), readFile(02files/predchozi-agent/*)
- Výstup piš do: `data/capabilities/teams/iiaa-team/1start/02files/{order}-{id}/01_*.md`
- Po dokončení: writeFile(triggers/<next-id>.txt) + update state.json

Příklad pro delete (System Architect):
- Trigger: triggers/delete.txt
- Čte: 02files/01-nofps/01_PRD.md
- Píše: 02files/02-delete/01_ARCHITECTURE.md, 02_modules.yaml
- Vytvoří: triggers/cheater.txt

Paralelní varianta:
delete po dokončení vytvoří 4 triggery: cheater.txt, camper.txt, laggy.txt, error.txt
fatal čeká v state.json až budou všechny 4 done.

Pro eskejp (Research):
- Kdokoliv může vytvořit triggers/eskejp.txt s dotazem
- eskejp přečte dotaz, udělá web_search, zapíše do 02files/00-eskejp/01_research_<slug>.md
