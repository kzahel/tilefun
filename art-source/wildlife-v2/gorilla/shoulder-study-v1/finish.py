"""Finish the existing palette-letter coats against new evaluated source poses.
Rigid painted torso/head parts follow their own source anchors/angles; limbs,
tail and ears follow separate actual joints. Grounded feet never inherit a bob.
"""
import json, math, hashlib, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[4]
species='gorilla';horse=True
S=ROOT/f'art-source/wildlife-v2/{species}/shoulder-study-v1';O=ROOT/f'public/demos/wildlife-v2/{species}/shoulder-study-v1'
assert not (S/'receipt.json').exists(),'Registered bank is immutable'
G=json.loads((S/'projection.json').read_text(encoding='utf8'))
M=dict(palette={'K':'#20292e','B':'#3e494e','H':'#5b6b70','S':'#718084','F':'#586366','M':'#8c9692','P':'#354247'},bodies={},heads={})
W=G['canvas'];F=['down','up','left','right'];P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
def snap(v):return math.floor(v+.5)
def xy(p):return tuple(snap(v) for v in p[:2])
def volume_hull(points):
    ps=sorted(set(xy(p) for p in points));lo=[];hi=[]
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    for p in ps:
        while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
        lo.append(p)
    for p in reversed(ps):
        while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
        hi.append(p)
    return lo[:-1]+hi[:-1]

# Species-specific fur/face palette masters are authored once from the
# independently modeled gorilla's rest guides, then retained as rigid painted parts.
keys=list(P)
for facing in F:
    ref=G['references'][facing]
    for group in ['body','head']:
        paint=Image.new('L',(W,W));d=ImageDraw.Draw(paint)
        for name,v in sorted(ref['volumes'].items(),key=lambda q:-q[1]['depth']):
            if v['group']!=group:continue
            ps=volume_hull(v['points']);value=keys.index(v['key'])+1
            if len(ps)>=3:d.polygon(ps,fill=value)
            elif len(ps)>=2:d.line(ps,fill=value)
            elif ps:d.point(ps[0],fill=value)
        old=paint.copy()
        for y in range(1,W-1):
            for x in range(1,W-1):
                value=old.getpixel((x,y))
                if value and keys[value-1] in ['B','H','S','F','M'] and any(not old.getpixel((x+dx,y+dy)) for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):paint.putpixel((x,y),keys.index('B')+1)
        rows=[''.join('.' if not paint.getpixel((x,y)) else keys[paint.getpixel((x,y))-1] for x in range(W)) for y in range(W)]
        M['bodies' if group=='body' else 'heads'][facing]=dict(pixels=rows,offset=[-snap(ref[group][0]),-snap(ref[group][1])])

def pattern(group,f):
    part=M[group][f];rows=part.get('pixels')
    if rows is None:rows=[r[::-1] for r in M[group][part['mirror']]['pixels']]
    im=Image.new('RGBA',(len(rows[0]),len(rows)))
    for y,row in enumerate(rows):
        for x,ch in enumerate(row):
            if ch!='.':im.putpixel((x,y),P[ch])
    return im,part['offset']
def part_image(group,f):
    im=Image.new('RGBA',(W,W));paint,offset=pattern(group,f)
    ref=G['references'][f];anchor=ref['body' if group=='bodies' or not horse else 'head']
    im.alpha_composite(paint,(snap(anchor[0])+offset[0],snap(anchor[1])+offset[1]));return im
templates={(group,f):part_image(group,f) for group in ['bodies','heads'] for f in F}
def painted_part(im,group,r):
    f=r['facing'];ref=G['references'][f];name='body' if group=='bodies' else 'head'
    # Reproject a rigid painted plane through the actual Blender body/head
    # transform. This includes camera foreshortening, never geometry scaling.
    def inverse(m):
        a,b=m[0];c,d=m[1];det=a*d-b*c;assert abs(det)>1e-8
        return [[d/det,-b/det],[-c/det,a/det]]
    a=ref[name+'Basis'];b=inverse(r[name+'Basis'])
    m=[[sum(a[i][k]*b[k][j] for k in range(2)) for j in range(2)] for i in range(2)]
    old=ref[name];new=r[name]
    transform=(m[0][0],m[0][1],old[0]-m[0][0]*new[0]-m[0][1]*new[1],m[1][0],m[1][1],old[1]-m[1][0]*new[0]-m[1][1]*new[1])
    paint=templates[group,f].transform((W,W),Image.Transform.AFFINE,transform,Image.Resampling.NEAREST)
    im.alpha_composite(paint)
def leg(im,name,c,near,r):
    ps=[xy(p) for p in c['screen']];radii=[3.6,3.0,2.4,2.0,2.0] if name.startswith('fore') else [4.0,3.0,2.2,1.8,1.8];normals=[]
    for i,p in enumerate(ps):
        a,b=ps[max(0,i-1)],ps[min(len(ps)-1,i+1)];dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy) or 1;normals.append((-dy/length*radii[i],dx/length*radii[i]))
    contour=[(snap(p[0]+n[0]),snap(p[1]+n[1])) for p,n in zip(ps,normals)]+[(snap(p[0]-n[0]),snap(p[1]-n[1])) for p,n in reversed(list(zip(ps,normals)))]
    d=ImageDraw.Draw(im);d.polygon(contour,fill=P['B']);d.line(contour+[contour[0]],fill=P['K'])
    if near:
        band=[(snap(p[0]+n[0]*.72),snap(p[1]+n[1]*.72)) for p,n in zip(ps,normals)]+[(snap(p[0]+n[0]*.30),snap(p[1]+n[1]*.30)) for p,n in reversed(list(zip(ps,normals)))];d.polygon(band,fill=P['H'])
    hand(im,name,r,near)

def hand(im,name,r,near):
    ps=volume_hull(r['hands'][name]);d=ImageDraw.Draw(im)
    if len(ps)>2:d.polygon(ps,fill=P['P' if near else 'B']);d.line(ps+[ps[0]],fill=P['K'])
    x,y=xy(r['contacts'][name]['screen'][-1])
    if near:d.line([(x-1,y),(x+1,y)],fill=P['F'])
    if near and r['facing']!='up':
        for p in r['knuckles'][name]:d.point(xy(p),fill=P['F'])

def compose(r):
    im=Image.new('RGBA',(W,W));order=sorted(r['contacts'].items(),key=lambda q:q[1]['screen'][0][2],reverse=True)
    for n,c in order[:2]:leg(im,n,c,False,r)
    if r['facing']=='up':painted_part(im,'heads',r)
    painted_part(im,'bodies',r)
    for n,c in order[2:]:leg(im,n,c,True,r)
    painted_part(im,'bodies',r)
    if r['facing']!='up':painted_part(im,'heads',r)
    if r['clip']=='action':
        for n,c in order:
            if n.startswith('fore'):hand(im,n,r,True)
    return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']}
clips={'idle':dict(start=0,count=1,frameDuration=100),'walk':dict(start=1,count=32,frameDuration=G['frameDurationMs']),'action':dict(start=33,count=16,frameDuration=50)}
sheet=Image.new('RGBA',(W*49,W*4));metadata=dict(identity=f'{species}-shoulder-study-v1-pixels-01',reviewStatus='owner-requested shoulder study; exact final pixels pending human review',image='sheet.png',frameWidth=W,frameHeight=W,anchor=G['anchor'],rootMotion=False,rootTravelPixelsPerCycle=G['strideWorldUnits']*10,clips=clips,facings={},cameraContract=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text()))
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
M['identity']=metadata['identity'];M['motionFinishing']='Rigid painted parts rotated about evaluated source anchors; projected independent constant-length limbs and contacts.'
(S/'masters.json').write_text(json.dumps(M,indent=2)+'\n',encoding='utf8')
contact=Image.new('RGBA',(W*8,W*4))
for row,f in enumerate(F):
    for col,i in enumerate(range(0,32,4)):contact.alpha_composite(frames[f,'walk',i],(col*W,row*W))
contact.save(O/'contact-sheet-native.png')
scene_panel=W+40;bg=Image.new('RGB',(scene_panel*4,W+40),'#879b82');d=ImageDraw.Draw(bg)
for y in range(20,W+40,16):d.line((0,y,scene_panel*4,y),fill='#7c9179')
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
for row in range(4):bg.paste(person.crop((0,row*32,32,(row+1)*32)),(row*scene_panel+2,10+G['anchor'][1]-28),person.crop((0,row*32,32,(row+1)*32)))
bg.save(O/'scene-background.png')
def four(clip,i,travel=0,padded=False):
    margin=math.ceil(G['strideWorldUnits']*20)+8 if padded else 0
    panel=W+2*margin if padded else scene_panel
    im=Image.new('RGB',(panel*4,W+40+2*margin),'#879b82') if padded else bg.copy()
    if padded:
        d=ImageDraw.Draw(im)
        for x in range(0,im.width,16):d.line((x,0,x,im.height),fill='#7c9179')
        for y in range(0,im.height,16):d.line((0,y,im.width,y),fill='#7c9179')
    for row,f in enumerate(F):
        yaw=math.radians(metadata['cameraContract']['modelYawDegrees'][f]);dx=snap(-math.sin(yaw)*travel);dy=snap(-math.sin(math.radians(40))*math.cos(yaw)*travel)
        tile=frames[f,clip,i];im.paste(tile,(row*panel+margin+(0 if padded else 36)+dx,10+margin+dy),tile)
    return im
four('idle',0).save(O/'scene-native.png')
def gif(images,name,duration):
    images[0].save(O/name,save_all=True,append_images=images[1:],duration=duration,loop=0,disposal=2,optimize=False)
seq=[('idle',0)]+[('walk',i) for i in range(32)]+[('action',i) for i in range(16)]
native=[]
for clip,i in seq:
    im=Image.new('RGB',(W*4,W),'#879b82')
    for row,f in enumerate(F):im.paste(frames[f,clip,i],(row*W,0),frames[f,clip,i])
    native.append(im)
gif(native,'preview-native.gif',[clips[c]['frameDuration'] for c,i in seq])
gif([im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST) for im in native],'preview.gif',[clips[c]['frameDuration'] for c,i in seq])
gif([four('walk',i%32,G['strideWorldUnits']*10*i/32,True) for i in range(64)],'travel-native.gif',G['frameDurationMs'])
allowed=set(P.values())|{(0,0,0,0)};assert set(sheet.get_flattened_data())<=allowed
body_ranges={}
for f in F:
    centers=[]
    for r in G['records']:
        if r['facing']!=f or r['clip']!='walk':continue
        im=Image.new('RGBA',(W,W));painted_part(im,'bodies',r)
        occupied=[(x,y) for y in range(W) for x in range(W) if im.getpixel((x,y))[3]]
        centers.append(sum(y for x,y in occupied)/len(occupied))
    body_ranges[f]=max(centers)-min(centers)
    assert body_ranges[f]>=1,(f,'finished torso weight transfer disappeared',body_ranges[f])
(O/'pixel-audit.json').write_text(json.dumps(dict(identity=metadata['identity'],poses=196,binaryAlpha=True,fixedPalette=True,minimumPadding=2,freshSpeciesSource=True,retainedRigidPaintMasters=True,bodyPaintCentroidRangePixels=body_ranges,rootTravelPixelsPerCycle=metadata['rootTravelPixelsPerCycle'],walkDurationMs=32*G['frameDurationMs'],velocityPixelsPerSecond=metadata['rootTravelPixelsPerCycle']/(32*G['frameDurationMs']/1000)),indent=2)+'\n',encoding='utf8')
print('LONG_LEGGED_FINISH_OK',species,metadata['sheetSha256'])
