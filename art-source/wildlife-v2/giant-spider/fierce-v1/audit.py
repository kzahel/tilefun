"""Independently inspect the saved scene's geometry, contacts and native body motion."""
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

SPECIES="giant-spider"
ROOT=next(p for p in Path(__file__).resolve().parents if (p/"package.json").exists())
SCRIPT=Path(__file__).resolve().parent
SCRATCH="--workspace" in sys.argv
WORK=ROOT/sys.argv[sys.argv.index("--workspace")+1] if SCRATCH else ROOT/f"data/fierce-137/{SPECIES}"
SOURCE=WORK/"source" if SCRATCH else SCRIPT
OUT=WORK/"public" if SCRATCH else ROOT/f"public/demos/wildlife-v2/{SPECIES}/fierce-v1"
G=json.loads((WORK/"projected-guides.json").read_text())
assert hashlib.sha256((SOURCE/"animal.blend").read_bytes()).hexdigest()==G["blendSha256"]
scene=bpy.context.scene
root=bpy.data.objects["ROOT-ground-anchor"]
W=G["canvas"][0]
assert scene.camera.data.type=="ORTHO" and abs(scene.camera.data.ortho_scale-W/10)<1e-5
assert tuple(root.location)==(0,0,0)
links=contacts=travel=0
error=0
for name,expected in G["meshLocalGeometrySha256"].items():
    obj=bpy.data.objects[name]
    assert tuple(obj.scale)==(1,1,1)
    assert hashlib.sha256(json.dumps([list(v.co) for v in obj.data.vertices]).encode()).hexdigest()==expected
    assert hashlib.sha256(json.dumps([list(p.vertices) for p in obj.data.polygons]).encode()).hexdigest()==G["meshTopologySha256"][name]
def project(point):
    p=world_to_camera_view(scene,scene.camera,point)
    return [p.x*W,(1-p.y)*W,p.z]
for record in G["records"]:
    root.rotation_euler.z=math.radians(G["cameraContract"]["modelYawDegrees"][record["facing"]])
    scene.frame_set(record["frame"])
    bpy.context.view_layer.update()
    for name in G["meshLocalGeometrySha256"]:
        assert bpy.data.objects[name].hide_render==(name in record.get("hiddenMeshes",[]))
    for name,points in record["limbsWorld"].items():
        for j,length in enumerate(record["limbLengths"][name]):
            a,b=Vector(points[j]),Vector(points[j+1])
            assert abs((b-a).length-length)<2e-6
            obj=bpy.data.objects[f"{name}-{j}"]
            for local,target in [(Vector((0,0,-length/2)),a),(Vector((0,0,length/2)),b)]:
                assert (obj.matrix_world@local-root.matrix_world@target).length<8e-6
            links+=1
        foot=bpy.data.objects[f"{name}-foot"]
        actual=foot.matrix_world@Vector((0,0,-G["sole"]))
        c=record["contacts"][name]
        assert (actual-root.matrix_world@Vector(c["world"])).length<8e-6
        if c["planted"]:
            assert abs(actual.z)<2e-6
            contacts+=1
            if record["clip"] in ["walk","charge"]:
                assert abs(c["world"][1]+c["stride"]*c["phase"]-(c["baseY"]+c["stride"]*c["stance"]/2))<2e-6
                travel+=1
        else: assert actual.z>0
    for name,volume in record["volumes"].items():
        obj=bpy.data.objects[name]
        points=[obj.matrix_world@v.co for v in obj.data.vertices]
        assert min(p.z for p in points)>-1e-6,(name,record["clip"],record["index"],min(p.z for p in points))
        pp=[project(p) for p in points]
        bounds=[min(p[0] for p in pp),min(p[1] for p in pp),max(p[0] for p in pp),max(p[1] for p in pp)]
        error=max(error,max(abs(a-b) for a,b in zip(bounds,volume["bbox"])))
        assert error<2e-5
motion={}
for facing in G["cameraContract"]["modelYawDegrees"]:
    rows=[r for r in G["records"] if r["facing"]==facing and r["clip"]=="walk"]
    motion[facing]={}
    for name in ["body","head","shoulder","pelvis"]:
        values=[r[name][1] for r in rows]
        motion[facing][name]=round(max(values)-min(values),5)
        assert motion[facing][name]>.85,(facing,name,values)
        assert max(round(v) for v in values)-min(round(v) for v in values)>=1
report={"identity":f"{SPECIES}-fierce-v1","poses":len(G["records"]),"meshCount":len(G["meshLocalGeometrySha256"]),
        "fixedLengthLinkChecks":links,"plantedGroundContacts":contacts,"stanceTravelCompensationChecks":travel,"maxProjectionError":error,
        "nativeProjectedMotionRangePx":motion,"status":"Saved-source integrity passes; human art approval is separate."}
(OUT/"source-audit.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8",newline="\n")
print(json.dumps(report))
