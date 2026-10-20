"""Own rounded legshield/step-through scooter anatomy and profile-driven controls."""

from mathutils import Matrix


def tube(name, a, b, radius, role, sides=8):
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    u = t.cross(Vector((0, 0, 1)))
    if u.length < 0.001:
        u = t.cross(Vector((0, 1, 0)))
    u.normalize()
    v = t.cross(u)
    vv = [
        tuple(
            p
            + radius
            * (
                u * math.cos(2 * math.pi * j / sides)
                + v * math.sin(2 * math.pi * j / sides)
            )
        )
        for p in [a, b]
        for j in range(sides)
    ]
    ff = [
        (j, (j + 1) % sides, sides + (j + 1) % sides, sides + j) for j in range(sides)
    ]
    ff += [tuple(range(sides - 1, -1, -1)), tuple(sides + j for j in range(sides))]
    return mesh(name, vv, ff, role)


def disk(name, center, normal, radius, role, segments=16, depth=0.018, group="body"):
    c = Vector(center)
    normal = Vector(normal).normalized()
    u = normal.cross(Vector((0, 0, 1)))
    if u.length < 0.001:
        u = normal.cross(Vector((0, 1, 0)))
    u.normalize()
    v = normal.cross(u)
    vv = [
        tuple(
            c
            + normal * d
            + r
            * (
                u * math.cos(2 * math.pi * j / segments)
                + v * math.sin(2 * math.pi * j / segments)
            )
        )
        for d, r in [(0, radius), (depth, radius * 0.88)]
        for j in range(segments)
    ]
    ff = [
        (j, (j + 1) % segments, segments + (j + 1) % segments, segments + j)
        for j in range(segments)
    ]
    ff.append(tuple(segments + j for j in range(segments)))
    return mesh(name, vv, ff, role, group)


# Broad rear cowling with an actual open radial wheel pocket, not a tire cap.
c = CFG["rearBody"]
n = c["segments"]
vv = [
    (
        x,
        c["halfWidth"] * q * math.cos(2 * math.pi * j / n),
        c["centerZ"] + c["heightRadius"] * q * math.sin(2 * math.pi * j / n),
    )
    for x, q in c["stations"]
    for j in range(n)
]
ff = [
    (k * n + j, k * n + (j + 1) % n, (k + 1) * n + (j + 1) % n, (k + 1) * n + j)
    for k in range(len(c["stations"]) - 1)
    for j in range(n)
]
ff += [
    tuple(range(n - 1, -1, -1)),
    tuple((len(c["stations"]) - 1) * n + j for j in range(n)),
]
rear = mesh(CFG["geometryOwners"]["rearBody"], vv, ff, "paint")
spec = CFG["wheelSpecs"]["R"]
bpy.ops.mesh.primitive_cylinder_add(
    vertices=c["archSegments"],
    radius=c["archRadius"],
    depth=1.2,
    location=(spec["axle"], 0, spec["radius"]),
    rotation=(math.pi / 2, 0, 0),
)
cut = bpy.context.object
bpy.context.view_layer.objects.active = rear
mod = rear.modifiers.new("Actual rear wheel open arch", "BOOLEAN")
mod.operation = "DIFFERENCE"
mod.solver = "EXACT"
mod.object = cut
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut, do_unlink=True)
rear.data.update()
for f in rear.data.polygons:
    for li in f.loop_indices:
        p = rear.data.vertices[rear.data.loops[li].vertex_index].co
        if abs(f.normal.y) > 0.3:
            u = (p.x - c["chartX"][0]) / (c["chartX"][1] - c["chartX"][0])
            py = (p.z - c["chartZ"][0]) / (c["chartZ"][1] - c["chartZ"][0]) * 256
        else:
            u = (p.x - c["chartX"][0]) / (c["chartX"][1] - c["chartX"][0])
            py = 384 + (p.y / c["halfWidth"] + 1) * 32
        rear.data.uv_layers["Semantic_palette_UV"].data[li].uv = (
            max(0.001, min(0.999, u)),
            1 - max(0.5, min(447.5, py)) / 512,
        )

# Rounded transverse legshield: front and rider-facing back belong to one closed shell.
c = CFG["shield"]
rows = c["levels"]
cols = c["widthFractions"]
m = len(cols)
n = len(rows)
vv = []
for back in [0, 1]:
    for z, x, w in rows:
        for f in cols:
            vv.append(
                (x - 0.055 + c["edgeCurve"] * f * f + back * c["thickness"], w * f, z)
            )
ff = []
for side in [0, 1]:
    o = side * n * m
    for j in range(n - 1):
        for k in range(m - 1):
            f = (
                o + j * m + k,
                o + j * m + k + 1,
                o + (j + 1) * m + k + 1,
                o + (j + 1) * m + k,
            )
            ff.append(f if side == 0 else tuple(reversed(f)))
for j in range(n - 1):
    for k in [0, m - 1]:
        a = j * m + k
        b = (j + 1) * m + k
        ff.append((a, b, n * m + b, n * m + a))
for j in [0, n - 1]:
    for k in range(m - 1):
        a = j * m + k
        b = a + 1
        ff.append((a, b, n * m + b, n * m + a))
shield = mesh(CFG["geometryOwners"]["shield"], vv, ff, "cream")
for f in shield.data.polygons:
    for li in f.loop_indices:
        p = shield.data.vertices[shield.data.loops[li].vertex_index].co
        u = (p.y - c["chartY"][0]) / (c["chartY"][1] - c["chartY"][0])
        py = 256 + (p.z - c["chartZ"][0]) / (c["chartZ"][1] - c["chartZ"][0]) * 128
        shield.data.uv_layers.active.data[li].uv = (
            max(0.001, min(0.999, u)),
            1 - max(256.5, min(383.5, py)) / 512,
        )

floor = CFG["floor"]
top = CONTACTS["foot_left_support"].z
assert abs(top - CONTACTS["foot_right_support"].z) < 1e-9
xl, xh = floor["xRange"]
hw = floor["halfWidth"]
pan = cube(
    floor["owner"],
    ((xl + xh) / 2, 0, top - floor["thickness"] / 2),
    (xh - xl, hw * 2, floor["thickness"]),
    "creamShadow",
)
for f in pan.data.polygons:
    if f.normal.z > 0.8:
        for li in f.loop_indices:
            p = pan.data.vertices[pan.data.loops[li].vertex_index].co
            pan.data.uv_layers.active.data[li].uv = (
                (p.x - xl) / (xh - xl) * 0.998 + 0.001,
                1 - (448.5 + (p.y + hw) / (2 * hw) * 31) / 512,
            )
for sign in [-1, 1]:
    cube(
        "Step-through raised outer floor rail " + str(sign),
        ((xl + xh) / 2, sign * (hw - 0.014), top + floor["railHeight"] / 2),
        (xh - xl, 0.028, floor["railHeight"]),
        "paint",
        bevel=0.012,
    )

# Low tongue and broad long rear saddle; both are fixed semantic geometry.
ctrl = CFG["controlVariant"]
seat_top = CONTACTS["hip_saddle"].z
cube(
    "Actual dark saddle central hip tangent",
    (ctrl["saddleCenterX"], 0, seat_top - 0.047),
    (ctrl["saddleLength"], ctrl["saddleWidth"], 0.094),
    "seat",
    bevel=0.025,
)
cube(
    "Scooter broad long rear saddle",
    (ctrl["pillionCenterX"], 0, seat_top + ctrl["pillionRise"] - 0.05),
    (ctrl["pillionLength"], ctrl["pillionWidth"], 0.1),
    "seatLight",
    bevel=0.025,
)

# Small-wheel fork, axle tips and rear suspension are outside full rotating cylinders.
for sign in [-1, 1]:
    tube(
        "Scooter front fork " + str(sign),
        (-0.60, sign * 0.18, 0.77),
        (-0.98, sign * 0.18, 0.31),
        0.022,
        "chrome",
        10,
    )
    tube(
        "Scooter rear arm " + str(sign),
        (0.34, sign * 0.20, 0.35),
        (0.95, sign * 0.20, 0.33),
        0.020,
        "frame",
        8,
    )
    for wid, spec in CFG["wheelSpecs"].items():
        stop = spec["width"] / 2 + 0.034 + 0.003 + 0.018
        tube(
            "Scooter fixed axle stub " + wid + " " + str(sign),
            (spec["axle"], sign * (0.18 if wid == "F" else 0.20), spec["radius"]),
            (spec["axle"], sign * stop, spec["radius"]),
            0.018,
            "frameLight",
            8,
        )
tube("Scooter low floor frame", (-0.52, 0, 0.32), (0.48, 0, 0.32), 0.022, "frame", 8)
tube("Scooter steering mast", (-0.63, 0, 0.50), ctrl["headstock"], 0.026, "chrome", 10)
left, right = CONTACTS["hand_left_grip"], CONTACTS["hand_right_grip"]
tube(
    "Headstock to actual grip riser",
    ctrl["headstock"],
    (left.x, 0, left.z),
    0.026,
    "chrome",
    10,
)
tube(
    "Actual connected handlebar centerline",
    (left.x, left.y + ctrl["gripHalfLength"], left.z),
    (right.x, right.y - ctrl["gripHalfLength"], right.z),
    0.022,
    "chrome",
    12,
)
for side in ["left", "right"]:
    hand = CONTACTS["hand_" + side + "_grip"]
    tube(
        "Actual palm wrapped grip " + side,
        (hand.x, hand.y - ctrl["gripHalfLength"], hand.z),
        (hand.x, hand.y + ctrl["gripHalfLength"], hand.z),
        ctrl["gripRadius"],
        "dark",
        12,
    )
cube(
    "Scooter rounded handlebar headlamp nacelle",
    (-0.62, 0, 1.22),
    (0.24, 0.30, 0.17),
    "paintLight",
    bevel=0.06,
)
disk(
    "Scooter gray round headlamp rim",
    (-0.745, 0, 1.22),
    (-1, 0, 0),
    0.080,
    "chrome",
    18,
    0.012,
)
disk(
    "Scooter cream round headlamp lens",
    (-0.760, 0, 1.22),
    (-1, 0, 0),
    0.065,
    "white",
    18,
    0.008,
)
cube(
    "Scooter small rear red lamp",
    (1.31, 0, 0.73),
    (0.06, 0.15, 0.08),
    "ruby",
    bevel=0.018,
)

for wid, f in CFG["fenders"].items():
    spec = CFG["wheelSpecs"][wid]
    n = f["segments"]
    limit = f["angularLimit"]
    vv = [
        (spec["axle"] + r * math.sin(t), y, spec["radius"] + r * math.cos(t))
        for j in range(n + 1)
        for t in [-limit + 2 * limit * j / n]
        for r, y in [
            (f["innerRadius"], -f["halfWidth"]),
            (f["innerRadius"], f["halfWidth"]),
            (f["outerRadius"], f["halfWidth"]),
            (f["outerRadius"], -f["halfWidth"]),
        ]
    ]
    ff = [
        (k * 4 + j, k * 4 + (j + 1) % 4, (k + 1) * 4 + (j + 1) % 4, (k + 1) * 4 + j)
        for k in range(n)
        for j in range(4)
    ]
    ff += [(3, 2, 1, 0), (n * 4, n * 4 + 1, n * 4 + 2, n * 4 + 3)]
    mesh(
        "Scooter actual curved front fender " + wid,
        vv,
        ff,
        ["paintDeep", "creamShadow", "cream", "paint"] * n + ["paint", "paint"],
    )
# Independent round tires/hubs. Different front/rear sizes are declared in config.
for wid, spec in CFG["wheelSpecs"].items():
    r, w, nr = spec["radius"], spec["width"], spec["segments"]
    vv = [
        (rad * math.sin(2 * math.pi * j / nr), y, rad * math.cos(2 * math.pi * j / nr))
        for y, rad in [
            (-w / 2, r * 0.84),
            (-w * 0.36, r * 0.97),
            (0, r),
            (w * 0.36, r * 0.97),
            (w / 2, r * 0.84),
        ]
        for j in range(nr)
    ]
    ff = [
        (
            k * nr + j,
            k * nr + (j + 1) % nr,
            (k + 1) * nr + (j + 1) % nr,
            (k + 1) * nr + j,
        )
        for k in range(4)
        for j in range(nr)
    ]
    roles = [
        "tire" if k in [1, 2] else "tireLight" for k in range(4) for j in range(nr)
    ]
    for k in [0, 4]:
        ff.append(tuple(k * nr + j for j in range(nr)))
        roles.append("tire")
    mesh("Scooter true rounded road tire " + wid, vv, ff, roles, wid)
    for sign in [-1, 1]:
        disk(
            "Scooter broad wheel rim " + wid + " " + str(sign),
            (0, sign * (w / 2 + 0.002), 0),
            (0, sign, 0),
            r * 0.63,
            "rim",
            18,
            0.014,
            wid,
        )
        disk(
            "Scooter chrome wheel hub " + wid + " " + str(sign),
            (0, sign * (w / 2 + 0.018), 0),
            (0, sign, 0),
            r * 0.27,
            "chrome",
            12,
            0.014,
            wid,
        )
        disk(
            "Scooter asymmetric phase index " + wid + " " + str(sign),
            (r * 0.31, sign * (w / 2 + 0.034), r * 0.19),
            (0, sign, 0),
            0.035,
            "frame",
            8,
            0.003,
            wid,
        )
