"""Own stocky Brown Bear animal-avatar geometry template; local hip origin, no vehicle loft.
Blender5.2 factory background four threads. -- --scratch writes fresh replay only.
"""

from pathlib import Path
import bpy, bmesh, json, math, sys, struct, zlib, shutil, hashlib
from mathutils import Vector

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
C = json.loads((S / "rider.json").read_text())
I = json.loads((S / "identity.json").read_text())
PROFILE = json.loads((S / C["contactProfile"]["ownCopy"]).read_text())
assert (
    hashlib.sha256((S / C["contactProfile"]["ownCopy"]).read_bytes()).hexdigest()
    == C["contactProfile"]["sha256"]
)
D = R / "data/vehicle-riders/bear-upright"
scratch = "--scratch" in sys.argv
A = (
    D / "replay-final/source"
    if scratch
    else R / "art-source/vehicle-riders/bear-upright/v1"
)
O = (
    D / "replay-final/public"
    if scratch
    else R / "public/demos/vehicle-riders/bear-upright/v1"
)
for p in [A, O, D]:
    p.mkdir(parents=True, exist_ok=True)
if (O / "report.json").exists():
    assert not json.loads((O / "report.json").read_text()).get("sourceImmutable", False)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scale = C["worldScale"]
hip = Vector(C["hipSocketSource"])
palette = {k: tuple(bytes.fromhex(v[1:])) for k, v in I["palette"].items()}
keys = list(palette)


def png(p, w, h, pix):
    def ch(k, v):
        return (
            struct.pack(">I", len(v))
            + k
            + v
            + struct.pack(">I", zlib.crc32(k + v) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\0" + pix[y * w * 4 : (y + 1) * w * 4] for y in range(h))
    p.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + ch(b"IDAT", zlib.compress(raw, 9))
        + ch(b"IEND", b"")
    )


pixels = bytearray(256 * 256 * 4)
for y in range(256):
    for x in range(256):
        role = "c"
        if y < 84 and x < 252:
            chart = "front" if x < 96 else "back" if x < 192 else "profile"
            x0 = 0 if x < 96 else 96 if x < 192 else 192
            cell = 6 if x < 192 else 4
            rows = I["32"][chart]
            row = min(len(rows) - 1, y // 6)
            col = min(len(rows[row]) - 1, (x - x0) // cell)
            role = rows[row][col]
            if role == ".":
                role = "c"
        elif 96 <= y < 192 and x < 96:
            u = (x - 48) / 34
            v = (y - 146) / 36
            role = "t" if u * u + v * v < 0.72 else "g" if u * u + v * v < 1 else "c"
        elif 112 <= y < 184 and 128 <= x < 224:
            role = "t" if x < 205 else "g"
            if 173 <= x <= 179 and 148 <= y <= 165:
                role = "k"
        elif y >= 224:
            role = keys[min(len(keys) - 1, x // 16)]
        pixels[(y * 256 + x) * 4 : (y * 256 + x + 1) * 4] = bytes((*palette[role], 255))
png(A / "atlas.png", 256, 256, pixels)
shutil.copyfile(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("Bear_original8color_opaque_unlit")
mat.use_nodes = True
nodes = mat.node_tree.nodes
nodes.clear()
out = nodes.new("ShaderNodeOutputMaterial")
tex = nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(str(A / "atlas.png"))
tex.interpolation = "Closest"
tex.extension = "EXTEND"
mat.node_tree.links.new(tex.outputs["Color"], out.inputs["Surface"])
parts = []
stats = []


def mesh(name, verts, faces, role):
    m = bpy.data.meshes.new(name)
    m.from_pydata([tuple(Vector(v) - hip) for v in verts], [], faces)
    m.update()
    o = bpy.data.objects.new(name, m)
    scene.collection.objects.link(o)
    m.materials.append(mat)
    uv = m.uv_layers.new(name="Bear_semantic_UV")
    attr = m.attributes.new("paint_role", "INT", "FACE")
    for f in m.polygons:
        k = role[f.index] if isinstance(role, list) else role
        idx = keys.index(k)
        attr.data[f.index].value = idx
        for j, li in enumerate(f.loop_indices):
            uv.data[li].uv = (
                (idx * 16 + 8 + 3 * math.cos(j * 2 * math.pi / len(f.loop_indices)))
                / 256,
                1 - (240 + 3 * math.sin(j * 2 * math.pi / len(f.loop_indices))) / 256,
            )
    bm = bmesh.new()
    bm.from_mesh(m)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(m)
    bm.free()
    o["semantic_owner"] = name
    o["static_seated_component"] = True
    parts.append(o)
    return o


def box(name, center, dims, role, bevel=0.02, segments=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.object
    o.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("Rounded character solid", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
    v = [tuple(o.matrix_world @ p.co) for p in o.data.vertices]
    f = [tuple(p.vertices) for p in o.data.polygons]
    bpy.data.objects.remove(o, do_unlink=True)
    return mesh(name, v, f, role)


def ellipsoid(name, center, radii, role, segments=10, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1, location=center
    )
    o = bpy.context.object
    o.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    v = [tuple(o.matrix_world @ p.co) for p in o.data.vertices]
    f = [tuple(p.vertices) for p in o.data.polygons]
    bpy.data.objects.remove(o, do_unlink=True)
    return mesh(name, v, f, role)


def limb(name, a, b, ra, rb, role, sides=8):
    a = Vector(a)
    b = Vector(b)
    n = (b - a).normalized()
    u = n.cross(Vector((0, 0, 1)))
    if u.length < 0.1:
        u = n.cross(Vector((0, 1, 0)))
    u.normalize()
    v = n.cross(u).normalized()
    verts = []
    for p, r in [(a, ra), (b, rb)]:
        for j in range(sides):
            verts.append(
                tuple(
                    p
                    + r
                    * (
                        u * math.cos(j * 2 * math.pi / sides)
                        + v * math.sin(j * 2 * math.pi / sides)
                    )
                )
            )
    faces = [
        (j, (j + 1) % sides, sides + (j + 1) % sides, sides + j) for j in range(sides)
    ]
    faces.extend(
        [tuple(range(sides - 1, -1, -1)), tuple(sides + j for j in range(sides))]
    )
    return mesh(name, verts, faces, role)


# Original animal anatomy: fixed short limb lengths; targets can fail, never stretch.
an = C["anatomy"]
targets = {n: Vector(p) / scale for n, p in PROFILE["contacts"].items()}
P = {}
joints = {}
fit = []


def two_bone(a, target, lengths, bend, label):
    a = Vector(a)
    target = Vector(target)
    delta = target - a
    distance = delta.length
    l1, l2 = lengths
    effective = min(max(distance, abs(l1 - l2) + 0.00001), l1 + l2 - 0.00001)
    direction = delta.normalized()
    actual = a + direction * effective
    b = Vector(bend)
    b -= direction * b.dot(direction)
    b.normalize()
    along = (l1 * l1 - l2 * l2 + effective * effective) / (2 * effective)
    joint = a + direction * along + b * math.sqrt(max(0, l1 * l1 - along * along))
    assert (
        abs((joint - a).length - l1) < 1e-6 and abs((actual - joint).length - l2) < 1e-6
    )
    fit.append(
        {
            "limb": label,
            "fixedBoneLengthsSource": lengths,
            "rootSource": list(a),
            "targetJointSource": list(target),
            "actualJointSource": list(actual),
            "unclampedTargetDistanceSource": distance,
            "maximumChainLengthSource": l1 + l2,
            "unreachableBeyondChainWorld": max(0, distance - l1 - l2) * scale,
            "jointSource": list(joint),
            "actualLengthsSource": [(joint - a).length, (actual - joint).length],
        }
    )
    return joint, actual


pelvis = box(
    "Bear broad seated pelvis", (0, 0, 0), an["pelvisDimensions"], "c", 0.065, 2
)
P["hip_saddle"] = Vector((0, 0, -an["pelvisDimensions"][2] / 2))
for sign in [-1, 1]:
    side = "left" if sign < 0 else "right"
    shoulder = Vector(an["shoulderSource"])
    shoulder.y *= sign
    elbow, palm = two_bone(
        shoulder,
        targets["hand_" + side + "_grip"],
        an["armLengthsSource"],
        (0, sign, 0.12),
        "arm_" + side,
    )
    limb("Bear upper arm " + side, shoulder, elbow, 0.112, 0.100, "c", 8)
    ellipsoid("Bear elbow " + side, elbow, (0.104, 0.105, 0.105), "s", 8, 5)
    limb("Bear forearm " + side, elbow, palm, 0.098, 0.081, "c", 8)
    ellipsoid("Bear gripping forepaw " + side, palm, an["forepawRadii"], "c", 10, 6)
    P["hand_" + side + "_grip"] = palm
    hj = Vector(an["hipJointSource"])
    hj.y *= sign
    ankleOffset = Vector(an["ankleFromSoleSource"])
    knee, ankle = two_bone(
        hj,
        targets["foot_" + side + "_support"] + ankleOffset,
        an["legLengthsSource"],
        (-1, sign * 0.4, 0),
        "leg_" + side,
    )
    sole = ankle - ankleOffset
    limb("Bear bent thigh " + side, hj, knee, 0.100, 0.091, "c", 8)
    ellipsoid("Bear knee " + side, knee, (0.098, 0.099, 0.096), "c", 8, 5)
    limb("Bear short shin " + side, knee, ankle, 0.087, 0.073, "c", 8)
    foot = box(
        "Bear broad hindpaw " + side,
        sole + Vector((0, 0, an["hindpawDimensions"][2] / 2)),
        an["hindpawDimensions"],
        "c",
        0.045,
        2,
    )
    # Dark sole is paint on actual hindpaw bottom; no overlay geometry.
    for f in foot.data.polygons:
        if f.normal.z < -0.7:
            for li in f.loop_indices:
                foot.data.uv_layers.active.data[li].uv = (
                    (keys.index("b") * 16 + 8) / 256,
                    1 - 240 / 256,
                )
    P["foot_" + side + "_support"] = sole
    joints[side] = {
        "shoulder": list(shoulder),
        "elbow": list(elbow),
        "palm": list(palm),
        "hip": list(hj),
        "knee": list(knee),
        "ankle": list(ankle),
        "sole": list(sole),
    }
torso = box(
    "Bear stocky torso belly UV owner",
    an["torsoCenter"],
    an["torsoDimensions"],
    "c",
    0.165,
    3,
)
tc = Vector(an["torsoCenter"])
td = Vector(an["torsoDimensions"])
for f in torso.data.polygons:
    if f.normal.x < -0.50:
        for li in f.loop_indices:
            v = torso.data.vertices[torso.data.loops[li].vertex_index].co
            u = (v.y + td.y / 2) / td.y
            v0 = (tc.z + td.z / 2 - v.z) / td.z
            torso.data.uv_layers.active.data[li].uv = (
                (3 + 90 * u) / 256,
                1 - (99 + 90 * v0) / 256,
            )
ellipsoid("Bear short neck", (0, 0, 0.445), (0.20, 0.25, 0.12), "c", 10, 6)
hc = Vector(an["headCenter"])
hd = Vector(an["headDimensions"])
head = box("Bear rounded head UV owner", hc, hd, "c", 0.190, 3)
for f in head.data.polygons:
    for li in f.loop_indices:
        v = head.data.vertices[head.data.loops[li].vertex_index].co
        py = 18 + (hc.z + hd.z / 2 - v.z) / hd.z * 65
        if f.normal.x < -0.50:
            px = (v.y + hd.y / 2) / hd.y * 95
        elif f.normal.x > 0.50:
            px = 96 + (v.y + hd.y / 2) / hd.y * 95
        elif abs(f.normal.y) > 0.50:
            px = 192 + (v.x - (hc.x - hd.x / 2)) / hd.x * 59
        else:
            continue
        head.data.uv_layers.active.data[li].uv = (
            max(0.002, min(0.982, px / 256)),
            1 - max(0.002, min(0.325, py / 256)),
        )
for sign in [-1, 1]:
    ear = ellipsoid(
        "Bear round ear " + str(sign),
        (-0.025, sign * 0.365, 1.000),
        (0.100, 0.110, 0.100),
        "c",
        10,
        6,
    )
    for f in ear.data.polygons:
        if f.normal.x < -0.55:
            for li in f.loop_indices:
                ear.data.uv_layers.active.data[li].uv = (
                    (keys.index("g") * 16 + 8) / 256,
                    1 - 240 / 256,
                )
muzzle = ellipsoid(
    "Bear tan muzzle UV owner", (-0.354, 0, 0.595), (0.142, 0.245, 0.145), "t", 12, 8
)
for f in muzzle.data.polygons:
    for li in f.loop_indices:
        v = muzzle.data.vertices[muzzle.data.loops[li].vertex_index].co
        u = (v.y + 0.245) / 0.49
        v0 = (0.740 - v.z) / 0.29
        muzzle.data.uv_layers.active.data[li].uv = (
            (129 + 94 * u) / 256,
            1 - (113 + 70 * v0) / 256,
        )
ellipsoid("Bear dark nose", (-0.492, 0, 0.640), (0.038, 0.093, 0.047), "k", 8, 5)
ellipsoid("Bear tiny fixed tail", (0.300, 0, 0.095), (0.085, 0.095, 0.085), "s", 10, 6)
contact_errors = {n: (P[n] - targets[n]).length * scale for n in P}
fit_status = (
    "passed-profile-contacts"
    if max(contact_errors.values()) < 0.0001
    else "FAILED-profile-fit-no-stretch"
)
tex.image.pack()
scene.view_settings.view_transform = "Standard"
for o in parts:
    o.data.calc_loop_triangles()
    stats.append(
        {
            "name": o.name,
            "triangles": len(o.data.loop_triangles),
            "semanticOwner": o["semantic_owner"],
        }
    )
bpy.ops.wm.save_as_mainfile(filepath=str(A / "master.blend"))
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
low = bpy.context.object
low.name = "Bear_static_seated"
low["presentation_status"] = "prototype-not-production"
root = bpy.data.objects.new("Bear_HipOrigin_forward_minus_X", None)
scene.collection.objects.link(root)
low.parent = root
for name, point in P.items():
    e = bpy.data.objects.new("Socket_" + name, None)
    scene.collection.objects.link(e)
    e.parent = root
    e.location = Vector(point) - hip
    e["contact_semantics"] = name
mod = low.modifiers.new("Explicit seated topology triangulation", "TRIANGULATE")
bpy.context.view_layer.objects.active = low
bpy.ops.object.modifier_apply(modifier=mod.name)
root.scale = (scale,) * 3
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for o in root.children_recursive:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(O / "rider.glb"),
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_yup=True,
    export_materials="EXPORT",
)
# Canonicalize only triangle index ordering/cyclic starts. Blender's stable geometry
# exporter can visit equivalent opaque triangles in a different order across runs.
# Vertex, normal, UV, image buffers and every triangle's winding stay byte untouched.
path = O / "rider.glb"
glb = bytearray(path.read_bytes())
json_size = struct.unpack_from("<I", glb, 12)[0]
document = json.loads(glb[20 : 20 + json_size])
bin_start = 28 + json_size
for model in document["meshes"]:
    for primitive in model["primitives"]:
        accessor = document["accessors"][primitive["indices"]]
        view = document["bufferViews"][accessor["bufferView"]]
        kind = {5123: "H", 5125: "I"}[accessor["componentType"]]
        count = accessor["count"]
        offset = bin_start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        indices = struct.unpack_from("<" + str(count) + kind, glb, offset)
        triangles = []
        for i in range(0, count, 3):
            a, b, c = indices[i : i + 3]
            triangles.append(min((a, b, c), (b, c, a), (c, a, b)))
        canonical = [v for tri in sorted(triangles) for v in tri]
        struct.pack_into("<" + str(count) + kind, glb, offset, *canonical)
path.write_bytes(glb)
shutil.copyfile(O / "rider.glb", A / "rider.glb")
root.scale = (1,) * 3
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(A / "low.blend"))
recipe = {
    "status": "prototype-not-production",
    "humanApproval": False,
    "template": "Own broad Brown Bear animal-avatar anatomy, fixed short bone lengths and constrained two-bone pose; no Explorer body/clothes or vehicle loft",
    "contactFitStatus": fit_status,
    "actualContactsSource": {n: list(p) for n, p in P.items()},
    "targetMissWorld": contact_errors,
    "fixedLengthIK": fit,
    "anatomicalJointsSource": joints,
    "config": C,
    "palette": I["palette"],
    "components": stats,
    "semanticUV": "Approved Bear head pattern crop on volumetric rounded head; own tan belly and muzzle charts on actual curved animal skin. Round ear/sole palette ownership; no coincident artwork planes.",
    "masterMeaning": "Editable named semantic components at runtime topology; no skeletal animation/high-to-low claim",
    "sourceDependencies": [
        "build.py",
        "rider.json",
        "identity.json",
        "explorer-upright-v1.json",
    ],
    "scratchInputDependencies": [],
    "immutableContactProfile": PROFILE,
    "profileSha256": C["contactProfile"]["sha256"],
    "deterministicIndexOrder": "Winding-preserving cyclic-start and triangle-order canonicalization after export; vertex/normal/UV/image buffers untouched. Opaque static single mesh; geometry unchanged.",
}
for base in [A, O]:
    (base / "recipe.json").write_text(json.dumps(recipe, indent=2) + "\n")
for n in ["build.py", "rider.json", "identity.json", "explorer-upright-v1.json"]:
    shutil.copyfile(S / n, A / n)
low.data.calc_loop_triangles()
g = {
    "triangles": len(low.data.loop_triangles),
    "meshes": 1,
    "materials": 1,
    "textures": 1,
    "atlas": [256, 256],
    "glbBytes": (O / "rider.glb").stat().st_size,
    "sha256": hashlib.sha256((O / "rider.glb").read_bytes()).hexdigest(),
}
(O / "report.json").write_text(
    json.dumps(
        {
            "status": "prototype-not-production",
            "sourceStage": "draft",
            "sourceImmutable": False,
            "humanApproval": False,
            "geometry": g,
            "contactFitStatus": fit_status,
            "targetMissWorld": contact_errors,
            "limits": [
                "One static Brown Bear player-avatar and synthetic fixture; no actual bike/production/27-avatar/AI/fallback qualification",
                "Existing standing/promoted characters and normal vehicle runtime unchanged",
            ],
        },
        indent=2,
    )
    + "\n"
)
print(json.dumps(g))
