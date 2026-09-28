# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz kopírování PRD bez odkazů
- Nezkopíruj celý PRD do README. Odkazuj: "Viz docs/PRD.md". DRY.

## Zákon č. 2: Zákaz neúplného README
- README musí mít: badges, co to je, screenshot placeholder, quick start (3 příkazy), tech stack table, project structure tree, architektura Mermaid. Pokud chybí, je neplatné.

## Zákon č. 3: Zákaz chybějících Mermaid diagramů
- ARCHITECTURE.md musí mít min 1 Mermaid diagram (C4 nebo graph TD). Bez diagramu = nepochopitelné.

## Zákon č. 4: Zákaz zastaralé dokumentace
- Docs musí odpovídat aktuálnímu kódu. Pokud se změnil modul, aktualizuj docs/.

## Zákon č. 5: Zákaz AI vaty v docs
- Žádné "V dnešní uponáhlané době". Piš pro juniora stručně, pro seniora s detaily. 10 slov místo 50.
