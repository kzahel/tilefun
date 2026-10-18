"""Editable species-owned rigid volumes and moving-hip planted-foot animation.

Run in background Blender. Retained revisions refuse overwrite; use --workspace.
"""
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

C = {'id': 'griffin', 'kind': 'griffin', 'size': 128, 'sole': 0.1, 'stride': 1.44, 'bob': 0.14, 'lift': 0.25, 'head': [0, 1.32, 2.73], 'torso': [[0, -0.15, 1.78], [0.59, 1.18, 0.62]], 'shoulder': [[0, 0.64, 1.96], [0.61, 0.7, 0.78]], 'pelvis': [[0, -1, 1.69], [0.56, 0.6, 0.63]], 'belly': [[0, 0.05, 1.41], [0.46, 0.91, 0.32]], 'neck': [[0, 1.02, 2.3], [0.44, 0.47, 0.6]], 'skull': [0.42, 0.53, 0.49], 'snout': [[0, 0.46, -0.13], [0.23, 0.4, 0.24]], 'hips': {'HL': [-0.45, -0.94, 1.44], 'FL': [-0.44, 0.76, 1.64], 'HR': [0.45, -0.94, 1.44], 'FR': [0.44, 0.76, 1.64]}, 'feet': {'HL': [-0.53, -0.94, 0], 'FL': [-0.5, 0.89, 0], 'HR': [0.53, -0.94, 0], 'FR': [0.5, 0.89, 0]}, 'paw': [0.18, 0.27, 0.1], 'tailStart': [0, -1.27, 1.84], 'tailCount': 7, 'tailLength': 0.3, 'tailRadius': 0.12, 'tailPitch': -20, 'tailCurl': 7, 'chaseSpeed': 80, 'chargeStride': 2.52, 'palette': {'k': '#282633', 's': '#665044', 'c': '#a37a4e', 'h': '#cfaa6b', 'w': '#e8e4cf', 'g': '#d6a34b', 'e': '#ec9251', 'f': '#f4ead0', 'r': '#906879'}}
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "package.json").exists())
SCRIPT = Path(__file__).resolve().parent
SCRATCH = "--workspace" in sys.argv
WORK = ROOT / sys.argv[sys.argv.index("--workspace") + 1] if SCRATCH else ROOT / f"data/fierce-137/{C['id']}"
SOURCE = WORK / "source" if SCRATCH else SCRIPT
SOURCE.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
assert not (SOURCE / "receipt.json").exists(), "Immutable revision; replay in --workspace."
CAMERA = json.loads((ROOT / "art-source/wildlife-v2/camera.json").read_text())
SIZE = C["size"]
ANCHOR = (SIZE // 2, SIZE * 3 // 4)
SOLE = C["sole"]
STRIDE = C["stride"]
CLIPS = {"idle": (1, 1), "walk": (10, 12), "feed": (30, 8), "display": (50, 8), "charge": (70, 8), "sleep": (90, 4)}
if C["kind"] in ["dragon", "griffin"]:
    CLIPS["flight"] = (110, 8)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = scene.render.resolution_y = SIZE * 4
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = False
scene.view_settings.view_transform = "Standard"
meshes = []
materials = {}
for letter, color in C["palette"].items():
    mat = bpy.data.materials.new(letter)
    mat.diffuse_color = (*[int(color[i:i+2], 16) / 255 for i in [1, 3, 5]], 1)
    materials[letter] = mat

def empty(name, parent=None, at=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent, obj.location = parent, at
    return obj

root = empty("ROOT-ground-anchor")
body = empty("BODY-weight-transfer", root)
head = empty("HEAD-follow", body, C["head"])
jaw = empty("JAW-hinge", head, (0, -.15, -.25))

def sphere(name, at, radii, color="c", parent=body):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10)
    obj = bpy.context.object
    obj.name, obj.scale = name, radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent, obj.location = parent, at
    obj.data.materials.append(materials[color])
    meshes.append(obj)
    return obj

def cone(name, length, radius, color="c", parent=body, tip=.75):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, radius2=radius*tip, depth=length)
    obj = bpy.context.object
    obj.name, obj.parent = name, parent
    obj.data.materials.append(materials[color])
    meshes.append(obj)
    return obj

def polygon(name, vertices, color, parent):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [list(range(len(vertices)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(materials[color])
    meshes.append(obj)
    return obj

def key(obj, frame):
    obj.keyframe_insert("location", frame=frame)
    obj.keyframe_insert("rotation_quaternion" if obj.rotation_mode == "QUATERNION" else "rotation_euler", frame=frame)

def place(obj, a, b, frame):
    a, b = Vector(a), Vector(b)
    obj.location = (a+b)/2
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = (b-a).to_track_quat("Z", "Y")
    key(obj, frame)

kind = C["kind"]
torso = sphere("torso", C["torso"][0], C["torso"][1])
shoulder = sphere("shoulder", C["shoulder"][0], C["shoulder"][1], "w" if kind == "griffin" else "c")
pelvis = sphere("pelvis", C["pelvis"][0], C["pelvis"][1])
sphere("belly", C["belly"][0], C["belly"][1], "w")
neck = sphere("neck", C["neck"][0], C["neck"][1], "w" if kind == "griffin" else "c")
sphere("skull", (0, 0, 0), C["skull"], "w" if kind == "griffin" else "c", head)
sphere("snout", C["snout"][0], C["snout"][1], "g" if kind == "griffin" else "c", head)
sphere("mouth", (0, C["snout"][0][1] + .12, -.24), (C["skull"][0]*.88, C["snout"][1][1]*.92, .075), "k", head)
sphere("lower-jaw", (0, C["snout"][0][1] + .19, -.15), (C["skull"][0]*.86, C["snout"][1][1], .13), "w", jaw)
for side in [-1, 1]:
    sphere(f"eye-{side}", (side*C["skull"][0]*.90, .13, C["skull"][2]*.32), (.085, .10, .083), "e", head)
    sphere(f"pupil-{side}", (side*(C["skull"][0]*.90+.045), .15, C["skull"][2]*.32), (.025, .055, .065), "k", head)
    if kind in ["rex", "dragon"]:
        for j in range(4):
            tooth = cone(f"tooth-{side}-{j}", .20 if kind == "rex" else .12, .06, "f", head, 0)
            tooth.location = (side*C["skull"][0]*.75, .22 + j*C["snout"][1][1]*.35, -.31)
            tooth.rotation_euler.x = math.pi
    if kind == "wolf":
        ear = cone(f"pointed-ear-{side}", .65, .22, "c", head, 0)
        ear.location = (side*.29, -.19, .46)
        ear.rotation_euler.y = side*.16
        sphere(f"ear-inner-{side}", (side*.29, -.03, .53), (.095, .035, .17), "s", head)
        sphere(f"brow-{side}", (side*.30, .17, .20), (.13, .17, .055), "s", head)
    if kind == "dragon":
        horn = cone(f"horn-{side}", .75, .16, "g", head, 0)
        horn.location = (side*.34, -.42, .51)
        horn.rotation_euler.x = -.5
    if kind == "griffin":
        sphere(f"brow-{side}", (side*.37, .22, .24), (.13, .26, .12), "s", head)
        sphere(f"ear-tuft-{side}", (side*.32, -.23, .45), (.14, .18, .30), "w", head)
    if kind == "spider":
        for j in range(2):
            sphere(f"small-eye-{side}-{j}", (side*(.12+j*.12), .35, .22-j*.13), (.048, .045, .045), "e", head)
        fang = cone(f"fang-{side}", .30, .07, "f", head, 0)
        fang.location = (side*.13, .39, -.20)
        fang.rotation_euler.x = math.pi*.8

if kind in ["rex", "wolf", "dragon"]:
    sphere("nose", (0, C["snout"][0][1]+C["snout"][1][1]-.04, -.02), (C["skull"][0]*.55, .09, .11), "s" if kind != "wolf" else "k", head)
if kind == "rex":
    for side in [-1, 1]:
        for j, (a, b, radius) in enumerate([
            ((side*.72, .85, 3.55), (side*.89, 1.23, 3.25), .14),
            ((side*.89, 1.23, 3.25), (side*.78, 1.62, 3.37), .09),
        ]):
            arm = cone(f"tiny-arm-{side}-{j}", (Vector(a)-Vector(b)).length, radius)
            place(arm, a, b, 1)
        for digit in [-1, 1]:
            claw = cone(f"hand-claw-{side}-{digit}", .22, .04, "f", body, 0)
            claw.location = (side*.78 + digit*.06, 1.68, 3.35)
            claw.rotation_euler.x = -math.pi/2
if kind in ["wolf", "griffin"]:
    for j in range(7):
        fur = cone(f"ruff-feather-{j}", .50, .18, "w" if kind == "griffin" else "s", body, .1)
        fur.location = (math.sin(j*math.tau/7)*.43, .95, 1.9+math.cos(j*math.tau/7)*.45)
        fur.rotation_euler.x = -.6
if kind == "griffin":
    polygon("hooked-beak", [(-.23,.35,.02),(.23,.35,.02),(.16,1.04,-.16),(0,1.06,-.48),(-.16,.90,-.23)], "g", head)
if kind in ["rex", "dragon"]:
    for j in range(6):
        ridge = cone(f"dorsal-ridge-{j}", .27, .12, "g" if kind == "dragon" else "s", body, 0)
        ridge.location = (0, -.9+j*.35, C["torso"][0][2]+C["torso"][1][2]-.05)
if kind == "spider":
    sphere("abdomen-mark", (0, -.62, 1.27), (.30, .35, .07), "g")

breath=[]
if kind=="dragon":
    for j in range(3):
        breath.append(sphere(f"BREATH-{j}",(0,1.1+j*.36,.02+j*.12),(.12+j*.055,.14+j*.055,.12+j*.055),"m",head))

wings = []
if kind in ["dragon", "griffin"]:
    for side in [-1, 1]:
        pivot = empty(f"WING-{side}", body, (side*.58, -.05, 2.12))
        wings.append((side, pivot))
        if kind == "dragon":
            polygon(f"wing-membrane-{side}", [(0,0,0),(side*1.4,.5,.65),(side*3.0,-.8,.12),(side*1.5,-1.7,-.15),(side*.5,-1.0,-.18)], "r", pivot)
            pairs = [((0,0,0),(side*1.4,.5,.65)), ((side*1.4,.5,.65),(side*3.0,-.8,.12)), ((side*1.4,.5,.65),(side*1.5,-1.7,-.15))]
            for j, (a,b) in enumerate(pairs):
                bone = cone(f"wing-finger-{side}-{j}", (Vector(a)-Vector(b)).length, .065, "g", pivot)
                place(bone,a,b,1)
        else:
            sphere(f"wing-shoulder-{side}", (side*.7,-.12,.12), (.95,.45,.22), "w", pivot)
            for j in range(8):
                feather = sphere(f"wing-feather-{side}-{j}", (side*(.8+j*.27), -.55-j*.07, -.02-j*.012), (.22,.83-j*.035,.075), "w" if j<3 else "h", pivot)
                feather.rotation_euler.z = side*(.10+j*.055)

hips = C["hips"]
lands = {name: (i % 2)*.5 if kind in ["rex","spider"] else [0,.25,.5,.75][i] for i,name in enumerate(hips)}
if kind=="spider": lands={name:((int(name[1])+(1 if name.startswith("R") else 0))%2)*.5 for name in hips}
legs, feet, muscles, lengths = {}, {}, {}, {}
for name, hip in hips.items():
    lengths[name] = [1.4, 1.25, .12] if kind == "spider" else [hip[2]*.65, hip[2]*.60, .25 if kind != "rex" else .42]
    radius = .07 if kind == "spider" else .26 if kind == "rex" else .15
    legs[name] = [cone(f"{name}-{j}", length, radius*(1-j*.27), "s" if kind == "spider" else "g" if kind == "griffin" and name.startswith("F") else "c") for j,length in enumerate(lengths[name])]
    feet[name] = sphere(f"{name}-foot", (0,0,0), C["paw"], "k" if kind == "spider" else "g" if kind == "griffin" and name.startswith("F") else "c")
    if kind != "spider":
        muscles[name] = sphere(f"{name}-muscle", (0,0,0), (.45,.55,.72) if kind=="rex" else (.20,.25,.32))
    if kind in ["rex", "griffin"]:
        for digit in [-1,0,1]:
            sphere(f"{name}-toe-{digit}", (digit*.13,.30,0), (.075,.33,SOLE*.7), "g" if kind=="griffin" else "s", feet[name])

tail = []
if kind != "spider":
    for j in range(C["tailCount"]):
        tail.append(cone(f"tail-{j}", C["tailLength"], C["tailRadius"]*(1-.86*j/max(1,C["tailCount"]-1)), "c"))
    if kind == "griffin":
        sphere("tail-tuft", (0,0,0), (.19,.27,.20), "s", tail[-1])

bpy.ops.object.camera_add()
camera = bpy.context.object
camera.name, camera.data.type = "CAMERA-contract", "ORTHO"
camera.data.ortho_scale = SIZE / 10
camera.data.shift_y = (ANCHOR[1]-SIZE/2)/SIZE
camera.location = CAMERA["cameraLocationAtDistance10"]
camera.rotation_euler = (-camera.location).to_track_quat("-Z","Y").to_euler()
scene.camera = camera

def solve(a,b,l1,l2,name):
    axis = b-a
    d = axis.length
    assert abs(l1-l2) < d < l1+l2, (name,d,l1,l2)
    direction = axis/d
    along = (l1*l1-l2*l2+d*d)/(2*d)
    hint = Vector(((-1 if name.startswith("L") else 1)*.4,0,1)) if kind=="spider" else Vector((0,1 if name.startswith("H") else -1,0))
    bend = (hint-direction*hint.dot(direction)).normalized()
    return a+along*direction+math.sqrt(l1*l1-along*along)*bend

def pose(clip,index,frame):
    count = CLIPS[clip][1]
    phase = index/count if clip in ["walk","charge","flight"] else 0
    action = math.sin(math.pi*index/(count-1))**2 if clip in ["feed","display"] else 0
    moving = clip in ["walk","charge"]
    pitch = math.radians(2.5)*math.sin(math.tau*phase) if moving else -.08*action if clip=="feed" else .03*action
    rise = C["bob"]*(1-math.cos((2 if kind in ["rex","spider"] else 4)*math.tau*phase)) if moving else (-.40 if kind!="spider" else -.12)+.015*math.sin(index*math.tau/count) if clip=="sleep" else 0
    body.location = (.035*math.sin(math.tau*phase) if moving else 0,0,rise)
    body.rotation_euler.x = pitch
    key(body,frame)
    head.location = Vector(C["head"])+Vector((0,.06*action if clip=="feed" else 0,(-.28 if kind=="rex" else -.13)*action if clip=="feed" else -.30 if clip=="sleep" and kind!="spider" else .12*action))
    head.rotation_euler.x = -pitch + (-.24*action if clip=="feed" else (.62 if kind=="wolf" else .18)*action if clip=="display" else -.08 if clip=="sleep" else 0)
    key(head,frame)
    jaw.rotation_euler.x = -.65*action if clip=="display" else -.20*action if clip=="feed" else -.12 if clip=="charge" else 0
    key(jaw,frame)
    for j,puff in enumerate(breath):
        puff.location=(.08*math.sin(j+index*.3),1.1+j*.36+.16*action,.02+j*.12+.08*action)
        puff.hide_render=not(clip=="display" and 2<=index<=5)
        puff.keyframe_insert("hide_render",frame=frame)
        key(puff,frame)
    for side,wing in wings:
        wing.rotation_euler.y = side*(.1+math.sin(math.tau*phase)*.45) if clip=="flight" else side*(-1.05+1.1*action) if clip=="display" else -side*1.05
        wing.rotation_euler.z=-side*.85 if clip=="sleep" else 0
        if clip=="sleep": wing.rotation_euler.y=-side*.65
        key(wing,frame)
    bpy.context.view_layer.update()
    basis = body.matrix_basis.copy()
    inverse = basis.inverted()
    joints,contacts = {},{}
    for name,hip in hips.items():
        q = (phase-lands[name])%1 if moving else .31
        stance = .62 if kind=="rex" else .75
        stride = C["chargeStride"] if clip=="charge" else STRIDE
        planted = not moving or q <= stance
        advance = stride*stance/2-stride*q if planted else -stride*stance/2+stride*stance*(q-stance)/(1-stance)
        lift = 0 if planted else C["lift"]*math.sin(math.pi*(q-stance)/(1-stance))
        target = C["feet"][name]
        foot_world = Vector((target[0],target[1]+advance,SOLE+lift))
        if clip=="flight":
            foot_world.z += .4
            planted = False
        foot = inverse@foot_world
        ankle_world = foot_world+Vector((0,-lengths[name][2]*.5,math.sqrt(lengths[name][2]**2-(lengths[name][2]*.5)**2)))
        ankle = inverse@ankle_world
        a = Vector(hip)
        knee = solve(a,ankle,*lengths[name][:2],name)
        points = [a,knee,ankle,foot]
        for obj,start,end in zip(legs[name],points,points[1:]):
            place(obj,start,end,frame)
        feet[name].location = foot
        feet[name].rotation_euler.x = -pitch
        key(feet[name],frame)
        if name in muscles:
            muscles[name].location = a.lerp(knee,.28)
            key(muscles[name],frame)
        joints[name] = [list(basis@p) for p in points]
        contact = basis@foot-Vector((0,0,SOLE))
        contacts[name] = {"world":list(contact),"planted":planted,"phase":q,"stance":stance,"stride":stride,"baseY":target[1]}
    tip = Vector(C["tailStart"])
    for j,obj in enumerate(tail):
        yaw = .14*math.sin(math.tau*phase-j*.3)+.12*action+(j*.34 if clip=="sleep" and kind=="dragon" else 0)
        angle = math.radians(C["tailPitch"]+j*C["tailCurl"])
        delta = Vector((math.sin(yaw)*math.cos(angle),-math.cos(yaw)*math.cos(angle),math.sin(angle)))*C["tailLength"]
        end = tip+delta
        place(obj,tip,end,frame)
        tip = end
    return {"clip":clip,"index":index,"frame":frame,"limbsWorld":joints,"limbLengths":lengths,"contacts":contacts,"actionAmount":action}

records = [pose(clip,i,start+i) for clip,(start,count) in CLIPS.items() for i in range(count)]
for clip,(start,count) in CLIPS.items():
    if count>1:
        pose(clip,0,start+count)
for obj in bpy.data.objects:
    if obj.animation_data and obj.animation_data.action:
        for layer in obj.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for point in curve.keyframe_points:
                            point.interpolation="LINEAR"
scene.frame_start,scene.frame_end = 1,max(start+count for start,count in CLIPS.values())
scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"animal.blend"))

def project(p):
    q = world_to_camera_view(scene,camera,p)
    return [round(q.x*SIZE,5),round((1-q.y)*SIZE,5),round(q.z,5)]

def hull(points):
    points=sorted(set(tuple(p) for p in points))
    def cross(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    low,high=[],[]
    for result,seq in [(low,points),(high,reversed(points))]:
        for p in seq:
            while len(result)>1 and cross(result[-2],result[-1],p)<=0: result.pop()
            result.append(p)
    return low[:-1]+high[:-1]

G={"identity":f"{C['id']}-fierce-v1-geometry-01","species":C["id"],"kind":kind,"palette":C["palette"],"chaseSpeed":C["chaseSpeed"],"cameraContract":CAMERA,
   "canvas":[SIZE,SIZE],"anchor":list(ANCHOR),"orthoScale":SIZE/10,"shiftY":camera.data.shift_y,
   "stride":STRIDE,"chargeStride":C["chargeStride"],"sole":SOLE,"clips":CLIPS,"records":[],"meshLocalGeometrySha256":{},"meshTopologySha256":{}}
for obj in meshes:
    G["meshLocalGeometrySha256"][obj.name]=hashlib.sha256(json.dumps([list(v.co) for v in obj.data.vertices]).encode()).hexdigest()
    G["meshTopologySha256"][obj.name]=hashlib.sha256(json.dumps([list(p.vertices) for p in obj.data.polygons]).encode()).hexdigest()
for facing,yaw in CAMERA["modelYawDegrees"].items():
    root.rotation_euler.z=math.radians(yaw)
    for record in records:
        scene.frame_set(record["frame"])
        bpy.context.view_layer.update()
        r=json.loads(json.dumps(record))
        r["facing"]=facing
        for name,obj in [("body",body),("head",head),("shoulder",shoulder),("pelvis",pelvis)]:
            r[name]=project(obj.matrix_world.translation)
        r["projectedContacts"]={n:project(root.matrix_world@Vector(c["world"])) for n,c in r["contacts"].items()}
        r["volumes"]={}
        r["hiddenMeshes"]=[obj.name for obj in meshes if obj.hide_render]
        for obj in meshes:
            if obj.hide_render: continue
            points=[obj.matrix_world@v.co for v in obj.data.vertices]
            pp=[project(p) for p in points]
            r["volumes"][obj.name]={"hull":hull([p[:2] for p in pp]),"bbox":[min(p[0] for p in pp),min(p[1] for p in pp),max(p[0] for p in pp),max(p[1] for p in pp)],
                "depthRange":[min(p[2] for p in pp),max(p[2] for p in pp)],"worldZ":[min(p.z for p in points),max(p.z for p in points)],"color":obj.data.materials[0].name}
        G["records"].append(r)
G["blendSha256"]=hashlib.sha256((SOURCE/"animal.blend").read_bytes()).hexdigest()
(WORK/"projected-guides.json").write_text(json.dumps(G,separators=(",",":"))+"\n",encoding="utf-8",newline="\n")
print("FIERCE_SOURCE_OK",C["id"],len(meshes),len(G["records"]))
