"""Original upright touring bike; profile contacts from one measured mount."""


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
    if name.startswith("Classic broad wheel rim"):
        vv.append(tuple(c + normal * depth))
        center = len(vv) - 1
        ff += [
            (center, segments + j, segments + (j + 1) % segments)
            for j in range(segments)
        ]
        roles = [role] * segments + [
            "rim" if (j // 4) % 2 == 0 else "frame" for j in range(segments)
        ]
        return mesh(name, vv, ff, roles, group)
    ff.append(tuple(segments + j for j in range(segments)))
    return mesh(name, vv, ff, role, group)


# New upright touring volumes, all authored in source surfaces rather than camera paint.
def loft(name, stations, role="paint", chart=None):
    vv = []
    for x, w, low, high in stations:
        h = high - low
        vv += [
            (x, y, z)
            for y, z in [
                (-0.6 * w, low),
                (0.6 * w, low),
                (w, low + 0.18 * h),
                (w, low + 0.75 * h),
                (0.55 * w, high),
                (-0.55 * w, high),
                (-w, low + 0.75 * h),
                (-w, low + 0.18 * h),
            ]
        ]
    n = len(stations)
    ff = [
        (k * 8 + j, k * 8 + (j + 1) % 8, (k + 1) * 8 + (j + 1) % 8, (k + 1) * 8 + j)
        for k in range(n - 1)
        for j in range(8)
    ]
    ff += [tuple(range(7, -1, -1)), tuple((n - 1) * 8 + j for j in range(8))]
    ob = mesh(name, vv, ff, role)
    if chart:
        for face in ob.data.polygons:
            for li in face.loop_indices:
                p = ob.data.vertices[ob.data.loops[li].vertex_index].co
                if chart == "fairing":
                    u = (p.x + 0.70) / 1.32
                    py = (p.z - 0.30) / 0.85 * 192
                else:
                    u = (p.y + 0.30) / 0.60
                    py = 192 + (p.x + 1.4) / 2.8 * 128
                ob.data.uv_layers.active.data[li].uv = (
                    max(0.001, min(0.999, u)),
                    1 - max(0.5, min(319.5, py)) / 512,
                )
    return ob


# Broad forward fairing stays ahead of the immutable hands and knees.
fairing = loft(
    "TOURING broad cream edged front fairing",
    [
        (-1.30, 0.19, 0.98, 1.23),
        (-1.14, 0.31, 0.96, 1.34),
        (-0.90, 0.32, 0.99, 1.39),
        (-0.66, 0.17, 1.04, 1.28),
    ],
    chart="top",
)
tank = loft(
    "TOURING larger shouldered navy fuel tank",
    [
        (-0.78, 0.10, 0.94, 1.12),
        (-0.62, 0.17, 0.91, 1.22),
        (-0.43, 0.145, 0.92, 1.24),
        (-0.28, 0.12, 0.95, 1.18),
        (-0.18, 0.025, 0.985, 1.055),
    ],
    chart="top",
)
# Front lamp UV belongs only to forward end skin.
for face in fairing.data.polygons:
    if face.normal.x < -0.6:
        for li in face.loop_indices:
            p = fairing.data.vertices[fairing.data.loops[li].vertex_index].co
            fairing.data.uv_layers.active.data[li].uv = (
                (p.y + 0.19) / 0.38,
                1 - (400 + 48 * (p.z - 0.98) / 0.25) / 512,
            )
vv = [
    (x + d, y, z)
    for d in [-0.012, 0.012]
    for x, z, y in [
        (-0.98, 1.30, -0.26),
        (-0.98, 1.30, 0.26),
        (-0.73, 1.78, 0.235),
        (-0.73, 1.78, -0.235),
    ]
]
screen = mesh(
    "TOURING tall cool blue framed screen actual skin",
    vv,
    [
        (0, 1, 2, 3),
        (7, 6, 5, 4),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ],
    "ink",
)
for f in screen.data.polygons:
    if abs(f.normal.x) < 0.5:
        continue
    for li in f.loop_indices:
        p = screen.data.vertices[screen.data.loops[li].vertex_index].co
        screen.data.uv_layers.active.data[li].uv = (
            max(0.001, min(0.999, (p.y + 0.265) / 0.53)),
            1 - max(320.5, min(399.5, 320 + 80 * (p.z - 1.30) / 0.48)) / 512,
        )
# Rear luggage is actual closed three-dimensional geometry, outside the rider calves.
for side in [-1, 1]:
    pod = loft(
        "TOURING closed deep pannier " + str(side),
        [
            (0.48, 0.105, 0.76, 0.94),
            (0.58, 0.135, 0.70, 1.02),
            (1.14, 0.135, 0.70, 1.02),
            (1.30, 0.105, 0.76, 0.97),
        ],
        chart="fairing",
    )
    for v in pod.data.vertices:
        v.co.y += side * 0.375
    cube(
        "TOURING pannier lid " + str(side),
        (0.88, side * 0.375, 1.025),
        (0.69, 0.275, 0.045),
        "cream",
        bevel=0.018,
    )
    tube(
        "TOURING pannier attached carrier " + str(side),
        (0.55, side * 0.12, 0.91),
        (0.82, side * 0.32, 0.91),
        0.025,
        "frame",
        8,
    )
cube(
    "TOURING rear luggage deck",
    (0.97, 0, 1.11),
    (0.65, 0.35, 0.055),
    "cream",
    bevel=0.018,
)
cube(
    "TOURING comfortable raised pillion saddle",
    (0.55, 0, 1.085),
    (0.40, 0.31, 0.12),
    "seat",
    bevel=0.035,
)
seat_top = CONTACTS["hip_saddle"].z
cube(
    "Actual dark saddle central hip tangent",
    (0.24, 0, seat_top - 0.043),
    (0.68, 0.16, 0.086),
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
    "TOURING concealed broad crankcase",
    (-0.05, 0, 0.61),
    (0.38, 0.20, 0.27),
    "engine",
    bevel=0.035,
)
cube(
    "TOURING lower dark undertray",
    (-0.05, 0, 0.37),
    (0.80, 0.20, 0.08),
    "dark",
    bevel=0.015,
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
    tube("TOURING internal chassis member " + str(i), a, b, 0.028, "frame", 8)
for side in [-1, 1]:
    tube(
        "TOURING front fork " + str(side),
        (-0.70, side * 0.19, 1.12),
        (-1.12, side * 0.19, 0.42),
        0.025,
        "chrome",
        8,
    )
    tube(
        "TOURING rear swingarm " + str(side),
        (0.1, side * 0.24, 0.48),
        (1.12, side * 0.24, 0.42),
        0.025,
        "frame",
        8,
    )
    tube(
        "TOURING rear fixed shock " + str(side),
        (0.52, side * 0.24, 0.96),
        (1.05, side * 0.24, 0.45),
        0.025,
        "frameLight",
        8,
    )
    for wid in ["F", "R"]:
        spec = CFG["wheelSpecs"][wid]
        end = spec["width"] / 2 + 0.048
        start = end + 0.032
        tube(
            "TOURING fixed axle stops short of hub " + wid + str(side),
            (spec["axle"], side * start, spec["radius"]),
            (spec["axle"], side * end, spec["radius"]),
            0.021,
            "frameLight",
            8,
        )
    tube(
        "TOURING short upswept exhaust " + str(side),
        (0.45, side * 0.27, 0.32),
        (0.95, side * 0.27, 0.42),
        0.038,
        "engineLight",
        10,
    )
tube("TOURING grip riser", (-0.70, 0, 1.10), (-0.55, 0, 1.37), 0.025, "frameLight", 8)
tube(
    "TOURING connected handlebar",
    (-0.55, -0.17, 1.37),
    (-0.55, 0.17, 1.37),
    0.021,
    "frameLight",
    12,
)
for side, label in [(-1, "left"), (1, "right")]:
    hand = CONTACTS["hand_" + label + "_grip"]
    tube(
        "Actual palm wrapped grip " + label,
        (hand.x, hand.y - 0.06, hand.z),
        (hand.x, hand.y + 0.06, hand.z),
        0.026,
        "dark",
        12,
    )
    foot = CONTACTS["foot_" + label + "_support"]
    tube(
        "Actual sole tangent foot peg " + label,
        (foot.x, side * 0.10, foot.z - 0.025),
        (foot.x, side * 0.31, foot.z - 0.025),
        0.025,
        "dark",
        12,
    )
for wid, spec in CFG["wheelSpecs"].items():
    f = CFG["fenders"][wid]
    n = 12
    vv = [
        (spec["axle"] + r * math.sin(t), y, spec["radius"] + r * math.cos(t))
        for j in range(n + 1)
        for t in [-f["limit"] + 2 * f["limit"] * j / n]
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
    ] + [(3, 2, 1, 0), (n * 4, n * 4 + 1, n * 4 + 2, n * 4 + 3)]
    mesh(
        "TOURING close curved road fender " + wid,
        vv,
        ff,
        ["paintDeep", "paintMid", "paint", "paintShadow"] * n + ["paint", "paint"],
    )
cube(
    "TOURING integrated tail ruby lamp",
    (1.30, 0, 1.07),
    (0.035, 0.11, 0.055),
    "ruby",
    bevel=0.008,
)

# Genuine independently rolling F/R assemblies; rear width is its own parameter.

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
