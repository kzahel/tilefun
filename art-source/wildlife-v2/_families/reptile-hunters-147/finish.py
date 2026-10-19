"""Native fixed-palette reptile hunter pixels from source volume projections."""
import json,math,hashlib,os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
ROOT=Path(__file__).resolve().parents[4];species=globals()['SPECIES'];S=ROOT/f'art-source/wildlife-v2/{species}/roster-v3';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{species}/roster-v3')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
G=json.loads((S/'projection.json').read_text(encoding='utf8'));W=G['canvas'];F=['down','up','left','right'];P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in G['palette'].items()}
def snap(v):return math.floor(v+.5)
def xy(p):return tuple(snap(v) for v in p[:2])
def compose(r):
    im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im)
    for v in sorted(r['volumes'],key=lambda v:(-v['depth'],v['name'],v['key'],tuple(tuple(p) for p in v['points']))):
        points=[xy(p) for p in v['points']]
        if len(set(points))>=3:d.polygon(points,fill=P[v['key']])
        elif points:d.line(points,fill=P[v['key']],width=1)
    outline=Image.new('RGBA',im.size,P['K']);outline.putalpha(im.getchannel('A').filter(ImageFilter.MaxFilter(3)));outline.alpha_composite(im)
    return outline
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']}
clips={'idle':dict(start=0,count=1,frameDuration=100),'walk':dict(start=1,count=32,frameDuration=G['frameDurationMs']),'feed':dict(start=33,count=8,frameDuration=100),'display':dict(start=41,count=8,frameDuration=100),'chase':dict(start=49,count=32,frameDuration=G['chaseMs'])}
sheet=Image.new('RGBA',(W*81,W*4));metadata=dict(identity=f'{species}-roster-v3-pixels-01',reviewStatus='fresh connected reptile hunter prototype; exact final pixels pending human review',image='sheet.png',frameWidth=W,frameHeight=W,anchor=G['anchor'],rootMotion=False,defaultClip='walk',clips=clips,facings={},cameraContract=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text()))
for row,f in enumerate(F):
    metadata['facings'][f]=dict(row=row,frames=[])
    for clip,c in clips.items():
        for i in range(c['count']):
            im=frames[f,clip,i];bbox=im.getbbox();assert bbox and min(bbox[:2])>=2 and max(bbox[2:])<=W-2,(f,clip,i,bbox)
            assert set(im.getchannel('A').get_flattened_data())<={0,255}
            sheet.alpha_composite(im,((c['start']+i)*W,row*W))
            metadata['facings'][f]['frames'].append(dict(clip=clip,index=i,rect=[(c['start']+i)*W,row*W,W,W],visibleBounds=bbox))
sheet.save(O/'sheet.png');metadata['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest()
(O/'sprite.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf8')
(S/'masters.json').write_text(json.dumps(dict(identity=metadata['identity'],palette=G['palette'],finishing='Depth-sorted native projections of fixed editable source volumes'),indent=2)+'\n',encoding='utf8')
contact=Image.new('RGBA',(W*8,W*4))
for row,f in enumerate(F):
    for col,i in enumerate(range(0,32,4)):contact.alpha_composite(frames[f,'walk',i],(col*W,row*W))
contact.save(O/'contact-sheet-native.png')
scene_panel=W+40;bg=Image.new('RGB',(scene_panel*4,W+40),'#77947d');d=ImageDraw.Draw(bg)
for y in range(20,W+40,16):d.line((0,y,scene_panel*4,y),fill='#6c866f')
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
for row in range(4):bg.paste(person.crop((0,row*32,32,(row+1)*32)),(row*scene_panel+2,10+G['anchor'][1]-28),person.crop((0,row*32,32,(row+1)*32)))
bg.save(O/'scene-background.png')
def four(clip,i,travel=0,padded=False):
    margin=40 if padded else 0
    panel=W+2*margin if padded else scene_panel
    im=Image.new('RGB',(panel*4,W+40+2*margin),'#77947d') if padded else bg.copy()
    if padded:
        d=ImageDraw.Draw(im)
        for x in range(0,im.width,16):d.line((x,0,x,im.height),fill='#6c866f')
        for y in range(0,im.height,16):d.line((0,y,im.width,y),fill='#6c866f')
    for row,f in enumerate(F):
        yaw=math.radians(metadata['cameraContract']['modelYawDegrees'][f]);dx=snap(-math.sin(yaw)*travel);dy=snap(-math.sin(math.radians(40))*math.cos(yaw)*travel)
        tile=frames[f,clip,i];im.paste(tile,(row*panel+margin+(0 if padded else 36)+dx,10+margin+dy),tile)
    return im
four('idle',0).save(O/'scene-native.png')
def gif(images,name,duration):
    # GIF clocks use10ms ticks; cumulative rounding preserves fractional authored timing.
    ms=duration if isinstance(duration,list) else [duration]*len(images);total=0;ticks=0;balanced=[]
    for value in ms:
        total+=value;next_ticks=round(total/10);balanced.append((next_ticks-ticks)*10);ticks=next_ticks
    duration=balanced
    images[0].save(O/name,save_all=True,append_images=images[1:],duration=duration,loop=0,disposal=2,optimize=False)
seq=[(c,i) for c,p in clips.items() for i in range(p['count'])]
native=[]
for clip,i in seq:
    im=Image.new('RGB',(W*4,W),'#77947d')
    for row,f in enumerate(F):im.paste(frames[f,clip,i],(row*W,0),frames[f,clip,i])
    native.append(im)
gif(native,'preview-native.gif',[clips[c]['frameDuration'] for c,i in seq])
gif([im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST) for im in native],'preview.gif',[clips[c]['frameDuration'] for c,i in seq])
gif([four('walk',i%32,G['speed']*(32*G['frameDurationMs']/1000)*i/32,True) for i in range(64)],'travel-native.gif',G['frameDurationMs'])
allowed=set(P.values())|{(0,0,0,0)};assert set(sheet.get_flattened_data())<=allowed
motion={f:[r['body'][1] for r in G['records'] if r['facing']==f and r['clip']=='walk'] for f in F}
assert all(max(v)-min(v)>=1 for v in motion.values())
body_ranges={}
for f in F:
 centers=[]
 for r in G['records']:
  if r['facing']!=f or r['clip']!='walk':continue
  body=compose(dict(volumes=[v for v in r['volumes'] if v['group']=='body']))
  ps=[(x,y) for y in range(W) for x in range(W) if body.getpixel((x,y))[3]]
  centers.append(sum(y for x,y in ps)/len(ps))
 body_ranges[f]=max(centers)-min(centers);assert body_ranges[f]>=1,(f,body_ranges[f])
(O/'pixel-audit.json').write_text(json.dumps(dict(identity=metadata['identity'],poses=324,binaryAlpha=True,fixedPalette=True,minimumPadding=2,freshSpeciesSource=True,sourceMeshVolumes=True,bodyPaintCentroidRangePixels=body_ranges,rootTravelPixelsPerCycle=G['strideWorldUnits']*10,plantedTravel=True),indent=2)+'\n',encoding='utf8')
print('REPTILE_HUNTER_FINISH_OK',metadata['sheetSha256'])
