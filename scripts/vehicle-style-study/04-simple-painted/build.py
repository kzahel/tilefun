"""Original low-poly sports coupe; run with Blender 5.2 background CLI.

No external model or texture dependency. Shared source palette is frozen by
finish.py; all surfaces below are authored flat paint, not source projection.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
ROUTE = '04-simple-painted'
DATA = ROOT / 'data/vehicle-style-study' / ROUTE
OUT = ROOT / 'public/demos/vehicle-style-study' / ROUTE
DATA.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
PALETTE = {
    'ink': '#3a3a50', 'red_shadow': '#a11250', 'red_side': '#c53458',
    'red_main': '#d3445c', 'red_light': '#e35a5a', 'red_glint': '#e18484',
    'glass_dark': '#738ca8', 'glass_mid': '#8fa1c8', 'glass_light': '#a4bbd5',
    'glass_glint': '#bad2e0', 'trim_dark': '#46465e', 'trim_mid': '#565972',
    'silver': '#b9b9d5', 'lamp': '#ebe4f2', 'rear_lamp': '#fc5c46',
    'red_deep': '#7f214c',
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
# Deliberately low-sample CPU: predictable background execution and no GPU load.
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.cycles.use_denoising = False
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.world = bpy.data.worlds.new('Transparent studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0

def linear(v):
    v = v / 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

materials = {}
for name, color in PALETTE.items():
    rgb = tuple(bytes.fromhex(color[1:]))
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    emission = nodes.new('ShaderNodeRGB')
    emission.outputs[0].default_value = (*map(linear, rgb), 1)
    output = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(emission.outputs[0], output.inputs[0])
    mat.diffuse_color = (*map(linear, rgb), 1)
    materials[name] = mat

root = bpy.data.objects.new('SportsCoupe_Root', None)
scene.collection.objects.link(root)
root['forward_axis'] = '-X'
root['up_axis'] = '+Z'
root['ground_origin'] = [0, 0, 0]
static = []

def mesh(name, verts, faces, roles='red_main', parent=root, keep=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = parent
    if isinstance(roles, str):
        roles = [roles] * len(faces)
    unique = list(dict.fromkeys(roles))
    for role in unique:
        data.materials.append(materials[role])
    for poly, role in zip(data.polygons, roles):
        poly.material_index = unique.index(role)
    if not keep:
        static.append(obj)
    return obj

def panel(name, verts, role):
    return mesh(name, verts, [tuple(range(len(verts)))], role)

def line(name, points, width, role='ink', plane_normal=(0,0,1)):
    # Width is authored in model units; depth offsets come from caller.
    verts, faces = [], []
    for a, b in zip(points, points[1:]):
        a, b = Vector(a), Vector(b)
        direction = b-a
        # Lines mostly lie on broad Z-facing surfaces; side strips use X/Z.
        normal = Vector(plane_normal)
        side = direction.cross(normal).normalized() * width / 2
        n = len(verts)
        verts.extend([a-side, b-side, b+side, a+side])
        faces.append((n,n+1,n+2,n+3))
    mesh(name, verts, faces, role)

def interp(x, controls):
    for (a, av), (b, bv) in zip(controls, controls[1:]):
        if a <= x <= b:
            return av+(bv-av)*(x-a)/(b-a)
    return controls[0][1] if x < controls[0][0] else controls[-1][1]

height = [(-2.3,.37),(-2.02,.52),(-1.70,.70),(-1.38,.755),(-1.04,.72),(-.65,.675),(.5,.675),(1.1,.75),(1.38,.78),(1.75,.74),(2.04,.65),(2.3,.58)]
width = [(-2.3,.70),(-2.0,.86),(-1.5,.95),(-1.0,.89),(-.4,.85),(.6,.89),(1.38,.96),(1.9,.92),(2.3,.81)]
axles = [-1.38, 1.38]
xs = {-2.3,-2.15,-2.02,-1.90,-1.70,-1.04,-.8,-.65,-.4,0,.5,.8,1.1,1.75,2.04,2.3}
for center in axles:
    xs.update(center + .385*math.cos(math.pi*i/8) for i in range(9))
    xs.update([center-.405,center+.405])
xs = sorted(xs)
bands = [-1,-.81,-.61,0,.61,.81,1]

def surface(x, f):
    # Raised shoulders frame a shallow hood/deck valley, simple painted facets.
    z = interp(x,height)
    z += interp(abs(f), [(0,-.045),(.61,-.025),(.81,.025),(1,0)])
    return (x, interp(x,width)*f, z)

verts = [surface(x, f) for x in xs for f in bands]
faces, roles = [], []
for ix in range(len(xs)-1):
    for j in range(6):
        n=ix*7+j
        faces.append((n,n+7,n+8,n+1))
        roles.append('red_light' if j in [1,4] else 'red_main')
mesh('Sectional hood and haunches', verts, faces, roles)

def bottom(x):
    for center in axles:
        dx = abs(x-center)
        if dx <= .38500001:
            return .33+math.sqrt(max(0,.385**2-dx**2))
    return .19

for side in [-1,1]:
    verts=[]
    for x in xs:
        w=interp(x,width)
        top=interp(x,height)
        low=bottom(x)
        verts.extend([(x,side*w,top),(x,side*(w-.012),max(low,.30)),(x,side*(w-.07),low)])
    faces=[]; roles=[]
    for i in range(len(xs)-1):
        n=i*3
        faces.extend([(n,n+3,n+4,n+1),(n+1,n+4,n+5,n+2)])
        roles.extend(['red_side','red_shadow'])
    mesh(f'Open wheel-well side {side}',verts,faces,roles)
    # Thin arch lip follows the actual curved aperture; no dark fake wheel disk.
    for center in axles:
        verts=[]
        for i in range(9):
            angle=math.pi*i/8
            x=center+.385*math.cos(angle)
            y=side*(interp(x,width)+.003)
            z=.33+.385*math.sin(angle)
            verts.extend([(x,y,z),(x,y,z+.025)])
        mesh(f'Painted arch lip {side} {center}',verts,[(i*2,i*2+2,i*2+3,i*2+1) for i in range(8)],'red_deep')
    # Intake behind door; its slanted outline is repeated as editable geometry.
    y=side*.907
    panel(f'Side intake {side}',[(.56,y,.36),(.98,y,.39),(1.055,y,.62),(.77,y,.58)],'ink')
    panel(f'Intake mouth {side}',[(.65,y+side*.004,.405),(.93,y+side*.004,.425),(.98,y+side*.004,.55),(.79,y+side*.004,.53)],'trim_dark')
    # Geometric door shutline and tiny horizontal handle.
    door_points=[(x,side*(interp(x,width)+.008),z) for x,z in [(-.65,.63),(-.55,.35),(.44,.35),(.60,.61)]]
    line(f'Door edge {side}',door_points,.017,'red_deep',(0,1,0))
    panel(f'Door handle {side}',[(.27,side*.893,.58),(.43,side*.9,.58),(.43,side*.9,.61),(.27,side*.893,.61)],'red_glint')

for x in [-2.3,2.3]:
    w=interp(x,width); h=interp(x,height)
    panel('Nose' if x<0 else 'Tail',[(x,-w,.19),(x,w,.19),(x,w,h),(x,-w,h)],'red_side' if x<0 else 'red_shadow')
    xx=x+(-.008 if x<0 else .008)
    panel('Front grille' if x<0 else 'Rear diffuser',[(xx,-.54,.205),(xx,.54,.205),(xx,.48,.31),(xx,-.48,.31)],'ink')
    for side in [-1,1]:
        if x>0:
            panel(f'Rear dark lamp surround {side}',[(xx,side*.34,.43),(xx,side*.76,.43),(xx,side*.76,.55),(xx,side*.34,.55)],'ink')
            panel(f'Rear blade lamp {side}',[(xx+.002,side*.38,.46),(xx+.002,side*.71,.46),(xx+.002,side*.71,.51),(xx+.002,side*.38,.51)],'rear_lamp')

# Continuous red canopy with separately inset bordered glass apertures.
A=(-.73,-.69,.665); B=(-.73,.69,.665)
C=(-.23,-.57,1.05); D=(-.23,.57,1.05)
E=(.62,-.59,1.05); F=(.62,.59,1.05)
G=(1.23,-.73,.72); H=(1.23,.73,.72)
panel('Canopy front', [A,B,D,C], 'red_light')
panel('Canopy roof',[C,D,F,E], 'red_main')
panel('Canopy rear',[E,F,H,G],'red_shadow')
panel('Canopy near side',[A,C,E,G], 'red_main')
panel('Canopy far side',[B,D,F,H], 'red_main')

def inset(name, corners, role, margin=.08, offset=(0,0,.002)):
    center = sum((Vector(v) for v in corners), Vector()) / len(corners)
    verts = [tuple(Vector(v).lerp(center,margin)+Vector(offset)) for v in corners]
    panel(name,verts,role)
    return verts

front=inset('Windshield continuous ink',[A,B,D,C],'ink',.09,(-.002,0,.004))
inset('Windshield blue glass',front,'glass_light',.10,(-.002,0,.004))
panel('Windshield controlled reflection',[(-.629,-.43,.753),(-.629,-.29,.753),(-.296,-.26,1.01),(-.296,-.38,1.01)],'glass_glint')
rear=inset('Rear glass continuous ink',[E,F,H,G],'ink',.14,(.002,0,.003))
inset('Rear blue glass',rear,'glass_dark',.10,(.002,0,.003))
for side,corners in [(-1,[A,C,E,G]),(1,[B,D,F,H])]:
    border=inset(f'Side window ink {side}',corners,'ink',.14,(0,side*.004,.002))
    inset(f'Side blue glass {side}',border,'glass_mid',.13,(0,side*.004,.002))
    panel(f'Side glass B pillar {side}',[(.36,side*.721,.741),(.395,side*.722,.741),(.395,side*.613,1.01),(.36,side*.613,1.01)],'ink')
    # Angular mirrors sit outside the rail with tapered dark mounting geometry.
    mesh(f'Mirror {side}',[(-.57,side*.72,.75),(-.63,side*.91,.77),(-.46,side*.97,.79),(-.42,side*.83,.82),(-.58,side*.82,.86)],[(0,1,2,3),(0,3,4),(1,4,3,2),(0,4,1)],['red_shadow','red_main','red_light','ink'])

# Hood shutlines, lamp clusters and recessed sporty vents follow shell height.
for side in [-1,1]:
    def p(x,f,dz=.004):
        v=surface(x,side*f)
        return (v[0],v[1],v[2]+dz)
    hood_x=[-2.08]+[x for x in xs if -2.08<x<-.82]+[-.82]
    line('Hood cut line',[p(x,interp(x,[(-2.08,.44),(-1.6,.50),(-.82,.54)]),.008) for x in hood_x],.045,'red_deep')
    corners=[p(-2.18,.55),p(-2.03,.87),p(-1.76,.88),p(-1.92,.58)]
    panel('Front smoked lamp housing',corners,'ink')
    inset('Front white blade lamp',corners,'lamp',.28,(0,0,.004))
    panel('Hood cooling vent',[p(-1.1,.56),p(-.88,.56),p(-.89,.69),p(-1.13,.69)],'red_deep')
    line('Hood vent slot',[p(-1.10,.61,.010),p(-.91,.61,.010)],.025,'ink')

# Small integrated ducktail; curved silhouette stays at the rear of the coupe.
mesh('Ducktail',[(2.04,-.85,.65),(2.04,.85,.65),(2.25,.82,.70),(2.25,-.82,.70),(2.26,-.82,.65),(2.26,.82,.65)],[(0,1,2,3),(3,2,5,4),(0,3,4),(1,5,2)],['red_light','red_shadow','red_side','red_side'])

# Four rigid, local-Y-axis wheel objects. Tire contact is exactly Z=0.
wheels=[]
for axle,x in enumerate(axles):
    for side in [-1,1]:
        verts=[]; faces=[]; roles=[]
        def ring(radius,y):
            indices=[]
            for i in range(12):
                angle=2*math.pi*i/12
                indices.append(len(verts))
                verts.append((radius*math.cos(angle),y,radius*math.sin(angle)))
            return indices
        rings=[ring(.30,-.11),ring(.33,-.075),ring(.33,.075),ring(.30,.11)]
        for j in range(3):
            for i in range(12):
                faces.append((rings[j][i],rings[j][(i+1)%12],rings[j+1][(i+1)%12],rings[j+1][i]))
                roles.append('ink' if j==1 else 'trim_dark')
        for sign in [-1,1]:
            outer=rings[0 if sign<0 else 3]
            inner=ring(.215,sign*.111)
            for i in range(12):
                faces.append((outer[i],outer[(i+1)%12],inner[(i+1)%12],inner[i]))
                roles.append('ink')
            faces.append(tuple(inner)); roles.append('trim_dark')
        # Only outer-facing silver rims and five distinct tapered spokes.
        y=side*.115
        outer=ring(.224,y); inner=ring(.194,y+side*.001)
        for i in range(12):
            faces.append((outer[i],outer[(i+1)%12],inner[(i+1)%12],inner[i]));roles.append('silver')
        for spoke in range(5):
            a=spoke*2*math.pi/5
            n=len(verts)
            for r,da in [(.05,-.38),(.19,-.13),(.19,.13),(.05,.38)]:
                verts.append((r*math.cos(a+da),y+side*.004,r*math.sin(a+da)))
            faces.append((n,n+1,n+2,n+3));roles.append('silver')
        hub=ring(.052,y+side*.006)
        faces.append(tuple(hub));roles.append('red_main')
        obj=mesh(f'Wheel_{"Front" if axle==0 else "Rear"}_{"L" if side<0 else "R"}',verts,faces,roles,keep=True)
        obj.location=(x,side*.88,.33)
        obj['radius']=.33
        obj['axle_axis_local']=[0,1,0]
        obj['ground_contact_model']=[x,side*.88,0]
        wheels.append(obj)

# Join static components while keeping per-face paint and editable wheel meshes.
bpy.ops.object.select_all(action='DESELECT')
for obj in static:
    obj.select_set(True)
bpy.context.view_layer.objects.active=static[0]
bpy.ops.object.join()
body=bpy.context.object
body.name='Body_PaintedShell_Glass_Trim'
body['paint_method']='Shared flat unlit roles; geometric glass borders and shutlines'

cam_data=bpy.data.cameras.new('Contract_Orthographic_50deg')
cam=bpy.data.objects.new('Contract_Orthographic_50deg',cam_data)
scene.collection.objects.link(cam)
elev=math.radians(50)
cam.location=(0,-12*math.cos(elev),12*math.sin(elev))
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.type='ORTHO';cam_data.ortho_scale=7.2
scene.camera=cam
# Kept fixed for the scene contract; emission paint is deliberately light invariant.
light_data=bpy.data.lights.new('Fixed studio light','AREA');light_data.energy=300
light=bpy.data.objects.new('Fixed studio light',light_data);scene.collection.objects.link(light)
light.location=(-3,-4,8)

mesh_objs=[body]+wheels
triangles=0
components=[]
for obj in mesh_objs:
    obj.data.calc_loop_triangles()
    n=len(obj.data.loop_triangles);triangles+=n
    components.append({'name':obj.name,'triangles':n,'vertices':len(obj.data.vertices)})
assert 700<=triangles<=1800, triangles
root['triangle_count']=triangles
scene['render_contract']='512 RGBA; ortho 7.2 at elevation50; origin ground; eight Z headings'
bpy.ops.wm.save_as_mainfile(filepath=str(DATA/'sports-coupe.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in [root]+mesh_objs:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'sports-coupe.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_materials='EXPORT')

record={
    'route':ROUTE,'title':'Rosso Sprint — simple painted coupe',
    'triangles':triangles,'meshCount':len(mesh_objs),'components':components,
    'paletteRoles':PALETTE,'units':{'length':4.6,'nominalBodyWidth':1.92,'roofHeight':1.05,'forward':'-X','up':'+Z','origin':'ground center'},
    'camera':{'position':list(cam.location),'elevationDegrees':50,'orthographicScale':7.2,'target':[0,0,0]},
    'renderer':{'engine':'Cycles','device':'CPU','samples':8,'threads':4,'materials':'RGB unlit surface'},
    'wheelCenters':[list(obj.location) for obj in wheels], 'wheelRadius':.33,
    'blend':'data/vehicle-style-study/04-simple-painted/sports-coupe.blend',
    'glb':'public/demos/vehicle-style-study/04-simple-painted/sports-coupe.glb',
    'renderedHeadings':[],
}
for i in range(8):
    root.rotation_euler.z=math.radians(i*45)
    scene.render.filepath=str(OUT/f'raw-{i}.png')
    bpy.ops.render.render(write_still=True)
    record['renderedHeadings'].append(i*45)
    (DATA/'geometry.json').write_text(json.dumps(record,indent=2)+'\n')
root.rotation_euler.z=0
print('STYLE_STUDY_GEOMETRY',json.dumps({'triangles':triangles,'meshCount':len(mesh_objs)}))
