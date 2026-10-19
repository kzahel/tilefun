"""Scene semantic masks -> deliberately authored pixel clusters. Pillow only.
No view-specific palette, fitting, cropping, dithering or generated imagery.
"""
import json, math, hashlib
from pathlib import Path
from collections import Counter,deque
from PIL import Image,ImageDraw,ImageFont,ImageFilter
ROOT=Path(__file__).resolve().parents[3];ROUTE='03-guide-pixel-finish'
DATA=ROOT/'data/vehicle-style-study'/ROUTE;OUT=ROOT/'public/demos/vehicle-style-study'/ROUTE
SCENE=json.loads((DATA/'scene.json').read_text())
REFS=ROOT/'art-source/vehicle-models/compact-4/v1/refs'
P={
 'ink':(58,58,80),'warm_ink':(74,42,61),'red_deep':(127,33,76),
 'red_shadow':(161,18,80),'red_mid':(197,52,88),'red':(211,68,92),
 'red_light':(227,90,90),'red_glint':(225,132,132),
 'glass_dark':(86,89,114),'glass':(115,140,168),'glass_light':(164,187,213),
 'glass_glint':(186,210,224),'rim':(131,136,151),'silver':(212,212,230),
 'white':(248,248,248),'tire_light':(70,70,94),'ruby':(186,39,88)}
source=set()
for f in REFS.glob('*.png'):
 source.update(c[:3] for c in Image.open(f).convert('RGBA').get_flattened_data() if c[3]>200)
assert all(c in source for c in P.values()),'All colors should be genuinely sampled from source'
IDS={k:tuple(round(v*255) for v in rgb) for k,rgb in SCENE['guideColors'].items()}
N4=[(-1,0),(1,0),(0,-1),(0,1)]
RULES=[
 'One palette sampled from all four compact-4 frozen refs; no extra colors, adaptive quantization or dithering.',
 'Visible class maps are the actual scene rendered with emission materials and identical geometry/camera; 4x4 plurality reduces IDs to native grid.',
 'Every view is reduced to 128 square then translated by exactly (0,+28); no bounds fitting.',
 'Body uses fixed raw-red luminance bands and a single constrained majority cleanup, replacing one-pixel shade islands inside the body only.',
 'Glass is redrawn inside its projected aperture: one dark inner border, two broad component-relative tone bands, one continuous upper reflection strip. No stochastic reflections.',
 'Tires use solid dark clusters with a restrained lower shade; rims remain actual projected spokes and rings, using two fixed silver tones.',
 'Lamps use contiguous pale-core/blue-edge clusters and ruby rear clusters; no isolated bright pixels outside the actual projected lamp masks.',
 'Intakes use a solid dark fill and restrained one-row muted lower accent for clusters at least four native pixels wide; no dotted grille noise.',
 'Six fine scene rear-deck louvers are deliberately simplified into three continuous one-pixel slats at the actual projected endpoints of louvers 0/2/4; original intake-mask speckles in their bank are replaced with the neighboring body tone.',
 'Projected panel-feature pixels are one-pixel ink; body silhouette has one-native-pixel inward ink so silhouette footprint is preserved.',
 'All interior authored marks are clipped to actual visible semantic masks. Small glass fragments remain dark rather than inventing replacement windows.'
]
def translate(im):
 out=Image.new(im.mode,(128,128),0);out.paste(im,(0,28));return out
def components(points):
 todo=set(points);result=[]
 while todo:
  p=todo.pop();q=[p];comp={p}
  while q:
   x,y=q.pop()
   for dx,dy in N4:
    n=x+dx,y+dy
    if n in todo:todo.remove(n);comp.add(n);q.append(n)
  result.append(comp)
 return result
def read_ids(i):
 im=Image.open(DATA/'guides'/f'ids-{i}.png').convert('RGBA');px=im.load()
 classes={k:set() for k in IDS};native={}
 # Full-size visible masks exported losslessly from class pass.
 masks={k:Image.new('L',(512,512)) for k in IDS};mp={k:m.load() for k,m in masks.items()}
 for y in range(512):
  for x in range(512):
   c=px[x,y]
   if c[3]<128:continue
   k=min(IDS,key=lambda k:sum((c[j]-IDS[k][j])**2 for j in range(3)))
   mp[k][x,y]=255
 for y in range(128):
  for x in range(128):
   votes=Counter()
   for dy in range(4):
    for dx in range(4):
     xx=x*4+dx;yy=y*4+dy
     if px[xx,yy][3]>=128:
      k=min(IDS,key=lambda k:sum((px[xx,yy][j]-IDS[k][j])**2 for j in range(3)));votes[k]+=1
   if sum(votes.values())<8:continue
   k=votes.most_common(1)[0][0]
   # Retain actual thin seams where at least 25% of a native pixel is covered.
   if k=='body' and votes['panels']>=4:k='panels'
   if y+28<128:native[x,y+28]=k;classes[k].add((x,y+28))
 for k,m in masks.items():
  m.save(DATA/'guides'/f'{k}-{i}-512.png')
  nm=Image.new('L',(128,128));p=nm.load()
  for xy in classes[k]:p[xy]=255
  nm.save(DATA/'guides'/f'{k}-{i}-128.png')
 # Combined six mandatory semantic masks (rim is part of wheels, rear lens of lamps).
 for k,sub in [('wheels',['wheels','rim']),('lamps',['lamps','rear_lamps'])]:
  for size in (128,512):
   merged=Image.new('L',(size,size))
   from PIL import ImageChops
   for part in sub:merged=ImageChops.lighter(merged,Image.open(DATA/'guides'/f'{part}-{i}-{size}.png'))
   merged.save(DATA/'guides'/f'{k}-combined-{i}-{size}.png')
 guide=Image.new('RGBA',(128,128));gp=guide.load()
 for xy,k in native.items():gp[xy]=IDS[k]+(255,)
 guide.save(OUT/f'guide-{i}.png')
 return native,classes
def finish(i):
 raw=translate(Image.open(OUT/f'raw-{i}.png').convert('RGBA').resize((128,128),Image.Resampling.BOX))
 native,C=read_ids(i);im=Image.new('RGBA',(128,128));pix=im.load();rp=raw.load()
 for (x,y),kind in native.items():
  if kind=='body':
   r,g,b,_=rp[x,y];v=.78*r+.22*g
   role=['red_deep','red_shadow','red_mid','red','red_light','red_glint'][sum(v>t for t in [80,119,145,169,207])]
  elif kind=='glass':role='glass'
  elif kind=='rim':role='silver' if sum(rp[x,y][:3])>420 else 'rim'
  elif kind=='wheels':role='ink'
  elif kind=='lamps':role='white'
  elif kind=='rear_lamps':role='ruby'
  else:role='warm_ink' if kind=='panels' else 'ink'
  pix[x,y]=P[role]+(255,)
 # Majority pass only removes isolated body shade pixels, never silhouette/features.
 before=im.copy();bp=before.load()
 for x,y in C['body']:
  adjacent=[bp[x+dx,y+dy] for dx,dy in N4 if (x+dx,y+dy) in C['body']]
  if len(adjacent)==4 and adjacent.count(bp[x,y])==0:
   color,n=Counter(adjacent).most_common(1)[0]
   if n>=3:pix[x,y]=color
 for comp in components(C['glass']):
  x0=min(x for x,y in comp);x1=max(x for x,y in comp);y0=min(y for x,y in comp);y1=max(y for x,y in comp);h=y1-y0+1
  for x,y in comp:
   edge=any((x+dx,y+dy) not in comp for dx,dy in N4)
   role='ink' if edge else ('glass_light' if y<y0+h*.48 else 'glass')
   if not edge and y==y0+max(1,h//4):role='glass_glint'
   pix[x,y]=P[role]+(255,)
 for comp in components(C['intakes']):
  x0=min(x for x,y in comp);x1=max(x for x,y in comp);y1=max(y for x,y in comp)
  if x1-x0>=4:
   for x,y in comp:
    if y==y1-1 and (x,y+1) in comp and x0<x<x1:pix[x,y]=P['glass_dark']+(255,)
 for comp in components(C['lamps']):
  if len(comp)>2:
   y1=max(y for x,y in comp)
   for x,y in comp:
    if y==y1:pix[x,y]=P['glass_light']+(255,)
 # Guide-to-drawing choice: simplify fine subpixel geometry, rather than
 # accepting salt-and-pepper output. Anchors are evaluated actual-scene curves.
 lines=SCENE['projectedLouverLines'][i]
 region=Image.new('L',(128,128));dr=ImageDraw.Draw(region)
 corners=[lines[0][0],lines[0][1],lines[-1][1],lines[-1][0]]
 dr.polygon([tuple(p) for p in corners],fill=255)
 region=region.filter(ImageFilter.MaxFilter(3));regionpx=region.load()
 bank={xy for xy in native if regionpx[xy] and native[xy] in ('body','intakes')}
 bodytones=Counter(pix[xy] for xy in bank if native[xy]=='body')
 base=bodytones.most_common(1)[0][0] if bodytones else P['red_light']+(255,)
 for xy in bank:pix[xy]=base
 slats=Image.new('L',(128,128));sd=ImageDraw.Draw(slats)
 for k in (0,2,4):
  sd.line([tuple(math.floor(v+.5) for v in point) for point in lines[k]],fill=255,width=1)
 sp=slats.load()
 for xy in bank:
  if sp[xy]:pix[xy]=P['warm_ink']+(255,)
 # Inward outline keeps the true scene's footprint and far-side visibility.
 visible=set(native)
 for x,y in visible:
  if any((x+dx,y+dy) not in visible for dx,dy in N4):
   if native[x,y] not in ('lamps','rear_lamps'):pix[x,y]=P['ink']+(255,)
 im.save(OUT/f'view-{i}.png');raw.save(DATA/f'reduced-raw-{i}.png')
 return im,raw
BG=(27,30,40);FG=(238,235,226)
def font(n):return ImageFont.load_default(size=n)
def tile(im,scale=1):
 s=im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST);bg=Image.new('RGB',s.size,BG);d=ImageDraw.Draw(bg)
 for y in range(0,bg.height,16):
  for x in range(0,bg.width,16):
   if (x//16+y//16)%2:d.rectangle((x,y,x+15,y+15),fill=(34,38,48))
 bg.paste(s,(0,0),s);return bg
def main():
 frames=[];raws=[]
 for i in range(8):
  f,r=finish(i);frames.append(f);raws.append(r)
 sheet=Image.new('RGBA',(1024,128))
 for i,f in enumerate(frames):sheet.paste(f,(128*i,0))
 sheet.save(OUT/'sheet.png')
 # Two columns of view blocks. Each shows native raw/guide/final plus final at 4x.
 comparison=Image.new('RGB',(1800,2660),BG);d=ImageDraw.Draw(comparison)
 d.text((24,16),'03  /  SCENE GUIDES TO AUTHORED PIXEL CLUSTERS',font=font(28),fill=FG)
 d.text((24,54),f'Fixed camera, scale and anchor. Native stages at left; final at 4x nearest. Original scene, {SCENE["triangles"]:,} triangles.',font=font(18),fill=FG)
 for i,f in enumerate(frames):
  bx=20+(i%2)*890;by=100+(i//2)*584
  d.text((bx,by),f'VIEW {i}  /  YAW {i*45} DEGREES',font=font(20),fill=FG)
  for row,(label,img) in enumerate([('RAW 128',raws[i]),('VISIBLE IDS',Image.open(OUT/f'guide-{i}.png').convert('RGBA')),('FINAL 1x',f)]):
   yy=by+40+row*165;d.text((bx,yy),label,font=font(14),fill=FG);comparison.paste(tile(img),(bx+120,yy+20))
  comparison.paste(tile(f,4),(bx+320,by+40));d.text((bx+320,by+558),'FINAL 4x / nearest / no independent fitting',font=font(15),fill=FG)
 y=2450;d.text((24,y),'EXISTING SOURCE REFERENCES / PALETTE ONLY / DIFFERENT VEHICLE',font=font(18),fill=FG)
 for i,name in enumerate(('east','north','west','south')):
  ref=Image.open(REFS/f'{name}.png').convert('RGBA');scale=min(3,160//max(ref.size));comparison.paste(tile(ref,scale),(24+i*250,y+35));d.text((24+i*250,y+165),name,font=font(14),fill=FG)
 comparison.save(OUT/'comparison.png')
 # Unprocessed geometry review retains all eight 512 captures on one sheet.
 rawsheet=Image.new('RGB',(2048,1120),BG);rd=ImageDraw.Draw(rawsheet)
 for i in range(8):
  bx=(i%4)*512;by=(i//4)*560;rd.text((bx+12,by+8),f'RAW {i} / {i*45} deg',font=font(18),fill=FG)
  rawsheet.paste(tile(Image.open(OUT/f'raw-{i}.png').convert('RGBA')),(bx,by+40))
 rawsheet.save(OUT/'raw-sheet.png')
 previews=[]
 for i,f in enumerate(frames):
  c=Image.new('RGB',(640,600),BG);c.paste(tile(f,4),(64,48));dd=ImageDraw.Draw(c);dd.text((20,12),f'GUIDE / PIXEL  |  {i*45:03d} degrees',font=font(20),fill=FG);dd.text((20,570),'Same ground anchor (64,92), enlarged 4x',font=font(18),fill=FG);previews.append(c)
 previews[0].save(OUT/'turntable.gif',save_all=True,append_images=previews[1:],duration=220,loop=0,disposal=2,optimize=False)
 used=set();bounds=[];per_view=[]
 for i,f in enumerate(frames):
  a=set(f.getchannel('A').get_flattened_data());assert a<={0,255}
  cs={c[:3] for c in f.get_flattened_data() if c[3]};used|=cs;assert cs<=set(P.values());bounds.append(f.getbbox());assert f.getbbox()[3]<128
  per_view.append({'view':i,'bounds':f.getbbox(),'opaquePixels':sum(c[3]>0 for c in f.get_flattened_data()),'colors':len(cs)})
 gif=Image.open(OUT/'turntable.gif');assert gif.n_frames==8
 files=[*(f'raw-{i}.png' for i in range(8)),*(f'view-{i}.png' for i in range(8)),'sheet.png','comparison.png','turntable.gif']
 assert all((OUT/f).exists() for f in files)
 report={'route':ROUTE,'title':'Sculpted coupe / semantic guides to authored pixel clusters','status':'awaiting-visual-inspection',
 'method':'Original high-detail coachwork rendered with fixed CPU Cycles lighting, followed by actual-scene visible emission-ID guides and semantic component pixel redraw.',
 'evaluatedTriangles':SCENE['triangles'],'evaluatedMeshCount':SCENE['evaluatedMeshCount'],'sourceMeshCount':SCENE['sourceMeshCount'],'nativeSize':[128,128],
 'palette':{k:'#%02x%02x%02x'%v for k,v in P.items()},'colourCount':len(used),'paletteCount':len(P),'paletteSource':'art-source/vehicle-models/compact-4/v1/refs/*.png','supplementedColors':[],
 'blendPath':str((DATA/'sports-coupe.blend').relative_to(ROOT)).replace('\\','/'),'sourcePaths':[str(Path(__file__).relative_to(ROOT)).replace('\\','/'),'scripts/vehicle-style-study/03-guide-pixel-finish/build.py'],
 'guidesPath':'data/vehicle-style-study/03-guide-pixel-finish/guides/','camera':SCENE['camera'],'angles':SCENE['angles'],'rawSize':[512,512],'translation':[0,28],'groundAnchor':[64,92],
 'render':{'engine':SCENE['engine'],'threads':4,'samples':16,'guideSamples':1},'authoredClusterRules':RULES,'views':per_view,
 'commands':['& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-style-study/03-guide-pixel-finish/build.py','python scripts/vehicle-style-study/03-guide-pixel-finish/finish.py'],
 'limitations':['Offline art experiment; no production approval, review registration or gameplay integration.','Fixed eight-direction pixel redraw; no temporal in-between guarantee.','Small far-side wheel and trim details can merge at this fixed scale.','Separate wheel pivots exist; exported runtime steering and full clearance qualification are outside this study.','Body luminance bands remain lighting-dependent while glass and accent bands are deliberately authored.'],
 'visualInspection':[],'validation':{'binaryAlpha':True,'paletteMembership':True,'sourcePaletteOnly':True,'fixedCanvasAndTranslation':True,'allRequiredFilesExist':True,'gifFrames':gif.n_frames,'sheetSize':list(sheet.size),'minimumTrianglesPassed':SCENE['triangles']>=10000},
 'files':{f:hashlib.sha256((OUT/f).read_bytes()).hexdigest() for f in files}}
 (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
 (DATA/'cluster-rules.json').write_text(json.dumps(RULES,indent=2)+'\n')
 print(json.dumps({'triangles':report['evaluatedTriangles'],'meshes':report['evaluatedMeshCount'],'colors':len(used),'views':per_view},indent=2))
if __name__=='__main__':main()
