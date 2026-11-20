"""Apply a recorded second-pass art brief to an exact first candidate in Blender."""
import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Quaternion, Vector


def clamp(value, low=0, high=1):
    return max(low,min(high,value))


def packed_palette(shape):
    materials={m for mesh in bpy.data.meshes for m in mesh.materials if m and m.use_nodes}
    atlases={n.image for m in materials for n in m.node_tree.nodes
             if n.type=="TEX_IMAGE" and n.image}
    palette=shape.get("palette",[])
    darkest={}
    for atlas in atlases:
        pixels=list(atlas.pixels)
        order=[]
        for i in range(0,len(pixels),4):
            old=tuple(pixels[i+j] for j in range(3))
            current=old
            if palette:
                best=min(palette,key=lambda rgb:sum((a-b/255)**2 for a,b in zip(old,rgb)))
                distance=math.sqrt(sum((a-b/255)**2 for a,b in zip(old,best)))
                weight=.48 if distance<.23 else .24
                current=tuple(a*(1-weight)+b/255*weight for a,b in zip(old,best))
            level=sum(v*w for v,w in zip(current,(.24,.71,.05)))
            tone=shape.get("tone",0) * max(0,1-abs(level-.46)*1.7)
            contrast=shape.get("contrast",1)
            color=[clamp((value-.44)*contrast+.44+tone) for value in current]
            pixels[i:i+3]=color
            if i//4 < 60:
                order.append((sum(color),i//4))
        atlas.pixels[:]=pixels
        atlas.pack()
        index=min(order)[1]
        w,h=atlas.size
        darkest[atlas]=((index%w+.5)/w,(index//w+.5)/h)
    return materials,darkest


def retouch(mesh,rig,shape,atlases):
    region=shape.get("paintRegion")
    foot=shape.get("extremities")
    sprite_colors=shape.get("palette",[])
    layer=mesh.data.uv_layers.active
    if not (region or foot) or not sprite_colors or len(atlases)!=1 or layer is None:
        return
    atlas=next(iter(atlases))
    width,height=atlas.size
    if width*height<64:
        return
    shades=sorted(sprite_colors,key=lambda rgb: sum(c*w for c,w in zip(rgb,(.24,.71,.05))))
    paint=list(atlas.pixels)
    picks={"dark":shades[min(1,len(shades)-1)],"light":shades[-1]}
    for texel,pick in enumerate(picks.values(),start=62):
        paint[texel*4:texel*4+3]=[c/255 for c in pick]
    atlas.pixels[:]=paint
    atlas.pack()
    uv={key:((index%width+.5)/width,(index//width+.5)/height)
        for index,key in enumerate(picks,start=62)}
    bounds=[(min(v.co[i] for v in mesh.data.vertices),max(v.co[i] for v in mesh.data.vertices))
            for i in range(3)]
    head=rig.data.bones.get("head")
    if head is None:
        head=rig.data.bones.get("section.00")
    groups={v.index:v.name for v in mesh.vertex_groups}
    for polygon in mesh.data.polygons:
        point=polygon.center
        u=[(point[i]-lo)/max(.001,hi-lo) for i,(lo,hi) in enumerate(bounds)]
        n=polygon.normal
        shade=None
        if region=="collar" and head is not None:
            shoulder=head.head_local.y-(bounds[1][1]-bounds[1][0])*.09
            if abs(point.y-shoulder)<(bounds[1][1]-bounds[1][0])*.046 and u[2]>.32:
                shade="light"
        elif region=="bib" and u[1]>.58 and .25<u[2]<.64 and abs(u[0]-.5)<.24 and n.y>.28:
            shade="light"
        elif region in ("dark-back","pale-back") and  .18<u[1]<.70 and u[2]>.56 and n.z>.41:
            shade="dark" if region=="dark-back" else "light"
        elif region=="patches" and abs(n.x)>.39 and .21<u[2]<.72:
            y=(u[1]*4.7+math.floor(u[2]*4)*.41)%1-.5
            z=(u[2]*3.8+math.floor(u[1]*5)*.29)%1-.5
            if y*y+z*z<.052:
                shade="dark"
        if foot and u[2]<.21 and any(
            any(k in groups.get(weight.group,"") for k in ("paw","hoof","foot","leg"))
            for i in polygon.vertices for weight in mesh.data.vertices[i].groups
            if weight.weight>.39
        ):
            shade=foot
        if shade:
            for index in polygon.loop_indices:
                layer.data[index].uv=uv[shade]


def group_warp(mesh,rig,shape):
    bones=rig.data.bones
    groups={vg.index:bones.get(vg.name) for vg in mesh.vertex_groups}
    for vert in mesh.data.vertices:
        general=Vector((0,0,0))
        weight=0
        for group in vert.groups:
            bone=groups.get(group.group)
            if bone is None or not group.weight:
                continue
            label=bone.name.lower()
            pos=vert.co.copy()
            center=bone.head_local
            offset=pos-center
            if "ear" in label and "ear" in shape:
                pos=center+offset*shape["ear"]
            elif label in ("head","jaw","bill") and ("head" in shape or "front" in shape):
                size=shape.get("head",1)
                pos=center+Vector((offset.x*size,offset.y*size*shape.get("front",1),offset.z*size))
            elif any(s in label for s in ("tail","fluke","fan")) and "tail" in shape:
                size=shape["tail"]
                pos=center+Vector((offset.x*size,offset.y*(.48+.52*size),offset.z*size))
            elif any(s in label for s in ("wing","fin","flipper","case","tip.")) and "wings" in shape:
                axis=(bone.tail_local-center).normalized()
                axial=axis*offset.dot(axis)
                pos=center+axial+(offset-axial)*shape["wings"]
            elif any(s in label for s in ("leg","paw","hoof","foot","hind","fore")) and "limbs" in shape:
                axis=(bone.tail_local-center).normalized()
                axial=axis*offset.dot(axis)
                pos=center+axial+(offset-axial)*shape["limbs"]
            elif label in ("body","abdomen") and "trunkDepth" in shape:
                pos.z=center.z+offset.z*shape["trunkDepth"]
            if label=="head" and "ear" in shape and offset.z>.09:
                pos.z+=(offset.z-.09)*(shape["ear"]-1)
            general+=pos*group.weight
            weight+=group.weight
        if weight>0:
            vert.co=general/weight
    mesh.data.update()
    rig.scale.x*=shape.get("width",1)
    rig.scale.y*=shape.get("length",1)
    rig.scale.z*=shape.get("height",1)


def strengthen_actions(rig,coefficient):
    if coefficient==1:
        return
    for action in bpy.data.actions:
        if action.name.lower()=="idle":
            continue
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    rotations={}
                    for curve in bag.fcurves:
                        if curve.data_path.endswith("rotation_quaternion"):
                            rotations.setdefault(curve.data_path,{})[curve.array_index]=curve
                        elif curve.data_path.endswith("location") and any(
                            f'["{name}"]' in curve.data_path for name in ("body","head","jaw","fluke","tail")):
                            keys=curve.keyframe_points
                            if len(keys)<2:
                                continue
                            anchor=keys[0].co.y
                            for key in keys:
                                key.co.y=anchor+(key.co.y-anchor)*coefficient
                            curve.update()
                    for data_path,curves in rotations.items():
                        if len(curves)!=4 or not len(curves[0].keyframe_points):
                            continue
                        keys=[curves[i].keyframe_points for i in range(4)]
                        base=Quaternion(tuple(lane[0].co.y for lane in keys)).normalized()
                        inv=base.inverted()
                        prev=base
                        strength=1+(coefficient-1)*(.52 if "leg" in data_path or "foot" in data_path else 1)
                        for frame in range(len(keys[0])):
                            q=Quaternion(tuple(lane[frame].co.y for lane in keys)).normalized()
                            q.make_compatible(base)
                            delta=inv@q
                            axis,angle=delta.to_axis_angle()
                            q=base@Quaternion(axis,min(math.pi,max(0,angle*strength)))
                            q.make_compatible(prev)
                            for lane,value in zip(keys,q):
                                lane[frame].co.y=value
                            prev=q
                        for curve in curves.values():
                            curve.update()


def add_contour(mesh,thickness,materials,darkest):
    if not thickness or len(materials)!=1 or len(darkest)!=1:
        return
    material=next(iter(materials))
    uv=next(iter(darkest.values()))
    if not mesh.data.uv_layers.active:
        return
    material.use_backface_culling=True
    contour=mesh.copy()
    contour.data=mesh.data.copy()
    contour.name=mesh.name+" · contour"
    bpy.context.collection.objects.link(contour)
    for vertex in contour.data.vertices:
        vertex.co+=vertex.normal*thickness
    contour.data.flip_normals()
    for loop in contour.data.uv_layers.active.data:
        loop.uv=uv
    bpy.ops.object.select_all(action="DESELECT")
    contour.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.join()


def main():
    source, dest=(Path(p).resolve() for p in sys.argv[sys.argv.index("--")+1:])
    spec=json.loads((dest/"revision.json").read_text())
    shape=spec["shape"]
    bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False)
    rig=next(o for o in bpy.data.objects if o.type=="ARMATURE")
    mesh=next(o for o in bpy.data.objects if o.type=="MESH")
    group_warp(mesh,rig,shape)
    materials,darkest=packed_palette(shape)
    retouch(mesh,rig,shape,darkest)
    strengthen_actions(rig,shape.get("motion",1))
    add_contour(mesh,shape.get("outline"),materials,darkest)
    scene=bpy.context.scene
    scene["Campaign revision"]="; ".join(spec["changes"])
    scene.frame_set(scene.frame_start)
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(dest/"model.blend"))
    glb=dest/"model.glb"
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",export_yup=True,
        export_animation_mode="ACTIONS",export_frame_range=False,export_def_bones=True,
        export_leaf_bone=False,export_texcoords=True)
    blob=glb.read_bytes()
    n,=struct.unpack_from("<I",blob,12)
    data=json.loads(blob[20:20+n])
    primitives=[p for m in data["meshes"] for p in m["primitives"]]
    assert data.get("animations") and data.get("skins")
    report={"blender":bpy.app.version_string,"candidate":2,"triangles":sum(
        data["accessors"][p["indices"]]["count"]//3 for p in primitives),"glbBytes":len(blob),
        "materials":len(data["materials"]),"primitives":len(primitives),
        "actions":[x["name"] for x in data["animations"]],"brief":spec["changes"]}
    (dest/"report.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report))


if __name__=="__main__":
    main()
