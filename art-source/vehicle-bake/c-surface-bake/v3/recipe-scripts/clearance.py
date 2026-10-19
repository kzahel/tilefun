"""Actual exported GLB: neutral-roll swept cylinder vs every body triangle.
Background Blender, 4 threads. No steering qualification. Deliberate intersecting
triangle control proves the predicate rejects a body intruding into a wheel.
"""
import bpy,json,sys,math,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').exists() and (p/'package.json').exists());REV=sys.argv[sys.argv.index('--')+1]
OUT=ROOT/'public/demos/vehicle-bake/c-surface-bake'/REV;ART=ROOT/'art-source/vehicle-bake/c-surface-bake'/REV
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'model.glb'));bpy.context.view_layer.update()
def clip(poly,axis,bound,direction):
 if not poly:return []
 result=[];previous=poly[-1];prev_in=direction*(previous[axis]-bound)>=-1e-7
 for current in poly:
  inside=direction*(current[axis]-bound)>=-1e-7
  if inside!=prev_in:result.append(previous.lerp(current,(bound-previous[axis])/(current[axis]-previous[axis])))
  if inside:result.append(current)
  previous,prev_in=current,inside
 return result
def radial(poly,center):
 pts=[(p.x-center.x,p.z-center.z) for p in poly];cross=[];dist=[]
 for a,b in zip(pts,pts[1:]+pts[:1]):
  cross.append(a[0]*b[1]-a[1]*b[0]);dx=b[0]-a[0];dy=b[1]-a[1];l=dx*dx+dy*dy;t=min(1,max(0,-(a[0]*dx+a[1]*dy)/l)) if l else 0;dist.append(math.hypot(a[0]+t*dx,a[1]+t*dy))
 if abs(sum(cross))>1e-9 and (all(v>=-1e-7 for v in cross) or all(v<=1e-7 for v in cross)):return 0
 return min(dist)
body=bpy.data.objects['Body'];body.data.calc_loop_triangles();bv=[body.matrix_world@v.co for v in body.data.vertices];bt=[[bv[i] for i in t.vertices] for t in body.data.loop_triangles]
records=[]
for wid in ('FL','FR','RL','RR'):
 roll=bpy.data.objects['Wheel_'+wid+'_Roll'];wheel=bpy.data.objects['Wheel_'+wid+'_TireHub'];center=roll.matrix_world.translation;wv=[wheel.matrix_world@v.co for v in wheel.data.vertices];lo=min(v.y for v in wv);hi=max(v.y for v in wv);radius=max(math.hypot(v.x-center.x,v.z-center.z) for v in wv)
 gaps=[]
 for i,t in enumerate(bt):
  poly=clip(clip(t,1,lo,1),1,hi,-1)
  if poly:gaps.append((radial(poly,center)-radius,i))
 minimum,index=min(gaps);ground=min(v.z for v in wv)
 # A uniform cylinder can conservatively touch the sloping rear buttress while
 # the rounded tire shoulder is clear. Enclose the complete rolling mesh by a
 # concave upper hull in (axle Y, radial radius), then bound narrow axial slabs.
 # Convexity of radial norm guarantees every wheel triangle lies under this hull.
 stations={}
 for v in wv:
  yy=round(v.y,5);stations[yy]=max(stations.get(yy,0),math.hypot(v.x-center.x,v.z-center.z))
 hull=[]
 for point in sorted(stations.items()):
  while len(hull)>1:
   a,b=hull[-2:];c=point
   if (b[1]-a[1])*(c[0]-b[0]) <= (c[1]-b[1])*(b[0]-a[0]):hull.pop()
   else:break
  hull.append(point)
 def envelope(y):
  for (a,ra),(b,rb) in zip(hull,hull[1:]):
   if y<=b:return ra+(rb-ra)*min(1,max(0,(y-a)/(b-a)))
  return hull[-1][1]
 envelope_gaps=[];slab_count=192
 for k in range(slab_count):
  aa=lo+(hi-lo)*k/slab_count;bb=lo+(hi-lo)*(k+1)/slab_count
  rr=max(envelope(aa),envelope(bb),*[r for y,r in hull if aa<y<bb])+1e-4
  for i,t in enumerate(bt):
   if min(p.y for p in t)>bb or max(p.y for p in t)<aa:continue
   poly=clip(clip(t,1,aa,1),1,bb,-1)
   if poly:envelope_gaps.append((radial(poly,center)-rr,i))
 exact_gap,exact_index=min(envelope_gaps)
 control=[center+Vector((-.1,0,-.1)),center+Vector((.1,0,-.1)),center+Vector((0,0,.1))];negative=radial(control,center)-radius<0
 records.append({'id':wid,'radiusWorld':radius,'groundZ':ground,'axialSlab':[lo,hi],'conservativeFullCylinderGapWorld':minimum,'fullCylinderClosestTriangleSource':[[v/(80/4.6) for v in p] for p in bt[index]],'minimumBodyGapWorld':exact_gap,'minimumBodyGapSource':exact_gap/(80/4.6),'closestBodyTriangle':exact_index,'bodyTrianglesInSlab':len(gaps),'rollingEnvelopeUpperHull':hull,'axialSlabCount':slab_count,'radiusBoundSlackWorld':.0001,'deliberateIntrusionRejected':negative,'pass':minimum>=-1e-5 and ground>=-1e-5 and negative})
report={'glbHash':hashlib.sha256((OUT/'model.glb').read_bytes()).hexdigest(),'method':'Actual exported tire/hub rolling volume is enclosed by concave upper hull of axle-position/radius for all vertices (radial norm convexity bounds triangle interiors). Divide its axle slab into 192 slices; clip every body triangle and compare its exact radial polygon distance with the maximum envelope radius per slice, plus 0.0001 world slack. Positive gaps prove all neutral roll angles. Uniform-cylinder results are also retained.','steeringQualified':False,'wheels':records,'pass':all(r['pass'] for r in records)}
(ART/'clearance.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
