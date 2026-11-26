"""Build the standing Classic Player. Blender -b -P build.py -- OUTPUT_DIRECTORY."""
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

HERE = Path(__file__).resolve().parent
IDENTITY = json.loads((HERE.parents[1] / "vehicle-riders/classic-upright/v3/identity.json").read_text())
OUT = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.view_settings.view_transform = "Standard"
scene.render.fps = 24
bpy.context.preferences.filepaths.save_version = 0

# A planar front and rear paint chart, plus swatches for the solid pieces.
# Blender -Y faces the camera, Z is up. The source has no separate tail.
palette = dict(IDENTITY["palette"], trim="#8f82ae", rim="#b3a5c1")
size = 128
width = 192
colors = {key: [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)] + [1]
          for key, value in palette.items()}
atlas = bpy.data.images.new("Classic • face charts & sprite palette", width=width, height=size, alpha=False)
pixels = []
for j in range(size):
    for i in range(width):
        side = i // 64
        x = (i % 64 + .5) / 32 - 1
        z = .85 + (j + .5) / 112 * 1.18
        color = "c"
        # The sprite shows a broad squared forelock from the front and just
        # one lavender row at the back. Join the two over the crown.
        if abs(x) < (.275 if z > 1.72 else .218) and z > (1.56 if side == 0 else 1.84):
            color = "v"
        if side == 0 and .48 < abs(x) < .72 and 1.105 < z < 1.195:
            color = "y"
        if side == 2:
            color = "c"
            # Local ear chart, with a tapered inset and a small cream margin.
            ear_x = .20 + (i % 64 + .5)/64*.68
            ear_z = 1.56 + (j + .5)/112*.84
            t = (ear_z - 1.89)/.34
            center = .534 + .133*t
            radius = .16 * (1-max(0,t))**.62 if t < 1 else 0
            if t < .16:
                radius *= max(0,.5 + 3.1*t)
            if 0 < t < 1 and abs(ear_x-center) < radius:
                color = "p"
        if j >= 120:
            color = list(colors)[min(len(colors) - 1, i // 12)]
        pixels.extend(colors[color])
atlas.pixels[:] = pixels
atlas.pack()
mat = bpy.data.materials.new("Classic • nearest palette")
mat.use_nodes = True
mat.use_backface_culling = True
shader = mat.node_tree.nodes.get("Principled BSDF")
shader.inputs["Roughness"].default_value = .95
shader.inputs["Specular IOR Level"].default_value = .15
tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image, tex.interpolation = atlas, "Closest"
mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])

armature = bpy.data.armatures.new("Standing skeleton")
rig = bpy.data.objects.new("Classic Player", armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")


def bone(name, pivot, parent=None):
    b = armature.edit_bones.new(name)
    b.head, b.tail = pivot, Vector(pivot) + Vector((0, 0, .16))
    if parent:
        b.parent = armature.edit_bones[parent]


bone("Body", (0, 0, .4))
bone("Head", (0, 0, .94), "Body")
for sign, side in ((-1, "L"), (1, "R")):
    bone("Arm." + side, (sign * .44, 0, .82), "Body")
    bone("Leg." + side, (sign * .255, 0, .41), "Body")
    bone("Ear." + side, (sign * .53, 0, 1.77), "Head")
    bone("Eye." + side, (sign * .456, -.47, 1.34), "Head")
bpy.ops.object.mode_set(mode="OBJECT")
armature.display_type = "STICK"


def surface(name, rings, group, paint, outline=0, smooth=True):
    """Loft closed CCW sections and UV-paint them. The reverse skin draws the ink edge."""
    count = len(rings[0])
    verts = [Vector(p) for row in rings for p in row]
    faces = [tuple(reversed(range(count)))]
    for row in range(len(rings) - 1):
        a = row * count
        for j in range(count):
            k = (j + 1) % count
            faces.append((a+j, a+k, a+k+count, a+j+count))
    faces.append(tuple(range(len(verts)-count, len(verts))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    if outline:
        # Read the closed loft's outward normals before adding the inverted hull.
        outer = [v.co + outline * v.normal for v in mesh.vertices]
        mesh.clear_geometry()
        mesh.from_pydata(verts + outer, [], faces + [
            tuple(i + len(verts) for i in reversed(face)) for face in faces])
        mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = rig
    mesh.materials.append(mat)
    layer = mesh.uv_layers.new(name="Sprite paint")
    for face in mesh.polygons:
        ink = face.index >= len(faces)
        role = "k" if ink else (paint(face) if callable(paint) else paint)
        face.use_smooth = smooth
        for li in face.loop_indices:
            p = mesh.vertices[mesh.loops[li].vertex_index].co
            if role in ("front", "back"):
                u = ((64 if role == "back" else 0) + (p.x + 1)*32) / width
                v = (p.z - .85) / 1.18 * 112 / size
                layer.data[li].uv = (u, v)
            elif role == "ear":
                layer.data[li].uv = ((128 + (abs(p.x)-.20)/.68*64)/width,
                                     (p.z-1.56)/.84*112/size)
            else:
                layer.data[li].uv = ((12 * list(colors).index(role) + 5.5) / width, 124.5 / size)
    obj.vertex_groups.new(name=group).add(list(range(len(mesh.vertices))), 1, "REPLACE")
    obj.modifiers.new("Standing skeleton", "ARMATURE").object = rig


def signed_power(v, p):
    return math.copysign(abs(v) ** p, v)


def loaf(name, sections, group, paint, outline=.014, power=.82, sides=24):
    rings = []
    for x, y, z, rx, ry in sections:
        rings.append([(x + rx * signed_power(math.cos(a), power),
                       y + ry * signed_power(math.sin(a), power), z)
                      for a in [math.tau * j / sides for j in range(sides)]])
    surface(name, rings, group, paint, outline)


def centered(name, sections, group, paint, outline=.016, power=.8):
    loaf(name, [(0, 0, *s) for s in sections], group, paint, outline, power)


centered("Pear-shaped body", [
    (.24,.25,.22),(.29,.365,.278),(.42,.455,.32),(.64,.46,.32),
    (.82,.41,.277),(.97,.32,.235),(1.02,.19,.17)], "Body", "c")
centered("Violet collar", [
    (.748,.42,.30),(.775,.445,.322),(.925,.402,.3),(.985,.355,.27)],
    "Body", lambda f: "k" if f.normal.z < -.45 else "n", .009)

# The head narrows quickly under the chin, then presents a broad, fairly flat
# face for the widely spaced dot eyes. Its profile is much slimmer than its front.
centered("Cream head and forelock", [
    (.916,.32,.265),(.945,.53,.37),(1.035,.71,.46),(1.17,.794,.515),
    (1.36,.805,.526),(1.55,.765,.506),(1.72,.702,.462),
    (1.845,.616,.394),(1.91,.47,.303),(1.942,.29,.20),(1.951,.095,.09)],
    "Head", lambda f: "back" if f.center.y > .12 else "front", .022, .79)

for sign, side in ((-1, "L"), (1, "R")):
    def sections(rows):
        return [(sign*x,y,z,rx,ry) for x,y,z,rx,ry in rows]

    ear = "Ear." + side
    loaf("Pointed ear " + side, sections([
        (.47,.015,1.58,.247,.197),(.505,.01,1.76,.282,.225),
        (.55,.008,1.92,.244,.198),(.594,.018,2.075,.203,.168),
        (.638,.033,2.22,.15,.13),(.664,.046,2.322,.087,.087),
        (.67,.05,2.354,.034,.044)]), ear,
        lambda f: "ear" if f.normal.y < -.26 else "c", .016, .86)
    for index, (height, reach) in enumerate(((1.36,.944),(1.171,.918))):
        # Sweep the cheek fur out and back. The roots sit inside the head;
        # only the tips interrupt its contour, including in profile.
        rings = []
        for x,y,z,ry,rz in ((.664,-.03,-.008,.17,.104),
                              (.761,.018,-.008,.192,.093),
                              (.826,.101,.001,.143,.066),
                              (reach-.034,.21,.027,.068,.029),
                              (reach,.25,.047,.012,.008)):
            ring = [(sign*x, y+ry*math.cos(j*math.tau/12),
                     height+z+rz*math.sin(j*math.tau/12)) for j in range(12)]
            rings.append(ring if sign>0 else list(reversed(ring)))
        surface(f"Cheek tuft {side} {index+1}", rings, "Head", "c", .008)
    # At the eye meridian the face curves away by ~.05. Rotate the dot around
    # its local Z axis so a profile still shows one small ink landmark.
    eye_center = Vector((sign*.456,-.473,1.34))
    angle = sign * .32
    eye_rows = []
    for z, rx, ry in [(-.063,.034,.018),(-.047,.056,.025),(.045,.056,.025),(.064,.035,.018)]:
        row = []
        for j in range(16):
            a = j*math.tau/16
            x, y = rx*signed_power(math.cos(a),.7), ry*math.sin(a)
            row.append(eye_center + Vector((x*math.cos(angle)-y*math.sin(angle),
                                            x*math.sin(angle)+y*math.cos(angle),z)))
        eye_rows.append(row)
    surface("Violet eye " + side, eye_rows, "Eye." + side, "k")

    loaf("Mitten " + side, sections([
        (.488,-.102,.375,.057,.069),(.498,-.095,.403,.112,.118),
        (.513,-.062,.495,.143,.145),(.503,-.012,.652,.137,.143),
        (.451,.002,.797,.125,.125),(.414,.004,.847,.081,.09)]),
        "Arm."+side, lambda f: "v" if f.center.z < .43 else "c", .011)
    loaf("Paw " + side, sections([
        (.254,-.051,.018,.115,.129),(.257,-.061,.043,.152,.18),
        (.258,-.074,.104,.168,.196),(.253,-.042,.192,.155,.172),
        (.25,.01,.295,.119,.129),(.254,.012,.408,.103,.103)]),
        "Leg."+side, lambda f: "trim" if f.center.z < .08 else "v" if f.center.z < .175 else "c", .012)

# A little warm tag sits on the lower edge of the collar. The back of the
# band has a short knot, as suggested by the chevron on the back sprite.
loaf("Gold tag loop", [(0,-.324,z,rx,.026) for z,rx in ((.718,.027),(.84,.032),(.865,.023))],
     "Body","y",.005)
loaf("Buttercup tag", [(0,-.366,z,rx,ry) for z,rx,ry in
     ((.622,.038,.019),(.649,.077,.031),(.70,.089,.035),(.746,.067,.032),(.767,.027,.02))],
     "Body","l",.009, .72)
for sign in [-1,1]:
    loaf("Scarf end "+str(sign), [(sign*x,y,z,rx,ry) for x,y,z,rx,ry in
         ((.167,.314,.635,.025,.019),(.123,.319,.672,.064,.036),
          (.067,.319,.783,.075,.04),(.013,.292,.828,.036,.035))], "Body","n",.006)

# All bones point along world +Z (bone local Y). Rotate about local X for
# forward/back swing. Animate the legs' vertical offset to plant the stance paw.
anim = rig.animation_data_create()
for clip, frames in (("Idle",72),("Walk",24)):
    act = bpy.data.actions.new(clip)
    act.use_fake_user = True
    anim.action = act
    for frame in range(frames+1):
        t = frame/frames
        wave = math.sin(math.tau*t)
        stride = math.cos(math.tau*t)
        walk = clip == "Walk"
        lift = .055 * wave**2 if walk else 0
        for b in rig.pose.bones:
            b.rotation_mode = "XYZ"
            b.rotation_euler = (0,0,0)
            b.location = (0,0,0)
            b.scale = (1,1,1)
            sign = -1 if b.name.endswith(".L") else 1
            if b.name == "Body":
                b.location = (.021*stride if walk else 0, lift, 0)
            elif b.name == "Head":
                b.location.y = .007*wave if walk else .009*wave
                b.rotation_euler = ((.025 if walk else .018)*wave,
                                    .034*wave, (.024 if walk else .029)*stride)
            elif b.name.startswith("Leg"):
                swing = sign*wave
                b.rotation_euler.x = .57*swing if walk else 0
                if walk:
                    b.location.y = -lift - .062*swing**2 + .095*max(0,sign*stride)**2
            elif b.name.startswith("Arm"):
                b.rotation_euler.x = -sign*(.46 if walk else .035)*wave
            elif b.name.startswith("Ear"):
                b.rotation_euler.z = sign*(.038*wave if walk else .115*math.exp(-((t-(.42 if sign<0 else .52))/.056)**2))
            elif b.name.startswith("Eye") and not walk:
                b.scale.y = 1 - .92*math.exp(-((t-.725)/.021)**2)
            for prop in ("location","rotation_euler","scale"):
                b.keyframe_insert(prop,frame=frame+1,group=b.name)
    anim.action = None
anim.action = bpy.data.actions["Idle"]
scene.frame_end = 73
scene.frame_set(1)
# Join the weighted parts for a single textured skinned draw in the GLB.
bpy.ops.object.select_all(action="DESELECT")
parts = [o for o in scene.objects if o.type == "MESH"]
for part in parts:
    part.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
bpy.context.object.name = "Classic • painted standing mesh"
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            space = area.spaces.active
            space.shading.type = "MATERIAL"
            space.overlay.show_overlays = False
            space.region_3d.view_distance = 4.8
            space.region_3d.view_location = (0,0,1.15)
            space.region_3d.view_rotation = Euler((math.radians(78),0,math.radians(22))).to_quaternion()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"classic-player.blend"), compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/"classic-player.glb"),export_format="GLB",
    export_animation_mode="ACTIONS",export_frame_range=False,export_def_bones=True,export_leaf_bone=False)
blob = (OUT/"classic-player.glb").read_bytes()
length, = struct.unpack_from("<I",blob,12)
g = json.loads(blob[20:20+length])
primitives = [p for mesh in g["meshes"] for p in mesh["primitives"]]
assert len(g["skins"]) == len(primitives) == len(g["images"]) == 1
assert {a["name"] for a in g["animations"]} == {"Walk","Idle"}
assert g["samplers"][0]["magFilter"] == 9728
print(bpy.app.version_string, sum(g["accessors"][p["indices"]]["count"]//3 for p in primitives), "triangles")
