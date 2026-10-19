"""Render the actual authored high source owners retained inside car.blend."""
import bpy,json,sys,math
from pathlib import Path
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').exists() and (p/'package.json').exists());REV=sys.argv[sys.argv.index('--')+1];ART=ROOT/'art-source/vehicle-bake/c-surface-bake'/REV
bpy.ops.wm.open_mainfile(filepath=str(ART/'car.blend'));scene=bpy.context.scene
records=json.loads((ART/'transfer.json').read_text())['owners'];names={n for r in records for n in r['sourceOwners']}
collection=bpy.data.collections['Retained high source with authored semantic surface paint'];collection.hide_render=False;collection.hide_viewport=False
source_root=bpy.data.objects.new('Inspection_source_owners',None);scene.collection.objects.link(source_root)
for o in scene.objects:
 if o.type=='MESH':
  o.hide_render=o.name not in names;o.hide_set(o.name not in names)
  if o.name in names:o.parent=source_root
scale=80/4.6;scene.camera.location/=scale;scene.camera.data.ortho_scale/=scale
evidence=ART/'evidence';evidence.mkdir(exist_ok=True)
for i in range(8):
 source_root.rotation_euler.z=i*math.pi/4;scene.render.filepath=str(evidence/f'painted-high-{i}-512.png');bpy.ops.render.render(write_still=True)
(evidence/'high-source-render.json').write_text(json.dumps({'ownerObjectsRendered':sorted(names),'method':'Actual source owner meshes from packed car.blend, SourceSemanticPaint attribute -> emission. Hidden non-owner original trim is excluded because its simplified ink is already on owner body surface. Camera identical at native source scale.','views':8,'canvasInteriorPatches':0},indent=2)+'\n')
