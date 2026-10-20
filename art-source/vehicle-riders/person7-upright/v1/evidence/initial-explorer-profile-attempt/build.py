"""Own Person7 legacy human and stacked-cap geometry template; local hip origin, no vehicle loft.
Blender5.2 factory background four threads. -- --scratch writes fresh replay only.
"""

from pathlib import Path
import bpy, bmesh, json, math, sys, struct, zlib, shutil, hashlib
from mathutils import Vector

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
C = json.loads((S / "rider.json").read_text())
I = json.loads((S / "identity.json").read_text())
CORE = ["build.py", "rider.json", "identity.json", "explorer-upright-v1.json"]
if C["contactProfile"]["ownCopy"] != "explorer-upright-v1.json":
    CORE.append(C["contactProfile"]["ownCopy"])
attempt = "--explorer-attempt" in sys.argv
if attempt:
    C["contactProfile"] = C["explorerProfile"].copy()
PROFILE = json.loads((S / C["contactProfile"]["ownCopy"]).read_text())
assert (
    hashlib.sha256((S / C["contactProfile"]["ownCopy"]).read_bytes()).hexdigest()
    == C["contactProfile"]["sha256"]
)
D = R / "data/vehicle-riders/person7-upright"
scratch = "--scratch" in sys.argv
A = (
    D / "replay-final/source"
    if scratch
    else R / "art-source/vehicle-riders/person7-upright/v1"
)
O = (
    D / "replay-final/public"
    if scratch
    else R / "public/demos/vehicle-riders/person7-upright/v1"
)
if attempt:
    A = D / "final-explorer-attempt/source"
    O = D / "final-explorer-attempt/public"
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
        role = "j"
        if y < 80:
            role = "t" if 48 < x < 180 else "c"
            if y > 58:
                role = "c" if x < 160 else "s"
            if 82 <= x <= 102 and 57 <= y <= 76:
                role = "R" if x < 95 else "r"
        elif y < 144:
            chart = "front" if x < 96 else "back" if x < 192 else "profile"
            x0 = 0 if x < 96 else 96 if x < 192 else 192
            cell = 6 if x < 192 else 4
            rows = I["headSkinCharts"][chart]
            role = rows[min(3, (y - 80) // 16)][min(15, (x - x0) // cell)]
            if role == ".":
                role = "h"
        elif y < 176:
            role = "d" if y > 169 else "s" if y < 149 else "c" if (x // 16) % 2 else "l"
        elif y < 224 and x < 128:
            u = x % 64
            v = y - 176
            role = "b"
            if v < 8:
                role = "d"
            elif 4 < u < 14 or 50 < u < 60:
                role = "l"
            elif 29 < u < 35:
                role = "d"
            if x >= 64 and 12 < v < 38:
                role = "b" if 12 < u < 52 else "s"
        elif y >= 232:
            role = keys[min(len(keys) - 1, x // 8)]
        pixels[(y * 256 + x) * 4 : (y * 256 + x + 1) * 4] = bytes((*palette[role], 255))
png(A / "atlas.png", 256, 256, pixels)
shutil.copyfile(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("Person7_source24color_opaque_unlit")
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
    uv = m.uv_layers.new(name="Person7_semantic_UV")
    attr = m.attributes.new("paint_role", "INT", "FACE")
    for f in m.polygons:
        k = role[f.index] if isinstance(role, list) else role
        idx = keys.index(k)
        attr.data[f.index].value = idx
        for j, li in enumerate(f.loop_indices):
            uv.data[li].uv = (
                (idx * 8 + 4 + 1.5 * math.cos(j * 2 * math.pi / len(f.loop_indices)))
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


# Own measured legacy allocation: large cap/head, compact jacket, fixed short limbs.
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


pelvis = box("Person7 trouser pelvis", (0, 0, 0), an["pelvisDimensions"], "o", 0.035, 2)
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
    limb("Person7 upper arm " + side, shoulder, elbow, 0.062, 0.054, "b", 8)
    ellipsoid("Person7 elbow " + side, elbow, (0.054, 0.054, 0.054), "s", 8, 5)
    wrist = palm + (elbow - palm).normalized() * an["wristInsetFromPalmSource"]
    limb("Person7 forearm " + side, elbow, wrist, 0.048, 0.023, "l", 8)
    ellipsoid("Person7 gripping palm " + side, palm, an["palmRadii"], "w", 10, 6)
    P["hand_" + side + "_grip"] = palm
    hj = Vector(an["hipJointSource"])
    hj.y *= sign
    offset = Vector(an["ankleFromSoleSource"])
    knee, ankle = two_bone(
        hj,
        targets["foot_" + side + "_support"] + offset,
        an["legLengthsSource"],
        (-1, sign * 0.3, 0),
        "leg_" + side,
    )
    sole = ankle - offset
    limb("Person7 bent thigh " + side, hj, knee, 0.056, 0.049, "O", 8)
    ellipsoid("Person7 knee " + side, knee, (0.052, 0.053, 0.052), "y", 8, 5)
    limb("Person7 short shin " + side, knee, ankle, 0.046, 0.038, "O", 8)
    foot = box(
        "Person7 boot " + side,
        sole + Vector((0, 0, 0.045)),
        an["bootDimensions"],
        "H",
        0.028,
        2,
    )
    for f in foot.data.polygons:
        if f.normal.z < -0.7:
            for li in f.loop_indices:
                foot.data.uv_layers.active.data[li].uv = (
                    (keys.index("k") * 8 + 4) / 256,
                    1 - 240 / 256,
                )
    P["foot_" + side + "_support"] = sole
    joints[side] = {
        "shoulder": list(shoulder),
        "elbow": list(elbow),
        "wrist": list(wrist),
        "palm": list(palm),
        "hip": list(hj),
        "knee": list(knee),
        "ankle": list(ankle),
        "sole": list(sole),
    }
torso = box(
    "Person7 jacket torso UV owner",
    an["torsoCenter"],
    an["torsoDimensions"],
    "b",
    0.065,
    2,
)
tc = Vector(an["torsoCenter"])
td = Vector(an["torsoDimensions"])
for f in torso.data.polygons:
    if abs(f.normal.x) > 0.5:
        for li in f.loop_indices:
            v = torso.data.vertices[torso.data.loops[li].vertex_index].co
            u = (v.y + td.y / 2) / td.y
            v0 = (tc.z + td.z / 2 - v.z) / td.z
            x0 = 0 if f.normal.x < 0 else 64
            torso.data.uv_layers.active.data[li].uv = (
                (x0 + 1 + 62 * u) / 256,
                1 - (177 + 46 * v0) / 256,
            )
ellipsoid("Person7 neck", (-0.015, 0, 0.255), (0.060, 0.075, 0.055), "w", 8, 5)
hc = Vector(an["headCenter"])
hd = Vector(an["headDimensions"])
head = ellipsoid("Person7 face UV owner", hc, hd / 2, "h", 12, 8)
for f in head.data.polygons:
    for li in f.loop_indices:
        v = head.data.vertices[head.data.loops[li].vertex_index].co
        py = 80 + (hc.z + hd.z / 2 - v.z) / hd.z * 63
        if f.normal.x < -0.5:
            px = (v.y + hd.y / 2) / hd.y * 95
        elif f.normal.x > 0.5:
            px = 96 + (v.y + hd.y / 2) / hd.y * 95
        elif abs(f.normal.y) > 0.5:
            px = 192 + (v.x - (hc.x - hd.x / 2)) / hd.x * 63
        else:
            continue
        head.data.uv_layers.active.data[li].uv = (
            max(0.002, min(0.994, px / 256)),
            1 - max(80 / 256, min(143 / 256, py / 256)),
        )


def cap_loft(name, rings, band=False):
    verts = []
    sides = 16
    for z, rx, ry in rings:
        for j in range(sides):
            a = j * math.tau / sides
            verts.append((-0.015 + rx * math.cos(a), ry * math.sin(a), z))
    faces = [
        (
            i * sides + j,
            i * sides + (j + 1) % sides,
            (i + 1) * sides + (j + 1) % sides,
            (i + 1) * sides + j,
        )
        for i in range(len(rings) - 1)
        for j in range(sides)
    ]
    faces.extend(
        [
            tuple(range(sides - 1, -1, -1)),
            tuple((len(rings) - 1) * sides + j for j in range(sides)),
        ]
    )
    o = mesh(name, verts, faces, "c" if band else "t")
    for f in o.data.polygons:
        if len(f.vertices) != 4:
            continue
        for li in f.loop_indices:
            idx = o.data.loops[li].vertex_index
            ring = idx // sides
            j = idx % sides
            u = j / sides
            if j == 0 and any(v % sides == 15 for v in f.vertices):
                u = 1
            z = rings[ring][0]
            v = (rings[-1][0] - z) / (rings[-1][0] - rings[0][0])
            o.data.uv_layers.active.data[li].uv = (
                max(0.002, min(0.998, u)),
                1 - ((145 + 30 * v) if band else (1 + 78 * v)) / 256,
            )
    return o


cap_loft("Person7 tall teal cap crown UV owner", an["capCrownRings"])
cap_loft("Person7 stacked cap band UV owner", an["capBandRings"], True)
brim = ellipsoid(
    "Person7 projecting fixed cap brim", an["brimCenter"], an["brimRadii"], "c", 12, 8
)
for f in brim.data.polygons:
    if f.normal.z < -0.2:
        for li in f.loop_indices:
            brim.data.uv_layers.active.data[li].uv = (
                (keys.index("d") * 8 + 4) / 256,
                1 - 240 / 256,
            )
ellipsoid(
    "Person7 small face nose", (-0.225, 0, 0.335), (0.035, 0.045, 0.028), "w", 8, 5
)
for sign in [-1, 1]:
    ellipsoid(
        "Person7 ear " + str(sign),
        (-0.015, sign * 0.325, 0.345),
        (0.040, 0.028, 0.045),
        "p",
        8,
        5,
    )
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
low.name = "Person7_static_seated"
low["presentation_status"] = "prototype-not-production"
root = bpy.data.objects.new("Person7_HipOrigin_forward_minus_X", None)
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
    "template": "Own measured legacy Person7 human/cap anatomy, fixed short inferred chains and constrained bent pose; no Explorer head/body recolor or vehicle loft",
    "contactFitStatus": fit_status,
    "actualContactsSource": {n: list(p) for n, p in P.items()},
    "targetMissWorld": contact_errors,
    "fixedLengthIK": fit,
    "anatomicalJointsSource": joints,
    "config": C,
    "palette": I["palette"],
    "components": stats,
    "semanticUV": "Own Person7 source face charts on volumetric head; continuous crown/band UVs with orange accent, blue/teal jacket skin charts and olive trouser/boot palette ownership. No standing billboard or coincident paint planes.",
    "masterMeaning": "Editable named semantic components at runtime topology; no skeletal animation/high-to-low claim",
    "sourceDependencies": CORE,
    "scratchInputDependencies": [],
    "immutableContactProfile": PROFILE,
    "profileSha256": C["contactProfile"]["sha256"],
    "deterministicIndexOrder": "Winding-preserving cyclic-start and triangle-order canonicalization after export; vertex/normal/UV/image buffers untouched. Opaque static single mesh; geometry unchanged.",
}
for base in [A, O]:
    (base / "recipe.json").write_text(json.dumps(recipe, indent=2) + "\n")
for n in CORE:
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
                "One Person7 legacy source pilot and synthetic fixture; no actual bike/normal/20-person/all-avatar/AI/fallback qualification",
                "Existing standing/promoted characters and normal vehicle runtime unchanged",
            ],
        },
        indent=2,
    )
    + "\n"
)
print(json.dumps(g))
