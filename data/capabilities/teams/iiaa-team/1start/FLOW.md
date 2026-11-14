# CELÁ FLOW - IIAA Team 11 agentů (file-trigger)

## 1. User zadá nápad

### Varianta A: Přes API (doporučeno pro LOYO OS UI)
```
POST /api/teams/iiaa-team/start
Body: { "idea": "rychly prohlizec na android - rychly, bez reklam, gesta, vpn" }
```

Co se stane:
1. API zapíše idea do `data/capabilities/teams/iiaa-team/1start/zadani.txt`
2. Resetuje `state.json` - všechny steps na pending
3. Vymaže staré triggery z `triggers/`
4. Vytvoří `triggers/nofps.txt` s obsahem runId
5. Vrátí { runId, flow }

### Varianta B: Přes file watcher (dev)
- Edituješ ručně `1start/zadani.txt`
- Watcher (`watcher.ts`) detekuje změnu a vytvoří `nofps.txt`
- Nebo ručně: `echo "run" > 1start/triggers/nofps.txt`

## 2. Chain 11 agentů (sequential)

```
zadani.txt
  ↓ [watcher/API vytvoří nofps.txt]
[01] nofps (CTO/Product) - sleduje nofps.txt
  → čte zadani.txt
  → píše 02files/01-nofps/01_Product_Spec.md, 02_MVP.md, 03_Modules.md
  → updatuje state.json: 01-nofps = done
  → vytvoří triggers/delete.txt
  ↓
[02] delete (System Architect) - sleduje delete.txt
  → čte 01-nofps/01_Product_Spec.md
  → píše 02files/02-delete/01_Architecture.md, 02_modules.yaml, 03_libs.versions.toml
  → vytvoří triggers/cheater.txt
  ↓
[03] cheater (Domain)
  → čte Architecture
  → píše 02files/03-cheater/01_Entities.md, 02_UseCases.md
  → triggers/camper.txt
  ↓
[04] camper (Data)
  → čte Entities + UseCases
  → píše 02files/04-camper/01_RoomEntities.md, 02_KtorClient.md, 03_RepositoryImpl.md
  → triggers/laggy.txt
  ↓
[05] laggy (UI)
  → píše 02files/05-laggy/01_Theme.md, 02_Screens.md
  → triggers/error.txt
  ↓
[06] error (Build)
  → píše 02files/06-error/01_settings.gradle.kts.md, 02_build-logic.md
  → triggers/fatal.txt
  ↓
[07] fatal (QA)
  → píše 02files/07-fatal/01_UnitTests.md
  → triggers/cancel.txt
  ↓
[08] cancel (Code Reviewer)
  → čte všechny předchozí + dělá ponytail review
  → píše 02files/08-cancel/01_CODE_REVIEW.md
  → triggers/pwner.txt
  ↓
[09] pwner (DevOps)
  → píše 02files/09-pwner/01_ci.yml.md, 02_release.yml.md
  → triggers/op.txt
  ↓
[10] op (Doc)
  → píše 02files/10-op/01_README.md, 02_Architecture_Final.md
  → žádný další trigger = KONEC PIPELINE
  → state.json currentStep = done
```

## 3. On-demand: eskejp (Research)

Kdykoliv během pipeline může jakýkoliv agent vytvořit:

```
echo "hledej: Ktor 3.2.0 verze a changelog" > 1start/triggers/eskejp.txt
```

- eskejp se probudí
- udělá web_search
- zapíše `02files/00-eskejp/01_research_ktor_3_2.md`
- nevytváří další trigger (je mimo chain)

## 4. Paralelní varianta (pro speed)

Místo sequential může `delete` po dokončení vytvořit 4 triggery najednou:

```
delete dokončí
  → vytvoří cheater.txt + camper.txt + laggy.txt + error.txt zároveň
  → všichni 4 běží paralelně
  → fatal čeká v state.json až budou všichni 4 done (barrier)
  → pak teprve fatal začne
```

Pro teď je jednodušší sequential. Až to bude fungovat, přepneme na parallel.

## 5. Co s Mary-Jane?

**Mary-Jane, Julia, Kosterad, Lubor NEpatří do iiaa-team.**

To byl bug - auto-fix ti přepsal manifest.json na 4 náhodné agenty. Správný iiaa-team je 11:

nofps, delete, cheater, camper, laggy, error, fatal, cancel, pwner, eskejp, op

Mary-Jane je samostatný agent (možná pro jiný team - marketing? content?). Pokud ji chceš do pipeline, musíme ji přidat jako 12. agenta, ale pro Kotlin factory ji nepotřebuješ.

## 6. Jak volat z LOYO OS UI?

```typescript
// V tvém React komponentu
const startPipeline = async (idea: string) => {
  const res = await fetch('/api/teams/iiaa-team/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea })
  });
  const data = await res.json();
  console.log('Run started', data.runId);
  
  // Polluj state.json pro progress
  const poll = setInterval(async () => {
    const stateRes = await fetch('/api/teams/iiaa-team/state');
    const state = await stateRes.json();
    console.log('Current step', state.currentStep);
    if (state.currentStep === 'done') clearInterval(poll);
  }, 2000);
};
```

## 7. Soubory v tomto zipu

- `api/start.ts` - POST endpoint co spustí pipeline
- `watcher.ts` - file watcher pro dev
- `orchestrator.ts` - helper co volá agenty
- `FLOW.md` - tento soubor
