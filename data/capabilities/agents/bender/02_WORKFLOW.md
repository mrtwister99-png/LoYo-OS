# 02_WORKFLOW.md: Jak pracuješ

## Workflow: Blender MCP Official (lab/blender_mcp)

### Krok 0: Kontrola spojení (vždy!)
```
Tool: get_blendfile_summary_path_info
Tool: get_objects_summary
```
Pokud vrátí "Cannot connect to Blender" -> řekni uživateli: "Otevři Blender, Preferences > Add-ons > MCP > Start MCP Bridge Server, port 9876"

### Krok 1: Blockout - real-world metry
```python
import bpy
# VŽDY explicitně
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')

# Tvorba v metrech
bpy.ops.mesh.primitive_cube_add(size=0.45, location=(0,0,0.225))
obj = bpy.context.active_object
obj.name = "StoolSeat"
obj.dimensions = (0.45, 0.45, 0.05)
bpy.ops.object.transform_apply(scale=True)
# Bevel
mod = obj.modifiers.new(name="Bevel", type='BEVEL')
mod.width = 0.01

result = {"stage": "blockout", "objects": [obj.name], "dims": list(obj.dimensions)}
```

### Krok 2: Materiály - jen Principled
```python
mat = bpy.data.materials.new(name="Wood_Oak")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.6, 0.4, 0.2, 1)
bsdf.inputs["Roughness"].default_value = 0.35
obj.data.materials.append(mat)
result = {"stage": "materials", "mat": mat.name}
```

### Krok 3: Světla + Kamera
- Key: Area 100W, 45° left, 2m away
- Rim: Area 50W, behind right
- Camera: 85mm, height = object height

### Krok 4: Render
```
Tool: render_thumbnail_to_path(filename="bender_draft.png") -> rychlý 320px
# zkontroluj screenshot
Tool: render_viewport_to_path(filename="bender_final.png") -> full res
```
Pak v Pythonu zkopíruj z `bpy.app.tempdir + "/blender_mcp/bender_final.png"` do `data/reports/bender/`

### Error handling
- Pokud operator selže: zkontroluj active_object a mode
- Edit mode geometry -> použij bmesh, pak `bmesh.update_edit_mesh()`
- Vždy nastav `bpy.context.view_layer.objects.active = obj`

### Model routing
- Hlavní: devstral-small-2:latest (nejlepší tool-use)
- Fallback kód: qwen2.5-coder:32b (čistý bpy)
- Vision check: qwen2.5vl:7b (kouká na screenshoty)
- Embedding pro docs: nomic-embed-text nebo qwen3-embedding:8b
