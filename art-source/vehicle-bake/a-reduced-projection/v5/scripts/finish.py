"""Nearest sample real mesh renders; alpha-only inward outline. No interior patches."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,sys,struct,hashlib
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir());REV=sys.argv[1] if len(sys.argv)>1 else 'v1'
O=ROOT/'public/demos/vehicle-bake/a-reduced-projection'/REV
A=ROOT/'art-source/vehicle-bake/a-reduced-projection'/REV
assert not (O/'report.json').exists() or json.loads((O/'report.json').read_text()).get('status')!='complete','Finished revision is immutable'
BG=(31,34,45);FG=(235,235,240)
def tile(im,scale=1):
 im=im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST);out=Image.new('RGB',im.size,BG);out.paste(im,(0,0),im);return out
def final(raw):
 im=Image.new('RGBA',(128,128));im.paste(raw.resize((128,128),Image.Resampling.NEAREST),(0,28));p=im.load()
 # Alpha only. Never infer interior features from source sprites.
 occupied={(x,y) for y in range(128) for x in range(128) if p[x,y][3]>=128}
 for y in range(128):
  for x in range(128):
   if (x,y) not in occupied:p[x,y]=(0,0,0,0)
   elif any((x+dx,y+dy) not in occupied for dx,dy in ((-1,0),(1,0),(0,-1),(0,1))):p[x,y]=(58,58,80,255)
   else:p[x,y]=(*p[x,y][:3],255)
 return im
views=[];targets=[]
for i in range(8):
 im=final(Image.open(O/f'raw-{i}.png').convert('RGBA'));im.save(O/f'view-{i}.png');views.append(im)
 targets.append(Image.open(A/f'evidence/inputs/target-{i}.png').convert('RGBA'))
sheet=Image.new('RGB',(1536,1440),BG);d=ImageDraw.Draw(sheet)
for i in range(8):
 x=(i%4)*384;y=(i//4)*720;d.text((x+12,y+10),f'{i*45} deg / target then actual low mesh',fill=FG)
 sheet.paste(tile(targets[i],2),(x+64,y+36));sheet.paste(tile(views[i],2),(x+64,y+310));sheet.paste(tile(views[i]),(x+128,y+580))
sheet.save(O/'comparison.png')
native=Image.new('RGBA',(1024,128))
for i,im in enumerate(views):native.paste(im,(i*128,0))
native.save(O/'sheet.png')
frames=[]
for i,im in enumerate(views):
 f=Image.new('RGB',(512,544),BG);f.paste(tile(im,4),(0,24));ImageDraw.Draw(f).text((12,8),f'LOW MESH {i*45} degrees / {REV}',fill=FG);frames.append(f)
frames[0].save(O/'turntable.gif',save_all=True,append_images=frames[1:],duration=220,loop=0,disposal=2,optimize=False)
b=(O/'model.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);meshes=g['meshes'];access=g['accessors'];primitives=[p for m in meshes for p in m['primitives']]
stats={'triangles':sum(access[p['indices']]['count']//3 for p in primitives),'meshes':len(meshes),'materials':len(g.get('materials',[])),'primitives':len(primitives),'vertices':sum(access[p['attributes']['POSITION']]['count'] for p in primitives),'glbBytes':len(b),'textureBytes':sum(g['bufferViews'][im['bufferView']]['byteLength'] for im in g['images']),'extensionsUsed':g.get('extensionsUsed'),'nodes':g['nodes'],'atlasSize':[512,512]}
(A/'evidence/export-stats.json').write_text(json.dumps(stats,indent=2)+'\n');print(json.dumps({k:v for k,v in stats.items() if k!='nodes'},indent=2))
recipe=json.loads((A/'recipe.json').read_text());transfer=json.loads((A/'evidence/transfer.json').read_text())
report={'status':'awaiting-inspection','route':'a-reduced-projection','revision':REV,'method':'Per-component QEM on retained approach-3 source; exact owner and visibility-tested eight-view projection; source-owned atlas cleanup; five consolidated meshes.','exportWorldScale':80/4.6,'geometry':{k:v for k,v in stats.items() if k!='nodes'},'wheels':recipe['wheels'],'sourceHashes':json.loads((A/'evidence/source-hashes.json').read_text()),'sourcePath':str((A/'car.blend').relative_to(ROOT)).replace('\\','/'),'recipePath':str((A/'recipe.json').relative_to(ROOT)).replace('\\','/'),'transfer':transfer,'validation':{'allEightRendered':True,'nativePixelMethod':'512px actual mesh -> nearest128 -> constant (0,+28) -> alpha-only inward outline','actualGLBMetadataParsed':True,'binaryAlpha':all(set(im.getchannel('A').getdata())<={0,255} for im in views)},'visualInspection':[],'limitations':['Owner art acceptance pending.','Target drawings contain view-dependent reflection and body shades; atlas commits to one surface colour.','Unknown/hidden texels explicitly filled by source palette semantic roles.','Steering held neutral; no nonzero-steer clearance claim.'],'replayCommands':[f'python scripts/vehicle-bake/a-reduced-projection/prepare.py {REV}',f'& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/a-reduced-projection/build.py -- NEW_REVISION {recipe["budgetFactor"]}',f'python scripts/vehicle-bake/a-reduced-projection/finish.py NEW_REVISION']}
(O/'report.json').write_text(json.dumps(report,indent=2)+'\n')
