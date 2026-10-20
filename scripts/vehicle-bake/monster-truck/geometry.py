"""Independent raised narrow monster pickup, real bed, exposed .85R lug tires.

Source -X forward/+Z up/ground0. All fixed suspension is cosmetic rest geometry;
axle arms stop just inboard of each tire slab. No crown-covering fake caps.
"""


def chart(ob, kind):
    uv = ob.data.uv_layers.active.data
    for face in ob.data.polygons:
        for li in face.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            if kind == "cab":
                if abs(face.normal.x) > 0.65:
                    u = (
                        (p.y + 1.0) / 2.0 * 256 + (256 if face.center.x > 0 else 0)
                    ) / 512
                    py = 192 + (p.z - 1.60) / 1.50 * 160
                elif face.normal.z > 0.6 and face.center.z > 2.85:
                    u = (p.x + 1.15) / 1.85
                    py = 352 + (p.y + 1.0) / 2.0 * 48
                else:
                    u = (p.x + 1.15) / 1.85
                    py = (p.z - 1.60) / 1.50 * 192
            elif kind == "hood":
                u = (p.x + 2.50) / 1.6
                py = 400 + (p.y + 1.0) / 2.0 * 48
            else:
                u = (p.y + 0.80) / 1.60
                py = 448 + (p.x - 0.58) / 1.74 * 32
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def pocket(ob, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20,
            radius=CFG["arch"]["cutRadius"],
            depth=1.40,
            location=(axle, side * 1.40, 0.85),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Local raised-body wheel pocket only", "BOOLEAN")
        mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    ob.data.update()


def loft(name, stations, section):
    vv = [
        (x + sweep * max(0, min(1, (z - 2.20) / 0.8)), y * width, z)
        for x, width, sweep in stations
        for y, z in section
    ]
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


cab_section = [
    (-0.72, 1.68),
    (-0.84, 1.83),
    (-0.85, 2.23),
    (-0.83, 2.70),
    (-0.76, 2.91),
    (-0.60, 2.98),
    (0, 3.0),
    (0.60, 2.98),
    (0.76, 2.91),
    (0.83, 2.70),
    (0.85, 2.23),
    (0.84, 1.83),
    (0.72, 1.68),
]
cab = loft(
    "Raised short closed lime cab actual side glass roof skin",
    [(-1.02, 0.94, 0.35), (-0.65, 1, 0), (0.42, 1, 0), (0.51, 0.96, -0.04)],
    cab_section,
)
pocket(cab, -1.45)
chart(cab, "cab")
hood_section = [
    (-0.70, 1.68),
    (-0.86, 1.82),
    (-0.87, 2.10),
    (-0.76, 2.23),
    (-0.60, 2.255),
    (0, 2.27),
    (0.60, 2.255),
    (0.76, 2.23),
    (0.87, 2.10),
    (0.86, 1.82),
    (0.70, 1.68),
]
hood = loft(
    "Raised short rounded lime hood own skin",
    [(-2.33, 0.92, 0), (-2.23, 1, 0), (-1.08, 1, 0), (-0.98, 0.96, 0)],
    hood_section,
)
pocket(hood, -1.45)
chart(hood, "hood")

# The cargo bay is an actual short recessed tub, not a painted top deck.
bed = CFG["cargoBed"]
floor = cube(
    "Recessed monster cargo floor", bed["floorCenter"], bed["floorSize"], "bedFloor"
)
chart(floor, "floor")
for side in [-1, 1]:
    wall = cube(
        "Short monster cargo side wall " + str(side),
        (1.45, side * 0.80, 2.08),
        (1.84, 0.15, 0.65),
        "paint",
        bevel=0.04,
    )
    pocket(wall, 1.45)
    for face in wall.data.polygons:
        role = (
            "bedWall"
            if face.normal.y * side < -0.5
            else (
                "paintLight"
                if face.normal.z > 0.5
                else "paint" if face.center.z > 1.95 else "paintMid"
            )
        )
        idx = keys.index(role)
        for li in face.loop_indices:
            wall.data.uv_layers.active.data[li].uv = (
                ((idx % 16) * 32 + 16) / 512,
                1 - (480 + (idx // 16) * 16 + 8) / 512,
            )
    cube(
        "Purple rolled cargo rim " + str(side),
        (1.45, side * 0.80, 2.415),
        (1.88, 0.18, 0.08),
        "purpleLight",
        bevel=0.025,
    )
for x, label in [(0.60, "Cargo front bulkhead"), (2.33, "Closed short cargo tailgate")]:
    wall = cube(label, (x, 0, 2.08), (0.12, 1.46, 0.65), "paint", bevel=0.035)
    for face in wall.data.polygons:
        inward = face.normal.x > 0 if x < 1 else face.normal.x < 0
        role = "bedWall" if inward else "paintLight" if face.normal.z > 0.5 else "paint"
        idx = keys.index(role)
        for li in face.loop_indices:
            wall.data.uv_layers.active.data[li].uv = (
                ((idx % 16) * 32 + 16) / 512,
                1 - (480 + (idx // 16) * 16 + 8) / 512,
            )
    cube(label + " purple upper seam", (x, 0, 2.423), (0.13, 1.44, 0.045), "purple")
cube("Narrow cab support floor", (-0.25, 0, 1.68), (1.65, 1.36, 0.12), "chassis")


def tube(name, a, b, radius, role="chassisLight", sides=6):
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    u = t.cross(Vector((0, 0, 1)))
    if u.length < 0.001:
        u = t.cross(Vector((0, 1, 0)))
    u.normalize()
    v = t.cross(u)
    vv = []
    for p in [a, b]:
        for j in range(sides):
            vv.append(
                tuple(
                    p
                    + radius
                    * (
                        u * math.cos(2 * math.pi * j / sides)
                        + v * math.sin(2 * math.pi * j / sides)
                    )
                )
            )
    ff = [
        (j, (j + 1) % sides, sides + (j + 1) % sides, sides + j) for j in range(sides)
    ]
    ff.extend([tuple(range(sides - 1, -1, -1)), tuple(sides + j for j in range(sides))])
    return mesh(name, vv, ff, role)


# Simple dark visible fixed frame and suspension links. All endpoints stay just
# inside the .77-source inner tire slab; this is rest geometry, no new physics.
for side in [-1, 1]:
    cube(
        "STATIC dark long chassis rail " + str(side),
        (0, side * 0.42, 1.35),
        (4.18, 0.13, 0.22),
        "chassis",
        bevel=0.025,
    )
    cube(
        "Purple raised side step " + str(side),
        (0, side * 0.86, 1.56),
        (1.12, 0.22, 0.09),
        "purple",
        bevel=0.025,
    )
for axle in [-1.45, 1.45]:
    tube(
        "STATIC axle attachment arm " + str(axle),
        (axle, -0.755, 0.85),
        (axle, 0.755, 0.85),
        0.065,
        "chassisLight",
        8,
    )
    cube(
        "STATIC central axle housing " + str(axle),
        (axle, 0, 0.85),
        (0.34, 0.38, 0.28),
        "chassis",
        bevel=0.045,
    )
    tube(
        "STATIC frame crossmember " + str(axle),
        (axle, -0.49, 1.35),
        (axle, 0.49, 1.35),
        0.07,
        "chassis",
        6,
    )
    for side in [-1, 1]:
        tube(
            "STATIC fixed diagonal suspension link " + str(axle) + " " + str(side),
            (axle + (0.40 if axle < 0 else -0.40), side * 0.42, 1.31),
            (axle, side * 0.67, 0.85),
            0.052,
            "chassisLight",
            6,
        )
        tube(
            "STATIC fixed purple shock " + str(axle) + " " + str(side),
            (axle, side * 0.54, 1.64),
            (axle, side * 0.68, 1.01),
            0.045,
            "purple",
            6,
        )
for x in [-2.42, 2.42]:
    cube(
        "Purple short heavy bumper " + str(x),
        (x, 0, 1.80),
        (0.16, 1.80, 0.20),
        "purple",
        bevel=0.035,
    )
cube(
    "Broad dark front grille",
    (-2.351, 0, 1.98),
    (0.025, 1.14, 0.34),
    "ink",
    bevel=0.025,
)
for z in [1.88, 2.0, 2.10]:
    cube(
        "Broad purple grille slat " + str(z),
        (-2.373, 0, z),
        (0.02, 1.05, 0.035),
        "purpleLight",
    )
for side in [-1, 1]:
    cube(
        "Monster headlamp dark frame " + str(side),
        (-2.35, side * 0.71, 2.02),
        (0.027, 0.24, 0.25),
        "ink",
        bevel=0.025,
    )
    cube(
        "Monster ivory headlamp " + str(side),
        (-2.373, side * 0.71, 2.025),
        (0.023, 0.16, 0.16),
        "cream",
        bevel=0.018,
    )
    cube(
        "Ruby rear corner lamp " + str(side),
        (2.402, side * 0.69, 2.03),
        (0.025, 0.15, 0.23),
        "ruby",
        bevel=0.015,
    )


def disk(name, center, normal, radius, role, segments=12, depth=0.025, group="body"):
    c = Vector(center)
    normal = Vector(normal).normalized()
    u = normal.cross(Vector((0, 0, 1)))
    if u.length < 0.001:
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


for wid, spec in CFG["wheelSpecs"].items():
    radius, width, nr = spec["radius"], spec["width"], spec["segments"]
    side = -1 if wid[1] == "L" else 1
    vv, ff, rr = [], [], []
    for y, rad in [
        (-width / 2, 0.67),
        (-width * 0.34, 0.775),
        (width * 0.34, 0.775),
        (width / 2, 0.67),
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
    mesh("Massive rounded black tire carcass " + wid, vv, ff, rr, wid)
    # Broad chevron lug corners lie exactly on radius.85. Wedge blocks embed in
    # carcass and leave genuine angular gaps. No cube corner exceeds metadata.
    for j in range(spec["treadGroups"]):
        theta = 2 * math.pi * j / spec["treadGroups"] + 0.07
        for half, (ya, yb, sa, sb) in enumerate(
            [(-0.30, -0.025, -0.08, 0.08), (0.025, 0.30, 0.08, -0.08)]
        ):
            corners = [
                (ya, theta - 0.15 + sa),
                (yb, theta - 0.15 + sb),
                (yb, theta + 0.15 + sb),
                (ya, theta + 0.15 + sa),
            ]
            verts = [
                (rad * math.sin(t), y, rad * math.cos(t))
                for rad in [0.75, radius]
                for y, t in corners
            ]
            faces = [(3, 2, 1, 0), (4, 5, 6, 7)] + [
                (k, (k + 1) % 4, (k + 1) % 4 + 4, k + 4) for k in range(4)
            ]
            mesh(
                "Broad block tread " + wid + " " + str(j) + " " + str(half),
                verts,
                faces,
                ["tire", "tireLight", "tire", "tire", "tire", "tire"],
                wid,
            )
    disk(
        "Purple monster wheel rim " + wid,
        (0, side * (width / 2 + 0.003), 0),
        (0, side, 0),
        0.49,
        "purple",
        12,
        0.02,
        wid,
    )
    disk(
        "Purple monster broad hub " + wid,
        (0, side * (width / 2 + 0.026), 0),
        (0, side, 0),
        0.31,
        "purpleLight",
        12,
        0.025,
        wid,
    )
    disk(
        "Monster hub dark asymmetric inset " + wid,
        (0.12, side * (width / 2 + 0.054), 0.08),
        (0, side, 0),
        0.078,
        "purpleDeep",
        8,
        0.002,
        wid,
    )
