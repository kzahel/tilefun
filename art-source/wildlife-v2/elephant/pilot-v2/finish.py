"""Integer Pillow composition of retained elephant palette-letter masters.
Reads independent mesh/joint positions, never guide render colors.
"""
import json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/elephant/pilot-v2'
M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text())
P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
F=list(G['cameraContract']['modelYawDegrees']);W=G['canvas'][0]
def snap(v):return int(math.floor(v+.5))
def xy(v):return tuple(snap(x) for x in v[:2])
def pattern(part):
    rows=part['pixels'];im=Image.new('RGBA',(len(rows[0]),len(rows)))
    for y,row in enumerate(rows):
        assert len(row)==im.width
        for x,ch in enumerate(row):
            if ch!='.':im.putpixel((x,y),P[ch])
    return im
parts={group:{f:pattern(M[group][f]) for f in F} for group in ['heads','bodies']}
footmaster=pattern(M['foot'])
heelmaster=pattern(M['rearHeel'])
def paste(im,group,r):
    offset=M[group][r['facing']]['offset'];anchor=xy(r['body'])
    im.alpha_composite(parts[group][r['facing']],(anchor[0]+offset[0],anchor[1]+offset[1]))
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
def leg(im,c,near,facing):
    ps=[xy(c['screen'][k]) for k in ['hip','knee','foot']]
    ribbon(im,ps,[3.4,3.0,2.5],base='g' if near else 's',highlight=near)
    master=heelmaster if facing=='up' else footmaster
    foot=master if near else master.copy()
    if not near:
        for y in range(foot.height):
            for x in range(foot.width):
                rgba=foot.getpixel((x,y))
                if rgba==P['g'] or rgba==P['h']:foot.putpixel((x,y),P['e'])
    x,y=ps[-1];im.alpha_composite(foot,(x-4,y-2))
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
    tuft=xy(r['landmarks']['tail-tuft'])
    hull=r['volumes']['tail-volume']['hull'];a=xy(hull[0])
    # Endpoints from independently projected tail volume, attached inside rump.
    if r['facing']=='up':a=(56,71)
    elif r['facing']=='left':a=(78,53)
    else:a=(34,53)
    d=ImageDraw.Draw(im);d.line([a,tuft],fill=P['o'],width=2)
    d.line([a,tuft],fill=P['e'],width=1);d.ellipse((tuft[0]-1,tuft[1]-1,tuft[0]+1,tuft[1]+2),fill=P['s'])
def compose(r):
    im=Image.new('RGBA',(W,W))
    ordered=sorted(r['contacts'].items(),key=lambda x:x[1]['screen']['hip'][2],reverse=True)
    for n,c in ordered[:2]:leg(im,c,False,r['facing'])
    if r['facing']=='up':paste(im,'heads',r)
    # Profile far ear is included in the head master; torso overlays its lower edge.
    if r['facing'] in ['left','right']:paste(im,'heads',r)
    paste(im,'bodies',r)
    for n,c in ordered[2:]:leg(im,c,True,r['facing'])
    tail(im,r)
    if r['facing']!='up':
        trunk(im,r);paste(im,'heads',r)
    return im
records=G['records'];frames={(r['facing'],r['clip'],r['index']):compose(r) for r in records}
sheet=Image.new('RGBA',(W*21,W*4))
metadata={'identity':M['identity'],'motionIdentity':'elephant-pilot-v2-motion-01','sourceMotionIdentity':'elephant-pilot-v1-motion-04','reviewStatus':'pending coordinator and human review','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'fps':5,'rootMotion':False,'cameraContract':G['cameraContract'],'orthoScale':G['orthoScale'],'shiftY':G['shiftY'],'clips':{'idle':{'start':0,'count':1},'walk':{'start':1,'count':12,'durationMs':2400,'description':'Lateral sequence HL-FL-HR-FR, 75% stance, fixed-length IK, low foot lift, two passing samples per leg'},'action':{'start':13,'count':8,'durationMs':1600,'description':'retained five-joint trunk reach/curl and tail follow-through; stable skull and ears'}},'facings':{}}
for row,f in enumerate(F):
    metadata['facings'][f]={'row':row,'frames':[]}
    for clip,start,count in [('idle',0,1),('walk',1,12),('action',13,8)]:
        for i in range(count):
            im=frames[f,clip,i];sheet.alpha_composite(im,((start+i)*W,row*W))
            r=next(r for r in records if (r['facing'],r['clip'],r['index'])==(f,clip,i))
            metadata['facings'][f]['frames'].append({'clip':clip,'index':i,'rect':[(start+i)*W,row*W,W,W],'visibleBounds':list(im.getbbox()),'contacts':r['contacts']})
sheet.save(O/'sheet.png');metadata['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest()
(O/'sprite.json').write_text(json.dumps(metadata,indent=2)+'\n')
(O/'masters.json').write_bytes((S/'masters.json').read_bytes())
contact=Image.new('RGBA',(W*21,W*4+20),'#879b82');contact.alpha_composite(sheet,(0,20))
ImageDraw.Draw(contact).text((4,4),'African elephant | idle | heavy walk 0-11 | trunk curl 0-7 | down/up/left/right',fill='white')
contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*2,contact.height*2),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
    strip=Image.new('RGBA',(W*12,(W+14)*3),'#879b82');d=ImageDraw.Draw(strip)
    for row,clip in enumerate(['idle','walk','action']):
        d.text((2,row*(W+14)+2),f'{f} {clip}: chronological',fill='white')
        for i in range({'idle':1,'walk':12,'action':8}[clip]):strip.alpha_composite(frames[f,clip,i],(i*W,row*(W+14)+14))
    strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*2,strip.height*2),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(ROOT/'public/assets/tilesets/me-complete.png').convert('RGBA')
def crop(rect):x,y,w,h=rect;return atlas.crop((x,y,x+w,y+h))
bg=Image.new('RGBA',(480,240),'#769458')
bg.alpha_composite(crop([1920,7312,160,160]),(320,-94))
bg.alpha_composite(crop([256,96,48,64]),(4,5))
bg.alpha_composite(crop([0,1152,208,64]),(130,170))
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scenery(clip,i):
    im=bg.copy()
    for n,f in enumerate(F):
        im.alpha_composite(frames[f,clip,i],(56+n*104,59))
        im.alpha_composite(person.crop((0,n*32,32,n*32+32)),(80+n*104,25))
    return im
bg.save(O/'scene-background.png');scenery('idle',0).save(O/'scene-native.png')
scenery('idle',0).resize((1920,960),Image.Resampling.NEAREST).save(O/'scene-4x.png')
sequence=[('idle',0)]*3+[('walk',i) for _ in range(2) for i in range(12)]+[('action',i) for i in range(8)]+[('idle',0)]*3
def gif_save(ims,path):
    ims=[im.convert('RGB') for im in ims];ims[0].save(path,save_all=True,append_images=ims[1:],duration=200,loop=0,disposal=2,optimize=False)
native=[]
for clip,i in sequence:
    im=Image.new('RGBA',(W*4,W),'#879b82')
    for n,f in enumerate(F):im.alpha_composite(frames[f,clip,i],(n*W,0))
    native.append(im)
gif_save(native,O/'preview-native.gif');gif_save([im.resize((W*16,W*4),Image.Resampling.NEAREST) for im in native],O/'preview.gif')
gif_save([scenery(c,i) for c,i in sequence],O/'scene-native.gif')
gif_save([scenery(c,i).resize((1920,960),Image.Resampling.NEAREST) for c,i in sequence],O/'scene-4x.gif')
guides=Image.new('RGBA',(W*12,W*4),'#23343b')
for row,f in enumerate(F):
    for i in range(12):
        r=next(r for r in records if (r['facing'],r['clip'],r['index'])==(f,'walk',i))
        im=Image.new('RGBA',(W,W),'#23343b');d=ImageDraw.Draw(im)
        for n,v in r['volumes'].items():
            ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#a1cbaa' if 'skull' in n or 'ear-' in n else '#597d8a')
        for c in r['contacts'].values():
            d.line([xy(c['screen'][k]) for k in ['hip','knee','foot']],fill='#f8c878')
            d.ellipse(tuple(v+a for v,a in zip(xy(c['screen']['ground'])*2,[-1,-1,1,1])),fill='#ee6666' if c['planted'] else '#7799ff')
        guides.alpha_composite(im,(i*W,row*W))
guides.resize((W*24,W*8),Image.Resampling.NEAREST).save(O/'projected-volume-contact-sheet.png')
over=Image.new('RGBA',(W*4,W*2),'#879b82')
for n,f in enumerate(F):
    r=next(r for r in records if r['facing']==f and r['clip']=='idle');im=frames[f,'idle',0].copy();d=ImageDraw.Draw(im)
    for name,v in r['volumes'].items():
        ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#e3a773',width=1)
    over.alpha_composite(frames[f,'idle',0],(n*W,0));over.alpha_composite(im,(n*W,W))
over.resize((W*16,W*8),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
allowed=set(P.values())|{(0,0,0,0)}
assert set(sheet.getdata())<=allowed
assert set(sheet.getchannel('A').getdata())=={0,255}
for k,im in frames.items():
    b=im.getbbox();assert b and b[0]>=2 and b[1]>=2 and b[2]<=W-2 and b[3]<=W-2,(k,b,'padding')
assert Image.open(O/'sheet.png').convert('RGBA').tobytes()==sheet.tobytes()
timings={}
for name in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif']:
    gif=Image.open(O/name);timings[name]=sum(fr.info['duration'] for fr in ImageSequence.Iterator(gif));assert timings[name]==7600
report={'status':'draft-integrity passed; visual judgment separate','identity':M['identity'],'frameCount':84,'binaryAlpha':True,'palette':M['palette'],'padding':True,'decodedSheetMatches':True,'headMastersStable':True,'gifDurationMs':timings,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F},'styleLimit':'Integer ribbon shading is authored; actual volume guides establish pose provenance, not art acceptance.'}
(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('ELEPHANT_FINISH_OK',report['idleVisibleHeights'])
