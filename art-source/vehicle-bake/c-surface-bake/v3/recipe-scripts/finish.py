"""Only nearest reduction, fixed translation and alpha-only exterior ink.
Interior pixels are never edited here. Read GLB metadata, assemble evidence.
"""
import json,sys,struct,hashlib,shutil
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').exists() and (p/'package.json').exists());REV=sys.argv[1] if len(sys.argv)>1 else 'v1'
OUT=ROOT/'public/demos/vehicle-bake/c-surface-bake'/REV;ART=ROOT/'art-source/vehicle-bake/c-surface-bake'/REV;DATA=ROOT/'data/vehicle-bake/c-surface-bake'/REV
BG=(27,30,40);FG=(238,235,226)
def reduced(path,outline=True):
 im=Image.open(path).convert('RGBA').resize((128,128),Image.Resampling.NEAREST);out=Image.new('RGBA',(128,128));out.paste(im,(0,28));p=out.load();visible={(x,y) for y in range(128) for x in range(128) if p[x,y][3]>=128}
 for y in range(128):
  for x in range(128):
   if (x,y) not in visible:p[x,y]=(0,0,0,0)
   elif outline and any((x+dx,y+dy) not in visible for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):p[x,y]=(58,58,80,255)
   else:p[x,y]=(*p[x,y][:3],255)
 return out
def tile(im,s=1):
 im=im.resize((im.width*s,im.height*s),Image.Resampling.NEAREST);bg=Image.new('RGB',im.size,BG);d=ImageDraw.Draw(bg)
 for y in range(0,im.height,16):
  for x in range(0,im.width,16):
   if (x//16+y//16)%2:d.rectangle((x,y,x+15,y+15),fill=(34,38,48))
 bg.paste(im,(0,0),im);return bg
frames=[];blender=[];target=[]
for i in range(8):
 b=reduced(DATA/f'low-{i}-512.png');b.save(OUT/f'view-{i}.png');blender.append(b)
 g=reduced(DATA/f'gltf-frames-{i}-512.png');g.save(OUT/f'gltf-view-{i}.png');frames.append(g)
 target.append(Image.open(ROOT/f'public/demos/vehicle-style-study/03-guide-pixel-finish/view-{i}.png').convert('RGBA'))
font=lambda size:ImageFont.load_default(size=size)
sheet=Image.new('RGB',(1536,2304),BG);d=ImageDraw.Draw(sheet)
for i in range(8):
 x=(i%2)*768;y=(i//2)*576;d.text((x+12,y+10),f'{i*45:03d} degrees / target | Blender low | GLB Chromium',font=font(17),fill=FG)
 for j,im in enumerate((target[i],blender[i],frames[i])):sheet.paste(tile(im,2),(x+j*256,y+40))
 sheet.paste(tile(frames[i],2),(x+256,y+304));d.text((x+12,y+318),'GLB again at 2x\nAll interior paint\ncomes from atlas.',font=font(15),fill=FG)
sheet.save(OUT/'comparison.png')
own=Image.new('RGB',(2048,1024),BG)
for i,im in enumerate(frames):own.paste(tile(im,4),((i%4)*512,(i//4)*512))
own.save(OUT/'gltf-eight-views-4x.png')
native=Image.new('RGB',(1024,128),BG)
for i,im in enumerate(frames):native.paste(tile(im),(i*128,0))
native.save(OUT/'native-eight-views.png')
gif=[tile(im,4) for im in frames];gif[0].save(OUT/'turntable.gif',save_all=True,append_images=gif[1:],duration=240,loop=0,disposal=2,optimize=False)
novel=Image.new('RGB',(2048,1024),BG)
for j in range(4):
 im=reduced(DATA/f'gltf-intermediate-{j}-512.png');novel.paste(tile(im,4),(j*512,0));im.save(OUT/f'intermediate-{j}.png')
 im=reduced(DATA/f'gltf-rolls-{j}-512.png');novel.paste(tile(im,4),(j*512,512));im.save(OUT/f'roll-{j}.png')
novel.save(OUT/'intermediate-and-roll.png')
# Inspect actual GLB, including flattened exported vertices (UV/normal splits).
blob=(OUT/'model.glb').read_bytes();length,kind=struct.unpack_from('<II',blob,12);gltf=json.loads(blob[20:20+length]);acc=gltf['accessors'];primitives=[p for m in gltf['meshes'] for p in m['primitives']]
stats={'triangles':sum(acc[p['indices']]['count']//3 for p in primitives),'meshCount':len(gltf['meshes']),'materialCount':len(gltf['materials']),'primitiveCount':len(primitives),'vertexCount':sum(acc[p['attributes']['POSITION']]['count'] for p in primitives),'nodeCount':len(gltf['nodes']),'glbBytes':len(blob),'atlasSize':list(Image.open(OUT/'atlas.png').size),'atlasBytes':(OUT/'atlas.png').stat().st_size,'unlit':all('KHR_materials_unlit' in m.get('extensions',{}) for m in gltf['materials']),'embeddedImages':all('bufferView' in im for im in gltf['images']),'imageCount':len(gltf['images'])}
build=json.loads((ART/'recipe.json').read_text());validation=json.loads((DATA/'gltf-validation.json').read_text());sourcehashes={str(p.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/build['source'],*[ROOT/f'public/demos/vehicle-style-study/03-guide-pixel-finish/view-{i}.png' for i in range(8)]]}
report={'status':'awaiting-inspection','route':'c-surface-bake','revision':REV,'method':build['method'],'exportWorldScale':80/4.6,**stats,'wheels':validation['rigs'],'sourceHashes':sourcehashes,'recipePath':str((ART/'recipe.json').relative_to(ROOT)).replace('\\','/'),'blendPath':str((ART/'car.blend').relative_to(ROOT)).replace('\\','/'),'transfer':build['transfer'],'validation':{'actualGlbChromium':validation,'allEightViewsRendered':True,'nativeViews':True,'intermediateHeadings':[22.5,67.5,112.5,157.5],'rollDegrees':[0,90,180,270],'canvasInteriorPatches':0},'limitations':['Source-space paint reauthors the guide finish: it does not reconstruct exact view-relative glass reflection strips.','Nearest fallback and opposing-ray ambiguity are retained in transfer.json and uncertainty.png; they are not claimed observed target paint.','Neutral roll is checked; steering is held neutral and is not qualified.','No production approval or shared engine activation. Coordinator owns independent shared harness inspection.'],'replayCommands':[f'blender --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/c-surface-bake/build.py -- --revision NEW_REV',f'node scripts/vehicle-bake/c-surface-bake/capture.mjs NEW_REV',f'python scripts/vehicle-bake/c-surface-bake/finish.py NEW_REV'],'visualInspection':[]}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n');(ART/'glb-structure.json').write_text(json.dumps(gltf,indent=2)+'\n');shutil.copy2(DATA/'gltf-validation.json',ART/'gltf-validation.json')
print(json.dumps(stats,indent=2))
