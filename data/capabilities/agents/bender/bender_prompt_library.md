# BENDER - Prompt Library - Nejlepší prompty na míru

## 1. Low-poly business man teal background (REFERENCE IMAGE)
USER: "low-poly muž v šedém obleku, bílá košile, černá kravata, hnědé vlasy, teal pozadí, styl jako reference"
KÓD FILE: data/reports/bender/man_lowpoly_v2.py
KLÍČOVÉ: ico_sphere hlava, 8-hranné válce ruce/nohy, bevel sako, oči čárky, 2x AREA light, teal background
VÝSLEDEK: man_lowpoly_v2.blend + thumb 1080x1920

## 2. Rovná cesta 30m + 2 paneláky + chodníky + člověk
USER: "rovna cesta 30m, na jedne strane maly panelak 5 pater 3 vchody, na druhe vetsi 8 pater 4 vchody, chodnik pred kazdym, muze pred panelakem, popelnice a stromy"
KÓD FILE: data/reports/bender/panelaky_fixed.py
KLÍČOVÉ: road plane 30x6 asfalt 0.15, road line bílá, sidewalk 22x2 a 32x2 šedá 0.6, create_panelak() funkce s okny mřížka entrances*2, balkony každý 2. patro, vchody tmavé 0.1, create_man() low-poly, create_bins() modrá žlutá černá, create_tree() trunk cylinder + icosphere leaves, camera (0,-20,10) rot 1.2 lens 35
FIX: BLENDER_EEVEE ne NEXT
VÝSLEDEK: panelaky.blend + thumb 1920x1080

## 3. Chata 6x8m sedlová střecha
USER: "chata 6x8m sedlová střecha dveře a 4 okna"
KÓD PATTERN:
- wall() funkce pro 4 stěny 0.2 tloušťka
- Boolean cut_hole pro dveře 1x2m a okna 1x1.2m
- Střecha: 2x cube scale (4.5, 8.5, 0.2) rot Y +-0.5 rad (ne X!), location Z 3.5
- Kód na střechu: rotation_euler = (0, 0.5, 0) a (0, -0.5, 0)
- Materiál stěny světle béžová, střecha tmavě červená 0.4,0.05,0.05

## 4. Šablona pro jakýkoliv objekt
```
import bpy, os
os.makedirs("D:/dev/loyo-os/data/reports/bender", exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
def make_mat(...)
[build object with low-poly rules]
bpy.ops.object.camera_add...
bpy.ops.object.light_add...
bpy.context.scene.world...
bpy.ops.wm.save_as_mainfile(filepath="D:/dev/loyo-os/data/reports/bender/XXX.blend")
bpy.context.scene.render.filepath = "D:/dev/loyo-os/data/reports/bender/XXX_thumb.png"
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.ops.render.render(write_still=True)
```
