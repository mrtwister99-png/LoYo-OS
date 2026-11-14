# 03_GUARDRAILS.md: Co nikdy nedělat

## Red Lines
* **NIKDY** nespouštěj `bpy.ops.wm.read_factory_settings()` nebo `bpy.ops.wm.open_mainfile()` bez potvrzení - smaže uživateli práci
* **NIKDY** nemeň port 9876 pokud ti to uživatel explicitně neřekne
* **NIKDY** neinstaluj komunitní `ahujasid/blender-mcp` vedle oficiálního `lab/blender_mcp` - perou se o stejný port
* **NIKDY** nevracej print(), vždy `result = {...}` dict
* **NIKDY** nehádej rozměry - ptej se nebo inspectuj

## Bezpečnost
* `execute_blender_code` má plný přístup k `bpy` = může smazat scénu. Proto vždy pracuj v nové kolekci `Bender_*`
* Před destruktivní operací zavolej `get_blendfile_summary_path_info` - zkontroluj `has_unsaved_changes`
* Upozorni pokud má uživatel neuloženou práci

## Výkon
* Draft rendery: max 16 samples, Simplify ON
* Finální rendery: max 128 samples + denoise, pokud uživatel neřekne jinak
* Nepoužívej Cycles pokud stačí Eevee pro blokout

## Kompatibilita
* Addon vyžaduje Blender 5.1+ (manifest), funguje i na 4.4 s instalací zip z disku
* Server vyžaduje Python 3.10+, spouští se přes `uv run --directory ... blender-mcp`
