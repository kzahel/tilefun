"""Blender -b -P build.py -- OUTPUT. Three standing studies from the town pedestrian roster."""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(sys.argv[sys.argv.index("--")+1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
INK = "3a3a50"
SCALE = .1


def sp(v, power):
    return math.copysign(abs(v)**power, v)


class Person:
    def __init__(self, number):
        self.number = number
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.context.scene.view_settings.view_transform = "Standard"
        self.sheet = bpy.data.images.load(str(ROOT/f"public/assets/sprites/person{number}.png"))
        self.sheet.pack()
        self.width, self.height = self.sheet.size
        self.colors = {}
        self.sheet.colorspace_settings.name = "Non-Color"
        data = list(self.sheet.pixels)
        self.sheet.colorspace_settings.name = "sRGB"
        for y in range(self.height):
            for x in range(16):
                i = 4*((self.height-1-y)*self.width+x)
                if data[i+3] > .5:
                    color = bytes(round(255*f) for f in data[i:i+3]).hex()
                    self.colors[color] = ((x+.5)/self.width,1-(y+.5)/self.height)
        self.mat = bpy.data.materials.new(f"Person {number} • original sprite paint")
        self.mat.use_nodes = True
        self.mat.use_backface_culling = True
        bsdf = self.mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = .96
        bsdf.inputs["Specular IOR Level"].default_value = .12
        paint = self.mat.node_tree.nodes.new("ShaderNodeTexImage")
        paint.image, paint.interpolation = self.sheet, "Closest"
        self.mat.node_tree.links.new(paint.outputs["Color"],bsdf.inputs["Base Color"])
        bones = bpy.data.armatures.new("Biped")
        self.rig = bpy.data.objects.new(f"Person {number}",bones)
        bpy.context.collection.objects.link(self.rig)
        bpy.context.view_layer.objects.active = self.rig
        self.rig.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        for name,x,y,z,parent in [("Hips",0,0,4,None),("Head",0,0,9,"Hips")]+[
            (part+side,sign*x,y,z,"Hips") for sign,side in [(-1,".L"),(1,".R")]
            for part,x,y,z in [("Arm",4.6,0,8),("Leg",2.55,0,3.8)]]:
            b = bones.edit_bones.new(name)
            b.head = Vector((x,y,z))*SCALE
            b.tail = b.head + Vector((0,0,.16))
            if parent:
                b.parent = bones.edit_bones[parent]
        bpy.ops.object.mode_set(mode="OBJECT")
        bones.display_type = "STICK"

    def loft(self, name, rings, group, paint, ink=.10):
        n=len(rings[0])
        points=[Vector(p) for ring in rings for p in ring]
        faces=[tuple(reversed(range(n)))]
        for r in range(len(rings)-1):
            for j in range(n):
                a, b = r*n+j,r*n+(j+1)%n
                faces.append((a,b,b+n,a+n))
        faces.append(tuple(range(len(points)-n,len(points))))
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata(points,[],faces)
        mesh.update()
        if ink:
            outer=[v.co+v.normal*ink for v in mesh.vertices]
            mesh.clear_geometry()
            mesh.from_pydata(points+outer,[],faces+[tuple(i+len(points) for i in reversed(f)) for f in faces])
            mesh.update()
        uv=mesh.uv_layers.new(name="Directional sprite & swatches")
        for f in mesh.polygons:
            f.use_smooth = True
            role = INK if f.index>=len(faces) else (paint(f) if callable(paint) else paint)
            for li in f.loop_indices:
                uv.data[li].uv=self.colors[role]
        for v in mesh.vertices:
            v.co *= SCALE
        ob=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(ob)
        ob.parent=self.rig
        mesh.materials.append(self.mat)
        ob.vertex_groups.new(name=group).add(list(range(len(mesh.vertices))),1,"REPLACE")
        ob.modifiers.new("Biped skin","ARMATURE").object=self.rig

    def shape(self,name,sections,group,paint,power=.75,ink=.11):
        rings=[]
        for x,y,z,rx,ry in sections:
            rings.append([(x+rx*sp(math.cos(a),power),y+ry*sp(math.sin(a),power),z)
                          for a in [j*math.tau/24 for j in range(24)]])
        self.loft(name,rings,group,paint,ink)

    def box(self,name,x,y,z,w,d,h,group,col,power=.55,ink=.075):
        self.shape(name,[(x,y,z+h*k,w/2*r,d/2*r) for k,r in
                        [(-.50,.70),(-.43,.91),(-.3,1),(.3,1),(.43,.91),(.50,.70)]],
                   group,col,power,ink)

    def head(self):
        n=self.number
        skin={4:"bf8b78",10:"ffb893",20:"f0ae80"}[n]
        blush={4:"b57972",10:"f69784",20:"e6976d"}[n]
        # A common soft jaw and broad brow support different hair and headwear.
        def centered(name,sections,color,ink=.14):
            self.shape(name,[(0,y,z,x,d) for z,x,d,y in sections],"Head",color,.79,ink)

        centered("Cheeks and brow",[(8.79,2.95,2.23,-.12),(9.07,4.47,3.12,-.16),
            (9.84,5.63,3.9,-.19),(11.48,6.23,4.39,-.16),(13.44,6.46,4.54,-.08),
            (15.55,6.24,4.52,0),(17.3,5.53,4.06,.13),(18.5,3.88,2.87,.16)],skin)
        for sign in (-1,1):
            self.box("Ear "+str(sign),sign*6.16,-.04,11.94,1.39,1.75,2.18,"Head",skin,.85,.065)
            x=sign*3.03
            self.box("Eye "+str(sign),x,-4.36,11.65,.82,.57,1.32,"Head",INK,.74,.02)
            self.box("Cheek blush "+str(sign),sign*4.35,-3.59,10.38,1.24,.30,.43,"Head",blush,.70,0)
        if n==4:
            centered("Rust knit crown",[(14.5,6.99,4.74,.05),(15.37,7.67,5.16,.02),
                (17.4,7.58,5.25,.04),(19.43,7.10,4.90,.08),(21.36,5.99,4.20,.12),
                (22.74,4.34,3.2,.16),(23.49,2.29,1.72,.18),(23.58,1.30,.95,.18)],"a0574c")
            brim=[]
            for z,rx,ry in [(12.83,6.17,4.41),(13.24,7.29,5.12),(13.97,7.69,5.40),
                            (15.67,7.73,5.43),(16.12,7.35,5.16)]:
                ring=[]
                for j in range(96):
                    a=j*math.tau/96
                    ridge=1+.018*math.cos(24*a)
                    ring.append((rx*ridge*math.cos(a),ry*ridge*math.sin(a),z))
                brim.append(ring)
            self.loft("Folded ribbed brim",brim,"Head",lambda f:
                "7d4751" if f.center.z<13.5 else "8e5252",.11)
            self.box("Woven label",2.52,-5.23,15.85,1.14,.46,1.8,"Head","bf8b78",ink=.035)
        elif n==10:
            # Build a continuous bob with a diagonal front fringe. Each angular
            # cross-section has its own hem height. The nape hangs to the jaw.
            rings=[]
            for t,rx in [(0,.83),(.08,.97),(.26,1),(.55,.96),(.74,.82),(.91,.57),(1,.28)]:
                row=[]
                for j in range(40):
                    angle=j*math.tau/40
                    x,y=sp(math.cos(angle),.82),sp(math.sin(angle),.82)
                    front=max(0,-y)
                    edge=9.15+front**2*(5.8+2.8*x)-max(0,-x)*.28
                    z=edge+(21.92-edge)*t
                    row.append((x*7.10*rx,y*4.94*rx+.26,z))
                rings.append(row)
            def hair_paint(f):
                if f.center.z>19.6 and f.center.x < .9: return "ba8d5e"
                return "957350" if f.center.z>14.4 else "8a6552"
            self.loft("Side swept bob",rings,"Head",hair_paint,.14)
            # The low strand crosses one brow in the source's front view.
            self.shape("Swept fringe",[
                (-4.92,-3.10,11.62,.17,.20),(-4.62,-3.38,12.19,.69,.47),
                (-3.83,-3.97,13.08,1.31,.61),(-2.60,-4.30,14.40,1.73,.68),
                (-1.03,-4.17,15.97,1.88,.72),(.17,-3.84,17.63,1.56,.62),
                (.96,-3.29,18.78,.93,.43),(1.13,-2.96,19.24,.31,.20)],
                "Head",lambda f:"8a6552" if f.center.z<13.5 else "957350",.045)
        else:
            rings=[]
            for t,r in [(0,.91),(.13,.99),(.33,1),(.59,.94),(.81,.77),(.93,.55),(1,.32)]:
                row=[]
                for j in range(32):
                    a=j*math.tau/32
                    x,y=sp(math.cos(a),.78),sp(math.sin(a),.78)
                    edge=12.4+2.48*max(0,-y)**2-.45*max(0,y)
                    row.append((x*6.54*r,y*4.8*r+.14,edge+(21.94-edge)*t))
                rings.append(row)
            self.loft("Cropped grey hair",rings,"Head",lambda f:
                "898171" if f.center.z>19.2 and f.center.x<2 else "79746f",.13)

    def body(self):
        # These three have different garments. The short shoulder-to-hip distance
        # and large heads come straight from their 16×32 directional cells.
        n=self.number
        skin={4:"bf8b78",10:"ffb893",20:"f0ae80"}[n]
        cloth={4:"18838a",10:"e7e5ec",20:"9c5f8b"}[n]
        hem={4:"126b83",10:"bddae4",20:"7c6279"}[n]
        pants={4:"d68143",10:"b2bad4",20:"827e99"}[n]
        shoe={4:"3c9a9a",10:"accfda",20:"ba811a"}[n]
        def garment(f):
            z=f.center.z
            if z<4.42: return hem
            if n==4 and f.center.y<0 and abs(f.center.x)<(1.77+.12*(z-5)):
                return "f1dbda"
            if n==10 and f.center.y < -2.15 and z>7.5 and abs(f.center.x)<1.9:
                return skin
            if n==20 and (5.0<z<5.75 or 6.64<z<7.36):
                return "e7ba79"
            return cloth
        self.shape("Jacket" if n==4 else "Bodice" if n==10 else "Pullover",
                   [(0,0,z,x,y) for z,x,y in [(3.9,3.5,2.2),(4.43,4.45,2.65),
                    (5.0,4.42,2.78),(5.75,4.3,2.88),(6.64,4.36,2.88),
                    (7.36,4.61,2.82),(7.6,4.66,2.8),(8.45,4.25,2.2),(9.1,2.36,1.85)]],
                   "Hips",garment)
        self.box("Neck",0,0,9.0,4.5,3.9,2,"Hips",skin)
        for sign, side in [(-1,".L"),(1,".R")]:
            arm,leg="Arm"+side,"Leg"+side
            self.shape("Sleeve"+side,[(sign*x,y,z,rx,ry) for x,y,z,rx,ry in [
                (5.25,-.15,5.5,1.05,1.18),(5.25,-.09,5.77,1.51,1.38),
                (5.11,0,7.38,1.52,1.54),(4.75,0,8.04,1.14,1.26),
                (4.47,0,8.23,.61,.82)]],arm,cloth if n!=10 else hem)
            self.box("Hand"+side,sign*5.37,-.34,5.01,2.48,2.57,2.08,arm,skin,.78)
            self.box("Trouser leg"+side,sign*2.55,.04,2.58,3.33,3.9,3.45,leg,pants)
            self.shape("Shoe"+side,[(sign*2.57,y,z,rx,ry) for y,z,rx,ry in [
                (-.6,.10,1.39,1.82),(-.62,.34,1.76,2.36),(-.67,.9,1.8,2.43),
                (-.54,1.39,1.57,1.98),(-.12,1.59,1.18,1.48)]],leg,
                lambda f: INK if f.center.z<.4 else shoe)
        if n==4:
            self.box("Waistband",0,0,3.92,8.15,5.18,.79,"Hips","b05c44",ink=.05)
        elif n==10:
            self.shape("Flared skirt and pale blue hem",
                [(0,y,z,x,d) for y,z,x,d in [(.35,.36,4.36,3.27),(.29,.7,5.32,3.85),
                 (.18,1.41,5.88,3.96),(.05,2.15,5.37,3.65),(0,3.75,4.24,2.8),
                 (0,4.46,3.98,2.67)]],"Hips",lambda f:"bddae4" if f.center.z<1.15 else (
                    "d4e0ea" if math.cos(math.atan2(f.center.y,f.center.x)*6)>.4 else "e7e5ec"))
            self.box("Sash",0,0,4.37,8.51,5.72,.78,"Hips","b2bad4",ink=.055)
        else:
            for sign in [-1,1]:
                self.box("Blue pack strap"+str(sign),sign*3.37,-1.98,6.94,.81,1.19,3.85,
                         "Hips","3d56d2",ink=.06)
                x=sign*2.43
                self.box("Spectacle rim"+str(sign),x,-4.52,11.63,2.82,.92,2.30,"Head","58616f",ink=.08)
                self.box("Glazed lens"+str(sign),x,-5.02,11.70,1.99,.21,1.49,"Head","c6ecff",ink=0)
                # The temple follows the cheek back to the ear.
                rim=[]
                for x,y,z,r in [(3.57,-4.59,11.8,.19),(4.74,-3.78,11.85,.23),
                                (5.85,-2.60,11.95,.21),(6.22,-1.44,12.14,.22),(6.34,.02,12.18,.16)]:
                    rim.append([(sign*x+r*math.cos(i*math.tau/8),y,z-r*math.sin(i*math.tau/8)) for i in range(8)])
                self.loft("Eyeglass temple"+str(sign),rim,"Head","58616f",.03)
                self.box("Lens glint"+str(sign),sign*2.43-.41,-5.16,12.03,
                    .54,.10,.36,"Head","f8f8f8",ink=0)
            self.box("Spectacle bridge",0,-4.77,11.89,2.47,.50,.42,"Head","58616f",ink=.03)
            self.box("Pack",0,2.98,6.07,4.7,2.44,4.73,"Hips","d5aa35")
            self.box("Pack flap",0,3.58,7.61,4.97,1.94,1.95,"Hips","3d56d2")
            self.box("Pack clasp",0,4.28,6.64,1.09,.60,.85,"Hips","e8cf50")

    def save(self):
        animation=self.rig.animation_data_create()
        for name,frames in (("Idle",72),("Walk",24)):
            a=bpy.data.actions.new(name)
            a.use_fake_user=True
            animation.action=a
            for frame in range(frames+1):
                theta=frame/frames*math.tau
                swing,contact=math.sin(theta),math.cos(theta)
                walk=name=="Walk"
                for b in self.rig.pose.bones:
                    b.rotation_mode="XYZ"
                    b.rotation_euler=(0,0,0)
                    b.location=(0,0,0)
                    side=1 if b.name.endswith(".R") else -1
                    if b.name=="Hips":
                        b.location=(.026*contact if walk else 0,.052*swing**2 if walk else .005*swing,0)
                    if b.name=="Head":
                        b.rotation_euler=(.018*swing,.039*swing, .024*contact)
                    if b.name.startswith("Arm"):
                        b.rotation_euler.x= -side*(.58 if walk else .032)*swing
                    if walk and b.name.startswith("Leg"):
                        b.rotation_euler.x=side*.62*swing
                        b.location.y= -.115*swing**2+.091*max(0,side*contact)**2
                    for prop in ("location","rotation_euler"):
                        b.keyframe_insert(prop,frame=frame+1,group=b.name)
            animation.action=None
        animation.action=bpy.data.actions["Idle"]
        scene=bpy.context.scene
        scene.render.fps=24
        scene.frame_end=73
        scene.frame_set(1)
        bpy.ops.object.select_all(action="DESELECT")
        meshes=[obj for obj in scene.objects if obj.type=="MESH"]
        for ob in meshes: ob.select_set(True)
        bpy.context.view_layer.objects.active=meshes[0]
        bpy.ops.object.join()
        bpy.context.object.name=f"Town pedestrian {self.number} • standing"
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type=="VIEW_3D":
                    space=area.spaces.active
                    space.shading.type="MATERIAL"
                    space.overlay.show_overlays=False
                    space.region_3d.view_distance=4.6
                    space.region_3d.view_location=(0,0,1.13)
                    space.region_3d.view_rotation=Euler((1.36,0,.47)).to_quaternion()
        stem=OUT/f"person{self.number}"
        bpy.ops.wm.save_as_mainfile(filepath=str(stem.with_suffix(".blend")),compress=True)
        bpy.ops.export_scene.gltf(filepath=str(stem.with_suffix(".glb")),export_format="GLB",
            export_animation_mode="ACTIONS",export_frame_range=False,export_def_bones=True,export_leaf_bone=False)

for number in (4,10,20):
    person=Person(number)
    person.head()
    person.body()
    person.save()
