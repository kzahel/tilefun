"""Original detailed sports coupe; background Blender only, no external assets.

Replay: blender --background --factory-startup --threads 4 --python-exit-code 1
        --python scripts/vehicle-style-study/01-detailed-shaded/build.py
Use -- --views 0,1 for a bounded first look; omitted means all eight views.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
ROUTE = "01-detailed-shaded"
DATA = ROOT / "data/vehicle-style-study" / ROUTE
OUT = ROOT / "public/demos/vehicle-style-study" / ROUTE
DATA.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
P = math.pi


def material(name, rgb, metallic=0, roughness=.35, coat=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*rgb, 1)
    bs.inputs["Metallic"].default_value = metallic
    bs.inputs["Roughness"].default_value = roughness
    bs.inputs["Coat Weight"].default_value = coat
    bs.inputs["Coat Roughness"].default_value = .17
    if emission:
        bs.inputs["Emission Color"].default_value = (*rgb, 1)
        bs.inputs["Emission Strength"].default_value = emission
    return mat


def mesh(name, verts, faces, mat, smooth=True, parent=None):
    m = bpy.data.meshes.new(name)
    m.from_pydata(verts, [], faces)
    m.update()
    obj = bpy.data.objects.new(name, m)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent or car
    obj.data.materials.append(mat)
    for poly in m.polygons:
        poly.use_smooth = smooth
    return obj


def surface(name, fn, nu, nv, mat, flip=False):
    vs = [fn(i / nu, j / nv) for i in range(nu + 1) for j in range(nv + 1)]
    fs = []
    for i in range(nu):
        for j in range(nv):
            a = i * (nv + 1) + j
            face = (a, a + nv + 1, a + nv + 2, a + 1)
            fs.append(face[::-1] if flip else face)
    return mesh(name, vs, fs, mat)


def tube(name, pts, radius, mat, cyclic=False, resolution=3, parent=None):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 16
    cu.bevel_depth = radius
    cu.bevel_resolution = resolution
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    sp.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent or car
    return obj


def rounded(name, loc, scale, mat, bevel=.04, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    ob.parent = parent or car
    mod = ob.modifiers.new("Machined soft edges", "BEVEL")
    mod.width = bevel
    mod.segments = 4
    ob.modifiers.new("Weighted panel normals", "WEIGHTED_NORMAL")
    return ob


def lerp_keys(x, keys):
    for a, b in zip(keys, keys[1:]):
        if x <= b[0]:
            t = max(0, min(1, (x - a[0]) / (b[0] - a[0])))
            t = t * t * (3 - 2 * t)
            return a[1] * (1 - t) + b[1] * t
    return keys[-1][1]


def width(x):
    return lerp_keys(x, [(-2.3,.68),(-2.05,.84),(-1.4,.95),(-.4,.88),(.5,.90),(1.35,.97),(2.1,.91),(2.3,.82)])


def deck(x):
    return lerp_keys(x, [(-2.3,.35),(-2,.48),(-1.4,.57),(-.75,.60),(0,.59),(.8,.60),(1.4,.65),(2.1,.59),(2.3,.53)])


def top(x, u):
    bulge = .17 * (math.exp(-((x+1.4)/.48)**2) + math.exp(-((x-1.4)/.52)**2))
    z = deck(x) + bulge * abs(u)**2 - .026 * abs(u)**8
    # A subtle double-curved hood, not a flat subdivided slab.
    z += .035 * (1-u*u) * math.exp(-((x+1.35)/.8)**2)
    return (x, width(x)*u, z)


def lower(x):
    z = .17
    for axle in (-1.4, 1.4):
        d = x - axle
        if abs(d) < .375:
            z = max(z, .32 + math.sqrt(.375**2 - d*d))
    return z


def side(x, v, sign):
    upper = top(x, sign)[2]
    bottom = min(lower(x), upper - .018)
    z = bottom + (upper-bottom)*v
    return (x, sign*(width(x)-.055*(1-v)**2), z)


def cabin(x, theta, offset=0):
    h = lerp_keys(x, [(-.92,.015),(-.6,.20),(-.20,.45),(.45,.46),(.78,.37),(1.30,.015)])
    w = lerp_keys(x, [(-.92,.65),(-.6,.72),(-.20,.67),(.45,.66),(.78,.70),(1.30,.76)])
    return (x, (w+offset)*math.sin(theta), .59 + h*max(0,math.cos(theta))**.52 + offset*math.cos(theta))


def lathe(name, center, profile, mat, parent, n=96):
    # Revolved around local Y. Profile (axial offset, radius) shapes real shoulders.
    vs=[]
    for y,r in profile:
        for i in range(n):
            t=2*P*i/n
            vs.append((r*math.cos(t), y, r*math.sin(t)))
    fs=[]
    for j in range(len(profile)-1):
        for i in range(n):
            a=j*n+i; b=j*n+(i+1)%n
            fs.append((a,b,b+n,a+n))
    ob=mesh(name,vs,fs,mat,parent=parent)
    ob.location=center
    return ob


def disk(name, radius, depth, y, mat, wheel):
    bpy.ops.mesh.primitive_cylinder_add(vertices=80, radius=radius, depth=depth, rotation=(P/2,0,0))
    ob=bpy.context.object
    ob.name=name
    ob.location=(0,y,0)
    ob.parent=wheel
    ob.data.materials.append(mat)
    bevel=ob.modifiers.new("Rounded machined rim", "BEVEL")
    bevel.width=.006; bevel.segments=3
    for poly in ob.data.polygons: poly.use_smooth=True
    return ob


def make_wheel(x, sign):
    label=("Front" if x<0 else "Rear")+("_near" if sign<0 else "_far")
    wheel=bpy.data.objects.new("Wheel_"+label,None)
    bpy.context.collection.objects.link(wheel)
    wheel.parent=car; wheel.location=(x,sign*.835,.32)
    wheel["axle_axis"]="local +Y"; wheel["tire_radius"]=.32
    wheel["ground_contact"]= [x,sign*.835,0]
    profile=[]
    # Closed tire cross-section; 24 points, crowned tread and rounded sidewalls.
    for i in range(25):
        t=2*P*i/24
        profile.append((.135*math.cos(t),.259+.061*math.sin(t)))
    lathe(label+"_rubber_tire",(0,0,0),profile,rubber,wheel)
    face_y=sign*.137
    # Actual annular polished outer rim and inner barrel; holes remain between spokes.
    rimprof=[(sign*y,r) for y,r in [(.134,.227),(.145,.223),(.147,.207),(.137,.202),(.085,.202),(.085,.217),(.134,.227)]]
    lathe(label+"_forged_rim",(0,0,0),rimprof,silver,wheel)
    disk(label+"_brake_rotor",.191,.016,sign*.098,brake,wheel)
    disk(label+"_hub",.054,.032,sign*.144,silver,wheel)
    disk(label+"_hub_emblem",.024,.035,sign*.149,trim,wheel)
    for k in range(5):
        t=2*P*k/5+.15
        # Swept split spokes, each a separately editable machined component.
        for split in (-1,1):
            pts=[]
            for q in range(9):
                r=.045+q/8*.169
                ang=t+.20*(r/.22)+split*.065*(r/.22)
                pts.append((r*math.cos(ang),face_y+sign*.006,r*math.sin(ang)))
            tube(label+f"_spoke_{k}_{split}",pts,.012,silver,parent=wheel)
        ang=t+.28
        for r in (.133,.169):
            # Drilled rotor pinholes are dark inset discs, not a bitmap texture.
            ob=disk(label+f"_rotor_drill_{k}_{r}",.008,.003,sign*.109,trim,wheel)
            ob.location.x=r*math.cos(ang); ob.location.z=r*math.sin(ang)
    rounded(label+"_red_caliper",(.148,sign*.108,.035),(.061,.039,.145),red,.022,parent=wheel)
    # Two fine circumferential tread grooves with geometric separation.
    for gy in (-.052,.052):
        pts=[(.316*math.cos(i*2*P/96),gy,.316*math.sin(i*2*P/96)) for i in range(96)]
        tube(label+"_tread_groove",pts,.003,trim,True,2,parent=wheel)
    return wheel


def area(name, loc, power, size, color, target=(0,0,.4), size_y=None):
    bpy.ops.object.light_add(type="AREA", location=loc)
    ob=bpy.context.object; ob.name=name
    ob.data.energy=power; ob.data.color=color
    ob.data.shape="RECTANGLE"; ob.data.size=size; ob.data.size_y=size_y or size
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
car=bpy.data.objects.new("SPORTS_COUPE_ROOT__forward_minus_X",None)
bpy.context.collection.objects.link(car)
car["units"]="meters"; car["ground_origin"]=[0,0,0]
car["length"]=4.6; car["forward"]="-X"; car["authoring"]="original procedural curved panels; no downloaded model"
red=material("Gloss red automotive base and clearcoat",(.55,.012,.021),.22,.30,.60)
red_dark=material("Red recess paint",(.23,.008,.015),.2,.32,.7)
glass=material("Smoked blue opaque studio glazing",(.055,.13,.19),.48,.19,.8)
trim=material("Deep charcoal trim and apertures",(.014,.018,.027),.1,.44)
rubber=material("Satin tire rubber",(.018,.021,.027),.02,.68)
silver=material("Forged satin alloy",(.52,.59,.65),.8,.22,.15)
brake=material("Brake rotor steel",(.16,.19,.22),.72,.42)
white=material("Headlamp silver blue lens",(.70,.86,1),.35,.2,.8,.20)
lampred=material("Ruby rear light lenses",(.65,.008,.017),.15,.23,.7,.25)
amber=material("Small amber signals",(1,.25,.028),.1,.25,.4,.1)

# Curved upper body, two continuous open-arch side panels, end bumpers.
body=surface("Double_curved_hood_deck_and_haunches",lambda s,t:top(-2.3+4.6*s,2*t-1),128,48,red)
for sign in (-1,1):
    surface("Open_wheel_arch_side_panel_"+str(sign),lambda s,t,sg=sign:side(-2.3+4.6*s,t,sg),192,20,red,sign>0)
    # Sill follows the door, not through the tires; preserves a real open well.
    rounded("Lower_rocker_"+str(sign),(0,sign*.874,.19),(1.97,.11,.115),red_dark,.04)
    for axle in (-1.4,1.4):
        pts=[]
        for i in range(97):
            a=math.radians(-22)+math.radians(224)*i/96
            x=axle+.375*math.cos(a); z=.32+.375*math.sin(a)
            pts.append((x,sign*(width(x)+.006),z))
        tube(f"Rolled_fender_lip_{sign}_{axle}",pts,.015,red,False,3)
        surface(f"Recessed_arch_inner_liner_{sign}_{axle}",
                lambda s,t,sg=sign,ax=axle:(ax+.378*math.cos(math.radians(-22+224*s)),
                sg*(width(ax+.378*math.cos(math.radians(-22+224*s)))-.02-.15*t),
                .32+.378*math.sin(math.radians(-22+224*s))),96,4,trim)

for x,flip in [(-2.3,True),(2.3,False)]:
    surface("Front_bumper" if x<0 else "Rear_bumper",lambda s,t,xx=x:(xx,(2*s-1)*width(xx),.17+(top(xx,2*s-1)[2]-.17)*t),48,12,red,flip)

# Cabin is one doubly curved shell, with independently editable overlay apertures.
surface("Swept_canopy_and_red_roof",lambda s,t:cabin(-.92+2.22*s,(2*t-1)*P/2),112,64,red)
def glass_patch(name, x0,x1, t0,t1):
    ob=surface(name,lambda s,t:cabin(x0+(x1-x0)*s,t0+(t1-t0)*t,.007),48,28,glass)
    corners=[]
    for a in range(49): corners.append(cabin(x0+(x1-x0)*a/48,t0,.011))
    for a in range(29): corners.append(cabin(x1,t0+(t1-t0)*a/28,.011))
    for a in range(49): corners.append(cabin(x1-(x1-x0)*a/48,t1,.011))
    for a in range(29): corners.append(cabin(x0,t1-(t1-t0)*a/28,.011))
    tube(name+"_continuous_gasket",corners,.011,trim,True,3)
    return ob
glass_patch("Panoramic_front_windshield",-.78,-.19,-1.03,1.03)
glass_patch("Fastback_rear_glass",.64,1.18,-1.01,1.01)
for sg in (-1,1):
    glass_patch("Main_side_glass_"+str(sg),-.40,.53,sg*1.04,sg*1.48)
    glass_patch("Quarter_side_glass_"+str(sg),.59,.95,sg*1.05,sg*1.46)
    # Thin sculpted mirrors and pedestals.
    tube("Mirror_stalk_"+str(sg),[(-.47,sg*.72,.71),(-.52,sg*.91,.72)],.019,trim)
    mirror=rounded("Aero_mirror_"+str(sg),(-.55,sg*.967,.75),(.24,.15,.095),red,.044)
    rounded("Mirror_glass_"+str(sg),(-.46,sg*.974,.75),(.012,.10,.057),glass,.018)
    # Door shutline and flush handle ride the actual side panel.
    points=[]
    for xx,zz in [(-.58,.61),(-.61,.48),(-.60,.30),(-.48,.25),(.49,.25),(.70,.34),(.74,.57)]:
        points.append((xx,sg*(width(xx)+.004),zz))
    tube("Door_shutline_"+str(sg),points,.006,red_dark)
    rounded("Flush_door_handle_"+str(sg),(.40,sg*.909,.56),(.16,.017,.027),silver,.01)
    # Large dark swept side intake with red raised surround and three slats.
    intake=[(.68,sg*(width(.68)+.008),.34),(.84,sg*(width(.84)+.008),.60),
            (1.00,sg*(width(1.00)+.008),.59),(1.00,sg*(width(1.00)+.008),.35)]
    mesh("Sculpted_side_intake_"+str(sg),intake,[(0,1,2,3)],trim,False)
    tube("Side_intake_lip_"+str(sg),intake,.012,red_dark,True)
    for zz in (.39,.45,.51):
        tube("Intake_vane_"+str(sg),[(.83,sg*(width(.83)+.015),zz),(.99,sg*(width(.99)+.015),zz+.025)],.008,brake)

# Hood creases, two recessed extractor openings, long slim headlights.
for sg in (-1,1):
    pts=[top(-1.99+i/48*1.13,sg*(.39+.10*i/48)) for i in range(49)]
    tube("Hood_power_crease_"+str(sg),[(x,y,z+.007) for x,y,z in pts],.006,red_dark)
    surface("Hood_extractor_"+str(sg),lambda s,t,ss=sg:(lambda p:(p[0],p[1],p[2]+.008))(top(-1.01+s*.29,ss*(.60+t*.18))),32,12,trim)
    for xx in (-.96,-.90,-.84):
        pts=[top(xx,sg*(.61+i/12*.16)) for i in range(13)]
        tube("Hood_extractor_blade",[(x,y,z+.014) for x,y,z in pts],.007,red_dark)
    def lamp(s,t,ss=sg):
        x=-2.12+.42*s
        u=ss*(.60+.25*t+.08*s)
        p=top(x,u)
        return (p[0],p[1],p[2]+.013)
    surface("Headlamp_recess_"+str(sg),lamp,40,14,trim)
    # Two longitudinal LED strips, deliberately exaggerated but still geometric.
    for uu in (.65,.78):
        pts=[]
        for i in range(41):
            x=-2.08+.33*i/40
            p=top(x,sg*(uu+.08*i/40)); pts.append((p[0],p[1],p[2]+.026))
        tube("White_LED_blade_"+str(sg),pts,.017,white,False,3)
    p=top(-1.76,sg*.88)
    rounded("Amber_headlamp_tip_"+str(sg),(p[0],p[1],p[2]+.016),(.058,.051,.025),amber,.011)

# Wide front mouth, splitter, front grille ribs.
rounded("Front_central_intake",(-2.307,0,.25),(.031,1.04,.133),trim,.045)
rounded("Front_lower_splitter",(-2.28,0,.167),(.13,1.57,.034),trim,.014)
for yy in (-.42,-.28,-.14,0,.14,.28,.42):
    rounded("Front_grille_blade",(-2.33,yy,.255),(.025,.017,.09),brake,.006)
for sg in (-1,1):
    rounded("Front_corner_air_mouth_"+str(sg),(-2.305,sg*.585,.25),(.034,.17,.13),trim,.025)

# Rear: four round lamps, narrow black panel, mesh grille, quad exhausts, diffuser.
rounded("Rear_dark_lamp_panel",(2.31,0,.466),(.032,1.56,.16),trim,.025)
for yy in (-.63,-.39,.39,.63):
    # Cylinders point down the X axis.
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.069,depth=.022,location=(2.335,yy,.478),rotation=(0,P/2,0))
    ob=bpy.context.object; ob.name="Round_rear_lamp_lens"; ob.parent=car; ob.data.materials.append(lampred)
    bevel=ob.modifiers.new("Lens_roundover","BEVEL"); bevel.width=.011; bevel.segments=4
    for p in ob.data.polygons: p.use_smooth=True
    # Clear center emphasizes a ring in raw beauty, often subpixel in packed views.
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.027,depth=.024,location=(2.35,yy,.478),rotation=(0,P/2,0))
    ob=bpy.context.object; ob.name="Rear_lens_center"; ob.parent=car; ob.data.materials.append(red_dark)
rounded("Rear_lower_grille",(2.309,0,.303),(.031,1.12,.10),trim,.018)
for yy in (-.48,-.32,-.16,0,.16,.32,.48):
    rounded("Rear_grille_vane",(2.33,yy,.304),(.025,.016,.071),brake,.004)
rounded("Rear_diffuser",(2.245,0,.175),(.21,1.55,.085),trim,.025)
for yy in (-.48,-.24,0,.24,.48):
    rounded("Diffuser_fin",(2.26,yy,.155),(.26,.022,.09),trim,.007)
for yy in (-.67,-.54,.54,.67):
    pts=[(2.33,yy+.045*math.cos(i*2*P/64),.22+.045*math.sin(i*2*P/64)) for i in range(64)]
    tube("Exhaust_polished_lip",pts,.009,silver,True,3)
    # Dark inner opening, retains a true shaded metallic tube lip.
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.035,depth=.014,location=(2.32,yy,.22),rotation=(0,P/2,0))
    ob=bpy.context.object; ob.name="Exhaust_inner"; ob.parent=car; ob.data.materials.append(trim)
# Integrated curved lip spoiler across the tail deck.
pts=[]
for i in range(81):
    y=-.83+1.66*i/80; x=2.12+.035*(1-(y/.83)**2)
    pts.append((x,y,top(x,y/width(x))[2]+.042))
tube("Integrated_tail_spoiler",pts,.025,red,False,4)
for x in (-1.4,1.4):
    for sg in (-1,1): make_wheel(x,sg)

# Normalize the complete visual assembly, including projecting bumpers/lenses,
# to exactly 4.6 units long. A uniform transform preserves circular tires and
# Z=0 contact; this is model authoring, never an independent image/frame fit.
bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get()
bounds_lo=Vector((1e9,1e9,1e9)); bounds_hi=-bounds_lo
for ob in bpy.context.scene.objects:
    if ob.type not in {"MESH","CURVE"}: continue
    ev=ob.evaluated_get(dg); me=ev.to_mesh()
    for v in me.vertices:
        p=ob.matrix_world@v.co
        for axis in range(3):
            bounds_lo[axis]=min(bounds_lo[axis],p[axis]); bounds_hi[axis]=max(bounds_hi[axis],p[axis])
    ev.to_mesh_clear()
assembly_scale=4.6/(bounds_hi.x-bounds_lo.x)
car.scale=(assembly_scale,)*3
visual_bounds={"min":[v*assembly_scale for v in bounds_lo],"max":[v*assembly_scale for v in bounds_hi]}
car["uniform_authoring_scale"]=assembly_scale
for ob in bpy.context.scene.objects:
    if ob.name.startswith("Wheel_"):
        ob["world_center"]=[v*assembly_scale for v in ob.location]
        ob["world_tire_radius"]=.32*assembly_scale
        ob["world_ground_contact"]=[ob.location.x*assembly_scale,ob.location.y*assembly_scale,0]

# Fixed studio; never parent camera/lights to rotating car.
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.cycles.max_bounces=5
scene.render.threads_mode="FIXED"; scene.render.threads=4
scene.render.resolution_x=512; scene.render.resolution_y=512
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.film_transparent=True
scene.world.color=(.18,.18,.18)
scene.world.use_nodes=True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value=(.22,.26,.32,1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.4
scene.view_settings.view_transform="AgX"
scene.view_settings.look="AgX - Medium High Contrast"
scene.view_settings.exposure=-.4
area("Large fixed softbox key",(-3,-4,7),600,5,(1,.91,.83),size_y=3)
area("Fixed cool fill",(1,5,5),350,4,(.76,.86,1),size_y=5)
area("Long fixed gloss strip",(4,-1,6),300,2,(1,.96,.91),size_y=5)
bpy.ops.object.camera_add(location=(0,-12*math.cos(math.radians(50)),12*math.sin(math.radians(50))))
camera=bpy.context.object; camera.name="CONTRACT_FIXED_CAMERA"
camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type="ORTHO"; camera.data.ortho_scale=7.2
scene.camera=camera

# Save editable original scene before any direction render.
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
counts=[]
for ob in scene.objects:
    if ob.type in {"MESH","CURVE"}:
        ev=ob.evaluated_get(deps); m=ev.to_mesh(); m.calc_loop_triangles()
        counts.append({"name":ob.name,"sourceType":ob.type,"vertices":len(m.vertices),"triangles":len(m.loop_triangles)})
        ev.to_mesh_clear()
complexity={"evaluatedTriangles":sum(x["triangles"] for x in counts),
            "evaluatedMeshCount":len(counts),"sourceMeshCount":sum(o.type=="MESH" for o in scene.objects),
            "sourceCurveCount":sum(o.type=="CURVE" for o in scene.objects),"parts":counts}
assert complexity["evaluatedTriangles"]>=15000
report={"route":ROUTE,"blenderVersion":bpy.app.version_string,"complexity":complexity,
        "renderEngine":"Cycles CPU","samples":16,"threads":4,"rawSize":[512,512],
        "camera":{"position":list(camera.location),"target":[0,0,0],"orthoScale":7.2,"elevationDegrees":50},
        "model":{"forward":"-X","up":"Z","visualLength":4.6,"bodyLength":4.6*assembly_scale,
                 "maxBodyWidth":1.94*assembly_scale,"roofHeight":1.05*assembly_scale,
                 "visualBounds":visual_bounds,"uniformAuthoringScale":assembly_scale,
                 "wheelCenters":[[x*assembly_scale,s*.835*assembly_scale,.32*assembly_scale] for x in (-1.4,1.4) for s in (-1,1)],
                 "tireRadius":.32*assembly_scale,"axleAxis":"Y","groundContactZ":0},
        "blend":"data/vehicle-style-study/01-detailed-shaded/sports-coupe.blend"}
(DATA/"render.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
bpy.ops.wm.save_as_mainfile(filepath=str(DATA/"sports-coupe.blend"))
argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
parser=argparse.ArgumentParser(); parser.add_argument("--views",default="0,1,2,3,4,5,6,7")
args=parser.parse_args(argv)
for i in map(int,args.views.split(',')):
    car.rotation_euler.z=math.radians(i*45)
    scene.render.filepath=str(OUT/f"raw-{i}.png")
    bpy.ops.render.render(write_still=True)
print("STUDY_RENDER_COMPLETE",json.dumps({k:v for k,v in complexity.items() if k!="parts"}))
