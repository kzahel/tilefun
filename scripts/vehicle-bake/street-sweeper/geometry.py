"""Original white/mint sweeper; two fixed low bristle discs, four road wheels."""


def role_face(ob, face, role):
    idx = keys.index(role)
    for li in face.loop_indices:
        ob.data.uv_layers.active.data[li].uv = (
            ((idx % 16) * 32 + 16) / 512,
            1 - (480 + (idx // 16) * 16 + 8) / 512,
        )


def chart(ob, kind):
    for f in ob.data.polygons:
        for li in f.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            if kind == "cab":
                if abs(f.normal.x) > 0.65:
                    u = (
                        (p.y + 1.05) / 2.1 * 256 + (256 if f.center.x > -0.9 else 0)
                    ) / 512
                    py = 144 + (p.z - 0.75) / 1.40 * 112
                elif f.normal.z > 0.6 and f.center.z > 1.98:
                    u = (p.x + 2.0) / 1.65
                    py = 416 + (p.y + 1.05) / 2.1 * 16
                else:
                    u = (p.x + 2.0) / 1.65
                    py = (p.z - 0.75) / 1.40 * 144
            elif kind == "tank":
                if abs(f.normal.x) > 0.7:
                    u = (p.y + 1.0) / 2.0
                    py = 448 + (p.z - 0.85) / 1.2 * 32
                else:
                    u = (p.x + 0.30) / 2.2
                    py = 256 + (p.z - 0.75) / 1.30 * 160
            elif kind == "nose":
                u = (p.y + 1.05) / 2.1
                py = 432 + (p.x + 2) / 1.65 * 16
            else:
                raise ValueError(kind)
            ob.data.uv_layers.active.data[li].uv = (
                max(0.001, min(0.999, u)),
                1 - max(0.5, min(479.5, py)) / 512,
            )


def pocket(ob, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=0.42,
            depth=1.0,
            location=(axle, side * 1.06, 0.36),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Own sweeper wheel-local open pocket", "BOOLEAN")
        mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    ob.data.update()


def loft(name, stations, section, sweep_start, sweep_height):
    n = len(section)
    vv = [
        (x + sweep * max(0, min(1, (z - sweep_start) / sweep_height)), y * w, z)
        for x, w, sweep in stations
        for y, z in section
    ]
    ff = [
        (i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j)
        for i in range(len(stations) - 1)
        for j in range(n)
    ]
    ff += [
        tuple(range(n - 1, -1, -1)),
        tuple((len(stations) - 1) * n + j for j in range(n)),
    ]
    return mesh(name, vv, ff, "paint")


front = loft(
    "Mint short nose integrated front fenders",
    [(-1.91, 0.94, 0), (-1.78, 1, 0), (-0.53, 1, 0), (-0.39, 0.94, 0)],
    [
        (-0.84, 0.31),
        (-0.97, 0.40),
        (-1.0, 0.73),
        (-0.92, 0.91),
        (-0.75, 0.96),
        (0, 0.98),
        (0.75, 0.96),
        (0.92, 0.91),
        (1, 0.73),
        (0.97, 0.40),
        (0.84, 0.31),
    ],
    1,
    1,
)
pocket(front, -1.25)
chart(front, "nose")
for f in front.data.polygons:
    if f.normal.z < 0.5:
        role_face(front, f, "paint" if f.center.z > 0.64 else "paintMid")
cab = loft(
    "White closed cab continuous side front rear blue glass and roof skin",
    [(-1.88, 0.97, 0.25), (-1.52, 1, 0), (-0.50, 1, 0), (-0.41, 0.95, -0.025)],
    [
        (-0.83, 0.85),
        (-0.94, 1.03),
        (-0.94, 1.73),
        (-0.87, 1.98),
        (-0.72, 2.08),
        (0, 2.10),
        (0.72, 2.08),
        (0.87, 1.98),
        (0.94, 1.73),
        (0.94, 1.03),
        (0.83, 0.85),
    ],
    0.90,
    1.20,
)
chart(cab, "cab")
base = cube(
    "Mint rear lower collection body real integrated rear wheelhouses",
    (1.05, 0, 0.665),
    (1.75, 2.0, 0.55),
    "paintMid",
    bevel=0.035,
)
pocket(base, 1.20)
for f in base.data.polygons:
    role_face(
        base,
        f,
        (
            "paintLight"
            if f.normal.z > 0.5
            else "paintMid" if f.center.z > 0.60 else "paintDeep"
        ),
    )
# Genuine round/elliptical closed collection tank: four tapered longitudinal
# rings,16 angular vertices per ring; cap and side charts own actual skin.
nr = 16
stations = [(-0.22, 0.72), (-0.02, 1.0), (1.60, 1.0), (1.84, 0.72)]
vv = [
    (
        x,
        0.94 * q * math.cos(2 * math.pi * j / nr),
        1.43 + 0.53 * q * math.sin(2 * math.pi * j / nr),
    )
    for x, q in stations
    for j in range(nr)
]
ff = [
    (k * nr + j, k * nr + (j + 1) % nr, (k + 1) * nr + (j + 1) % nr, (k + 1) * nr + j)
    for k in range(3)
    for j in range(nr)
]
ff += [tuple(range(nr - 1, -1, -1)), tuple(3 * nr + j for j in range(nr))]
tank = mesh(
    "STATIC rounded gray green collection tank actual closed skin", vv, ff, "tank"
)
chart(tank, "tank")


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


for side in [-1, 1]:
    cube(
        "Dark compact chassis rail " + str(side),
        (0, side * 0.40, 0.34),
        (3.58, 0.14, 0.15),
        "chassis",
        bevel=0.015,
    )
    tube(
        "STATIC brush fixed arm " + str(side),
        (-0.36, side * 0.64, 0.63),
        (-0.05, side * 1.0, 0.29),
        0.04,
        "rim",
        8,
    )
    tube(
        "STATIC brush vertical mount " + str(side),
        (-0.05, side * 1.0, 0.29),
        (-0.05, side * 1.0, 0.23),
        0.05,
        "chassisLight",
        8,
    )
    cube(
        "STATIC tank support saddle " + str(side),
        (0.72, side * 0.52, 0.93),
        (1.62, 0.22, 0.16),
        "tankShadow",
        bevel=0.025,
    )
cube(
    "Narrow central floor retains local pockets",
    (0, 0, 0.34),
    (3.58, 1.12, 0.12),
    "chassis",
)
for axle in [-1.25, 1.20]:
    tube(
        "STATIC axle attachment arm " + str(axle),
        (axle, -0.645, 0.36),
        (axle, 0.645, 0.36),
        0.033,
        "chassisLight",
        8,
    )
for x in [-1.94, 1.94]:
    cube(
        "Short gray sweeper bumper " + str(x),
        (x, 0, 0.49),
        (0.12, 1.90, 0.16),
        "rim",
        bevel=0.025,
    )
cube(
    "Simple dark front intake",
    (-1.927, 0, 0.73),
    (0.022, 0.90, 0.19),
    "ink",
    bevel=0.018,
)
for side in [-1, 1]:
    cube(
        "Front lamp ink frame " + str(side),
        (-1.925, side * 0.74, 0.75),
        (0.025, 0.25, 0.19),
        "ink",
        bevel=0.018,
    )
    cube(
        "Broad pale headlamp " + str(side),
        (-1.942, side * 0.74, 0.75),
        (0.025, 0.17, 0.11),
        "white",
        bevel=0.014,
    )
    cube(
        "Tank rear ruby lamp " + str(side),
        (1.937, side * 0.76, 0.70),
        (0.025, 0.14, 0.16),
        "ruby",
        bevel=0.014,
    )
# Fixed horizontal brush discs are NOT Wheel_* objects. Twelve actual separated
# chunky wedge bristle blocks per brush give a readable dark circular silhouette.
for side in [-1, 1]:
    center = Vector((-0.05, side * 1.0, 0.16))
    disk(
        "STATIC low circular brush cap " + str(side),
        (-0.05, side * 1.0, 0.17),
        (0, 0, 1),
        0.18,
        "brushCap",
        16,
        0.05,
    )
    for j in range(12):
        angle = 2 * math.pi * j / 12
        vv = [
            (-0.05 + r * math.cos(a), side * 1.0 + r * math.sin(a), z)
            for z in [0.055, 0.185]
            for r, a in [
                (0.10, angle - 0.19),
                (0.25, angle - 0.19),
                (0.25, angle + 0.19),
                (0.10, angle + 0.19),
            ]
        ]
        mesh(
            "STATIC broad dark brush bristle block " + str(side) + " " + str(j),
            vv,
            [
                (0, 3, 2, 1),
                (4, 5, 6, 7),
                (0, 1, 5, 4),
                (1, 2, 6, 5),
                (2, 3, 7, 6),
                (3, 0, 4, 7),
            ],
            [
                "bristle",
                "bristleLight",
                "bristle",
                "bristle",
                "bristle",
                "bristleLight",
            ],
        )
for wid, spec in CFG["wheelSpecs"].items():
    r, width, nr = spec["radius"], spec["width"], spec["segments"]
    side = -1 if wid[1] == "L" else 1
    vv, ff, roles = [], [], []
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
    mesh("Rounded covered sweeper tire " + wid, vv, ff, roles, wid)
    disk(
        "Gray sweeper wheel rim " + wid,
        (0, side * (width / 2 + 0.003), 0),
        (0, side, 0),
        0.22,
        "rim",
        20,
        0.018,
        wid,
    )
    disk(
        "Broad gray sweeper hub " + wid,
        (0, side * (width / 2 + 0.024), 0),
        (0, side, 0),
        0.15,
        "silver",
        20,
        0.018,
        wid,
    )
    disk(
        "Sweeper asymmetric hub inset " + wid,
        (0.06, side * (width / 2 + 0.045), 0.035),
        (0, side, 0),
        0.037,
        "ink",
        10,
        0.004,
        wid,
    )
