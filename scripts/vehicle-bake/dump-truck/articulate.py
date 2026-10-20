"""Add equipment pivots to retained v1 parts; never re-author their geometry/UVs.
Blender --background --python THIS -- [--output REPO_RELATIVE_DIRECTORY]
Default writes the new v2 bundle. No production build invokes Blender.
"""
import bpy, sys, json, hashlib, shutil
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ROOT / (args[args.index("--output") + 1] if "--output" in args else "art-source/vehicle-bake/dump-truck/v2")
if (OUT / "recipe.json").exists():
    raise SystemExit("Retained output is immutable; choose a fresh --output directory.")
OUT.mkdir(parents=True, exist_ok=True)
OLD = ROOT / "art-source/vehicle-bake/dump-truck/v1"
cfg = json.loads((OLD / "family.json").read_text())
recipe = json.loads((OLD / "recipe.json").read_text())
S = cfg["exportWorldScale"]
bpy.ops.wm.open_mainfile(filepath=str(OLD / "car.blend"))
bpy.context.preferences.filepaths.save_version = 0
root = bpy.data.objects["Dump_Truck_Root_forward_minus_X"]
bpy.data.objects.remove(bpy.data.objects["Body_static"], do_unlink=True)
names = [c["name"] for c in recipe["components"] if c["group"] == "body"]
with bpy.data.libraries.load(str(OLD / "master.blend"), link=False) as (src, dst):
    assert all(n in src.objects for n in names)
    dst.objects = names

def pivot(name, parent, point):
    ob = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    ob.location = point
    return ob

bed = pivot("Dump_Bed_Hinge", root, (3.12, 0, 1.10))
bed["tilefun_dump_bed"] = 1
bed["hinge_axis_gltf"] = [0, 0, -1]
gate = pivot("Dump_Tailgate_Hinge", bed, (-0.02, 0, 1.325))
gate["tilefun_dump_tailgate"] = 1
gate["hinge_axis_gltf"] = [0, 0, -1]
bed_prefixes = ("Deep open steel", "Sloped steel dump", "STATIC broad dump", "Broad dump side rib", "Sloped dump front", "STATIC dump top frontwall")
gate_prefixes = ("Closed steel dump tailgate", "STATIC dump top tailgate")
parts = {root: [], bed: [], gate: []}
ram_index = 0
for ob in dst.objects:
    bpy.context.scene.collection.objects.link(ob)
    if ob.name.startswith("STATIC fixed stowed underbed ram"):
        side = -1 if ob.name.endswith("-1") else 1
        base = Vector((-0.40, side * 0.32, 0.64))
        end = Vector((0.35, side * 0.32, 1.145))
        q = (end - base).to_track_quat("Z", "Y")
        for v in ob.data.vertices: v.co = q.inverted() @ (v.co - base)
        ob.parent = root
        ob.location = base
        ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = q
        ob.name = "Dump_Ram_" + str(ram_index)
        ob["tilefun_dump_ram"] = 1
        ob["bed_mount_gltf"] = [-2.77, 0.045, -side * 0.32]
        ob["rest_length"] = (end - base).length
        ram_index += 1
        continue
    parent = gate if ob.name.startswith(gate_prefixes) else bed if ob.name.startswith(bed_prefixes) else root
    # Source component geometry is in Blender world coordinates at rest.
    ob.parent = parent
    ob.matrix_parent_inverse = Matrix.Identity(4)
    point = Vector((3.10, 0, 2.425)) if parent == gate else Vector((3.12, 0, 1.10)) if parent == bed else Vector((0, 0, 0))
    ob.location -= point
    parts[parent].append(ob)
assert len(parts[bed]) == 13 and len(parts[gate]) == 2, [(p.name, len(v)) for p, v in parts.items()]
assert ram_index == 2
# Compact draw groups retain independent hinges, fixed chassis and all six wheel rigs.
for parent, objects in parts.items():
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objects: ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = {root: "Body_static", bed: "Dump_Bed", gate: "Dump_Tailgate"}[parent]
    mod = ob.modifiers.new("Explicit runtime triangulation", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=mod.name)
for image in bpy.data.images:
    if image.source == "FILE": image.pack()
root.scale = (S,) * 3
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for ob in root.children_recursive: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "model.glb"), export_format="GLB", use_selection=True, export_extras=True, export_yup=True, export_materials="EXPORT")
# Portable CPU fallback uses the actual same triangles/UVs, in game coordinates.
# Source atlas stays byte-identical; only the hierarchy changes.
triangles = []
for ob in root.children_recursive:
    if ob.type != "MESH": continue
    ob.data.calc_loop_triangles()
    part = 2 if ob.parent == gate else 1 if ob.parent == bed else 3 if ob.name.startswith("Dump_Ram_") else 0
    for tri in ob.data.loop_triangles:
        row = [part]
        for vi, li in zip(tri.vertices, tri.loops):
            p = ob.matrix_world @ ob.data.vertices[vi].co
            uv = ob.data.uv_layers.active.data[li].uv
            row.extend(round(v, 6) for v in (-p.x, -p.y, p.z, uv.x, uv.y))
        triangles.append(row)
(OUT / "fallback.json").write_text(json.dumps({"triangles": triangles}, separators=(",", ":")) + "\n")
shutil.copy2(OLD / "atlas.png", OUT / "atlas.png")
root.scale = (1,) * 3
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "car.blend"))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
record = {"revision": "v2", "method": "Retained original component split; same topology, semantic UVs and six wheel rigs", "bedHingeBlender": [3.12, 0, 1.10], "tailgateHingeBlender": [3.10, 0, 2.425], "exportWorldScale": S, "maxTiltDegrees": 48, "tailgateOpenDegrees": 80, "triangles": len(triangles), "artReviewStatus": "awaiting-owner-review", "inputs": {p.relative_to(ROOT).as_posix(): sha(p) for p in [OLD / "master.blend", OLD / "car.blend", OLD / "family.json", OLD / "recipe.json", OLD / "atlas.png", Path(__file__)]}, "outputs": {n: sha(OUT / n) for n in ["model.glb", "car.blend", "atlas.png", "fallback.json"]}}
(OUT / "recipe.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record, indent=2))
