"""Fixed-palette evaluated source hulls; preserve all native travel cells exactly."""
from pathlib import Path
import hashlib,json,math,sys
from PIL import Image,ImageDraw,ImageFilter

R=Path(__file__).resolve().parents[2];species=sys.argv[1]
S=R/f'art-source/wildlife-v2/{species}/behavior-v1';O=R/f'public/demos/wildlife-v2/{species}/behavior-v1'
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
I=json.loads((S/'inputs.json').read_text(encoding='utf8'));G=json.loads((S/'projection.json').read_text(encoding='utf8'));M=json.loads((R/I['masters']).read_text(encoding='utf8'))
W=I['canvas'];F=['down','up','left','right'];P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
source=Image.open(R/I['sheet']).convert('RGBA');original_columns=source.width//W
base=json.loads((R/I['metadata']).read_text(encoding='utf8'));clips={k:dict(v) for k,v in base['clips'].items()};extras=G['clips'];column=original_columns
for name,count,ms in extras:clips[name]=dict(start=column,count=count,frameDuration=ms,loop=name in ['browse','display']);column+=count
sheet=Image.new('RGBA',(column*W,4*W));sheet.alpha_composite(source)
def snap(v):return math.floor(v+.5)
def hull(points):
 ps=sorted(set((snap(p[0]),snap(p[1])) for p in points));lo=[];hi=[];cross=lambda a,b,c:(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 for p in ps:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(ps):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
def polygon(draw,ps,color):
 if len(ps)>2:draw.polygon(ps,fill=color)
 elif len(ps)>1:draw.line(ps,fill=color)
 elif ps:draw.point(ps[0],fill=color)
def affine(im,old,basis,new,current):
 a,b=current[0];c,d=current[1];det=a*d-b*c
 if abs(det)<1e-7:return Image.new('RGBA',(W,W))
 inv=[[d/det,-b/det],[-c/det,a/det]];m=[[sum(basis[i][k]*inv[k][j] for k in range(2)) for j in range(2)] for i in range(2)]
 coeff=(m[0][0],m[0][1],old[0]-m[0][0]*new[0]-m[0][1]*new[1],m[1][0],m[1][1],old[1]-m[1][0]*new[0]-m[1][1]*new[1])
 return im.transform((W,W),Image.Transform.AFFINE,coeff,Image.Resampling.NEAREST)
def compose(r):
 im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im)
 for v in sorted(r['volumes'],key=lambda v:-v['depth']):polygon(d,hull(v['points']),P[v['key']])
 border=Image.new('RGBA',(W,W),P['K']);border.putalpha(im.getchannel('A').filter(ImageFilter.MaxFilter(3)));border.alpha_composite(im);return border
for r in G['records']:
 tile=compose(r);bbox=tile.getbbox();assert bbox and min(bbox[:2])>=2 and max(bbox[2:])<=W-2,(species,r['facing'],r['clip'],r['index'],bbox)
 sheet.alpha_composite(tile,((clips[r['clip']]['start']+r['index'])*W,F.index(r['facing'])*W))
assert sheet.crop((0,0,source.width,source.height)).tobytes()==source.tobytes();sheet.save(O/'sheet.png')
meta=dict(identity=f'{species}-behavior-v1',reviewStatus='pending human review',frameWidth=W,frameHeight=W,anchor=I['anchor'],image='sheet.png',rootMotion=False,defaultClip='browse' if species=='deer' else 'display' if species=='peacock' else 'bury',clips=clips,sheetSha256=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest())
for key in ['rootTravelPixelsPerCycle','cameraContract']:
 if key in base:meta[key]=base[key]
(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8',newline='\n')
contact=Image.new('RGBA',((column-original_columns)*W,4*W),'#77947d')
for row in range(4):contact.alpha_composite(sheet.crop((original_columns*W,row*W,column*W,(row+1)*W)),(0,row*W))
contact.save(O/'contact-sheet-native.png');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');panel=W+48
def four(clip,i):
 im=Image.new('RGBA',(panel*4,W+40),'#77947d');d=ImageDraw.Draw(im)
 for y in range(0,im.height,16):d.line((0,y,im.width,y),fill='#6c866f')
 for row in range(4):
  c=clips[clip]['start']+i;im.alpha_composite(sheet.crop((c*W,row*W,(c+1)*W,(row+1)*W)),(row*panel+36,10));im.alpha_composite(person.crop((0,row*32,32,(row+1)*32)),(row*panel,10+I['anchor'][1]-28))
 return im
four(meta['defaultClip'],clips[meta['defaultClip']]['count']//3).save(O/'scene-native.png')
sequence=[(c,i,ms) for c,n,ms in extras for i in range(n)];images=[four(c,i).convert('RGB') for c,i,ms in sequence]
for name,scale in [('preview-native.gif',1),('preview.gif',3)]:
 frames=[im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST) for im in images];frames[0].save(O/name,save_all=True,append_images=frames[1:],duration=[ms for c,i,ms in sequence],disposal=2,loop=0,optimize=False)
audit=dict(identity=meta['identity'],poses=len(G['records']),binaryAlpha=set(sheet.getchannel('A').get_flattened_data())<={0,255},nativeCellsUnchanged=True,minimumPadding=2,distinctActionFrames={f:{c:len({sheet.crop(((clips[c]['start']+i)*W,row*W,(clips[c]['start']+i+1)*W,(row+1)*W)).tobytes() for i in range(n)}) for c,n,_ in extras} for row,f in enumerate(F)})
assert audit['binaryAlpha'] and all(n>=3 for groups in audit['distinctActionFrames'].values() for n in groups.values()),audit
connections=0
for r in G['records']:
 row=F.index(r['facing']);col=clips[r['clip']]['start']+r['index'];tile=sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W));occupied={(x,y) for y in range(W) for x in range(W) if tile.getpixel((x,y))[3]};groups={};group=0
 for p in occupied:
  if p in groups:continue
  group+=1;todo=[p];groups[p]=group
  for x,y in todo:
   for dx in [-1,0,1]:
    for dy in [-1,0,1]:
     q=(x+dx,y+dy)
     if q in occupied and q not in groups:groups[q]=group;todo.append(q)
 nearest=lambda p:min(occupied,key=lambda q:math.hypot(q[0]-p[0],q[1]-p[1]));assert groups[nearest(r['head'])]==groups[nearest(r['body'])],(species,r['facing'],r['clip'],r['index'],'head detached');connections+=1
audit['connectedHeadBodyChecks']=connections;(O/'pixel-audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf8',newline='\n')
(O/'playback.js').write_bytes((R/'scripts/wildlife/meadow-playback.js').read_bytes())
(O/'index.html').write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8"><title>{species} actions</title><style>body{{background:#283b36;color:white;font:16px sans-serif}}canvas{{image-rendering:pixelated;width:min(100%,1000px);background:#77947d}}img{{image-rendering:pixelated;max-width:100%}}</style><h1>{species} - behavior-v1</h1><p>Pending human review.</p><label>Action <select id="clip">{''.join(f'<option>{c}</option>' for c in clips)}</select></label> <button type="button" id="pause">Play</button> <button type="button" id="step">Next pose</button> <label>Pose <input id="pose" type="range" min="0" value="0"></label> <label>Speed <select id="speed"><option value="0.5">Half</option><option value="1" selected>Normal</option><option value="2">Double</option></select></label><p><canvas aria-label="Four animal directions"></canvas></p><img alt="Four directions beside Trail Explorer" src="scene-native.png"><p><a href="contact-sheet-native.png">All action cells</a> - <a href="sprite.json">Source metadata</a></p><script type="module" src="playback.js"></script></html>''',encoding='utf8',newline='\n')
print('FOREST_FINISH_OK',species,meta['sheetSha256'])
