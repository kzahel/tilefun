"""Independent 1970s long-roof estate geometry and skin charts.

Source units, forward -X, ground0. Wheel-local pockets and broad integrated
shoulders cover the smaller classic road wheels. No SUV geometry is stretched.
"""


def chart(ob, kind):
    uv = ob.data.uv_layers.active.data
    for face in ob.data.polygons:
        for li in face.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            if kind == "lower":
                if abs(face.normal.x) > 0.70:
                    u = (
                        (p.y + 1.05) / 2.1 * 256 + (256 if face.center.x > 0 else 0)
                    ) / 512
                    py = 304 + (p.z - 0.35) / 1.4 * 112
                elif face.normal.z > 0.65 and face.center.x < -1.12:
                    u = (p.x + 2.75) / 1.7
                    py = 448 + (p.y + 1.05) / 2.1 * 32
                else:
                    u = (p.x + 2.75) / 5.5
                    py = (p.z - 0.30) / 0.85 * 176
            elif kind == "cabin":
                if abs(face.normal.x) > 0.65:
                    u = (
                        (p.y + 1.05) / 2.1 * 256 + (256 if face.center.x > 0 else 0)
                    ) / 512
                    py = 304 + (p.z - 0.35) / 1.4 * 112
                elif face.normal.z > 0.60 and face.center.z > 1.56:
                    u = (p.x + 1.45) / 4.15
                    py = 416 + (p.y + 1.05) / 2.1 * 32
                else:
                    u = (p.x + 1.45) / 4.15
                    py = 176 + (p.z - 0.85) / 0.90 * 128
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def pocket(ob, axle):
    # Pockets stop inboard of the tread; central floor is retained.
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20,
            radius=CFG["arch"]["cutRadius"],
            depth=1.0,
            location=(axle, side * 1.12, CFG["wheelRadius"]),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Estate wheel-local floor and body pocket", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    ob.data.update()


def loft(name, stations, section):
    vv = []
    for x, width, sweep in stations:
        for y, z in section:
            t = max(0, min(1, (z - 0.95) / 0.69))
            vv.append((x + sweep * t, y * width, z))
    n = len(section)
    ff = []
    for i in range(len(stations) - 1):
        for j in range(n):
            ff.append(
                (
                    i * n + j,
                    i * n + (j + 1) % n,
                    (i + 1) * n + (j + 1) % n,
                    (i + 1) * n + j,
                )
            )
    ff.extend(
        [
            tuple(range(n - 1, -1, -1)),
            tuple((len(stations) - 1) * n + j for j in range(n)),
        ]
    )
    return mesh(name, vv, ff, "paint")


# Long low body has its own tapered nose/tail, broad belt and rounded shoulders.
# The greenhouse is narrower and sweeps strongly rearward at the windshield.
body_section = [
    (-0.82, 0.34),
    (-0.92, 0.44),
    (-0.935, 0.83),
    (-0.91, 0.96),
    (-0.77, 1.035),
    (0, 1.05),
    (0.77, 1.035),
    (0.91, 0.96),
    (0.935, 0.83),
    (0.92, 0.44),
    (0.82, 0.34),
]
body = loft(
    "Long rounded estate coachwork and real wood-inlay skin",
    [
        (-2.58, 0.93, 0),
        (-2.49, 1, 0),
        (-1.10, 1, 0),
        (1.90, 1, 0),
        (2.46, 0.99, 0),
        (2.59, 0.92, 0),
    ],
    body_section,
)
for axle in CFG["axles"]:
    pocket(body, axle)
chart(body, "lower")

cabin_section = [
    (-0.82, 0.90),
    (-0.89, 1.015),
    (-0.87, 1.35),
    (-0.80, 1.57),
    (-0.64, 1.62),
    (0, 1.64),
    (0.64, 1.62),
    (0.80, 1.57),
    (0.87, 1.35),
    (0.89, 1.015),
    (0.82, 0.90),
]
cabin = loft(
    "Sweeping estate greenhouse actual continuous side front rear roof skin",
    [(-1.24, 0.96, 0.50), (-0.65, 1, 0), (2.22, 1, 0), (2.50, 0.94, -0.22)],
    cabin_section,
)
chart(cabin, "cabin")
cube("Narrow retained estate chassis", (0, 0, 0.31), (5.0, 1.16, 0.13), "paintDeep")

# Broad low fender panels join the estate belt and cover the central tread crown.
f = CFG["fender"]
n = f["segments"]
r = CFG["wheelRadius"]
for axle in CFG["axles"]:
    for side in [-1, 1]:
        vv, ff, rr = [], [], []
        for y, rad in zip(f["lateralStations"], f["shoulderRadii"]):
            for j in range(n + 1):
                t = math.pi * j / n
                vv.append((axle + rad * math.cos(t), side * y, r + rad * math.sin(t)))
        for k in range(len(f["lateralStations"]) - 1):
            for j in range(n):
                ff.append(
                    (
                        k * (n + 1) + j,
                        k * (n + 1) + j + 1,
                        (k + 1) * (n + 1) + j + 1,
                        (k + 1) * (n + 1) + j,
                    )
                )
                rr.append("paintLight" if k < 2 else "paint" if k == 2 else "paintMid")
        base = len(vv)
        for j in range(n + 1):
            t = math.pi * j / n
            vv.append(
                (
                    axle + f["archRadius"] * math.cos(t),
                    side * f["lateralStations"][-1],
                    r + f["archRadius"] * math.sin(t),
                )
            )
        last = len(f["lateralStations"]) - 1
        for j in range(n):
            ff.append(
                (last * (n + 1) + j, last * (n + 1) + j + 1, base + j + 1, base + j)
            )
            rr.append("paintDeep")
        mesh(
            "Integrated estate low broad open fender " + str(axle) + " " + str(side),
            vv,
            ff,
            rr,
        )
for side in [-1, 1]:
    cube(
        "Restrained chrome rocker trim " + str(side),
        (-0.04, side * 0.94, 0.39),
        (2.10, 0.055, 0.045),
        "silver",
    )
for x in [-2.65, 2.65]:
    cube(
        "Classic short chrome bumper " + str(x),
        (x, 0, 0.43),
        (0.14, 1.93, 0.15),
        "silver",
        bevel=0.035,
    )
    cube(
        "Bumper rubber strip " + str(x),
        (x + (-0.073 if x < 0 else 0.073), 0, 0.43),
        (0.014, 1.70, 0.045),
        "ink",
    )

# Roof rack is fixed equipment: two slim longitudinal rails and two crossbars.
# Four little feet meet the actual crown; no luggage, moving equipment or tags.
for side in [-1, 1]:
    cube(
        "STATIC roof rack slender longitudinal rail " + str(side),
        (0.80, side * 0.61, 1.715),
        (2.30, 0.045, 0.055),
        "rack",
        bevel=0.012,
    )
    for x in [-0.18, 1.78]:
        cube(
            "STATIC roof rack planted foot " + str(side) + " " + str(x),
            (x, side * 0.61, 1.652),
            (0.10, 0.08, 0.085),
            "ink",
        )
for x in [-0.18, 1.78]:
    cube(
        "STATIC roof rack slim crossbar " + str(x),
        (x, 0, 1.68),
        (0.045, 1.29, 0.04),
        "rim",
        bevel=0.010,
    )


def disk(name, center, normal, radius, role, segments=12, depth=0.02, group="body"):
    c = Vector(center)
    normal = Vector(normal).normalized()
    u = normal.cross(Vector((0, 0, 1)))
    if u.length < 0.01:
        u = normal.cross(Vector((0, 1, 0)))
    u.normalize()
    v = normal.cross(u)
    vv = []
    for dep, rad in [(0, radius), (depth, radius * 0.85)]:
        for j in range(segments):
            vv.append(
                tuple(
                    c
                    + normal * dep
                    + rad
                    * (
                        u * math.cos(2 * math.pi * j / segments)
                        + v * math.sin(2 * math.pi * j / segments)
                    )
                )
            )
    ff = [
        (j, (j + 1) % segments, segments + (j + 1) % segments, segments + j)
        for j in range(segments)
    ]
    ff.append(tuple(segments + j for j in range(segments)))
    return mesh(name, vv, ff, role, group)


cube(
    "Classic horizontal estate grille aperture",
    (-2.593, 0, 0.745),
    (0.025, 1.12, 0.28),
    "ink",
)
for z in [0.66, 0.745, 0.83]:
    cube(
        "Simple broad horizontal grille bar " + str(z),
        (-2.61, 0, z),
        (0.02, 1.08, 0.025),
        "rim",
    )
for side in [-1, 1]:
    cube(
        "Front headlamp dark framed rectangular surround " + str(side),
        (-2.598, side * 0.72, 0.77),
        (0.025, 0.32, 0.235),
        "ink",
        bevel=0.02,
    )
    for y in [0.64, 0.79]:
        cube(
            "Twin classic rectangular headlamp " + str(side) + " " + str(y),
            (-2.615, side * y, 0.78),
            (0.022, 0.115, 0.16),
            "cream",
            bevel=0.012,
        )
    cube(
        "Front amber corner lamp " + str(side),
        (-2.607, side * 0.73, 0.58),
        (0.02, 0.20, 0.055),
        "amber",
    )
    cube(
        "Rear upright ruby corner lamp " + str(side),
        (2.601, side * 0.76, 0.76),
        (0.025, 0.14, 0.28),
        "ruby",
        bevel=0.01,
    )
    cube(
        "Rear ruby broad highlight " + str(side),
        (2.617, side * 0.76, 0.81),
        (0.012, 0.09, 0.06),
        "rubyLight",
    )

# Classic tires are slimmer and smaller than the off-roader, with their own
# centered radius and track; one asymmetrical hub inset reveals actual rolling.
width = CFG["wheelWidth"]
nr = 20
for axle in CFG["axles"]:
    for side in [-1, 1]:
        wid = ("F" if axle < 0 else "R") + ("L" if side < 0 else "R")
        vv, ff, rr = [], [], []
        for y, rad in [
            (-width / 2, r * 0.82),
            (-width * 0.34, r),
            (width * 0.34, r),
            (width / 2, r * 0.82),
        ]:
            for j in range(nr):
                t = 2 * math.pi * j / nr
                vv.append((rad * math.sin(t), y, rad * math.cos(t)))
        for k in range(3):
            for j in range(nr):
                ff.append(
                    (
                        k * nr + j,
                        k * nr + (j + 1) % nr,
                        (k + 1) * nr + (j + 1) % nr,
                        (k + 1) * nr + j,
                    )
                )
                rr.append("tire" if k == 1 else "tireLight")
        for k in [0, 3]:
            ff.append(tuple(k * nr + j for j in range(nr)))
            rr.append("tire")
        mesh("Classic estate tire " + wid, vv, ff, rr, wid)
        disk(
            "Classic polished wheel rim " + wid,
            (0, side * (width / 2 + 0.003), 0),
            (0, side, 0),
            0.248,
            "rim",
            group=wid,
        )
        disk(
            "Classic metal dome hub " + wid,
            (0, side * (width / 2 + 0.025), 0),
            (0, side, 0),
            0.17,
            "silver",
            depth=0.025,
            group=wid,
        )
        disk(
            "Estate asymmetric hub inset " + wid,
            (0.075, side * (width / 2 + 0.052), 0.06),
            (0, side, 0),
            0.044,
            "ink",
            segments=6,
            depth=0.002,
            group=wid,
        )
