"""Pixel reduction, alpha-only ink, exact GLB audit and review evidence.
No interior pixel edits: interior style is entirely in model.glb/atlas.png.
"""
import json, math, hashlib, shutil, struct, argparse, io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np

ROOT=next(p for p in Path(__file__).resolve().parents if (p/'scripts/vehicle-bake/README.md').is_file());ROUTE='b-authored-semantic'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read_glb(path):
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);off=20+n
 size,kind=struct.unpack_from('<II',b,off);assert kind==0x004e4942
 return g,b[off+8:off+8+size]
def accessor(g,b,i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dt={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']]
 stride=v.get('byteStride',np.dtype(dt).itemsize*dim)
 return np.ndarray((a['count'],dim),dtype=dt,buffer=b,offset=offset,strides=(stride,np.dtype(dt).itemsize)).copy()
def local(node):
 if 'matrix' in node:return np.array(node['matrix']).reshape((4,4)).T
 x,y,z,w=node.get('rotation',[0,0,0,1]);m=np.eye(4)
 m[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])@np.diag(node.get('scale',[1,1,1]))
 m[:3,3]=node.get('translation',[0,0,0]);return m
def transforms(g,overrides=None):
 parents={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])};cache={}
 def go(i):
  if i not in cache:
   l=local(g['nodes'][i]);l=l@(overrides or {}).get(i,np.eye(4));cache[i]=(go(parents[i]) if i in parents else np.eye(4))@l
  return cache[i]
 return [go(i) for i in range(len(g['nodes']))]
def positions(g,b,world):
 ret={}
 for i,n in enumerate(g['nodes']):
  if 'mesh' not in n:continue
  ps=[]
  for p in g['meshes'][n['mesh']]['primitives']:
   v=accessor(g,b,p['attributes']['POSITION']);ps.append((world[i]@np.c_[v,np.ones(len(v))].T).T[:,:3])
  ret[i]=np.concatenate(ps)
 return ret
def clip(poly,axis,limit,keep_greater):
 result=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=a[axis]-limit;db=b[axis]-limit;ia=da>=-1e-8 if keep_greater else da<=1e-8;ib=db>=-1e-8 if keep_greater else db<=1e-8
  if ia:result.append(a)
  if ia!=ib:result.append(a+(b-a)*(da/(da-db)))
 return result
def radial_min(poly,c):
 pts=[p[[0,1]]-c for p in poly] # glTF XY is wheel radial plane; Z is axle.
 if not pts:return math.inf
 cross=lambda a,b:a[0]*b[1]-a[1]*b[0]
 signs=[cross(b-a,-a) for a,b in zip(pts,pts[1:]+pts[:1])]
 if all(s>=-1e-8 for s in signs) or all(s<=1e-8 for s in signs):
  # Degenerate projected polygons should not be classified as covering the origin.
  area=sum(cross(a,b) for a,b in zip(pts,pts[1:]+pts[:1]))
  if abs(area)>1e-7:return 0.
 dist=math.inf
 for a,b in zip(pts,pts[1:]+pts[:1]):
  d=b-a;t=max(0,min(1,-np.dot(a,d)/max(1e-20,np.dot(d,d))));dist=min(dist,float(np.linalg.norm(a+t*d)))
 return dist
def audit(path):
 g,b=read_glb(path);world=transforms(g);verts=positions(g,b,world);byname={n.get('name'):i for i,n in enumerate(g['nodes'])}
 stats=[]
 for m in g['meshes']:
  for p in m['primitives']:
   stats.append({'mesh':m.get('name'),'triangles':g['accessors'][p['indices']]['count']//3,'vertices':g['accessors'][p['attributes']['POSITION']]['count']})
 assert len(g['materials'])==1 and 'KHR_materials_unlit' in g['materials'][0].get('extensions',{})
 assert g['materials'][0].get('alphaMode','OPAQUE')=='OPAQUE'
 assert len(g['meshes'])==5 and len(stats)==5
 assert len(g['images'])==1 and 'bufferView' in g['images'][0]
 radius=.34*80/4.6;wheels=[];body_i=byname['Body'];body=verts[body_i]
 body_p=g['meshes'][g['nodes'][body_i]['mesh']]['primitives'][0];indices=accessor(g,b,body_p['indices']).flatten().reshape((-1,3))
 all_clear=True
 for tag in ('FL','FR','RL','RR'):
  si=byname[f'Wheel_{tag}_Steer'];ri=byname[f'Wheel_{tag}_Roll'];wi=byname[f'Wheel_{tag}_tire_hub']
  assert ri in g['nodes'][si]['children'] and wi in g['nodes'][ri]['children']
  se=g['nodes'][si]['extras'];re=g['nodes'][ri]['extras']
  assert se['steering_enabled']==tag.startswith('F') and se['steer_axis_gltf']==[0,1,0]
  assert re['roll_axis_gltf']==[0,0,-1] and abs(re['wheel_radius']-radius)<1e-6
  center=world[ri][:3,3];v=verts[wi];radial=np.linalg.norm(v[:,:2]-center[:2],axis=1)
  assert abs(radial.max()-radius)<2e-5 and abs(v[:,1].min())<2e-5
  z0,z1=v[:,2].min(),v[:,2].max();mind=math.inf
  for tri in body[indices]:
   poly=clip(list(tri),2,z0,True)
   if poly:poly=clip(poly,2,z1,False)
   if poly:mind=min(mind,radial_min(poly,center[:2]))
  clear=mind>radius+1e-4;all_clear&=clear
  # Actual glTF node axis, independent rotation, and absolute reset.
  th=.63;rot=np.eye(4);rot[:3,:3]=[[math.cos(th),math.sin(th),0],[-math.sin(th),math.cos(th),0],[0,0,1]]
  moved=positions(g,b,transforms(g,{ri:rot}));changed=[g['nodes'][i]['name'] for i in verts if not np.allclose(moved[i],verts[i],atol=1e-5)]
  assert changed==[f'Wheel_{tag}_tire_hub']
  reset=positions(g,b,transforms(g,{ri:np.eye(4)}));assert all(np.allclose(reset[i],verts[i]) for i in verts)
  wheels.append({'wheel':tag,'centerGltfWorld':center.tolist(),'radiusWorld':radius,'groundMinY':float(v[:,1].min()),'minimumBodyEnvelopeClearanceWorld':mind-radius,'clearancePassed':clear,'independentRollPassed':True,'resetPassed':True})
 assert all_clear,'Actual exported body enters a wheel swept cylinder'
 # Deliberately displaced triangle proves that the envelope predicate catches intrusion.
 c=np.array(wheels[0]['centerGltfWorld']);bad=[c+[-1,-1,0],c+[1,-1,0],c+[0,1,0]]
 assert radial_min(bad,c[:2])<radius
 bounds=np.concatenate(list(verts.values()));iv=g['bufferViews'][g['images'][0]['bufferView']];texture=iv['byteLength'];start=iv.get('byteOffset',0)
 embedded=Image.open(io.BytesIO(b[start:start+texture])).convert('RGB');atlas=Image.open(path.parent/'atlas.png').convert('RGB') if (path.parent/'atlas.png').exists() else None
 if atlas is not None:assert embedded.size==atlas.size and embedded.tobytes()==atlas.tobytes()
 return {'triangles':sum(p['triangles'] for p in stats),'exportedVertices':sum(p['vertices'] for p in stats),'meshCount':len(g['meshes']),'materialCount':len(g['materials']),'primitiveCount':len(stats),'textureBytes':texture,'glbBytes':path.stat().st_size,'perMesh':stats,'wheels':wheels,'boundsGltf':{'min':bounds.min(axis=0).tolist(),'max':bounds.max(axis=0).tolist(),'size':np.ptp(bounds,axis=0).tolist()},'unlit':True,'embeddedAtlas':True,'embeddedAtlasPixelHash':hashlib.sha256(embedded.tobytes()).hexdigest(),'wheelCylinderNegativeProbePassed':True,'actualExportWheelClearancePassed':bool(all_clear)}

def pixels(path):
 raw=Image.open(path).convert('RGBA').resize((128,128),Image.Resampling.NEAREST)
 out=Image.new('RGBA',(128,128));out.paste(raw,(0,28))
 # Threshold alpha only; no colour quantization, cleanup or interior repaint.
 a=out.getchannel('A').point(lambda v:255 if v>=128 else 0);out.putalpha(a)
 edge=ImageChops.subtract(a,a.filter(ImageFilter.MinFilter(3)))
 out.paste((58,58,80,255),(0,0),edge)
 return out
def panel_bg(size):
 im=Image.new('RGBA',size,(28,32,42,255));d=ImageDraw.Draw(im)
 for y in range(0,size[1],8):
  for x in range(0,size[0],8):
   if (x//8+y//8)%2:d.rectangle((x,y,x+7,y+7),fill=(34,39,50,255))
 return im
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--revision',default='v1');ap.add_argument('--complete',action='store_true');args=ap.parse_args()
 src=ROOT/'art-source/vehicle-bake'/ROUTE/args.revision;out=ROOT/'public/demos/vehicle-bake'/ROUTE/args.revision;data=ROOT/'data/vehicle-bake'/ROUTE/args.revision
 if (src/'complete.lock.json').exists():raise SystemExit('Immutable finished candidate')
 shutil.copyfile(src/'atlas.png',out/'atlas.png')
 stats=audit(out/'model.glb');cfg=json.loads((src/'recipe.json').read_text());build=json.loads((data/'build.json').read_text());views=[];refs=[];ious=[]
 evidence=src/'evidence';evidence.mkdir(exist_ok=True)
 target=ROOT/'public/demos/vehicle-style-study/03-guide-pixel-finish'
 for i in range(8):
  v=pixels(data/f'raw-{i}.png');v.save(out/f'view-{i}.png');views.append(v)
  ref=Image.open(target/f'view-{i}.png').convert('RGBA');refs.append(ref)
  a=np.array(v)[:,:,3]>0;b=np.array(ref)[:,:,3]>0;ious.append(float(np.logical_and(a,b).sum()/np.logical_or(a,b).sum()))
  shutil.copyfile(data/f'raw-{i}.png',evidence/f'actual-glb-512-{i}.png')
  shutil.copyfile(target/f'view-{i}.png',evidence/f'target-{i}.png')
 sheet=Image.new('RGBA',(1024,576),(22,25,34));d=ImageDraw.Draw(sheet);d.text((12,8),f'B / authored approach-3 coupe / {args.revision} / {stats["triangles"]} exported triangles',fill='white')
 for i,v in enumerate(views):
  tile=panel_bg((256,256));tile.alpha_composite(v.resize((256,256),Image.Resampling.NEAREST));x=(i%4)*256;y=32+(i//4)*272;sheet.alpha_composite(tile,(x,y));d.text((x+8,y+8),f'{i}: yaw {45*i}',fill='white')
 sheet.save(out/'sheet.png')
 native=Image.new('RGBA',(512,288),(22,25,34))
 for i,v in enumerate(views):
  tile=panel_bg((128,128));tile.alpha_composite(v);native.alpha_composite(tile,((i%4)*128,32+(i//4)*128))
 ImageDraw.Draw(native).text((8,8),'Actual GLB / eight native 128px canvases',fill='white');native.save(out/'sheet-native.png')
 contour=Image.new('RGBA',(1024,544),(22,25,34))
 for i,(v,ref) in enumerate(zip(views,refs)):
  a=np.array(v)[:,:,3]>0;b=np.array(ref)[:,:,3]>0;rgb=np.zeros((128,128,4),dtype=np.uint8)
  rgb[a&b]=[85,90,110,255];rgb[b&~a]=[255,95,75,255];rgb[a&~b]=[75,195,255,255]
  tile=panel_bg((256,256));tile.alpha_composite(Image.fromarray(rgb).resize((256,256),Image.Resampling.NEAREST));contour.alpha_composite(tile,((i%4)*256,32+(i//4)*256))
 ImageDraw.Draw(contour).text((8,8),'Silhouette: gray shared / red target-only / cyan mesh-only',fill='white');contour.save(out/'contour-diff.png')
 comparison=Image.new('RGBA',(1024,1120),(22,25,34));dc=ImageDraw.Draw(comparison)
 dc.text((12,8),'B / target above, actual low GLB below / fixed camera and translation / no interior screen edits',fill='white')
 for i in range(8):
  x=(i%4)*256;y=32+(i//4)*544
  for j,v in enumerate((refs[i],views[i])):
   tile=panel_bg((256,256));tile.alpha_composite(v.resize((256,256),Image.Resampling.NEAREST));comparison.alpha_composite(tile,(x,y+j*256))
  dc.text((x+6,y+4),f'view {i} / target',fill='white');dc.text((x+6,y+260),f'actual GLB / IoU {ious[i]:.3f}',fill='white')
 comparison.save(out/'comparison.png')
 # Full 4x native inspection includes all eight views.
 four=Image.new('RGBA',(2048,1056),(22,25,34))
 for i,v in enumerate(views):
  tile=panel_bg((512,512));tile.alpha_composite(v.resize((512,512),Image.Resampling.NEAREST));four.alpha_composite(tile,((i%4)*512,32+(i//4)*512))
 ImageDraw.Draw(four).text((12,8),'Actual reimported GLB / all eight views / 4x nearest',fill='white');four.save(out/'inspect-4x.png')
 frames=[]
 for v in views:
  f=panel_bg((128,128));f.alpha_composite(v);frames.append(f.convert('RGB'))
 frames[0].save(out/'turntable.gif',save_all=True,append_images=frames[1:],duration=220,loop=0,disposal=2)
 novel=Image.new('RGBA',(1024,544),(22,25,34))
 for j,pattern in enumerate(('novel-*.png','roll-*.png')):
  for i,p in enumerate(sorted(data.glob(pattern))):
   v=pixels(p);v.save(evidence/p.name);tile=panel_bg((256,256));tile.alpha_composite(v.resize((256,256),Image.Resampling.NEAREST));novel.alpha_composite(tile,(i*256,32+j*256));ImageDraw.Draw(novel).text((i*256+5,34+j*256),p.stem,fill='white')
 novel.save(out/'novel-and-roll.png')
 wire_sheet=Image.new('RGBA',(1024,288),(22,25,34))
 for i,p in enumerate(sorted(data.glob('wire-*.png'))):
  v=pixels(p);tile=panel_bg((256,256));tile.alpha_composite(v.resize((256,256),Image.Resampling.NEAREST));wire_sheet.alpha_composite(tile,(i*256,32));shutil.copyfile(p,evidence/p.name)
 ImageDraw.Draw(wire_sheet).text((8,8),'Actual exported triangulated topology / proof material only',fill='white');wire_sheet.save(out/'wireframe.png')
 shutil.copyfile(src/'atlas.png',out/'atlas.png');shutil.copyfile(data/'build.json',evidence/'build.json')
 sources=[ROOT/'scripts/vehicle-style-study/03-guide-pixel-finish/build.py',ROOT/'scripts/vehicle-style-study/03-guide-pixel-finish/finish.py',ROOT/'art-source/vehicle-style-study/03-guide-pixel-finish/sports-coupe.blend',ROOT/'art-source/vehicle-style-study/03-guide-pixel-finish/evidence/scene.json']
 sources += [target/f'view-{i}.png' for i in range(8)]
 sources += list((ROOT/'art-source/vehicle-style-study/03-guide-pixel-finish/evidence/guides').glob('*-128.png'))
 own=Path(__file__).parent
 report={'status':'complete' if args.complete else 'awaiting-visual-inspection','route':ROUTE,'revision':args.revision,'method':cfg['method'],**stats,'atlasSize':[512,512],'exportWorldScale':80/4.6,'sourceDimensions':'4.6 body length; exact source width/deck/cabin landmarks, wheels/mirrors extend to approximately 2.066 width',
 'sourceHashes':{str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in sources},'ownSource':str(src.relative_to(ROOT)).replace('\\','/'),'recipe':str((src/'recipe.json').relative_to(ROOT)).replace('\\','/'),
 'scriptHashes':{p.name:sha(p) for p in own.glob('*.py')},'silhouetteIoU':ious,'paintOwnership':cfg['ownership'],'uncertainty':cfg['uncertainty'],
 'actualValidation':['Parsed actual GLB indices/attributes, five draw primitives, one embedded opaque atlas material, KHR_materials_unlit.','Actual GLB independently reimported into Blender for all eight fixed headings, four intermediate headings, and four roll angles.','Each actual GLB wheel was rotated independently about declared glTF -Z; other wheel/body vertices unchanged; absolute reset checked.','Every actual body triangle clipped against each wheel axial slab; swept radius-.34 cylinder does not intersect body; negative triangle-insertion probe detects intrusion.','Only nearest reduction, fixed (0,+28) translation, alpha threshold and one-pixel inward alpha-boundary ink applied to final pixels.'],
 'visualInspection':[], 'sourceMeshStats':build.get('sourceMeshStats',[]),'sourceVertices':sum(m['vertices'] for m in build.get('sourceMeshStats',[])),
 'vertexSplitOverhead':stats['exportedVertices']-sum(m['vertices'] for m in build.get('sourceMeshStats',[])), 'packedSourceAtlas':build.get('packedAtlas',False),
 'transferLimitations':['Symmetric view-independent red ramp replaces direction-specific studio highlights in the eight target drawings.','Analytic semantic paint reauthors source feature ownership; not a raw projection of target drawings. No projected texels are claimed.','Tires are faceted at the budget; five-spoke paint replaces source high-detail forged geometry.','Continuous UV glass frames are surface-owned and cannot reproduce every direction-specific one-pixel cluster of 141.','Steering remains neutral; steering clearance and actual engine full-Chromium qualification belong to the coordinator.','UV discontinuities at Boolean pocket walls are explicit ink-owned cuts; unseen underside/tread paint is inferred.'],
 'replayCommands':[f'python scripts/vehicle-bake/{ROUTE}/paint.py --revision NEW',f'& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/{ROUTE}/build.py -- --revision NEW --budget {build["budget"]}',f'python scripts/vehicle-bake/{ROUTE}/finish.py --revision NEW'],
 'humanApproval':False,'coordinatorNext':'Render actual GLB with CarMeshAsset(scene,1,{batch:true}), fixed camera and shared alpha outline; register exact revision for owner review.'}
 (out/'report.json').write_text(json.dumps(report,indent=2)+'\n');(src/'export-audit.json').write_text(json.dumps(stats,indent=2)+'\n')
 print(json.dumps({'revision':args.revision,**{k:stats[k] for k in ('triangles','exportedVertices','meshCount','materialCount','primitiveCount','glbBytes')},'silhouetteIoU':ious,'wheelClearances':[w['minimumBodyEnvelopeClearanceWorld'] for w in stats['wheels']]},indent=2))
if __name__=='__main__':main()
