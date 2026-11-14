# LoYo F3 - 4 kritické fixy

Tyhle 4 bugy ti shazují číslování F3 a FTS:

## 1. TYPE_FOLDER bug capabilities.ts:28
**Bug:** mcp -> mcps
Koštěrad zapíše do mcps/ a loader to nikdy nenajde.

**Fix:** `mcp: 'mcp'`
Soubor: `01-capabilities-TYPE_FOLDER-fix.ts`

## 2. SQL bug MATCH? bez mezery
**Bug:** `WHERE notes_fts MATCH?` bez mezery -> syntax error v SQLite FTS5, shazuje celý FTS pro poznámky/úkoly.

**Fix:** `MATCH ?` s mezerou (jednoznaková oprava ale kritická)
Soubory: `02-notesTasksFts-MATCH-fix.ts` a `02b-search-MATCH-fix.ts`

## 3. DB race - singleton
**Bug:** manifestDb.ts, notesTasksFts.ts a search.ts si každý dělá `new Database()`. Na Windows WAL to zamrzá.

**Fix:** `connection.ts` singleton `getDb()` - všichni používají sdílenou instanci.
Soubory: `03-connection-singleton-fix.ts` + `03b-manifestDb-singleton-fix.ts`
+ busy_timeout 5000 pro Windows

## 4. Dir traversal tmp.ts
**Bug:** `path.includes('tmp')` projde `data/tmp/../../.env`

**Fix:** 
```ts
const resolved = resolve(DATA_DIR, query.path);
const safeData = DATA_DIR.endsWith(sep) ? DATA_DIR : DATA_DIR + sep;
if (!resolved.startsWith(safeData)) return 403
```
Soubor: `04-tmp-traversal-fix.ts`

## Jak aplikovat
```powershell
# rozbal do rootu yolo/
./patches/apply.ps1
```

Nebo ručně překopíruj soubory do apps/api/src/...
