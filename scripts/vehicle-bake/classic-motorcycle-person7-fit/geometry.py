"""Original actual two-wheel classic bike; profile contacts from one measured mount."""


def role_face(ob, face, role):
    idx = keys.index(role)
    for li in face.loop_indices:
        ob.data.uv_layers.active.data[li].uv = (
            ((idx % 16) * 32 + 16) / 512,
            1 - (480 + (idx // 16) * 16 + 8) / 512,
        )


def tube(name, a, b, radius, role="chassisLight", sides=8):
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


def disk(name, center, normal, radius, role, segments=20, depth=0.018, group="body"):
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
            + normal * dep
            + rad
            * (
                u * math.cos(2 * math.pi * j / segments)
                + v * math.sin(2 * math.pi * j / segments)
            )
        )
        for dep, rad in [(0, radius), (depth, radius * 0.88)]
        for j in range(segments)
    ]
    ff = [
        (j, (j + 1) % segments, segments + (j + 1) % segments, segments + j)
        for j in range(segments)
    ]
    ff.append(tuple(segments + j for j in range(segments)))
    return mesh(name, vv, ff, role, group)


# Rounded tank with its own continuous side chart and fixed top/end owners.
nr = 12
stations = [(-0.80, 0.24), (-0.66, 0.92), (-0.43, 1.0), (-0.25, 0.72), (-0.16, 0.20)]
vv = [
    (
        x,
        0.145 * q * math.cos(2 * math.pi * j / nr),
        1.02 + 0.18 * q * math.sin(2 * math.pi * j / nr),
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
tank = mesh("Rounded teal tank actual cream side UV panels", vv, ff, "paint")
for f in tank.data.polygons:
    for li in f.loop_indices:
        p = tank.data.vertices[tank.data.loops[li].vertex_index].co
        if abs(f.normal.x) > 0.65:
            u = (p.y + 0.2) / 0.4
            py = 256 + (p.z - 0.78) / 0.48 * 128
        elif f.normal.z > 0.6 and f.center.z > 1.10:
            u = (p.x + 0.82) / 0.72
            py = 256 + (p.y + 0.2) / 0.4 * 128
        else:
            u = (p.x + 0.82) / 0.72
            py = (p.z - 0.78) / 0.48 * 256
        tank.data.uv_layers.active.data[li].uv = (
            max(0.001, min(0.999, u)),
            1 - max(0.5, min(383.5, py)) / 512,
        )
# Saddle's central actual top is tangent to the configured measured hip bottom.
seat_top = CONTACTS["hip_saddle"].z
cube(
    "Actual dark saddle central hip tangent",
    (0.24, 0, seat_top - 0.043),
    (0.68, CFG["controlVariant"]["saddleWidth"], 0.086),
    "seat",
    bevel=0.025,
)
cube(
    "Actual narrow saddle nose",
    (-0.13, 0, 0.978),
    (0.13, 0.16, 0.065),
    "seat",
    bevel=0.020,
)
cube(
    "Actual rounded pillion rear saddle",
    (0.44, 0, seat_top + CFG["controlVariant"]["pillionTopOffset"] - 0.045),
    (0.32, CFG["controlVariant"]["pillionWidth"], 0.090),
    "seatLight",
    bevel=0.008,
)
# Broad engine masses and a few legible fin plates, no tiny texture noise.
cube(
    "Exposed dark gray crankcase rounded block",
    (-0.06, 0, 0.61),
    (0.42, 0.24, 0.30),
    "engine",
    bevel=0.05,
)
cube(
    "Exposed single cylinder broad block",
    (-0.32, 0, 0.77),
    (0.27, 0.23, 0.24),
    "engine",
    bevel=0.025,
)
for z in [0.70, 0.75, 0.80, 0.85]:
    cube(
        "Broad engine cooling fin " + str(z),
        (-0.32, 0, z),
        (0.32, 0.25, 0.022),
        "engineLight",
    )
for side in [-1, 1]:
    disk(
        "Exposed round crankcase face " + str(side),
        (-0.03, side * 0.124, 0.60),
        (0, side, 0),
        0.135,
        "engineLight",
        12,
        0.015,
    )
    tube(
        "Gray outboard exhaust silencer " + str(side),
        (0.10, side * 0.235, 0.30),
        (1.18, side * 0.235, 0.30),
        0.038,
        "chrome",
        10,
    )
    # Source rays/wholewheel envelope include every frame/fork/exhaust triangle.
    tube(
        "Rear swingarm " + str(side),
        (-0.03, side * 0.19, 0.53),
        (1.12, side * 0.19, 0.42),
        0.025,
        "frame",
        8,
    )
    tube(
        "Rear static spring shock broad tube " + str(side),
        (0.52, side * 0.19, 0.93),
        (1.05, side * 0.19, 0.45),
        0.030,
        "frameLight",
        8,
    )
    tube(
        "Twin front fork stanchion " + str(side),
        (-0.70, side * 0.19, 1.12),
        (-1.12, side * 0.19, 0.42),
        0.025,
        "chrome",
        8,
    )
    for x in [-1.12, 1.12]:
        tube(
            "Fixed axle attachment stop short of hub " + str(x) + " " + str(side),
            (x, side * 0.19, 0.42),
            (x, side * 0.158, 0.42),
            0.021,
            "frameLight",
            8,
        )
for i, (a, b) in enumerate(
    [
        ((-0.70, 0, 1.10), (-0.48, 0, 0.37)),
        ((-0.48, 0, 0.37), (0.48, 0, 0.37)),
        ((0.48, 0, 0.37), (0.48, 0, 0.94)),
        ((0.48, 0, 0.90), (-0.65, 0, 0.94)),
        ((-0.70, 0, 1.10), (-0.03, 0, 0.53)),
        ((-0.03, 0, 0.53), (0.48, 0, 0.94)),
    ]
):
    tube("Narrow tubular frame member " + str(i), a, b, 0.030, "frame", 8)
tube(
    "Headstock to actual grip riser",
    (-0.70, 0, 1.10),
    (CONTACTS["hand_left_grip"].x, 0, CONTACTS["hand_left_grip"].z),
    0.025,
    "chrome",
    8,
)
tube(
    "Actual connected handlebar centerline",
    (
        CONTACTS["hand_left_grip"].x,
        CONTACTS["hand_left_grip"].y + CFG["controlVariant"]["gripHalfLength"],
        CONTACTS["hand_left_grip"].z,
    ),
    (
        CONTACTS["hand_right_grip"].x,
        CONTACTS["hand_right_grip"].y - CFG["controlVariant"]["gripHalfLength"],
        CONTACTS["hand_right_grip"].z,
    ),
    0.021,
    "chrome",
    12,
)
for side, label in [(-1, "left"), (1, "right")]:
    hand = CONTACTS["hand_" + label + "_grip"]
    tube(
        "Actual palm wrapped grip " + label,
        (hand.x, hand.y - CFG["controlVariant"]["gripHalfLength"], hand.z),
        (hand.x, hand.y + CFG["controlVariant"]["gripHalfLength"], hand.z),
        CFG["controlVariant"]["gripRadius"],
        "dark",
        12,
    )
    foot = CONTACTS["foot_" + label + "_support"]
    tube(
        "Actual sole tangent foot peg " + label,
        (
            foot.x,
            side * CFG["controlVariant"]["pegInnerY"],
            foot.z - CFG["controlVariant"]["pegRadius"],
        ),
        (
            foot.x,
            side * CFG["controlVariant"]["pegOuterY"],
            foot.z - CFG["controlVariant"]["pegRadius"],
        ),
        CFG["controlVariant"]["pegRadius"],
        "dark",
        12,
    )
# Solid curved fender arches on the actual two tire crowns.
for wid, spec in CFG["wheelSpecs"].items():
    axle = spec["axle"]
    n = 16
    inner = 0.48
    outer = 0.525
    hw = 0.165
    limit = 1.18
    vv = [
        (axle + r * math.sin(t), y, 0.42 + r * math.cos(t))
        for j in range(n + 1)
        for t in [-limit + 2 * limit * j / n]
        for r, y in [(inner, -hw), (inner, hw), (outer, hw), (outer, -hw)]
    ]
    ff = [
        (k * 4 + j, k * 4 + (j + 1) % 4, (k + 1) * 4 + (j + 1) % 4, (k + 1) * 4 + j)
        for k in range(n)
        for j in range(4)
    ] + [(3, 2, 1, 0), (n * 4, n * 4 + 1, n * 4 + 2, n * 4 + 3)]
    roles = ["paintDeep", "creamShadow", "cream", "paint"] * n + ["paint", "paint"]
    mesh("Actual curved cream teal road fender " + wid, vv, ff, roles)
tube(
    "Front round headlamp dark housing",
    (-0.79, 0, 1.18),
    (-0.91, 0, 1.18),
    0.13,
    "frame",
    16,
)
disk(
    "Broad cream front headlamp face",
    (-0.918, 0, 1.18),
    (-1, 0, 0),
    0.105,
    "white",
    16,
    0.009,
)
cube("Simple rear ruby lamp", (1.42, 0, 0.84), (0.055, 0.17, 0.10), "ruby", bevel=0.014)

# Two true centerline road wheels, both side faces belong to each own Roll mesh.
for wid, spec in CFG["wheelSpecs"].items():
    r, width, nr = spec["radius"], spec["width"], spec["segments"]
    vv = []
    ff = []
    roles = []
    for y, rad in [
        (-width / 2, r * 0.84),
        (-width * 0.36, r * 0.97),
        (0, r),
        (width * 0.36, r * 0.97),
        (width / 2, r * 0.84),
    ]:
        for j in range(nr):
            t = 2 * math.pi * j / nr
            vv.append((rad * math.sin(t), y, rad * math.cos(t)))
    for k in range(4):
        for j in range(nr):
            ff.append(
                (
                    k * nr + j,
                    k * nr + (j + 1) % nr,
                    (k + 1) * nr + (j + 1) % nr,
                    (k + 1) * nr + j,
                )
            )
            roles.append("tire" if k in [1, 2] else "tireLight")
    for k in [0, 4]:
        ff.append(tuple(k * nr + j for j in range(nr)))
        roles.append("tire")
    mesh("True motorcycle rounded tire " + wid, vv, ff, roles, wid)
    for side in [-1, 1]:
        disk(
            "Classic broad wheel rim " + wid + " " + str(side),
            (0, side * (width / 2 + 0.002), 0),
            (0, side, 0),
            0.265,
            "rim",
            16,
            0.014,
            wid,
        )
        disk(
            "Chrome wheel hub " + wid + " " + str(side),
            (0, side * (width / 2 + 0.018), 0),
            (0, side, 0),
            0.11,
            "chrome",
            12,
            0.014,
            wid,
        )
        disk(
            "Asymmetric wheel phase index " + wid + " " + str(side),
            (0.13, side * (width / 2 + 0.034), 0.08),
            (0, side, 0),
            0.035,
            "frame",
            8,
            0.003,
            wid,
        )
