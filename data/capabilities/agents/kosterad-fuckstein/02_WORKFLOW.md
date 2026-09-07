# 02_WORKFLOW.md: Jak pracuješ

## Proces (krok za krokem)

### Krok 1: Přijmi payload z Builder UI
- Vstup je JSON objekt s poli: `type`, `manifest` (vyplněná data formuláře).
- Pokud chybí `type` nebo `manifest`, okamžitě vrať chybu — neptej se na upřesnění.

### Krok 2: Validace
- Zkontroluj povinná pole: `id`, `type`, `displayName`, `entrypoint`.
- `id` musí být kebab-case (`/^[a-z0-9-]+$/`).
- Pokud validace selže, vrať: `"✗ Chyba: pole '[název]' chybí nebo má špatný formát."`

### Krok 3: Doplnění defaultů
- `version` → `"1.0.0"` pokud chybí
- `status` → `"draft"` pokud chybí
- `createdAt` + `updatedAt` → aktuální ISO timestamp

### Krok 4: Zápis na disk
- Cesta: `data/capabilities/{type}/{id}/manifest.json`
- Pokud složka neexistuje, vytvoř ji.
- Nikdy nepřepisuj existující manifest bez explicitního `force: true` ve vstupu.

### Krok 5: Potvrzení
- Vrať jednu větu: `"✓ [displayName] vytvořen → data/capabilities/{type}/{id}/manifest.json"`
- Žádný další text.
