"""Own low cruiser anatomy: broad tank, long seat, raked fork, V engine/exhaust.

Utility primitives and true-wheel ring construction reused; every fixed body
component/layout is authored for this family, with profile-driven controls.
"""

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


def v_block(name, a, b, width, thickness, role):
    a, b = Vector(a), Vector(b)
    center = (a + b) / 2
    ob = cube(name, center, (thickness, width, (b - a).length), role, bevel=0.022)
    rot = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
    for v in ob.data.vertices:
        v.co = center + rot @ (v.co - center)
    ob.data.update()
    return ob


# Seven distinct stations and a flattened broad cross-section: not classic tank scaling.
tank_cfg = CFG["tank"]
nr = tank_cfg["segments"]
stations = tank_cfg["stations"]
vv = [
    (
        x,
        tank_cfg["halfWidth"] * q * math.cos(2 * math.pi * j / nr),
        tank_cfg["centerZ"]
        + tank_cfg["heightRadius"] * q * math.sin(2 * math.pi * j / nr),
    )
    for x, q in stations
    for j in range(nr)
]
ff = [
    (k * nr + j, k * nr + (j + 1) % nr, (k + 1) * nr + (j + 1) % nr, (k + 1) * nr + j)
    for k in range(len(stations) - 1)
    for j in range(nr)
]
ff += [
    tuple(range(nr - 1, -1, -1)),
    tuple((len(stations) - 1) * nr + j for j in range(nr)),
]
tank = mesh(CFG["geometryOwners"]["tank"], vv, ff, "paint")
xl, xh = tank_cfg["chartX"]
zl, zh = tank_cfg["chartZ"]
for f in tank.data.polygons:
    for li in f.loop_indices:
        p = tank.data.vertices[tank.data.loops[li].vertex_index].co
        if abs(f.normal.x) > 0.65:
            u = (p.y + 0.23) / 0.46
            py = 256 + (p.z - zl) / (zh - zl) * 128
        elif f.normal.z > 0.6 and f.center.z > tank_cfg["centerZ"] + 0.06:
            u = (p.x - xl) / (xh - xl)
            py = 256 + (p.y + 0.23) / 0.46 * 128
        else:
            u = (p.x - xl) / (xh - xl)
            py = (p.z - zl) / (zh - zl) * 256
        tank.data.uv_layers.active.data[li].uv = (
            max(0.001, min(0.999, u)),
            1 - max(0.5, min(383.5, py)) / 512,
        )

# Low long saddle with an actual central flat contact and raised passenger end.
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
    "Cruiser long raised pillion pad",
    (ctrl["pillionCenterX"], 0, seat_top + ctrl["pillionRise"] - 0.05),
    (ctrl["pillionLength"], ctrl["pillionWidth"], 0.10),
    "seatLight",
    bevel=0.025,
)

# Wide visible V engine: two actual slanted cylinders around a broad crankcase.
cube(
    "Cruiser broad V engine dark crankcase",
    (-0.15, 0, 0.47),
    (0.52, 0.30, 0.27),
    "engine",
    bevel=0.065,
)
for label, top in [("front", (-0.59, 0, 0.80)), ("rear", (0.10, 0, 0.82))]:
    base = (-0.22, 0, 0.53)
    v_block("Cruiser V cylinder " + label, base, top, 0.29, 0.20, "engine")
    for i in range(3):
        a = Vector(base).lerp(Vector(top), 0.40 + i * 0.21)
        b = a + (Vector(top) - Vector(base)).normalized() * 0.028
        v_block(
            "Cruiser broad cylinder fin " + label + " " + str(i),
            a,
            b,
            0.32,
            0.24,
            "engineLight",
        )
for side in [-1, 1]:
    disk(
        "Cruiser large rounded crankcase face " + str(side),
        (-0.14, side * 0.153, 0.46),
        (0, side, 0),
        0.185,
        "chrome",
        16,
        0.018,
    )
    # Low broad outboard pipes clear the rotating axial envelopes by construction,
    # but every triangle is still tested against both actual wheel cylinders.
    tube(
        "Cruiser exhaust downpipe " + str(side),
        (-0.42, side * 0.22, 0.66),
        (-0.20, side * 0.31, 0.26),
        0.034,
        "chrome",
        10,
    )
    tube(
        "Cruiser long low chrome exhaust " + str(side),
        (-0.20, side * 0.31, 0.26),
        (1.45, side * 0.31, 0.26),
        0.045,
        "chrome",
        12,
    )
    tube(
        "Cruiser cream exhaust heat shield " + str(side),
        (0.28, side * 0.318, 0.285),
        (1.30, side * 0.318, 0.285),
        0.028,
        "cream",
        8,
    )
    tube(
        "Cruiser extended rear swingarm " + str(side),
        (-0.03, side * 0.25, 0.42),
        (1.20, side * 0.25, 0.46),
        0.027,
        "frame",
        8,
    )
    tube(
        "Cruiser rear shock broad tube " + str(side),
        (0.64, side * 0.25, 0.88),
        (1.13, side * 0.25, 0.49),
        0.032,
        "frameLight",
        10,
    )
    tube(
        "Cruiser laidback long front fork " + str(side),
        (-0.64, side * 0.22, 1.08),
        (-1.40, side * 0.22, 0.43),
        0.031,
        "chrome",
        10,
    )
    for wid, spec in CFG["wheelSpecs"].items():
        y_stop = spec["width"] / 2 + 0.034 + 0.003 + 0.017
        tube(
            "Cruiser fixed axle stub stop short " + wid + " " + str(side),
            (spec["axle"], side * (0.22 if wid == "F" else 0.25), spec["radius"]),
            (spec["axle"], side * y_stop, spec["radius"]),
            0.020,
            "frameLight",
            8,
        )
for i, (a, b) in enumerate(
    [
        ((-0.64, 0, 1.08), (-0.58, 0, 0.31)),
        ((-0.58, 0, 0.31), (0.62, 0, 0.31)),
        ((0.62, 0, 0.31), (0.68, 0, 0.87)),
        ((0.84, 0, 0.87), (-0.62, 0, 0.85)),
        ((-0.64, 0, 1.08), (-0.12, 0, 0.46)),
        ((-0.12, 0, 0.46), (0.84, 0, 0.87)),
    ]
):
    tube("Cruiser long low frame member " + str(i), a, b, 0.031, "frame", 8)

# Mechanical controls use this family's measured profile/mount only.
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
for sign, side in [(-1, "left"), (1, "right")]:
    hand = CONTACTS["hand_" + side + "_grip"]
    foot = CONTACTS["foot_" + side + "_support"]
    tube(
        "Actual palm wrapped grip " + side,
        (hand.x, hand.y - ctrl["gripHalfLength"], hand.z),
        (hand.x, hand.y + ctrl["gripHalfLength"], hand.z),
        ctrl["gripRadius"],
        "dark",
        12,
    )
    tube(
        "Actual sole tangent foot peg " + side,
        (foot.x, sign * ctrl["pegInnerY"], foot.z - ctrl["pegRadius"]),
        (foot.x, sign * ctrl["pegOuterY"], foot.z - ctrl["pegRadius"]),
        ctrl["pegRadius"],
        "dark",
        12,
    )

for wid, spec in CFG["wheelSpecs"].items():
    f = CFG["fenders"][wid]
    n = f["segments"]
    lo = f["innerRadius"]
    hi = f["outerRadius"]
    hw = f["halfWidth"]
    limit = f["angularLimit"]
    vv = [
        (spec["axle"] + r * math.sin(t), y, spec["radius"] + r * math.cos(t))
        for j in range(n + 1)
        for t in [-limit + 2 * limit * j / n]
        for r, y in [(lo, -hw), (lo, hw), (hi, hw), (hi, -hw)]
    ]
    ff = [
        (k * 4 + j, k * 4 + (j + 1) % 4, (k + 1) * 4 + (j + 1) % 4, (k + 1) * 4 + j)
        for k in range(n)
        for j in range(4)
    ] + [(3, 2, 1, 0), (n * 4, n * 4 + 1, n * 4 + 2, n * 4 + 3)]
    mesh(
        "Cruiser actual curved cream maroon fender " + wid,
        vv,
        ff,
        ["paintDeep", "creamShadow", "cream", "paint"] * n + ["paint", "paint"],
    )
tube(
    "Cruiser round headlamp dark housing",
    (-0.83, 0, 1.12),
    (-1.00, 0, 1.12),
    0.15,
    "frame",
    18,
)
disk(
    "Cruiser round cream headlamp lens",
    (-1.008, 0, 1.12),
    (-1, 0, 0),
    0.124,
    "white",
    18,
    0.010,
)
cube("Cruiser rear ruby lamp", (1.61, 0, 0.86), (0.06, 0.20, 0.12), "ruby", bevel=0.018)

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
    mesh("Cruiser true rounded road tire " + wid, vv, ff, roles, wid)
    for sign in [-1, 1]:
        disk(
            "Cruiser broad wheel rim " + wid + " " + str(sign),
            (0, sign * (w / 2 + 0.002), 0),
            (0, sign, 0),
            r * 0.63,
            "rim",
            18,
            0.014,
            wid,
        )
        disk(
            "Cruiser chrome wheel hub " + wid + " " + str(sign),
            (0, sign * (w / 2 + 0.018), 0),
            (0, sign, 0),
            r * 0.27,
            "chrome",
            12,
            0.014,
            wid,
        )
        disk(
            "Cruiser asymmetric phase index " + wid + " " + str(sign),
            (r * 0.31, sign * (w / 2 + 0.034), r * 0.19),
            (0, sign, 0),
            0.035,
            "frame",
            8,
            0.003,
            wid,
        )
