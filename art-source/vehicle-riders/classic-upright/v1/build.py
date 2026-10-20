"""Original compact Classic cat seated source pilot; no normal avatar/runtime change.
Geometry helpers derived from retained Bear source mechanics, not its anatomy.
Blender factory background4threads; -- --scratch generates isolated replay outputs.
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
D = R / "data/vehicle-riders/classic-upright"
scratch = "--scratch" in sys.argv
A = (
    D / "replay-final/source"
    if scratch
    else R / "art-source/vehicle-riders/classic-upright/v1"
)
O = (
    D / "replay-final/public"
    if scratch
    else R / "public/demos/vehicle-riders/classic-upright/v1"
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
        if y < 96:
            u = (x % 128) // 8
            # Semantic skin paint only: source exterior contour belongs to real geometry.
            if x < 128:
                role = "c"
                if 44 <= y < 62 and u in [3, 4, 11, 12]:
                    role = "k"
                if 78 <= y < 92 and u in [3, 4, 11, 12]:
                    role = "y"
            else:
                role = "v" if u in [6, 7, 8, 9] and y < 12 else "c"
        elif 112 <= y < 176 and x < 96:
            role = "n" if y < 148 else "c"
            if 124 < y < 156 and 38 < x < 58:
                role = "l"
        elif 112 <= y < 176 and 128 <= x < 192:
            role = "v" if abs(x - 160) < 12 and 144 <= y < 162 else "c"
        elif 112 <= y < 176 and 192 <= x < 256:
            u = x - 192
            v = y - 112
            role = "p" if 12 < v < 53 and abs(u - 32) < (v - 8) * 0.30 else "c"
        elif 176 <= y < 224 and x < 192:
            u = x % 96
            role = "c"
            if 190 <= y < 200 and (
                (x < 96 and 24 <= u < 34) or (x >= 96 and 62 <= u < 72)
            ):
                role = "k"
            if 210 <= y < 220 and (
                (x < 96 and 10 <= u < 34) or (x >= 96 and 62 <= u < 86)
            ):
                role = "y"
        elif 176 <= y < 224 and x >= 192:
            role = "p" if 207 < x < 241 and 184 < y < 212 else "c"
        elif y >= 232:
            role = keys[min(len(keys) - 1, x // 16)]
        pixels[(y * 256 + x) * 4 : (y * 256 + x + 1) * 4] = bytes((*palette[role], 255))
png(A / "atlas.png", 256, 256, pixels)
shutil.copyfile(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("Classic_original7color_opaque_unlit")
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
    uv = m.uv_layers.new(name="RiderClassic_semantic_UV")
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


# Own compact anatomy and short fixed chain lengths, chosen independently of any bike.
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
    "RiderClassic seated pelvis", (0, 0, 0), an["pelvisDimensions"], "c", 0.02, 2
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
    limb("RiderClassic upper arm " + side, shoulder, elbow, 0.035, 0.031, "c", 8)
    ellipsoid("RiderClassic elbow " + side, elbow, (0.033, 0.033, 0.033), "c", 10, 6)
    wrist = palm + (elbow - palm).normalized() * an["wristInsetFromPalmSource"]
    limb("RiderClassic forearm " + side, elbow, wrist, 0.029, 0.022, "c", 8)
    ellipsoid("RiderClassic gripping palm " + side, palm, an["palmRadii"], "c", 12, 7)
    P["hand_" + side + "_grip"] = palm
    hj = Vector(an["hipJointSource"])
    hj.y *= sign
    offset = Vector(an["ankleFromSoleSource"])
    knee, ankle = two_bone(
        hj,
        targets["foot_" + side + "_support"] + offset,
        an["legLengthsSource"],
        (-1, sign * 0.4, 0),
        "leg_" + side,
    )
    sole = ankle - offset
    limb("RiderClassic bent thigh " + side, hj, knee, 0.035, 0.032, "c", 8)
    ellipsoid("RiderClassic knee " + side, knee, (0.034, 0.034, 0.033), "c", 10, 6)
    limb("RiderClassic short shin " + side, knee, ankle, 0.031, 0.026, "c", 8)
    foot = box(
        "RiderClassic boot " + side,
        sole + Vector((0, 0, an["bootDimensions"][2] / 2)),
        an["bootDimensions"],
        "v",
        0.018,
        2,
    )
    for f in foot.data.polygons:
        role = "k" if f.normal.z < -0.7 else "v" if f.normal.z < 0.7 else "c"
        for li in f.loop_indices:
            foot.data.uv_layers.active.data[li].uv = (
                (keys.index(role) * 16 + 8) / 256,
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
    "RiderClassic tiny torso collar UV owner",
    an["torsoCenter"],
    an["torsoDimensions"],
    "c",
    0.025,
    3,
)
tc = Vector(an["torsoCenter"])
td = Vector(an["torsoDimensions"])
for f in torso.data.polygons:
    for li in f.loop_indices:
        v = torso.data.vertices[torso.data.loops[li].vertex_index].co
        if f.normal.x < -0.6:
            torso.data.uv_layers.active.data[li].uv = (
                (3 + 90 * (v.y + td.y / 2) / td.y) / 256,
                1 - (113 + 62 * (tc.z + td.z / 2 - v.z) / td.z) / 256,
            )
        elif v.z > 0.105:
            torso.data.uv_layers.active.data[li].uv = (
                (keys.index("n") * 16 + 8) / 256,
                1 - 240 / 256,
            )
hc = Vector(an["headCenter"])
hd = Vector(an["headDimensions"])
head = box("RiderClassic broad face UV owner", hc, hd, "c", 0.045, 4)
for f in head.data.polygons:
    for li in f.loop_indices:
        v = head.data.vertices[head.data.loops[li].vertex_index].co
        if f.normal.x < -0.65 or f.normal.x > 0.65:
            offset = 0 if f.normal.x < 0 else 128
            px = offset + 1 + 125 * (v.y + hd.y / 2) / hd.y
            py = 1 + 93 * (hc.z + hd.z / 2 - v.z) / hd.z
            head.data.uv_layers.active.data[li].uv = (px / 256, 1 - py / 256)
        elif abs(f.normal.y) > 0.65:
            u = (v.x - (hc.x - hd.x / 2)) / hd.x
            if f.normal.y > 0:
                u = 1 - u
            px = (0 if f.normal.y < 0 else 96) + 1 + 93 * u
            py = 177 + 45 * (hc.z + hd.z / 2 - v.z) / hd.z
            head.data.uv_layers.active.data[li].uv = (px / 256, 1 - py / 256)
        elif f.normal.z > 0.6:
            px = 129 + 61 * (v.y + hd.y / 2) / hd.y
            py = 113 + 61 * (v.x - (hc.x - hd.x / 2)) / hd.x
            head.data.uv_layers.active.data[li].uv = (px / 256, 1 - py / 256)
# Solid pointed triangular ear prisms. Front inner pink ownership is actual skin paint.
for sign in [-1, 1]:
    y = sign * 0.29
    yz = [(y - sign * 0.09, 0.405), (y + sign * 0.09, 0.405), (y + sign * 0.034, 0.730)]
    verts = [(x, yy, z) for x in [-0.145, 0.120] for yy, z in yz]
    faces = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)]
    ear = mesh(
        "RiderClassic pointed ear " + ("left" if sign < 0 else "right"),
        verts,
        faces,
        ["p", "c", "c", "c", "c"],
    )
    # A painted cream rim within the front triangular UV island, not overlay geometry.
    for li in ear.data.polygons[0].loop_indices:
        idx = ear.data.loops[li].vertex_index
        u, v = {0: (2, 62), 1: (62, 62), 2: (32, 2)}[idx]
        ear.data.uv_layers.active.data[li].uv = ((192 + u) / 256, 1 - (112 + v) / 256)
    for li in ear.data.polygons[3].loop_indices:
        v = ear.data.vertices[ear.data.loops[li].vertex_index].co
        u = (v.x + 0.145) / 0.265
        w = (0.730 - v.z) / 0.325
        ear.data.uv_layers.active.data[li].uv = (
            (193 + 61 * u) / 256,
            1 - (177 + 45 * w) / 256,
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
low.name = "RiderClassic_static_seated"
low["presentation_status"] = "prototype-not-production"
root = bpy.data.objects.new("RiderClassic_HipOrigin_forward_minus_X", None)
scene.collection.objects.link(root)
low.parent = root
for name, point in P.items():
    e = bpy.data.objects.new("RiderClassic_Socket_" + name, None)
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
    "template": "Own compact cream cat anatomy, pointed ears/broad head/tiny torso, fixed short paw chains; no Explorer anatomy or recolor",
    "contactFitStatus": fit_status,
    "actualContactsSource": {n: list(p) for n, p in P.items()},
    "targetMissWorld": contact_errors,
    "fixedLengthIK": fit,
    "anatomicalJointsSource": joints,
    "config": C,
    "palette": I["palette"],
    "components": stats,
    "semanticUV": "Own semantic charts from original Classic seven-color forehead/eyes/cheeks and torso collar clusters, without transferred sprite exterior contours, painted on actual volumetric skin; pink front ear triangles and violet underside/sole owners; no sprite billboard or painted silhouette.",
    "masterMeaning": "Editable named semantic components at runtime topology; no skeletal animation/high-to-low claim",
    "sourceDependencies": [
        "build.py",
        "rider.json",
        "identity.json",
        "classic-upright-v1.json",
    ],
    "scratchInputDependencies": [],
    "immutableContactProfile": PROFILE,
    "profileSha256": C["contactProfile"]["sha256"],
    "deterministicIndexOrder": "Winding-preserving cyclic-start and triangle-order canonicalization after export; vertex/normal/UV/image buffers untouched. Opaque static single mesh; geometry unchanged.",
}
for base in [A, O]:
    (base / "recipe.json").write_text(json.dumps(recipe, indent=2) + "\n")
for n in ["build.py", "rider.json", "identity.json", "classic-upright-v1.json"]:
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
                "One static Classic compact cream cat player-avatar and synthetic fixture; no actual bike/production/27-avatar/AI/fallback qualification",
                "Existing standing/promoted characters and normal vehicle runtime unchanged",
            ],
        },
        indent=2,
    )
    + "\n"
)
print(json.dumps(g))
