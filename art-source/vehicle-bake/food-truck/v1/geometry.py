"""Original closed-cab mobile kitchen with a true asymmetric serving cavity.

Forward-X, upZ, ground0. Axles and local pockets are family-owned; shade,
counter, folded lip and roof vent are static body geometry, not extra rigs.
"""


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
                        (p.y + 1.2) / 2.4 * 256 + (256 if f.center.x > -1.5 else 0)
                    ) / 512
                    py = 112 + (p.z - 0.8) / 1.45 * 112
                elif f.normal.z > 0.6 and f.center.z > 2.08:
                    u = (p.x + 2.60) / 1.50
                    py = 400 + (p.y + 1.2) / 2.4 * 32
                else:
                    u = (p.x + 3.0) / 2.0
                    py = (p.z - 0.9) / 1.35 * 112
            elif kind == "nose":
                u = (p.y + 1.2) / 2.4
                py = 432 + (p.x + 2.95) / 1.90 * 16
            elif kind == "box":
                if abs(f.normal.y) > 0.7:
                    u = (p.x + 1.15) / 4.05
                    py = (224 if f.center.y < 0 else 304) + (p.z - 0.4) / 2.25 * (
                        80 if f.center.y < 0 else 96
                    )
                else:
                    u = (p.x + 1.15) / 4.05
                    py = 400 + (p.y + 1.2) / 2.4 * 32
            elif kind == "inner":
                u = (p.x + 0.68) / 2.92
                py = 448 + (p.z - 1.18) / 1.20 * 32
            else:
                u = (p.x + 1.15) / 4.05
                py = 400 + (p.y + 1.2) / 2.4 * 32
            ob.data.uv_layers.active.data[li].uv = (
                max(0.001, min(0.999, u)),
                1 - max(0.5, min(479.5, py)) / 512,
            )


def pocket(ob, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=0.54,
            depth=1.0,
            location=(axle, side * 1.25, 0.48),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Food truck local open wheel arch", "BOOLEAN")
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


nose = loft(
    "Red rounded forward nose with integrated natural front fenders",
    [(-2.89, 0.93, 0), (-2.78, 1, 0), (-1.23, 1, 0), (-1.10, 0.96, 0)],
    [
        (-0.96, 0.40),
        (-1.08, 0.49),
        (-1.12, 0.91),
        (-1.08, 1.19),
        (-0.91, 1.29),
        (0, 1.31),
        (0.91, 1.29),
        (1.08, 1.19),
        (1.12, 0.91),
        (1.08, 0.49),
        (0.96, 0.40),
    ],
    0.9,
    1,
)
for vertex in nose.data.vertices:
    vertex.co.y *= 1.06
nose.data.update()
pocket(nose, -2.05)
chart(nose, "nose")
for f in nose.data.polygons:
    if f.normal.z < 0.5:
        role_face(nose, f, "paint" if f.center.z > 0.75 else "paintMid")
cab = loft(
    "Cream closed forward cab continuous side front rear glass skin",
    [(-2.45, 0.96, 0.25), (-2.10, 1, 0), (-1.14, 1, 0)],
    [
        (-0.98, 1.10),
        (-1.06, 1.26),
        (-1.06, 1.84),
        (-1.00, 2.08),
        (-0.85, 2.16),
        (0, 2.18),
        (0.85, 2.16),
        (1.00, 2.08),
        (1.06, 1.84),
        (1.06, 1.26),
        (0.98, 1.10),
    ],
    1.25,
    0.93,
)
chart(cab, "cab")

box = cube(
    "Red cream kitchen box actual serving recess and opposite emblem skin",
    (0.87, 0, 1.555),
    (3.98, 2.30, 2.19),
    "paint",
    bevel=0.075,
)
# Cutter traverses only the near side and stops at an actual back wall -.55Y.
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.78, -1.125, 1.78))
cutter = bpy.context.object
cutter.scale = (2.92, 1.15, 1.20)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.context.view_layer.objects.active = box
mod = box.modifiers.new("Actual wide serving cavity .60 source deep", "BOOLEAN")
mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter, do_unlink=True)
pocket(box, 1.90)
chart(box, "box")
# Assign interior back wall its own warm matte chart and the four actual jambs
# independent shadow roles. Exterior +Y emblem stays on the original box skin.
for f in box.data.polygons:
    if (
        abs(f.center.y + 0.55) < 0.001
        and -0.69 < f.center.x < 2.25
        and 1.17 < f.center.z < 2.39
    ):
        for li in f.loop_indices:
            p = box.data.vertices[box.data.loops[li].vertex_index].co
            box.data.uv_layers.active.data[li].uv = (
                (p.x + 0.68) / 2.92,
                1 - (448 + (p.z - 1.18) / 1.20 * 32) / 512,
            )
    elif (
        -0.69 < f.center.x < 2.25
        and -1.16 < f.center.y < -0.54
        and 1.17 < f.center.z < 2.39
    ):
        role_face(box, f, "counter" if f.normal.z > 0.5 else "innerShadow")
    elif abs(f.normal.y) < 0.7:
        role_face(
            box,
            f,
            (
                "creamLight"
                if f.center.z > 1.38
                else "paint" if f.center.z > 0.72 else "paintMid"
            ),
        )

roof = cube(
    "STATIC cream kitchen roof separate surface owner",
    (0.87, 0, 2.675),
    (4.00, 2.32, 0.05),
    "creamLight",
    bevel=0.025,
)
chart(roof, "roof")
cube(
    "STATIC one broad cream roof vent",
    (0.65, 0, 2.7475),
    (0.66, 0.56, 0.095),
    "creamMid",
    bevel=0.025,
)
cube(
    "STATIC single dark vent top inset",
    (0.65, 0, 2.798),
    (0.43, 0.31, 0.004),
    "chassisLight",
    bevel=0.015,
)

# Fixed short outward shade/hatch: a real low wedge attached just above recess.
x0, x1 = -0.82, 2.38
y0, y1 = -1.08, -1.46
vv = [
    (x, y, z)
    for x in [x0, x1]
    for y, z in [(y0, 2.48), (y1, 2.42), (y1, 2.36), (y0, 2.42)]
]
ff = [
    (0, 1, 2, 3),
    (4, 7, 6, 5),
    (0, 4, 5, 1),
    (1, 5, 6, 2),
    (2, 6, 7, 3),
    (3, 7, 4, 0),
]
mesh(
    "STATIC cream yellow short serving shade attached wedge",
    vv,
    ff,
    ["creamMid", "creamMid", "creamLight", "cream", "amber", "creamMid"],
)
cube(
    "STATIC serving hatch hinge seam", (0.78, -1.16, 2.405), (3.10, 0.035, 0.045), "ink"
)
cube(
    "STATIC broad serving counter actual horizontal slab",
    (0.78, -1.14, 1.155),
    (3.06, 0.48, 0.09),
    "counter",
    bevel=0.018,
)
cube(
    "STATIC folded outer counter edge",
    (0.78, -1.367, 1.215),
    (3.06, 0.035, 0.06),
    "counterLight",
    bevel=0.012,
)
for side in [-1, 1]:
    cube(
        "Narrow dark chassis rail " + str(side),
        (0, side * 0.57, 0.40),
        (5.55, 0.12, 0.18),
        "chassis",
        bevel=0.02,
    )
cube(
    "Retained central floor no full axle tunnel",
    (0, 0, 0.43),
    (5.55, 1.44, 0.16),
    "chassis",
)
for side in [-1, 1]:
    cube(
        "Cab entry step " + str(side),
        (-1.24, side * 1.10, 0.57),
        (0.48, 0.18, 0.12),
        "rim",
        bevel=0.025,
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


for axle in [-2.05, 1.90]:
    tube(
        "STATIC axle attachment arm " + str(axle),
        (axle, -0.775, 0.48),
        (axle, 0.775, 0.48),
        0.045,
    )
for x in [-2.94, 2.94]:
    cube(
        "Short cream truck bumper " + str(x),
        (x, 0, 0.57),
        (0.12, 2.24, 0.17),
        "creamMid",
        bevel=0.035,
    )
cube(
    "Broad front dark grille",
    (-2.908, 0, 0.94),
    (0.025, 1.12, 0.35),
    "ink",
    bevel=0.025,
)
for z in [0.84, 0.94, 1.04]:
    cube("Broad gray grille slat " + str(z), (-2.926, 0, z), (0.025, 1.0, 0.035), "rim")
for side in [-1, 1]:
    cube(
        "Food truck headlamp ink frame " + str(side),
        (-2.899, side * 0.82, 1.02),
        (0.025, 0.32, 0.25),
        "ink",
        bevel=0.03,
    )
    cube(
        "Food truck warm headlamp " + str(side),
        (-2.919, side * 0.82, 1.025),
        (0.025, 0.22, 0.16),
        "creamLight",
        bevel=0.02,
    )
    cube(
        "Food truck rear red lamp " + str(side),
        (2.884, side * 0.94, 0.83),
        (0.025, 0.18, 0.28),
        "ruby",
        bevel=0.02,
    )
    cube(
        "Food truck rear ivory lamp inset " + str(side),
        (2.900, side * 0.94, 0.75),
        (0.015, 0.12, 0.07),
        "cream",
    )


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
    mesh("Rounded covered food truck tire " + wid, vv, ff, roles, wid)
    disk(
        "Broad gray truck wheel rim " + wid,
        (0, side * (width / 2 + 0.003), 0),
        (0, side, 0),
        0.29,
        "rim",
        20,
        0.018,
        wid,
    )
    disk(
        "Simple gray truck hub " + wid,
        (0, side * (width / 2 + 0.024), 0),
        (0, side, 0),
        0.19,
        "silver",
        20,
        0.018,
        wid,
    )
    disk(
        "Truck asymmetric hub inset " + wid,
        (0.085, side * (width / 2 + 0.045), 0.05),
        (0, side, 0),
        0.045,
        "ink",
        10,
        0.004,
        wid,
    )
