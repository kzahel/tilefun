"""Build the editable tuxedo-cat experiment and its animated GLB with Blender."""
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

V = Vector
X = V((1, 0, 0))
TAU = math.tau
FPS = 24
# Swatches are sampled with nearest filtering. The different bands are painted
# into the UVs, so the coat keeps its contrast in the game and in glTF viewers.
PALETTE = {
    "ink": "131922", "shade": "1e2530", "coat": "2b3342", "light": "3e4a5b",
    "shine": "58677a", "cream": "f3efde", "white": "fffbeb", "ivory": "d7d4c7",
    "cream_shadow": "a6a9ac", "ear": "b97783", "ear_light": "d88f96",
    "nose": "d8969e", "iris": "b3cf78", "iris_shadow": "779453",
    "pupil": "131923", "mouth": "51454b",
}
PAINT_LIGHT = V((-0.48, 0.38, 0.80)).normalized()
VARIANT = "tuxedo"
ROLLOUT = False
# Name, coat tones (ink to light), markings, ear height, trunk width and tail
# reach. The profiles key distinct anatomy and paint to the live animal art.
WILD_FELIDS = {
    "bobcat": ("Bobcat", ("594737","795b43","a17b54","c0996e"), "spots", .88, 1.14, .26),
    "cheetah": ("Cheetah", ("3b302b","95703f","c79b55","e8bb70"), "tears", .58, .84, 1.12),
    "lynx": ("Eurasian Lynx", ("534940","7c6e60","a5977c","c9b697"), "tufts", 1.03, 1.19, .28),
    "jaguar": ("Jaguar", ("3b3029","906138","bb8b48","dbaf65"), "rosettes", .55, 1.28, .83),
    "leopard": ("Leopard", ("392e27","946d3e","c09856","e4ba70"), "rosettes", .62, .99, 1.22),
    "lion": ("Lion", ("593d2d","a27444","c79b63","e2bb80"), "mane", .51, 1.18, 1.11),
    "tiger": ("Wild Tiger", ("312824","a4512f","ce7638","e69c56"), "stripes", .60, 1.26, .95),
    "panther": ("Panther", ("151b23","202935","303947","475565"), "ghost-rosettes", .65, 1.09, 1.18),
}
# y is forward in Blender. The exporter maps it to glTF -Z.
BODY_ORIGIN = V((0, 0, 0.77))
HEAD_ORIGIN = V((0, 0.80, 1.14))
TAIL = [V(p) for p in (
    (0, -0.79, 0.88), (0, -1.08, 0.91), (0.025, -1.38, 1.03),
    (0.07, -1.62, 1.30), (0.10, -1.76, 1.63), (0.08, -1.67, 1.87),
)]
LEGS = {
    "fore.L": (0.255, 0.61, 0.86, 0.49, 0.35, 0.67),
    "fore.R": (-0.255, 0.61, 0.86, 0.49, 0.35, 0.67),
    "hind.L": (0.282, -0.62, 0.83, -0.43, 0.39, -0.72),
    "hind.R": (-0.282, -0.62, 0.83, -0.43, 0.39, -0.72),
}

def mix(a, b, t):
    return a + (b - a) * t


def smooth(t):
    t = max(0, min(1, t))
    return t * t * (3 - 2 * t)


def head_fit(point):
    delta = point - HEAD_ORIGIN
    ear_height = max(0, delta.z - .32)
    wild = WILD_FELIDS.get(VARIANT)
    return HEAD_ORIGIN + V((delta.x * 1.18, delta.y * 1.04,
                            delta.z * 1.08 - ear_height *
                            (1 - wild[3] if wild else .21 if VARIANT != "tuxedo" else 0)))


def swatch_material(palette=PALETTE, name="Tuxedo"):
    atlas = bpy.data.images.new("Tuxedo coat · palette", width=8, height=8, alpha=False)
    pixels = []
    for i in range(64):
        hex_color = list(palette.values())[(i // 2) % len(palette)]
        pixels.extend(int(hex_color[j:j + 2], 16) / 255 for j in (0, 2, 4))
        pixels.append(1)
    atlas.pixels[:] = pixels
    atlas.pack()
    material = bpy.data.materials.new(name + " · hand-painted bands")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    paint = nodes.new("ShaderNodeTexImage")
    paint.image = atlas
    paint.interpolation = "Closest"
    material.node_tree.links.new(paint.outputs["Color"], output.inputs["Surface"])
    return material


class CatSurface:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.weights = []
        self.paint = []
        self.parts = {}

    def start(self, name):
        self.parts[name] = len(self.vertices)

    def rings(self, rings, paint):
        """Join equal-size cross sections, carrying each ring's skin weights."""
        first = len(self.vertices)
        count = len(rings[0][0])
        for ring, weights in rings:
            self.vertices.extend(ring)
            self.weights.extend([weights] * count)
        self.face(tuple(first + j for j in reversed(range(count))), paint)
        for i in range(len(rings) - 1):
            a = first + count * i
            b = a + count
            for j in range(count):
                k = (j + 1) % count
                self.face((a + j, a + k, b + k, b + j), paint)
        last = first + (len(rings) - 1) * count
        self.face(tuple(last + j for j in range(count)), paint)

    def face(self, indices, paint):
        a, b, c = (self.vertices[i] for i in indices[:3])
        center = sum((self.vertices[i] for i in indices), V((0, 0, 0))) / len(indices)
        # The sweep convention gives inward face order for these rings.
        normal = (c - a).cross(b - a).normalized()
        self.faces.append(tuple(reversed(indices)))
        self.paint.append(paint(center, normal))

    def ellipsoid(self, center, radii, group, paint, *, sides=12, steps=7, basis=None):
        basis = basis if basis is not None else Matrix.Identity(3)
        rings = []
        for i in range(steps + 1):
            angle = mix(-1.548, 1.548, i / steps)
            ring = []
            for j in range(sides):
                phi = TAU * j / sides
                p = V((radii[0] * math.cos(angle) * math.cos(phi),
                       radii[1] * math.sin(angle),
                       radii[2] * math.cos(angle) * math.sin(phi)))
                ring.append(center + basis @ p)
            rings.append((ring, {group: 1}))
        self.rings(rings, paint)

    def tube(self, sections, paint, sides=10):
        rings = []
        for i, (point, rx, ry, weights) in enumerate(sections):
            tangent = sections[min(i + 1, len(sections) - 1)][0] - sections[max(i - 1, 0)][0]
            tangent.normalize()
            across = (X - X.dot(tangent) * tangent).normalized()
            other = across.cross(tangent).normalized()
            ring = [
                point + rx * math.cos(TAU * j / sides) * across
                + ry * math.sin(TAU * j / sides) * other
                for j in range(sides)
            ]
            rings.append((ring, weights))
        self.rings(rings, paint)

    def make(self, rig, palette=PALETTE, name="Tuxedo Cat"):
        mesh = bpy.data.meshes.new(name + " painted surface")
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = rig
        groups = {bone.name: obj.vertex_groups.new(name=bone.name) for bone in rig.data.bones}
        for i, weights in enumerate(self.weights):
            for group, weight in weights.items():
                if weight:
                    groups[group].add([i], weight, "REPLACE")
        for (name, start), end in zip(self.parts.items(), [*list(self.parts.values())[1:], len(self.vertices)]):
            obj.vertex_groups.new(name="Part · " + name).add(list(range(start, end)), 1, "REPLACE")
        skin = obj.modifiers.new("Cat armature", "ARMATURE")
        skin.object = rig
        mesh.materials.append(swatch_material(palette, name))
        uvs = mesh.uv_layers.new(name="Palette swatches")
        for face, color in zip(mesh.polygons, self.paint):
            swatch = list(palette).index(color) * 2
            uv = ((swatch % 8 + 1) / 8, (swatch // 8 + .5) / 8)
            for loop in face.loop_indices:
                uvs.data[loop].uv = uv
        return obj


def coat(normal):
    light = normal.dot(PAINT_LIGHT)
    if light > .66:
        return "light"
    if light > .10:
        return "coat"
    if light > -.48:
        return "shade"
    return "ink"


def wild_pattern(point, normal):
    wild = WILD_FELIDS.get(VARIANT)
    if not wild or point.z < .52:
        return None
    style = wild[2]
    if style == "stripes" and math.cos(point.y * 16 + abs(point.x) * 5 - point.z * 3) > .49:
        return "ink"
    if style in ("tears", "rosettes", "spots", "ghost-rosettes", "tufts"):
        cell_y = (point.y * 3.95 + point.z * 1.37) % 1 - .5
        cell_h = (point.z * 4.1 + abs(point.x) * 2.08 + math.floor(point.y * 3.95) * .41) % 1 - .5
        radius = cell_y * cell_y + cell_h * cell_h
        if style in ("rosettes", "ghost-rosettes") and .022 < radius < .14:
            return "shade" if style == "ghost-rosettes" else "ink"
        if style in ("tears", "spots", "tufts") and radius < .088:
            return "ink"
    return None


def cream(normal):
    light = normal.dot(PAINT_LIGHT)
    return "white" if light > .56 else "cream" if light > -.18 else "ivory"


def ellipsoid_basis(normal):
    across = V((normal.y, -normal.x, 0)).normalized()
    return Matrix((across, normal, across.cross(normal))).transposed()


def build_surface(rig):
    surface = CatSurface()
    surface.start("Body")
    body = []
    for y, z, width, height in (
        (-1.00, .78, .07, .09), (-.91, .78, .24, .24), (-.70, .78, .35, .33),
        (-.41, .81, .36, .34), (-.08, .81, .32, .32), (.24, .82, .34, .34),
        (.49, .85, .365, .37), (.67, .90, .33, .36), (.84, .99, .28, .32),
        (.96, 1.05, .16, .24),
    ):
        wild = WILD_FELIDS.get(VARIANT)
        if wild:
            width *= wild[4]
        ring = [
            V((width * math.cos(TAU * j / 16), y, z + height * math.sin(TAU * j / 16)))
            for j in range(16)
        ]
        weights = {"body": 1} if y < .67 else {"body": .76, "head": .24}
        body.append((ring, weights))

    def body_paint(p, normal):
        patterned = wild_pattern(p, normal)
        if patterned:
            return patterned
        if VARIANT == "ginger" and -.85 < p.y < .37 and p.z > .59 and math.cos(p.y * 13) > .28:
            return "shade" if normal.dot(PAINT_LIGHT) > -.03 else "ink"
        bib_width = max(.0, (p.y - .37) * 1.06)
        if abs(p.x) < bib_width and p.z < 1.13 and p.y > .53:
            return cream(normal)
        return coat(normal)

    surface.rings(body, body_paint)
    surface.start("Head")
    # The cheeks taper into a short, broad muzzle, with a dip at the eye line.
    skull = []
    for y, z, width, height in (
        (-.36, .01, .07, .12), (-.28, .015, .28, .245), (-.15, .022, .397, .308),
        (.018, .012, .455, .328), (.165, -.009, .421, .300),
        (.284, -.040, .351, .237), (.373, -.092, .260, .169),
        (.436, -.133, .156, .104), (.471, -.13, .055, .056),
    ):
        ring = [
            HEAD_ORIGIN + V((width * math.cos(TAU * j / 20), y, z + height * math.sin(TAU * j / 20)))
            for j in range(20)
        ]
        skull.append((ring, {"head": 1}))

    def face_paint(p, n):
        h = p - HEAD_ORIGIN
        if VARIANT == "cheetah" and .185 < abs(h.x) < .295 and h.y > .225 and -.152 < h.z < .132:
            return "ink"
        if VARIANT == "tiger" and -.07 < h.z < .181 and .19 < abs(h.x) < .39 and math.cos(h.z * 27) > .42:
            return "ink"
        muzzle = -.16 if ROLLOUT else -.030 if VARIANT == "tuxedo" else -.105
        if h.y > .17 and h.z < muzzle + (.10 if ROLLOUT else .12) * max(0, 1 - abs(h.x) / .36):
            return cream(n)
        if h.z < -.145 and h.y > .02 and abs(h.x) < .27:
            return cream(n)
        return coat(n)

    surface.rings(skull, face_paint)

    for sign, label in ((1, "L"), (-1, "R")):
        ear = "ear." + label
        surface.start("Ear " + label)
        # A flat outer rim and a recessed rose interior keep the tips legible.
        pivot = ear_base(sign)
        sections = [
            (pivot - V((sign * .015, .015, .095)), .173, .092, {ear: 1}),
            (pivot + V((sign * .040, -.008, .035)), .170, .072, {ear: 1}),
            (pivot + V((sign * .091, -.025, .132 if ROLLOUT else .175)), .093, .046, {ear: 1}),
            (pivot + V((sign * (.145 if ROLLOUT else .155), -.053, .232 if ROLLOUT else .323)), .010, .015, {ear: 1}),
        ]

        def ear_paint(p, n):
            center_x = abs(pivot.x) + .04 + max(0, p.z - pivot.z) * .31
            if n.y > .40 and abs(abs(p.x) - center_x) < .086 and p.z > pivot.z + (.065 if ROLLOUT else -.020):
                return "ear_light" if n.z > -.33 else "ear"
            return "ink" if n.y > .0 else coat(n)

        surface.tube(sections, ear_paint, sides=8)

        surface.start("Eye " + label)
        normal = V((sign * .67, .70, .245)).normalized()
        basis = ellipsoid_basis(normal)
        center = HEAD_ORIGIN + V((sign * .312, .301, .139))
        surface.ellipsoid(center, (.136, .049, .110), "head", lambda p, n: "ink",
                          sides=14, steps=6, basis=basis)
        surface.ellipsoid(center + normal * .026, (.119, .044, .091), "head",
                          lambda p, n: "iris" if n.z > -.32 else "iris_shadow",
                          sides=14, steps=6, basis=basis)
        pupil = center + normal * .068 + V((-sign * .012, .008, .002))
        surface.ellipsoid(pupil, (.048, .016, .070), "head", lambda p, n: "pupil",
                          sides=10, steps=5, basis=basis)
        shine = pupil + normal * .015 + V((-.020, .005, .030))
        surface.ellipsoid(shine, (.019, .009, .021), "head", lambda p, n: "white",
                          sides=8, steps=4, basis=basis)

    surface.start("Nose and muzzle")
    for sign in (1, -1):
        surface.ellipsoid(HEAD_ORIGIN + V((sign * .100, .423, -.177 if ROLLOUT else -.154)),
                          (.125 if ROLLOUT else .147, .095, .059 if ROLLOUT else .084),
                          "head", lambda p, n: cream(n), sides=12, steps=6)
    surface.ellipsoid(HEAD_ORIGIN + V((0, .502, -.110)), (.070, .032, .045),
                      "head", lambda p, n: "nose" if n.z >= -.40 else "ear", sides=10, steps=5)
    surface.ellipsoid(HEAD_ORIGIN + V((0, .506, -.163)), (.021, .012, .033),
                      "head", lambda p, n: "mouth", sides=8, steps=4)
    if VARIANT in WILD_FELIDS:
        surface.start("Lower jaw")
        surface.ellipsoid(HEAD_ORIGIN + V((0,.364,-.212)),(.205,.168,.071),
                          "jaw", lambda p,n: cream(n), sides=12, steps=6)
    if VARIANT == "lion":
        surface.start("Layered lion mane")
        for x, y, z, w, length, height in (
            (0,-.191,-.102,.506,.318,.523),(-.329,-.104,-.171,.186,.283,.401),
            (.329,-.104,-.171,.186,.283,.401),(0,.010,-.366,.327,.221,.283),
        ):
            surface.ellipsoid(HEAD_ORIGIN+V((x,y,z)),(w,length,height),"head",
                              lambda p,n:"shade" if n.dot(PAINT_LIGHT)>.53 else "ink",
                              sides=14,steps=9)

    for i, weights in enumerate(surface.weights):
        if weights.keys() == {"head"} or any(bone.startswith("ear.") for bone in weights):
            surface.vertices[i] = head_fit(surface.vertices[i])

    for name, (x, y, z, ky, kz, py) in LEGS.items():
        surface.start(name)
        hip, knee, ankle = V((x, y, z)), V((x, ky, kz)), V((x, py, .103))
        upper, lower, paw = leg_names(name)
        width = WILD_FELIDS[VARIANT][4] if VARIANT in WILD_FELIDS else 1
        broad = (.175 if name.startswith("hind") else .145) * width
        surface.tube([
            (hip + V((0, 0, .12)), broad * .65, broad * .70, {upper: .78, "body": .22}),
            (hip, broad, broad * 1.15, {upper: 1}),
            (hip.lerp(knee, .59), broad * .8, broad * .91, {upper: 1}),
            (hip.lerp(knee, .92), .085, .095, {upper: .65, lower: .35}),
            (knee.lerp(ankle, .11), .071, .080, {upper: .31, lower: .69}),
            (knee.lerp(ankle, .65), .065, .071, {lower: 1}),
            (ankle, .071, .067, {lower: .4, paw: .6}),
        ], lambda p, n: cream(n) if p.z < .272 else (wild_pattern(p,n) or coat(n)))
        surface.ellipsoid(ankle + V((0, .057, -.031)), (.091, .130, .071), paw,
                          lambda p, n: cream(n), sides=10, steps=5)

    surface.start("Tail")
    tail_sections = []
    radii = [.136, .130, .115, .104, .087, .051]
    if VARIANT in ("bobcat", "lynx"):
        radii = [.151,.138,.126,.104,.087,.060]
    for i in range(len(TAIL) - 1):
        current, nxt = tail_name(i), tail_name(min(i + 1, len(TAIL) - 2))
        for f in (0, .44, .77):
            weights = {current: 1} if f < .6 or current == nxt else {current: .76, nxt: .24}
            if f == 0 and i:
                weights = {tail_name(i - 1): .42, current: .58}
            radius = mix(radii[i], radii[i + 1], f)
            tail_sections.append((TAIL[i].lerp(TAIL[i + 1], f), radius, radius * .91, weights))
    tail_sections.append((TAIL[-1], radii[-1], radii[-1], {tail_name(4): 1}))
    def tail_paint(p, n):
        if VARIANT in ("bobcat", "lynx") and p.y < TAIL[3].y:
            return "ink"
        if VARIANT in ("tiger", "leopard", "cheetah", "jaguar") and math.cos((p.y+.13)*16) > .11:
            return "ink"
        if VARIANT == "ginger" and p.y < -1.06 and math.cos(p.y * 15) < -.27:
            return "shade"
        return coat(n)

    surface.tube(tail_sections, tail_paint, sides=9)
    if VARIANT == "lion":
        surface.ellipsoid(TAIL[-1],(.121,.129,.142),tail_name(4),
                          lambda p,n:"shade" if n.dot(PAINT_LIGHT)>.58 else "ink",
                          sides=12,steps=7)
    names = {"tuxedo": "Tuxedo Cat", "black": "Black Cat", "ginger": "Ginger Tabby"}
    names.update((key,row[0]) for key,row in WILD_FELIDS.items())
    return surface.make(rig, PALETTE, names[VARIANT])


def leg_names(name):
    return tuple(name + "." + section for section in ("upper", "lower", "paw"))


def tail_name(i):
    return f"tail.{i + 1:02}"


def ear_base(sign):
    return HEAD_ORIGIN + V((sign * .292, -.084, .241))


def build_armature():
    skeleton = bpy.data.armatures.new("Tuxedo Cat Skeleton")
    rig = bpy.data.objects.new("Cat Rig", skeleton)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    rig.show_in_front = True
    bpy.ops.object.mode_set(mode="EDIT")

    def add(name, start, end, parent=None):
        bone = skeleton.edit_bones.new(name)
        bone.head = start
        bone.tail = end
        if parent:
            bone.parent = skeleton.edit_bones[parent]
        return bone

    add("body", BODY_ORIGIN, BODY_ORIGIN + V((0, .7, 0)))
    add("head", HEAD_ORIGIN, HEAD_ORIGIN + V((0, .42, 0)), "body")
    if VARIANT in WILD_FELIDS:
        pivot = HEAD_ORIGIN + V((0,.190,-.148))
        add("jaw", pivot, pivot+V((0,.29,-.08)), "head")
    for sign, label in ((1, "L"), (-1, "R")):
        pivot = ear_base(sign)
        add("ear." + label, head_fit(pivot),
            head_fit(pivot + V((sign * .145, -.05, .30))), "head")
    for name, (x, y, z, ky, kz, py) in LEGS.items():
        upper, lower, paw = leg_names(name)
        hip, knee, ankle = (x, y, z), (x, ky, kz), (x, py, .103)
        add(upper, hip, knee, "body")
        add(lower, knee, ankle, upper)
        add(paw, ankle, (x, py + .20, .103), lower)
    for i in range(len(TAIL) - 1):
        add(tail_name(i), TAIL[i], TAIL[i + 1], tail_name(i - 1) if i else "body")
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.data.display_type = "STICK"
    return rig


def euler(x=0, y=0, z=0):
    return Euler((x, y, z)).to_quaternion()


def transform(q, source, target):
    result = q.to_matrix().to_4x4()
    result.translation = target - q @ source
    return result


def aimed(rest, start, end):
    raw = rest.to_quaternion()
    direction = (end - start).normalized()
    turn = (raw @ V((0, 1, 0))).rotation_difference(direction)
    return transform(turn @ raw, V((0, 0, 0)), start)


def solve_knee(hip, toe, upper, lower, preferred):
    target = toe - hip
    length = min(target.length, upper + lower - .001)
    direction = target.normalized()
    pole = (preferred - direction * preferred.dot(direction)).normalized()
    along = (upper * upper - lower * lower + length * length) / (2 * length)
    height = math.sqrt(max(0, upper * upper - along * along))
    return hip + direction * along + pole * height, hip + direction * length


def rows(table, t):
    for (a, *left), (b, *right) in zip(table, table[1:]):
        if t <= b:
            fraction = smooth((t - a) / (b - a))
            return [mix(x, y, fraction) for x, y in zip(left, right)]
    return list(table[-1][1:])


def stride(t, phase, half, lift):
    step = (t + phase) % 1
    if step < .60:
        return mix(half, -half, step / .60), 0
    swing = (step - .60) / .40
    return mix(-half, half, smooth(swing)), lift * math.sin(math.pi * swing) ** 1.35


POUNCE_BODY = [
    (0, -.24, -.042, -.11, .06),
    (.17, -.35, -.15, -.17, .10),
    (.32, -.18, -.01, .13, -.06),
    (.47, .55, .16, .19, -.12),
    (.60, .54, .13, -.075, .015),
    (.73, -.14, .03, -.14, .12),
    (.87, -.115, .012, -.02, .06),
    (1, 0, 0, 0, 0),
]  # time, body rise, lean, pitch, head pitch

POUNCE_FORE = [
    (0, .10, 0, .0), (.20, .12, 0, 0), (.34, .23, .21, .18),
    (.48, .44, .65, -.18), (.60, .47, .58, -.31), (.72, .27, 0, 0),
    (.86, .16, 0, 0), (1, 0, 0, 0),
]  # time, reach, paw height, paw pitch

POUNCE_HIND = [
    (0, .13, 0, 0), (.22, .16, 0, 0), (.35, -.16, .09, .35),
    (.49, -.32, .56, .42), (.60, -.12, .53, .16), (.73, .10, .11, .04),
    (.85, .16, 0, 0), (1, 0, 0, 0),
]

FLEE_BODY = [
    (0, -.07, -.09, -.11, .02), (.22, .07, .03, .13, -.10),
    (.44, .09, .12, -.08, .02), (.67, -.10, .03, -.16, .11),
    (.84, -.16, -.10, -.01, -.02), (1, -.07, -.09, -.11, .02),
]

FLEE_FORE = [
    (0, -.25, .03, .12), (.24, -.13, .28, .23), (.47, .44, .29, -.17),
    (.65, .35, 0, 0), (.84, .02, 0, 0), (1, -.25, .03, .12),
]

FLEE_HIND = [
    (0, .20, 0, 0), (.21, -.32, 0, .19), (.38, -.40, .17, .24),
    (.57, -.13, .34, .11), (.75, .35, .16, -.22), (.87, .36, 0, 0), (1, .20, 0, 0),
]


def pose_cat(rig, clip, t, previous):
    rest = {bone.name: bone.matrix_local for bone in rig.data.bones}
    phase = t * TAU
    sway, rise, lean, pitch, head_pitch = 0, 0, 0, 0, 0
    if clip in ("Walk", "Stalk"):
        sway = .027 * math.sin(phase)
        rise = .027 * math.cos(phase * 2)
        pitch = .036 * math.sin(phase)
        if clip == "Stalk":
            rise -= .187
            lean = -.044
            pitch -= .09
            head_pitch = .08
    elif clip == "Pounce":
        rise, lean, pitch, head_pitch = rows(POUNCE_BODY, t)
    elif clip == "Flee":
        rise, lean, pitch, head_pitch = rows(FLEE_BODY, t)
    elif clip == "Climb":
        rise = -.14 + .046 * math.cos(phase * 2)
        pitch = 1.05 + .08 * math.sin(phase)
        head_pitch = -.27 + .07 * math.sin(phase)
    elif clip == "Sit":
        rise, lean, pitch, head_pitch = -.24, -.22, .30, -.13
        rise += .04 * math.sin(phase)
    elif clip == "Action" and ROLLOUT:
        # The sprite's quiet turn and tail flick is separate from batting the ball.
        rise, lean, pitch, head_pitch = -.06 * math.sin(math.pi * t), 0, .04, .18 * math.sin(math.pi * t)
    elif clip in ("Bat", "Action"):
        amount = math.sin(math.pi * t)
        rise, lean, pitch, head_pitch = -.11 * amount, .11 * amount, -.06 * amount, .09 * amount
    elif clip in ("Feed", "Display"):
        amount = math.sin(math.pi*t)**2
        if clip == "Feed":
            rise, lean, pitch, head_pitch = -.15*amount, .11*amount, -.10*amount, -.58*amount
        else:
            pitch, head_pitch, rise = .09*amount, .16*amount, .032*amount
    else:
        rise = .013 * (1 - math.cos(phase))
        head_pitch = .039 * math.sin(phase)

    body_q = euler(pitch, sway * 1.7, sway * .52)
    body_delta = transform(body_q, BODY_ORIGIN, BODY_ORIGIN + V((sway, lean, rise)))
    matrices = {"body": body_delta @ rest["body"]}
    look = .10 * math.sin(phase) if clip == "Idle" else -.044 * math.sin(phase)
    if clip == "Action" and ROLLOUT:
        look += .43 * math.sin(math.pi * t) ** 2
    head_q = body_q @ euler(head_pitch - pitch * .66, 0, look)
    head_local = transform(head_q, HEAD_ORIGIN, body_delta @ HEAD_ORIGIN)
    matrices["head"] = head_local @ rest["head"]
    if "jaw" in rest:
        pivot = rest["jaw"].translation
        amount = math.sin(math.pi*t)**2
        jaw_yaw = .12*math.sin(phase*5)*amount if clip == "Feed" else 0
        aperture = (.49 if clip == "Display" else .20 if clip == "Feed" else .03)*amount
        matrices["jaw"] = transform(head_q @ euler(-aperture, 0, jaw_yaw), pivot,
                                    head_local @ pivot) @ rest["jaw"]

    for sign, label in ((1, "L"), (-1, "R")):
        name = "ear." + label
        flick = math.sin(phase * 2) * max(0, math.sin(phase)) ** 6
        amount = (.15 if sign == 1 else .047) * flick if clip == "Idle" else .038 * math.sin(phase)
        if clip == "Pounce":
            amount = -.19 * math.sin(math.pi * t)
        elif clip == "Flee":
            amount = -.17 + .045 * math.sin(phase)
        ear = head_fit(ear_base(sign))
        pivot = head_local @ ear
        matrices[name] = transform(
            head_q @ euler(amount, sign * amount / 2, 0), ear, pivot
        ) @ rest[name]

    for name, (x, y, z, ky, kz, py) in LEGS.items():
        upper, lower, paw = leg_names(name)
        hind = name.startswith("hind")
        left = name.endswith(".L")
        offset, lift, roll = 0, 0, 0
        if clip in ("Walk", "Stalk"):
            leg_phase = (0 if hind else .24) + (0 if left else .5)
            offset, lift = stride(t, leg_phase, .29 if clip == "Walk" else .20,
                                  .170 if clip == "Walk" else .099)
            roll = lift * -1.2
        elif clip == "Pounce":
            stagger = .035 if left else -.018
            leg_time = max(0, min(1, t + math.sin(math.pi * t) * stagger))
            offset, lift, roll = rows(POUNCE_HIND if hind else POUNCE_FORE, leg_time)
        elif clip == "Flee":
            offset, lift, roll = rows(FLEE_HIND if hind else FLEE_FORE, (t + (0 if left else .12)) % 1)
        elif clip == "Sit":
            offset = .10 if hind else -.13
        elif clip == "Climb":
            offset = -.28 if hind else -.34
            lift = (.15 if hind else .70) + .22 * math.sin(phase + (math.pi if left != hind else 0))
            roll = .56
        elif (clip == "Bat" or (clip == "Action" and not ROLLOUT)) and not hind and left:
            reach = math.sin(math.pi * t) ** 2
            offset, lift, roll = .42 * reach, .26 * reach, -.18 * reach
        hip = body_delta @ V((x, y, z))
        toe = V((x * (1.06 if hind and clip == "Pounce" else 1), py + offset, .103 + lift))
        upper_len = rig.data.bones[upper].length
        lower_len = rig.data.bones[lower].length
        knee, toe = solve_knee(hip, toe, upper_len, lower_len, V((0, 1 if hind else -1, 0)))
        matrices[upper] = aimed(rest[upper], hip, knee)
        matrices[lower] = aimed(rest[lower], knee, toe)
        matrices[paw] = transform(euler(roll), V((0, 0, 0)), toe) @ rest[paw].to_quaternion().to_matrix().to_4x4()

    next_point = body_delta @ TAIL[0]
    for i in range(len(TAIL) - 1):
        name = tail_name(i)
        swish = math.sin(phase - i * .44) * (.07 + .065 * i)
        lift = math.sin(phase - i * .46) * (.045 + .024 * i)
        if clip == "Pounce":
            lift = (.17 + .045 * i) * math.sin(math.pi * t)
            swish *= .7
        elif clip == "Stalk":
            lift -= .24 + i * .055
        elif clip == "Flee":
            lift = -.14 + .085 * math.sin(phase - i * .5)
            swish *= .43
        elif clip == "Action" and ROLLOUT:
            swish += (.10 + .09 * i) * math.sin(phase * 2 - i * .45) * math.sin(math.pi * t)
        direction = body_q @ (euler(lift, 0, swish) @ (TAIL[i + 1] - TAIL[i]))
        end = next_point + direction
        matrices[name] = aimed(rest[name], next_point, end)
        next_point = end

    for bone in rig.pose.bones:
        kwargs = {}
        if bone.parent:
            name = bone.parent.name
            kwargs = {"parent_matrix": matrices[name], "parent_matrix_local": rest[name]}
        local = bone.bone.convert_local_to_pose(matrices[bone.name], rest[bone.name], invert=True, **kwargs)
        shift, quaternion, _ = local.decompose()
        if bone.name in previous:
            quaternion.make_compatible(previous[bone.name])
        previous[bone.name] = quaternion.copy()
        bone.location = shift
        bone.rotation_quaternion = quaternion


def animate(rig, scene):
    # Timings are derived from the corresponding production sprite clips.
    clips = {"Idle": 48, "Walk": 16, "Stalk": 24, "Pounce": 16,
             "Action": 31, "Bat": 18, "Climb": 29, "Sit": 29}
    if VARIANT in WILD_FELIDS:
        clips = {"Idle":48,"Walk":21,"Feed":24,"Display":29}
    elif ROLLOUT:
        clips["Flee"] = 12
    anim = rig.animation_data_create()
    for name, duration in clips.items():
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        anim.action = action
        previous = {}
        for i in range(duration + 1):
            pose_cat(rig, name, i / duration, previous)
            for bone in rig.pose.bones:
                bone.keyframe_insert("location", frame=i + 1, group=bone.name)
                bone.keyframe_insert("rotation_quaternion", frame=i + 1, group=bone.name)
        for curve in action.layers[0].strips[0].channelbags[0].fcurves:
            for key in curve.keyframe_points:
                key.interpolation = "LINEAR"
        anim.action = None
    anim.action = bpy.data.actions["Idle"]
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, clips["Idle"] + 1
    scene.frame_set(1)
    return clips


def main():
    global VARIANT, TAIL, ROLLOUT
    args = sys.argv[sys.argv.index("--") + 1:]
    ROLLOUT = "--rollout" in args
    if ROLLOUT:
        args.remove("--rollout")
    output = Path(args[0]).resolve()
    if len(args) > 1:
        VARIANT = args[1]
        coats = {
            "black": {
                "ink": "121720", "shade": "1b222e", "coat": "252f3e", "light": "394657",
                "white": "424d5a", "cream": "323b49", "ivory": "293342", "pupil": "101620",
                "nose": "897077", "iris": "c2cd7f", "iris_shadow": "82975c",
            },
            "ginger": {
                "ink": "8d4b30", "shade": "a86033", "coat": "c98043", "light": "e4a65e",
                "white": "f9eed2", "cream": "eed8b0", "ivory": "c8ae87", "nose": "c88e83",
                "iris": "d8b562", "iris_shadow": "a98648", "pupil": "332821",
            },
        }
        if VARIANT in WILD_FELIDS:
            _, tones, style, _, _, reach = WILD_FELIDS[VARIANT]
            PALETTE.update(dict(zip(("ink","shade","coat","light"),tones)))
            PALETTE.update({"iris":"beac62","iris_shadow":"96814c","ear":"976e5a",
                            "ear_light":"c88a74","nose":"a77366"})
            if style == "ghost-rosettes":
                PALETTE.update({"cream":"38404a","white":"505963","ivory":"292e39"})
            elif style == "mane":
                PALETTE.update({"cream":"e9cb98","white":"f2d6a6","ivory":"c99f71"})
            rest = TAIL[0]
            TAIL = [rest + V(((p-rest).x*reach,(p-rest).y*reach,(p-rest).z*min(1,reach))) for p in TAIL]
        else:
            PALETTE.update(coats[VARIANT])
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.view_settings.view_transform = "Standard"
    rig = build_armature()
    cat = build_surface(rig)
    clips = animate(rig, scene)
    scene["Preview clips"] = ", ".join(clips)
    scene["Axis convention"] = "Blender +Y forward, Z up. glTF -Z forward, Y up."
    rig.select_set(False)
    cat.select_set(True)
    bpy.context.view_layer.objects.active = cat
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                view = area.spaces.active
                view.shading.type = "MATERIAL"
                view.region_3d.view_distance = 4.3
                view.region_3d.view_location = (0, -.15, .76)
                view.region_3d.view_rotation = euler(math.radians(66), 0, math.radians(37))
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "cat.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(output / "cat.glb"),
        export_format="GLB",
        export_yup=True,
        export_texcoords=True,
        export_animation_mode="ACTIONS",
        export_frame_range=False,
        export_def_bones=True,
        export_leaf_bone=False,
        export_materials="EXPORT",
    )
    blob = (output / "cat.glb").read_bytes()
    length, = struct.unpack_from("<I", blob, 12)
    gltf = json.loads(blob[20:20 + length])
    primitives = [p for mesh in gltf["meshes"] for p in mesh["primitives"]]
    animations = {animation["name"]: len(animation["channels"]) for animation in gltf["animations"]}
    assert animations.keys() == clips.keys(), animations
    assert len(gltf["skins"]) == len(primitives) == len(gltf["images"]) == 1
    assert "KHR_materials_unlit" in gltf["extensionsUsed"]
    assert gltf["samplers"][0]["magFilter"] == 9728
    assert gltf["samplers"][0]["minFilter"] in (9728, 9984)
    report = {
        "blender": bpy.app.version_string,
        "triangles": sum(gltf["accessors"][p["indices"]]["count"] // 3 for p in primitives),
        "primitives": len(primitives),
        "glb_bytes": len(blob),
        "bones": len(rig.data.bones),
        "animations": animations,
        "clip_seconds": {name: frames / FPS for name, frames in clips.items()},
    }
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
