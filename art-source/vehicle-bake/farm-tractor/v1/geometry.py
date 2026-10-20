"""Original narrow-hood farm tractor. Rear-only fenders, exposed small front wheels, fixed rear drawbar."""


def curve_tube(name, pts, r, role, group="body", sides=4):
    vv = []
    for i, p in enumerate(pts):
        tangent = Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(0, i - 1)])
        tangent.normalize()
        a = tangent.cross(Vector((0, 0, 1)))
        if a.length < 0.01:
            a = tangent.cross(Vector((0, 1, 0)))
        a.normalize()
        b = tangent.cross(a).normalized()
        for j in range(sides):
            vv.append(
                tuple(
                    Vector(p)
                    + r
                    * (
                        a * math.cos(j * 2 * math.pi / sides)
                        + b * math.sin(j * 2 * math.pi / sides)
                    )
                )
            )
    ff = []
    for i in range(len(pts) - 1):
        for j in range(sides):
            ff.append(
                (
                    i * sides + j,
                    i * sides + (j + 1) % sides,
                    (i + 1) * sides + (j + 1) % sides,
                    (i + 1) * sides + j,
                )
            )
    ff.extend(
        [
            tuple(range(sides - 1, -1, -1)),
            tuple((len(pts) - 1) * sides + j for j in range(sides)),
        ]
    )
    return mesh(name, vv, ff, role, group)


def disk(name, center, normal, r, role, segments=12, depth=0.035, group="body"):
    c = Vector(center)
    n = Vector(normal).normalized()
    u = n.cross(Vector((0, 0, 1)))
    if u.length < 0.01:
        u = n.cross(Vector((0, 1, 0)))
    u.normalize()
    v = n.cross(u)
    verts = []
    for dep, rad in [(0, r), (depth, r * 0.83)]:
        for j in range(segments):
            verts.append(
                tuple(
                    c
                    + n * dep
                    + rad
                    * (
                        u * math.cos(2 * math.pi * j / segments)
                        + v * math.sin(2 * math.pi * j / segments)
                    )
                )
            )
    faces = []
    for j in range(segments):
        faces.append(
            (j, (j + 1) % segments, segments + (j + 1) % segments, segments + j)
        )
    faces.append(tuple(segments + j for j in range(segments)))
    return mesh(name, verts, faces, role, group)


def chart(ob, kind):
    uv = ob.data.uv_layers.active.data
    for face in ob.data.polygons:
        for li in face.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            if kind == "cab":
                if abs(face.normal.x) > 0.65:
                    u = (
                        (p.y + 0.8) / 1.6 * 256 + (256 if face.center.x > 0.5 else 0)
                    ) / 512
                    py = 192 + (p.z - 0.70) / 1.95 * 160
                elif face.normal.z > 0.6 and face.center.z > 2.3:
                    u = (p.x + 0.2) / 1.5
                    py = 352 + (p.y + 0.8) / 1.6 * 48
                else:
                    u = (p.x + 0.2) / 1.5
                    py = (p.z - 0.70) / 1.95 * 192
            else:
                u = (p.x + 1.9) / 2.0
                py = 400 + (p.z - 0.55) * 80
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


tr = CFG["tractor"]
cab = cube(
    "Tall enclosed cab actual blue glass skin",
    tr["cab"]["center"],
    tr["cab"]["size"],
    "paint",
    bevel=0.045,
)
chart(cab, "cab")
hood = cube(
    "Long narrow green hood actual yellow stripe skin",
    tr["hood"]["center"],
    tr["hood"]["size"],
    "paint",
    bevel=0.09,
)
chart(hood, "hood")
cube(
    "Overhanging green canopy roof",
    tr["canopy"]["center"],
    tr["canopy"]["size"],
    "paintLight",
    bevel=0.045,
)
cube("Thin yellow canopy lower trim", (0.54, 0, 2.485), (1.44, 1.40, 0.035), "yellow")
cube(
    "Narrow dark tractor central frame",
    (-0.18, 0, 0.61),
    (3.12, 0.82, 0.24),
    "frame",
    bevel=0.025,
)
cube(
    "Front axle fixed attachment stops inside tire slabs",
    (-1.24, 0, 0.40),
    (0.18, 1.16, 0.12),
    "frame",
    bevel=0.015,
)
cube(
    "Rear axle fixed attachment stops inside tire slabs",
    (1.0, 0, 0.74),
    (0.22, 1.22, 0.17),
    "paintDeep",
    bevel=0.018,
)
cube(
    "Dark front grille on hood nose",
    (-1.788, 0, 1.02),
    (0.028, 0.64, 0.50),
    "ink",
    bevel=0.025,
)
for y in [-0.22, -0.11, 0, 0.11, 0.22]:
    cube(
        "Broad silver grille bar " + str(y),
        (-1.806, y, 1.02),
        (0.024, 0.030, 0.42),
        "rim",
    )
cube(
    "Yellow front weight bumper",
    (-1.83, 0, 0.60),
    (0.15, 0.96, 0.18),
    "yellow",
    bevel=0.025,
)
for y in [-0.30, 0.30]:
    disk(
        "Round front cream headlamp " + str(y),
        (-1.815, y, 1.28),
        (-1, 0, 0),
        0.085,
        "cream",
        segments=12,
        depth=0.018,
    )
for side in [-1, 1]:
    cube(
        "Cab fixed lower step " + str(side),
        (-0.08, side * 0.56, 0.73),
        (0.42, 0.22, 0.10),
        "frame",
        bevel=0.012,
    )
    cube(
        "Cab yellow step tread " + str(side),
        (-0.08, side * 0.57, 0.79),
        (0.35, 0.20, 0.028),
        "yellow",
    )
    cube(
        "Rear red lamp " + str(side),
        (1.15, side * 0.56, 1.68),
        (0.07, 0.12, 0.09),
        "ruby",
        bevel=0.014,
    )
    curve_tube(
        "Fixed rear hitch link " + str(side),
        [
            (1.31, side * 0.28, 0.62),
            (1.72, side * 0.28, 0.44),
            (1.86, side * 0.23, 0.44),
        ],
        0.055,
        "rim",
        sides=6,
    )
cube(
    "Fixed rear drawbar no hitch physics",
    (1.82, 0, 0.44),
    (0.26, 0.68, 0.10),
    "frame",
    bevel=0.018,
)
curve_tube(
    "Fixed upright exhaust stack",
    [(-0.30, -0.37, 1.40), (-0.30, -0.37, 2.29), (-0.38, -0.37, 2.40)],
    0.047,
    "ink",
    sides=8,
)
cube(
    "Exhaust lower gray heat shield",
    (-0.30, -0.37, 1.69),
    (0.13, 0.13, 0.52),
    "rim",
    bevel=0.025,
)

# Broad rear arches join cab side/inner cheek; no front fenders or fake caps.
f = CFG["fender"]
n = f["segments"]
rear = CFG["wheelSpecs"]["RL"]
r = rear["radius"]
axle = rear["axle"]
for side in [-1, 1]:
    vv = []
    ff = []
    rr = []
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
    for j in range(n):
        ff.append((4 * (n + 1) + j, 4 * (n + 1) + j + 1, base + j + 1, base + j))
        rr.append("paintDeep")
    a = len(vv)
    vv.extend(
        [
            (axle - f["shoulderRadii"][0], side * f["lateralStations"][0], 0.60),
            (axle + f["shoulderRadii"][0], side * f["lateralStations"][0], 0.60),
        ]
    )
    ff.append(tuple(range(n + 1)) + (a, a + 1))
    rr.append("paintMid")
    mesh("REAR real rounded green fender with inner cheek " + str(side), vv, ff, rr)

for wid, spec in CFG["wheelSpecs"].items():
    r, width, nr = spec["radius"], spec["width"], spec["segments"]
    side = -1 if wid[1] == "L" else 1
    # Rear base carcass is .04 below actual chevron crown; declared radius encloses lug vertices.
    treadr = r if wid[0] == "F" else r - 0.04
    vv = []
    ff = []
    rr = []
    for y, rad in [
        (-width / 2, treadr * 0.84),
        (-width * 0.36, treadr),
        (width * 0.36, treadr),
        (width / 2, treadr * 0.84),
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
    mesh(
        (
            "Small exposed front tire "
            if wid[0] == "F"
            else "Huge rear agricultural tire carcass "
        )
        + wid,
        vv,
        ff,
        rr,
        wid,
    )
    if wid[0] == "R":
        for j in range(0, nr, 2):
            for half in [-1, 1]:
                v = []
                for rad in [treadr - 0.003, r]:
                    for y, shift in [(0, 0), (half * width * 0.44, 0.11)]:
                        for dt in [0, 0.105]:
                            t = 2 * math.pi * j / nr + shift + dt
                            v.append((rad * math.sin(t), y, rad * math.cos(t)))
                faces = [
                    (0, 2, 3, 1),
                    (4, 5, 7, 6),
                    (0, 1, 5, 4),
                    (2, 6, 7, 3),
                    (0, 4, 6, 2),
                    (1, 3, 7, 5),
                ]
                mesh(
                    "Rear chevron rolling tread " + wid + " " + str((j, half)),
                    v,
                    faces,
                    "tireLight",
                    wid,
                )
    disk(
        "Yellow pressed wheel rim " + wid,
        (0, side * (width / 2 + 0.003), 0),
        (0, side, 0),
        r * 0.63,
        "yellow",
        segments=16,
        depth=0.015,
        group=wid,
    )
    disk(
        "Yellow broad wheel hub " + wid,
        (0, side * (width / 2 + 0.020), 0),
        (0, side, 0),
        r * 0.39,
        "yellowLight",
        segments=12,
        depth=0.023,
        group=wid,
    )
    disk(
        "Gray center spindle " + wid,
        (0, side * (width / 2 + 0.045), 0),
        (0, side, 0),
        r * 0.15,
        "rim",
        segments=8,
        depth=0.010,
        group=wid,
    )
