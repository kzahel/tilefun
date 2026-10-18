"""Finish the existing palette-letter coats against new evaluated source poses.
Rigid painted torso/head parts follow their own source anchors/angles; limbs,
tail and ears follow separate actual joints. Grounded feet never inherit a bob.
"""
import json, math, hashlib, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[4]
species='elephant';horse=True;assert species=='elephant'
S=ROOT/f'art-source/wildlife-v2/{species}/motion-v2';O=ROOT/f'public/demos/wildlife-v2/{species}/motion-v2'
assert not (S/'receipt.json').exists(),'Registered bank is immutable'
G=json.loads((S/'projection.json').read_text(encoding='utf8'))
M=json.loads((S.parent/'pilot-v2/masters.json').read_text(encoding='utf8'))
W=G['canvas'];F=['down','up','left','right'];P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
def snap(v):return math.floor(v+.5)
def xy(p):return tuple(snap(v) for v in p[:2])
def pattern(group,f):
    part=M[group][f] if f else M[group];rows=part.get('pixels')
    if rows is None:rows=[r[::-1] for r in M[group][part['mirror']]['pixels']]
    im=Image.new('RGBA',(len(rows[0]),len(rows)))
    for y,row in enumerate(rows):
        for x,ch in enumerate(row):
            if ch!='.':im.putpixel((x,y),P[ch])
    return im,part['offset']
def part_image(group,f):
    im=Image.new('RGBA',(W,W));paint,offset=pattern(group,f)
    ref=G['references'][f];anchor=G['anchor']
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
def ribbon(im,points,radii,base='g',highlight=True):
    d=ImageDraw.Draw(im);normals=[]
    for i,p in enumerate(points):
        a,b=points[max(0,i-1)],points[min(len(points)-1,i+1)]
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy) or 1
        normals.append((-dy/length*radii[i],dx/length*radii[i]))
    contour=[(snap(p[0]+n[0]),snap(p[1]+n[1])) for p,n in zip(points,normals)]
    contour += [(snap(p[0]-n[0]),snap(p[1]-n[1])) for p,n in reversed(list(zip(points,normals)))]
    d.polygon(contour,fill=P[base]);d.line(contour+[contour[0]],fill=P['o'],width=1)
    if highlight:
        d.line(points,fill=P['h'],width=2)
        d.line([(p[0]+1,p[1]) for p in points],fill=P[base],width=1)
def leg(im,name,c,near,f):
    ps=[xy(p) for p in c['screen']]
    ribbon(im,ps,[3.4,3.2,2.9,2.6,2.5],base='g' if near else 's',highlight=near)
    foot,offset=pattern('rearHeel' if f=='up' else 'foot',None)
    if not near:
        for y in range(foot.height):
            for x in range(foot.width):
                if foot.getpixel((x,y)) in [P['g'],P['h']]:foot.putpixel((x,y),P['e'])
    x,y=ps[-1];im.alpha_composite(foot,(x+offset[0],y+offset[1]))

def trunk(im,r):
    if r['facing']=='up':return
    points=[xy(p) for p in r['trunk']]
    ribbon(im,points,[3,2.8,2.4,2,1.6,1],highlight=True)
    d=ImageDraw.Draw(im)
    # Restrained 1px transverse folds; no noisy per-frame color sampling.
    for i in [1,2,3]:
        a,b=points[i-1],points[i+1];dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy) or 1
        nx,ny=-dy/length,dx/length;p=points[i]
        d.line([(snap(p[0]-nx),snap(p[1]-ny)),(snap(p[0]+nx),snap(p[1]+ny))],fill=P['e'])
def tail(im,r):
    if r['facing']=='down':return
    a,b=[xy(p) for p in r['tail']];d=ImageDraw.Draw(im)
    d.line([a,b],fill=P['o'],width=2);d.line([a,b],fill=P['e'],width=1)
    d.ellipse((b[0]-1,b[1]-1,b[0]+1,b[1]+2),fill=P['s'])

def compose(r):
    im=Image.new('RGBA',(W,W));order=sorted(r['contacts'].items(),key=lambda q:q[1]['screen'][0][2],reverse=True)
    for n,c in order[:2]:leg(im,n,c,False,r['facing'])
    if r['facing'] in ['up','left','right']:painted_part(im,'heads',r)
    painted_part(im,'bodies',r)
    for n,c in order[2:]:leg(im,n,c,True,r['facing'])
    painted_part(im,'bodies',r);tail(im,r)
    if r['facing']!='up':trunk(im,r);painted_part(im,'heads',r)
    return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']}
clips={'idle':dict(start=0,count=1,frameDuration=200),'walk':dict(start=1,count=32,frameDuration=G['frameDurationMs']),'action':dict(start=33,count=8,frameDuration=200)}
sheet=Image.new('RGBA',(W*41,W*4));metadata=dict(identity=f'{species}-motion-v2-pixels-01',reviewStatus='finished repair; final pixels pending human review; activation authorized in chat',image='sheet.png',frameWidth=W,frameHeight=W,anchor=G['anchor'],rootMotion=False,rootTravelPixelsPerCycle=G['strideWorldUnits']*10,clips=clips,facings={},cameraContract=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text()))
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
bg=Image.new('RGB',(W*4,W+40),'#879b82');d=ImageDraw.Draw(bg)
for y in range(20,W+40,16):d.line((0,y,W*4,y),fill='#7c9179')
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
for row in range(4):bg.paste(person.crop((0,row*32,32,(row+1)*32)),(row*W+4,W-10),person.crop((0,row*32,32,(row+1)*32)))
bg.save(O/'scene-background.png')
def four(clip,i,travel=0,padded=False):
    margin=math.ceil(G['strideWorldUnits']*20)+8 if padded else 0
    panel=W+2*margin
    im=Image.new('RGB',(panel*4,W+40+2*margin),'#879b82') if padded else bg.copy()
    if padded:
        d=ImageDraw.Draw(im)
        for x in range(0,im.width,16):d.line((x,0,x,im.height),fill='#7c9179')
        for y in range(0,im.height,16):d.line((0,y,im.width,y),fill='#7c9179')
    for row,f in enumerate(F):
        yaw=math.radians(metadata['cameraContract']['modelYawDegrees'][f]);dx=snap(-math.sin(yaw)*travel);dy=snap(-math.sin(math.radians(40))*math.cos(yaw)*travel)
        tile=frames[f,clip,i];im.paste(tile,(row*panel+margin+dx,10+margin+dy),tile)
    return im
four('idle',0).save(O/'scene-native.png')
def gif(images,name,duration):
    images[0].save(O/name,save_all=True,append_images=images[1:],duration=duration,loop=0,disposal=2,optimize=False)
seq=[('idle',0)]+[('walk',i) for i in range(32)]+[('action',i) for i in range(8)]
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
(O/'pixel-audit.json').write_text(json.dumps(dict(identity=metadata['identity'],poses=164,binaryAlpha=True,fixedPalette=True,minimumPadding=2,retainedCoatMasters=True,bodyPaintCentroidRangePixels=body_ranges,rootTravelPixelsPerCycle=metadata['rootTravelPixelsPerCycle'],walkDurationMs=32*G['frameDurationMs'],velocityPixelsPerSecond=metadata['rootTravelPixelsPerCycle']/(32*G['frameDurationMs']/1000)),indent=2)+'\n',encoding='utf8')
print('LONG_LEGGED_FINISH_OK',species,metadata['sheetSha256'])
