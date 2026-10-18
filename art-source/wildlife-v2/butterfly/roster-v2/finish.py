"""Deliberate monarch-like wing decals on actual fixed projected wing panels."""
from pathlib import Path
import json,math,hashlib
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=R/'public/demos/wildlife-v2/butterfly/roster-v2'
assert not (S/'receipt.json').exists(),'Registered bank is immutable'
G=json.loads((S/'projection.json').read_text(encoding='utf8'));W=G['canvas'];F=['down','up','left','right'];palette={'K':'#39382d','O':'#d78332','H':'#efb45b','C':'#eadcb7'};P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()}
def snap(v):return math.floor(v+.5)
def xy(p):return tuple(snap(v) for v in p[:2])
def draw_volume(draw,v):
 ps=list(dict.fromkeys(xy(p) for p in v['points']))
 if len(ps)>=3:draw.polygon(ps,fill=P[v['key']])
 elif len(ps)>=2:draw.line(ps,fill=P[v['key']])
 elif ps:draw.point(ps[0],fill=P[v['key']])
def compose(r):
 im=Image.new('RGBA',(W,W));draw=ImageDraw.Draw(im)
 objects=[(v['depth'],'mesh',v) for v in r['volumes'].values() if not v['wing']]
 objects += [(depth,'wing',wing) for wing,depth in r['wingDepth'].items()]
 for depth,kind,v in sorted(objects,key=lambda q:-q[0]):
  if kind=='mesh':draw_volume(draw,v)
  else:
   patches=[p for p in r['volumes'].values() if p['wing']==v and p['surface']==r['wingFront'][v]]
   for patch in sorted(patches,key=lambda p:p['layer']):draw_volume(draw,patch)
 return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']}
clips={'idle':dict(start=0,count=1,frameDuration=100),'flutter':dict(start=1,count=32,frameDuration=20),'action':dict(start=33,count=8,frameDuration=100)}
sheet=Image.new('RGBA',(W*41,W*4));meta=dict(identity='butterfly-roster-v2-pixels-01',reviewStatus='fresh flutterer prototype; exact pixels pending human review',image='sheet.png',frameWidth=W,frameHeight=W,anchor=G['anchor'],rootMotion=False,defaultClip='flutter',clips=clips,facings={},cameraContract=json.loads((R/'art-source/wildlife-v2/camera.json').read_text()))
masters=[]
for row,f in enumerate(F):
 meta['facings'][f]=dict(row=row,frames=[])
 for clip,c in clips.items():
  for i in range(c['count']):
   im=frames[f,clip,i];b=im.getbbox();assert b and min(b[:2])>=2 and max(b[2:])<=W-2,(f,clip,i,b)
   sheet.alpha_composite(im,((c['start']+i)*W,row*W));meta['facings'][f]['frames'].append(dict(clip=clip,index=i,rect=[(c['start']+i)*W,row*W,W,W],visibleBounds=b))
   reverse={v:k for k,v in P.items()};masters.append(dict(facing=f,clip=clip,index=i,pixels=[''.join(reverse.get(im.getpixel((x,y)),'.') for x in range(W)) for y in range(W)]))
sheet.save(O/'sheet.png');meta['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest();(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8')
(S/'masters.json').write_text(json.dumps(dict(identity=meta['identity'],palette=palette,finishing='Authored orange cells, black veins/borders and cream marginal spots remain attached to four fixed wing panels. Native pixels use actual projected geometry and deliberate decal order, not rendered colors.',frames=masters),indent=1)+'\n',encoding='utf8')
contact=Image.new('RGBA',(W*8,W*4))
for row,f in enumerate(F):
 for col,i in enumerate(range(0,32,4)):contact.alpha_composite(frames[f,'flutter',i],(col*W,row*W))
contact.save(O/'contact-sheet-native.png')
def four(clip,i):
 im=Image.new('RGB',(W*4,W),'#879b82')
 for row,f in enumerate(F):im.paste(frames[f,clip,i],(row*W,0),frames[f,clip,i])
 return im
person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');panel=W+40;bg=Image.new('RGB',(panel*4,W+24),'#879b82');ground=10+G['anchor'][1]
for row,f in enumerate(F):bg.paste(person.crop((0,row*32,32,(row+1)*32)),(row*panel+2,ground-28),person.crop((0,row*32,32,(row+1)*32)))
bg.save(O/'scene-background.png');scene=bg.copy()
for row,f in enumerate(F):scene.paste(frames[f,'idle',0],(row*panel+36,10),frames[f,'idle',0])
scene.save(O/'scene-native.png')
def gif(images,name,durations):images[0].save(O/name,save_all=True,append_images=images[1:],duration=durations,loop=0,disposal=2,optimize=False)
seq=[('idle',0)]+[('flutter',i) for i in range(32)]+[('action',i) for i in range(8)];native=[four(c,i) for c,i in seq];durations=[clips[c]['frameDuration'] for c,i in seq]
gif(native,'preview-native.gif',durations);gif([im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST) for im in native],'preview.gif',durations)
# Illustrative 12px short flight; production authority owns actual bounded targets.
travel=[]
for i in range(32):
 im=Image.new('RGB',(W*4,W+12),'#879b82');t=max(0,min(1,(i*.02-.04)/.56));height=6*math.sin(math.pi*t)
 for row,f in enumerate(F):
  yaw=math.radians(meta['cameraContract']['modelYawDegrees'][f]);dx=snap(-math.sin(yaw)*12*t);dy=snap(-math.sin(math.radians(40))*math.cos(yaw)*12*t-height);tile=frames[f,'flutter',i];im.paste(tile,(row*W+dx,6+dy),tile)
 travel.append(im)
gif(travel,'travel-native.gif',20)
assert set(sheet.getchannel('A').get_flattened_data())<={0,255};assert set(sheet.get_flattened_data())<=set(P.values())|{(0,0,0,0)}
unique={f:len({frames[f,'flutter',i].tobytes() for i in range(32)}) for f in F};assert min(unique.values())>=8,unique
(O/'pixel-audit.json').write_text(json.dumps(dict(identity=meta['identity'],poses=164,binaryAlpha=True,fixedPalette=True,minimumPadding=2,distinctFlutterPoses=unique,wingPaint='Fixed orange/black/cream source decals, actual wing facing and layer order',worldFlight='Shared physical short airborne arcs, with ordinary grounded landings'),indent=2)+'\n',encoding='utf8');print('BUTTERFLY_FINISH_OK',meta['sheetSha256'],unique)
