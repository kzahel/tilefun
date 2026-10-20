"""Independent checks of saved action meshes and native atlas retention."""
import bpy,hashlib,json,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];a=sys.argv[sys.argv.index('--')+1]
S=R/f'art-source/wildlife-v2/{a}/behavior-v1';O=R/f'public/demos/wildlife-v2/{a}/behavior-v1'
bpy.ops.wm.open_mainfile(filepath=str(S/f'{a}.blend'))
scene=bpy.context.scene;inputs=json.loads((S/'inputs.json').read_text());previous=json.loads((O/'source-audit.json').read_text())
assert scene.camera.data.type=='ORTHO' and abs(scene.camera.data.ortho_scale-inputs['canvas']/10)<1e-6
assert {o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'}==previous['meshGeometryUnchanged']
clips=[('eat',8)] if a!='meerkat' else [('scan',12),('alarm',8),('rear',8),('lower',8)]
checks=0;max_gap=0;hind=[];head=[]
for c,(name,count) in enumerate(clips):
    for i in range(count):
        scene.frame_set(200+c*40+i);bpy.context.view_layer.update()
        root=bpy.data.objects['ROOT-ground-fixed' if a=='robin' else 'ROOT-fixed-ground']
        assert root.location.length<1e-7
        h=bpy.data.objects['HEAD-stable-volume' if a=='rabbit' else 'HEAD-rigid-skull' if a=='robin' else 'HEAD-rigid']
        head.append(list(h.matrix_world.translation))
        if a=='meerkat':
            p=inputs['profile']
            for end in ['fore','hind']:
                for side in [-1,1]:
                    n=f'{end}{side}'
                    for j,L in enumerate(p[end+'Lengths']):
                        link=bpy.data.objects[f'{n}-link-{j}'];pa=bpy.data.objects[f'{n}-joint-{j}'].matrix_world.translation;pb=bpy.data.objects[f'{n}-joint-{j+1}'].matrix_world.translation
                        gap=max((link.matrix_world@Vector((0,0,-L/2))-pa).length,(link.matrix_world@Vector((0,0,L/2))-pb).length)
                        assert gap<1e-4,(n,j,gap);max_gap=max(max_gap,gap);checks+=1
                    if end=='hind':
                        foot=bpy.data.objects[f'{n}-foot'];assert abs(foot.matrix_world.translation.z-.06)<1e-5;hind.append(list(foot.matrix_world.translation))
            for j,L in enumerate(p['tailLengths']):
                pa=bpy.data.objects[f'tail-joint-{j}'].matrix_world.translation;pb=bpy.data.objects[f'tail-joint-{j+1}'].matrix_world.translation
                assert abs((pb-pa).length-L)<1e-5;checks+=1
previous.update(savedSourceIndependentlyChecked=True,actionSamples=sum(n for _,n in clips),fixedLengthEndpointChecks=checks,maxEndpointGapWorldUnits=max_gap,headHeightRange=max(h[2] for h in head)-min(h[2] for h in head),hindFeetPlanted=bool(hind) if a=='meerkat' else 'native grounded pose retained')
assert previous['headHeightRange']>.1
(O/'source-audit.json').write_text(json.dumps(previous,indent=2)+'\n')
print('MEADOW_AUDIT_OK',a,checks,max_gap)
