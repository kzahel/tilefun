"""Original editable high-detail sports coupe. Run with background Blender 5.2.

No downloaded geometry/textures. Forward=-X, Z=up, units metres.
Only writes this route's data/public directories. The scene saves before render.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'data/vehicle-style-study/02-detailed-toon'
OUT = ROOT / 'public/demos/vehicle-style-study/02-detailed-toon'
DATA.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablock in list(bpy.data.materials):
    bpy.data.materials.remove(datablock)
scene = bpy.context.scene
# Shader-to-RGB is evaluated by Eevee, not Cycles.
scene.render.engine = 'BLENDER_EEVEE'
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.render.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.world.color = (0.12, 0.12, 0.12)
try:
    scene.eevee.taa_render_samples = 32
except AttributeError:
    pass

def linear(v):
    v = v / 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def rgba(rgb):
    return tuple(linear(v) for v in rgb) + (1,)

# These exact sRGB roles are quantized before rasterization using CONSTANT ramps.
# Sources for existing colours are recorded by finish.py with image hashes.
roles = {
    'Coachwork': [(127,33,76), (168,43,45), (217,50,50), (252,92,70)],
    'Glazing': [(58,58,80), (86,89,114), (115,140,168), (164,187,213)],
    'Rubber_intake': [(32,29,43), (58,58,80), (70,70,94)],
    'Machined_alloy': [(86,89,114), (143,161,200), (212,212,230), (248,248,248)],
    'Warm_LED': [(164,187,213), (212,212,230), (248,248,248)],
    'Rear_lens': [(127,33,76), (203,42,42), (252,92,70)],
}

def toon(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    ns = mat.node_tree.nodes
    ns.clear()
    diffuse = ns.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Color'].default_value = (1,1,1,1)
    diffuse.inputs['Roughness'].default_value = 1
    diffuse.location = (-440, 30)
    srgb = ns.new('ShaderNodeShaderToRGB')
    srgb.location = (-220, 30)
    ramp = ns.new('ShaderNodeValToRGB')
    ramp.location = (-30, 30)
    ramp.color_ramp.interpolation = 'CONSTANT'
    colours = roles[name]
    stops = [0, .26, .53, .78] if len(colours) == 4 else [0, .34, .68]
    while len(ramp.color_ramp.elements) > 1:
        ramp.color_ramp.elements.remove(ramp.color_ramp.elements[-1])
    ramp.color_ramp.elements[0].position = stops[0]
    ramp.color_ramp.elements[0].color = rgba(colours[0])
    for pos, colour in zip(stops[1:], colours[1:]):
        ramp.color_ramp.elements.new(pos).color = rgba(colour)
    emit = ns.new('ShaderNodeEmission')
    emit.location = (220,30)
    output = ns.new('ShaderNodeOutputMaterial')
    output.location = (410,30)
    links = mat.node_tree.links
    links.new(diffuse.outputs[0], srgb.inputs[0])
    links.new(srgb.outputs[0], ramp.inputs[0])
    links.new(ramp.outputs[0], emit.inputs[0])
    links.new(emit.outputs[0], output.inputs['Surface'])
    mat.diffuse_color = rgba(colours[-2])
    mat['role'] = name
    mat['band_colours_srgb'] = json.dumps(colours)
    return mat

M = {key: toon(key) for key in roles}
root = bpy.data.objects.new('SportsCoupe_Root_rotate_Z', None)
scene.collection.objects.link(root)
root['forward'] = '-X'
root['ground_origin'] = [0,0,0]
root['authoring'] = 'Original detailed toon route; no production approval'

def mesh(name, verts, faces, role='Coachwork', parent=root, smooth=True):
    me = bpy.data.meshes.new(name + '_editable')
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = parent
    ob.data.materials.append(M[role])
    for p in me.polygons:
        p.use_smooth = smooth
    return ob

def bevel(ob, width=.025, segments=3):
    mod = ob.modifiers.new('Small manufactured edge radius', 'BEVEL')
    mod.width = width
    mod.segments = segments
    return ob

def curve(name, points, role='Rubber_intake', radius=.012, parent=root):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 2
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    sp = cu.splines.new('POLY')
    sp.points.add(len(points)-1)
    for p, co in zip(sp.points, points):
        p.co = (*co,1)
    ob = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(ob)
    ob.parent = parent
    cu.materials.append(M[role])
    return ob

def sphere(name, loc, scale, role, parent=root, seg=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    ob.parent = parent
    ob.data.materials.append(M[role])
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob

def interp(x, pairs):
    for (a, va), (b, vb) in zip(pairs, pairs[1:]):
        if x <= b:
            t = max(0,min(1,(x-a)/(b-a)))
            t = t*t*(3-2*t)
            return va+(vb-va)*t
    return pairs[-1][1]

# A dense continuous loft; real curvature rather than flat subdivided boxes.
width_profile = [(-2.3,.66),(-2.12,.80),(-1.48,.94),(-.65,.87),(.30,.85),(1.35,.95),(1.95,.90),(2.3,.77)]
top_profile = [(-2.3,.46),(-2.06,.55),(-1.45,.67),(-.82,.61),(.4,.63),(1.40,.72),(1.97,.65),(2.3,.55)]

def shellpoint(x, theta):
    w = interp(x, width_profile)
    top = interp(x, top_profile)
    bottom = .18
    s,c = math.sin(theta), math.cos(theta)
    y = w * math.copysign(abs(s)**.58,s)
    z = (bottom+top)/2 + (top-bottom)/2 * math.copysign(abs(c)**.58,c)
    # Haunch rises toward the shoulder over both axles; hood centre stays low.
    z += .065 * (math.exp(-((x+1.43)/.47)**2)+math.exp(-((x-1.40)/.50)**2)) * abs(s)**2 * max(0,c+.3)
    return (x,y,z)

N, K = 180, 96
verts = [shellpoint(-2.3+4.6*i/N,2*math.pi*j/K) for i in range(N+1) for j in range(K)]
faces = [(i*K+j,i*K+(j+1)%K,(i+1)*K+(j+1)%K,(i+1)*K+j) for i in range(N) for j in range(K)]
faces += [tuple(reversed(range(K))),tuple(N*K+j for j in range(K))]
body = mesh('Continuous_sculpted_body_with_wheel_openings',verts,faces)
# Normals point outward for our loft's parameter order only after recalculation.
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
body.select_set(False)

wheel_specs = []
for x, axle in [(-1.43,'Front'),(1.40,'Rear')]:
    for s, side in [(-1,'Near'),(1,'Far')]:
        # Well cutters terminate at inner liner; they do not tunnel through car.
        bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=.402, depth=.61, end_fill_type='NGON', location=(x,s*.91,.34), rotation=(math.pi/2,0,0))
        cutter = bpy.context.object
        cutter.name = 'Well_boolean_tool'
        bpy.context.view_layer.objects.active = body
        mod = body.modifiers.new('True curved '+axle+side+' wheel well', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
        wheel_specs.append({'name':axle+'_'+side,'center':[x,s*.825,.34],'axle':[0,1,0],'radius':.34,'tire_width':.25,'ground_contact':[x,s*.825,0]})

# Thin rolled lip follows the actual opening above the sill, not a painted wheel.
for spec in wheel_specs:
    x,y,z = spec['center']
    s = 1 if y>0 else -1
    pts=[]
    for i in range(65):
        a=math.radians(-24+228*i/64)
        xx=x+.405*math.cos(a)
        zz=z+.405*math.sin(a)
        yy=s*(interp(xx,width_profile)+.006)
        pts.append((xx,yy,zz))
    # Only upper open arch: ends terminate at sill height.
    curve(spec['name']+'_rolled_fender_lip',pts,'Coachwork',.018)
    # Curved flared sheet metal connects the lip to the hood/rear quarter.
    # This prevents a thin arch floating above the shoulder after the well cut.
    fv=[]
    for i in range(81):
        a=math.radians(-24+228*i/80)
        for j in range(13):
            t=j/12
            rr=.405*(1-t)+.33*t
            xx=x+rr*math.cos(a)
            yy=s*(interp(xx,width_profile)*(1-t)+.64*t)
            zz=z+rr*math.sin(a)
            zz+=.012*math.sin(math.pi*t)*max(0,math.sin(a))
            fv.append((xx,yy,zz))
    ff=[(i*13+j,(i+1)*13+j,(i+1)*13+j+1,i*13+j+1) for i in range(80) for j in range(12)]
    mesh(spec['name']+'_compound_curved_fender_sheet',fv,ff)

# Greenhouse: a continuous curved glazed volume, with red roof and thick pillars.
cabin_profile=[(-.83,.625,.715),(-.58,.81,.670),(-.15,1.045,.605),(.38,1.055,.59),(.75,1.015,.625),(1.06,.80,.70),(1.30,.68,.735)]
def cabinpoint(x,u,offset=0):
    h=interp(x,[(p[0],p[1]) for p in cabin_profile])
    w=interp(x,[(p[0],p[2]) for p in cabin_profile])
    base=.615
    y=w*u
    z=base+(h-base)*(max(0,1-abs(u)**3.6)**.55)
    return (x,y,z+offset)

CN, CK=106,64
cv=[cabinpoint(-.83+2.13*i/CN,-1+2*j/CK,.006) for i in range(CN+1) for j in range(CK+1)]
cf=[(i*(CK+1)+j,(i+1)*(CK+1)+j,(i+1)*(CK+1)+j+1,i*(CK+1)+j+1) for i in range(CN) for j in range(CK)]
cabin=mesh('Swept_compound_curved_glass_and_roof',cv,cf,'Glazing')
cabin.data.materials.append(M['Coachwork'])
for p in cabin.data.polygons:
    center=sum((cabin.data.vertices[j].co for j in p.vertices),Vector())/len(p.vertices)
    if -.14<center.x<.72 and abs(center.y)<.52:
        p.material_index=1

for x,label in [(-.81,'windshield_base'),(-.14,'A_pillar'),(.72,'C_pillar'),(1.28,'rear_glass_base')]:
    curve('Glazing_border_'+label,[cabinpoint(x,-1+2*j/64,.019) for j in range(65)],'Coachwork',.023 if 'pillar' in label else .016)
for s in [-1,1]:
    curve('Roof_side_rail_'+str(s),[cabinpoint(-.14+.86*i/48,s*.83,.018) for i in range(49)],'Coachwork',.028)
    curve('Window_sill_'+str(s),[cabinpoint(-.82+2.10*i/64,s*.995,.016) for i in range(65)],'Rubber_intake',.014)
    curve('Window_B_pillar_'+str(s),[cabinpoint(.43,s*(.83+.17*i/20),.014) for i in range(21)],'Rubber_intake',.019)
    # Separate mirrors and supports.
    curve('Mirror_stalk_'+str(s),[(-.52,s*.67,.72),(-.55,s*.88,.76)],'Rubber_intake',.022)
    sphere('Sculpted_mirror_'+str(s),(-.56,s*.92,.78),(.13,.092,.054),'Coachwork')
    sphere('Mirror_glass_'+str(s),(-.50,s*.928,.783),(.026,.074,.035),'Glazing')

def prism(name, points, delta, role, edge=.015, parent=root):
    n=len(points)
    vs=points+[tuple(a+b for a,b in zip(p,delta)) for p in points]
    fs=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return bevel(mesh(name,vs,fs,role,parent),edge,3)

for s in [-1,1]:
    # The black intake at the rear shoulder is deliberately broad at native scale.
    prism('Deep_side_air_scoop_'+str(s),[(.42,s*.866,.48),(.99,s*.942,.61),(1.10,s*.948,.56),(.89,s*.932,.29),(.48,s*.873,.29)],(0,s*.025,0),'Rubber_intake',.026)
    curve('Intake_upper_rolled_edge_'+str(s),[(.40,s*.88,.50),(.96,s*.955,.635),(1.1,s*.96,.58)],'Coachwork',.026)
    for i in range(3):
        x=.62+i*.115
        curve('Scoop_vane_'+str(s)+'_'+str(i),[(x,s*.915,.33),(x+.09,s*.94,.51)],'Rubber_intake',.015)
    # Fine geometry, not per-view painted details.
    curve('Door_seam_'+str(s),[(-.66,s*.86,.595),(-.55,s*.88,.27),(.31,s*.87,.27),(.43,s*.865,.54)],'Rubber_intake',.007)
    sphere('Flush_door_handle_'+str(s),(.22,s*.872,.555),(.105,.012,.018),'Machined_alloy',seg=24,rings=12)
    curve('Lower_sill_blade_'+str(s),[(-1.01,s*.89,.20),(-.70,s*.91,.18),(.73,s*.92,.18),(1.00,s*.93,.23)],'Rubber_intake',.035)

# Hood creases and sculpted raised lamps follow the shell surface.
for s in [-1,1]:
    curve('Hood_power_crease_'+str(s),[(-2.05+.98*i/45,s*(.36+.02*i/45),interp(-2.05+.98*i/45,top_profile)+.008) for i in range(46)],'Coachwork',.014)
    # Swept teardrop lens on the top-front shoulder.
    pts=[(-2.12,s*.57,.564),(-2.01,s*.73,.608),(-1.63,s*.76,.682),(-1.74,s*.58,.659)]
    prism('Black_headlamp_surround_'+str(s),pts,(0,0,.025),'Rubber_intake',.036)
    lens=[(-2.075,s*.584,.591),(-1.99,s*.695,.633),(-1.72,s*.727,.700),(-1.80,s*.603,.685)]
    prism('Swept_LED_headlamp_'+str(s),lens,(0,0,.012),'Warm_LED',.020)
    curve('LED_light_blade_'+str(s),[(-2.06,s*.60,.614),(-1.97,s*.68,.654),(-1.78,s*.70,.702)],'Warm_LED',.016)

prism('Wide_front_grille',[(-2.302,-.51,.285),(-2.302,.51,.285),(-2.302,.57,.405),(-2.302,-.57,.405)],(-.018,0,0),'Rubber_intake',.024)
for y in [-.38,-.19,0,.19,.38]:
    curve('Front_intake_vertical_vane_'+str(y),[(-2.327,y,.30),(-2.327,y,.39)],'Rubber_intake',.012)
curve('Front_splitter',[(-2.25,-.70,.232),(-2.34,-.45,.215),(-2.34,.45,.215),(-2.25,.70,.232)],'Rubber_intake',.025)
# Rear fascia, round twin lamps on each side and a diffuser/exhaust pair.
prism('Rear_black_fascia',[(2.305,-.70,.37),(2.305,.70,.37),(2.305,.70,.54),(2.305,-.70,.54)],(.015,0,0),'Rubber_intake',.02)

def cylinder_y(name, center, radius, depth, role, parent=root, vertices=96):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=center,rotation=(math.pi/2,0,0))
    ob=bpy.context.object
    ob.name=name
    ob.parent=parent
    ob.data.materials.append(M[role])
    for p in ob.data.polygons:
        p.use_smooth=len(p.vertices)==4
    return ob

def cylinder_x(name, center, radius, depth, role):
    ob=cylinder_y(name,center,radius,depth,role,vertices=64)
    ob.rotation_euler=(0,math.pi/2,0)
    bevel(ob,.007,2)
    return ob

for s in [-1,1]:
    for y in [.40,.61]:
        cylinder_x('Recessed_tail_lamp_socket_'+str(s*y),(2.335,s*y,.48),.075,.027,'Rubber_intake')
        cylinder_x('Round_red_tail_lens_'+str(s*y),(2.354,s*y,.48),.052,.028,'Rear_lens')
    cylinder_x('Polished_exhaust_tip_'+str(s),(2.32,s*.50,.255),.058,.14,'Machined_alloy')
    cylinder_x('Hollow_exhaust_core_'+str(s),(2.398,s*.50,.255),.041,.008,'Rubber_intake')
for y in [-.61,-.30,0,.30,.61]:
    prism('Diffuser_fin_'+str(y),[(1.99,y,.17),(2.32,y,.17),(2.32,y,.28),(2.08,y,.23)],(0,.018,0),'Rubber_intake',.008)
curve('Rear_lip_spoiler',[(2.16,-.77,.635),(2.23,-.61,.660),(2.23,.61,.660),(2.16,.77,.635)],'Coachwork',.035)

# Tire profile is a genuine smooth rounded cross section with sidewalls.
def radial_profile(name, x,y,z, profile, material, parent, sectors=112):
    vs=[]
    for offset, radius in profile:
        for j in range(sectors):
            a=2*math.pi*j/sectors
            vs.append((x+radius*math.cos(a),y+offset,z+radius*math.sin(a)))
    fs=[(i*sectors+j,i*sectors+(j+1)%sectors,((i+1)%len(profile))*sectors+(j+1)%sectors,((i+1)%len(profile))*sectors+j) for i in range(len(profile)) for j in range(sectors)]
    return mesh(name,vs,fs,material,parent)

for spec in wheel_specs:
    name=spec['name']
    x,y,z=spec['center']
    s=1 if y>0 else -1
    rig=bpy.data.objects.new('Wheel_'+name+'_independent_Y_axle',None)
    scene.collection.objects.link(rig)
    rig.parent=root
    rig['center']=spec['center']
    rig['axle']=[0,1,0]
    rig['radius']=.34
    rig['ground_contact']=spec['ground_contact']
    # Geometry is authored in car coordinates, rotate around recorded axle for use.
    tireprof=[(-.125,.235),(-.125,.285),(-.116,.315),(-.095,.335),(-.065,.34),(.065,.34),(.095,.335),(.116,.315),(.125,.285),(.125,.235)]
    radial_profile('Rounded_performance_tire_'+name,x,y,z,tireprof,'Rubber_intake',rig)
    outside=y+s*.132
    cylinder_y('Recessed_wheel_barrel_'+name,(x,y,z),.247,.245,'Rubber_intake',rig)
    radial_profile('Polished_rim_lip_'+name,x,outside,z,[(-.009,.219),(-.014,.236),(0,.247),(.014,.236),(.009,.219)],'Machined_alloy',rig)
    # Rotor inside five split spokes; these details intentionally test pixel loss.
    cylinder_y('Brake_rotor_'+name,(x,outside-s*.025,z),.205,.014,'Machined_alloy',rig)
    for j in range(10):
        a=2*math.pi*j/10
        cylinder_y('Rotor_drill_'+name+'_'+str(j),(x+.165*math.cos(a),outside+s*.002,z+.165*math.sin(a)),.010,.012,'Rubber_intake',rig,vertices=12)
    sphere('Red_brake_caliper_'+name,(x+.15,outside-s*.006,z+.05),(.055,.036,.11),'Rear_lens',rig,24,12)
    for spoke in range(5):
        a=2*math.pi*spoke/5+.15
        for split in [-1,1]:
            a2=a+split*.12
            pts=[]
            for rr,aa in [(.055,a+split*.09),(.232,a2-.065),(.232,a2+.065),(.082,a+split*.09+.17)]:
                pts.append((x+rr*math.cos(aa),outside+s*.018,z+rr*math.sin(aa)))
            prism('Split_alloy_spoke_'+name+'_'+str(spoke)+'_'+str(split),pts,(0,s*.025,0),'Machined_alloy',.009,rig)
    cylinder_y('Raised_hub_'+name,(x,outside+s*.047,z),.065,.032,'Machined_alloy',rig,48)
    cylinder_y('Dark_center_cap_'+name,(x,outside+s*.067,z),.035,.010,'Rubber_intake',rig,48)
    # Move child geometry into a true local axle frame, preserving world positions.
    rig.location=(x,y,z)
    for child in rig.children:
        child.location-=Vector((x,y,z))

# Fixed studio light / camera. All angle variation comes from model-root rotation.
ld=bpy.data.lights.new('Fixed_key_upper_left','SUN')
lo=bpy.data.objects.new('Fixed_key_upper_left',ld)
scene.collection.objects.link(lo)
lo.rotation_euler=(math.radians(24),math.radians(-28),math.radians(-28))
ld.energy=2.0
ld.angle=math.radians(8)
cd=bpy.data.cameras.new('Contract_orthographic_50deg')
cam=bpy.data.objects.new('Contract_orthographic_50deg',cd)
scene.collection.objects.link(cam)
cam.location=(0,-12*math.cos(math.radians(50)),12*math.sin(math.radians(50)))
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
cd.type='ORTHO'
cd.ortho_scale=7.2
scene.camera=cam
scene.render.fps=4
scene['render_contract']='512 RGBA; 128 reduction then constant +(0,28); ground=(64,92)'
scene['toon_method']='Diffuse -> ShaderToRGB -> CONSTANT colour ramp -> Emission; six material roles'
scene['no_downloaded_assets']=True
bpy.context.view_layer.update()

depsgraph=bpy.context.evaluated_depsgraph_get()
counts=[]
all_min=Vector((1e9,1e9,1e9))
all_max=-all_min
for ob in scene.objects:
    if ob.type not in {'MESH','CURVE'} or ob.hide_render:
        continue
    ev=ob.evaluated_get(depsgraph)
    me=ev.to_mesh()
    me.calc_loop_triangles()
    counts.append({'name':ob.name,'type':ob.type,'triangles':len(me.loop_triangles),'vertices':len(me.vertices)})
    for v in me.vertices:
        co=ev.matrix_world @ v.co
        for i in range(3):
            all_min[i]=min(all_min[i],co[i])
            all_max[i]=max(all_max[i],co[i])
    ev.to_mesh_clear()
triangles=sum(v['triangles'] for v in counts)
assert triangles>=15000,triangles
# Include splitter/exhaust extremities in the required 4.6-unit overall length.
# One global authoring scale is shared by every view; no image fitting occurs.
contract_scale=4.6/(all_max.x-all_min.x)
root.scale=(contract_scale,)*3
root['overall_length']=4.6
root['authored_to_contract_scale']=contract_scale
all_min*=contract_scale
all_max*=contract_scale
for spec in wheel_specs:
    for key in ['center','ground_contact']:
        spec[key]=[v*contract_scale for v in spec[key]]
    for key in ['radius','tire_width']:
        spec[key]*=contract_scale
    rig=bpy.data.objects['Wheel_'+spec['name']+'_independent_Y_axle']
    rig['world_center']=spec['center']
    rig['world_radius']=spec['radius']
    rig['world_ground_contact']=spec['ground_contact']
bpy.context.view_layer.update()
meta={'route':'02-detailed-toon','evaluatedTriangles':triangles,'evaluatedMeshCount':len(counts),'nativeMeshCount':sum(ob.type=='MESH' for ob in scene.objects),'curveCount':sum(ob.type=='CURVE' for ob in scene.objects),'objects':counts,'bounds':{'min':list(all_min),'max':list(all_max)},'authoredToContractScale':contract_scale,'wheels':wheel_specs,'materialRoles':roles,'camera':{'location':list(cam.location),'target':[0,0,0],'elevationDegrees':50,'orthographicScale':7.2},'threads':4,'engine':'BLENDER_EEVEE','anglesDegrees':list(range(0,360,45))}
(DATA/'geometry.json').write_text(json.dumps(meta,indent=2)+'\n')
root.rotation_euler.z=0
bpy.ops.wm.save_as_mainfile(filepath=str(DATA/'sports-coupe.blend'))
print('TOON_GEOMETRY '+str(triangles)+' evaluated triangles / '+str(len(counts))+' evaluated meshes',flush=True)
for i in range(8):
    root.rotation_euler.z=math.radians(i*45)
    scene.render.filepath=str(OUT/f'raw-{i}.png')
    bpy.ops.render.render(write_still=True)
    print('TOON_RENDER '+str(i)+' complete',flush=True)
root.rotation_euler.z=0
print('TOON_ALL_RENDERS_COMPLETE',flush=True)
