"""Build bounded pet poses from retained editable anatomy, before pixel finishing.

Run Blender --background --factory-startup --python-exit-code 1 --python this_file
-- PET_ID [--render-guides]. Existing registered sources are read, never written.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
arguments = sys.argv[sys.argv.index("--") + 1:]
pet_id = arguments[0]
batch = json.loads((ROOT / "art-source/wildlife-v2/pet-batch.json").read_text())
pet = next(p for p in batch["pets"] if p["id"] == pet_id)
species = pet["species"]
revision = batch["revision"]
source_dir = ROOT / f"art-source/wildlife-v2/{pet_id}/{revision}"
source_dir.mkdir(parents=True, exist_ok=True)
original = ROOT / f"art-source/wildlife-v2/{species}/draft-v1/build.py"
code = original.read_text(encoding="utf-8")


def replace(old, new):
    global code
    assert code.count(old) == 1, f"Retained builder changed: {old[:70]}"
    code = code.replace(old, new)


replace("S=Path(__file__).parent;R=S.parents[3]", f"S=Path({str(source_dir)!r});R=S.parents[3]")
replace(f"wildlife-v2/{species}/draft-v1", f"wildlife-v2/{pet_id}/{revision}")
replace(f"'{species}-draft-v1-geometry-01'", f"'{pet_id}-{revision}-geometry-01'")
assert code.count(f"S/'{species}.blend'") == 2
# Save and later hash read both name the original file.
code = code.replace(f"S/'{species}.blend'", "S/'animal.blend'")

if species == "cat":
    marker = " for n,hip in hips.items():\n"
    amplitude, pitch = 0.0625, 2.0
else:
    marker = " for n,hip in hips.items():\n"
    amplitude, pitch = 0.065, 1.2
    replace("[.32,.34,.12]", "[.34,.36,.12]")
    # Retriever has a full golden coat, softer longer ears and a level tail.
    if pet_id == "dog-golden":
        replace("(.095,.155,.29)", "(.115,.175,.31)")
        replace("45-j*8", "24-j*3")
    else:
        # A distinct triangular upright ear mesh; no scaling a hanging-ear sprite.
        replace("def segment(n,L,r,m,parent=body):", """def ear_mesh(n,m,parent,s):
 d=bpy.data.meshes.new(n+'-mesh')
 d.from_pydata([(-.12,-.07,0),(.12,-.07,0),(s*.035,0,.48),(-.12,.07,0),(.12,.07,0)],[],[(0,1,2),(3,2,4),(0,2,3),(1,4,2),(0,3,4,1)])
 d.update();o=bpy.data.objects.new(n,d);sc.collection.objects.link(o)
 o.parent=parent;o.data.materials.append(m);meshes.append(o)

def segment(n,L,r,m,parent=body):""")
        replace(
            "uv('pendent-ear-'+str(s),(s*.07,.05,-.25),(.095,.155,.29),earmat,rig);ears[s]=rig",
            "ear_mesh('upright-ear-'+str(s),earmat,rig,s);"
            "ears[s]=rig",
        )
        replace("45-j*8", "12-j*4")

replace(marker, f""" body.location=(.01*math.sin(math.tau*p) if clip=='walk' else 0,0,
     {amplitude}*(1-math.cos(2*math.tau*p)) if clip=='walk' else 0)
 body.rotation_euler.x=math.radians({pitch})*math.sin(math.tau*p) if clip=='walk' else 0
 key(body,fr);head.rotation_euler.x=-body.rotation_euler.x;key(head,fr)
 bpy.context.view_layer.update();B=body.matrix_basis.copy();inverse=B.inverted()
 for n,hip in hips.items():
""")
# Foot targets stay in root/world coordinates; the solver works in moving-body
# coordinates. Paw rotation cancels body pitch, keeping the sole on the floor.
if species == "cat":
    replace("a=Vector(hip);L1,L2,L3=Ls[n]", "foot=inverse@foot;ankle=inverse@ankle;a=Vector(hip);L1,L2,L3=Ls[n]")
    replace("paws[n].location=foot;key(paws[n],fr);nodes[n]=[list(v) for v in ps];contacts[n]={'world':[foot.x,foot.y,foot.z-.055]",
            "paws[n].location=foot;paws[n].rotation_euler.x=-body.rotation_euler.x;key(paws[n],fr);nodes[n]=[list(B@v) for v in ps];worldfoot=B@foot;contacts[n]={'world':[worldfoot.x,worldfoot.y,worldfoot.z-.055]")
    replace("'tailWorld':[list(v) for v in tailnodes]", "'tailWorld':[list(B@v) for v in tailnodes]")
else:
    replace("a=Vector(hip);knee=solve", "foot=inverse@foot;ankle=inverse@ankle;a=Vector(hip);knee=solve")
    replace("paws[n].location=foot;key(paws[n],fr);nodes[n]=[list(v) for v in ps];contacts[n]={'world':[foot.x,foot.y,foot.z-.07]",
            "paws[n].location=foot;paws[n].rotation_euler.x=-body.rotation_euler.x;key(paws[n],fr);nodes[n]=[list(B@v) for v in ps];worldfoot=B@foot;contacts[n]={'world':[worldfoot.x,worldfoot.y,worldfoot.z-.07]")
    replace("'tailWorld':[list(v) for v in tn]", "'tailWorld':[list(B@v) for v in tn]")

replace("rr['head']=project(head.matrix_world.translation)",
        "rr['head']=project(head.matrix_world.translation);"
        "rr['body']=project(body.matrix_world.translation);"
        "rr['shoulder']=project(bpy.data.objects['shoulder'].matrix_world.translation);"
        "rr['pelvis']=project(bpy.data.objects['pelvis'].matrix_world.translation)")
if "--render-guides" not in arguments:
    replace("bpy.ops.render.render(write_still=True)", "None # optional rendered studies; evaluated pose guides are always retained")
code = code.replace("ROOT-fixed", "ROOT-ground-anchor").replace("BODY-fixed", "BODY-weight-transfer")
code = code.replace("HEAD-fixed", "HEAD-follow")
exec(compile(code, str(original), "exec"), {"__file__": str(source_dir / "build.py")})
(source_dir / "provenance.json").write_text(json.dumps({
    "identity": f"{pet_id}-{revision}",
    "baseBuilder": str(original.relative_to(ROOT)).replace("\\", "/"),
    "baseBuilderSha256": hashlib.sha256(original.read_bytes()).hexdigest(),
    "builder": "art-source/wildlife-v2/pets/build.py",
    "motionContract": "body-motion-20261004",
    "bodyRisePeakToPeakUnits": amplitude * 2,
    "bodyPitchDegrees": pitch,
    "gait": "lateral walk; moving hips, constant-length links, world-grounded soles",
}, indent=2) + "\n", encoding="utf-8")
