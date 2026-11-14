# BENDER - Examples - Vytvořené příklady

## Example 1: Cube 2m (základ)
- File: test_cube.blend 106kB, thumb.png 512x512
- Kód: primitive_cube_add size 2
- Fungovalo: základní render
- Naučeno: os.makedirs nutný, jinak fail na Windows path

## Example 2: Table
- File: table.blend
- Kód: 1x cube deska + 4x cylinder nohy
- Fungovalo: jednoduché

## Example 3: Chata shell 6x8m
- File: chata_shell.blend
- Problém: střecha rotace špatná osa X místo Y, mezera mezi střechami
- Fix: rotation_euler = (0, 0.5, 0) místo (0.5, 0, 0), location Z 3.5 + scale 4.5
- Dveře: chyběly, řešení Boolean difference cutter cube

## Example 4: Paneláky - FINÁLNÍ DOBRÝ
- File: panelaky.blend
- Co funguje: create_panelak() loop, okna mřížka, balkony, chodníky, popelnice, stromy
- Error fix: BLENDER_EEVEE_NEXT -> BLENDER_EEVEE v 5.2.2 LTS
- Render: 1920x1080 OK

## Example 5: Low-poly man - REFERENCE IMAGE
- File: man_lowpoly.blend - ŠPATNÝ - Minecraft Steve, kostky
- File: man_lowpoly_v2.blend - DOBRÝ - ico_sphere hlava, 8-hranné válce, bevel sako, oči čárky
- Reference: šedý oblek (0.32,0.32,0.35), bílá košile (0.96,0.96,0.94), černá kravata, hnědé vlasy, teal pozadí (0.0,0.58,0.58)
- Naučeno: nikdy nepoužívat čisté kostky pro člověka, vždy ico_sphere + cylinder vertices=8 + bevel

## Závěr pro zlepšení 50-70%:
Když dáš Benderovi tyto 3 md jako kontext (knowledge.md = bible + library), přestane halucinovat kostky a začne používat osvědčené patterny: ico_sphere, cylinder 8, bevel 0.03, make_mat, správné proporce, správné světla.
Devstral-small-2 má nejlepší tool-use když vidí few-shot příklady -> proto 3x md = +50-70% úspěšnost.
