"""Deterministic authored pixel composition from independent Blender projection.

Does not read Blender rendered colors, resize finished sprites, or infer contacts
from authored pixels. The guide mesh/IK source is independent of these masters.
"""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
SOURCE = ROOT/'art-source/wildlife-v2/fox/pilot-v2'
OUT = ROOT/'public/demos/wildlife-v2/fox/pilot-v2'
M = json.loads((SOURCE/'masters.json').read_text())
G = json.loads((OUT/'projected-guides.json').read_text())
PALETTE = {k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
PALETTE['n'] = PALETTE['k']
W,H = G['canvas']
FACINGS = list(G['facings'])

def snap(v): return int(math.floor(v+.5))
def xy(v): return tuple(snap(x) for x in v[:2])
def pattern(group, facing=None):
    entry = M[group][facing] if facing else M[group]
    if 'mirror' in entry:
        rows = [r[::-1] for r in M[group][entry['mirror']]['pixels']]
    else: rows = entry['pixels']
    width = len(rows[0])
    assert all(len(r)==width for r in rows)
    im = Image.new('RGBA',(width,len(rows)))
    for y,row in enumerate(rows):
        for x,ch in enumerate(row):
            if ch!='.': im.putpixel((x,y),PALETTE[ch])
    return im,entry['offset']

def paste_part(im, group, facing, anchor):
    p,offset = pattern(group,facing)
    pos = (snap(anchor[0])+offset[0],snap(anchor[1])+offset[1])
    im.alpha_composite(p,pos)
    return p,pos

def tail(im, record):
    """Continuous authored integer ribbon: broad upper/shadow clusters, cream tip."""
    points = [xy(p) for p in record['tail']]
    d = ImageDraw.Draw(im)
    # Connected variable-width contour fitted to rigid volume center projections.
    normals=[]
    for i,p in enumerate(points):
        a,b=points[max(0,i-1)],points[min(len(points)-1,i+1)]
        vx,vy=b[0]-a[0],b[1]-a[1]
        length=math.hypot(vx,vy) or 1
        radius=M['tail']['radii'][i]
        normals.append((-vy/length*radius,vx/length*radius))
    contour=[(snap(p[0]+n[0]),snap(p[1]+n[1])) for p,n in zip(points,normals)]
    contour += [(snap(p[0]-n[0]),snap(p[1]-n[1])) for p,n in reversed(list(zip(points,normals)))]
    d.polygon(contour,fill=PALETTE['o'])
    d.line(contour+[contour[0]],fill=PALETTE['s'],width=1)
    d.line(points[1:3],fill=PALETTE['h'],width=2)
    d.line(points[3:],fill=PALETTE['C'],width=2)
    d.point(points[-1],fill=PALETTE['c'])

def leg(im,contact,near):
    d=ImageDraw.Draw(im)
    hip,knee,foot=[xy(contact['screen'][k]) for k in ['hip','knee','foot']]
    d.line([hip,knee],fill=PALETTE['o' if near else 's'],width=2)
    d.line([knee,foot],fill=PALETTE['p' if near else 'k'],width=1)
    paw,offset=pattern('paw')
    im.alpha_composite(paw,(foot[0]+offset[0],foot[1]+offset[1]))

def compose(r):
    im=Image.new('RGBA',(W,H))
    ordered=sorted(r['contacts'].items(),key=lambda item:item[1]['screen']['hip'][2],reverse=True)
    for i,(name,c) in enumerate(ordered): leg(im,c,i>=2)
    if r['facing']!='up': tail(im,r)
    if r['facing']=='up': paste_part(im,'heads',r['facing'],r['head'])
    paste_part(im,'bodies',r['facing'],r['body'])
    if r['facing']=='up': tail(im,r)
    if r['facing']!='up': paste_part(im,'heads',r['facing'],r['head'])
    return im

records=G['records']
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in records}
columns=17
sheet=Image.new('RGBA',(W*columns,H*4))
metadata={'identity':M['identity'],'status':'draft pending coordinator visual review; no human approval','image':'sheet.png','frameWidth':W,'frameHeight':H,'anchor':G['anchor'],'fps':8,'facings':{},'camera':{k:G[k] for k in ['elevationAboveGround','polarAngleFromVertical','cameraLocation','cameraEuler','orthoScale','shiftY','pixelsPerWorldUnit','facings']},'rootMotion':False,'clips':{'idle':{'start':0,'count':1},'walk':{'start':1,'count':8},'action':{'start':9,'count':8,'description':'tail flick with stable head orientation'}}}
for row,f in enumerate(FACINGS):
    metadata['facings'][f]={'row':row,'frames':[]}
    for clip,start,count in [('idle',0,1),('walk',1,8),('action',9,8)]:
        for i in range(count):
            im=frames[f,clip,i]
            sheet.alpha_composite(im,((start+i)*W,row*H))
            r=next(r for r in records if (r['facing'],r['clip'],r['index'])==(f,clip,i))
            metadata['facings'][f]['frames'].append({'clip':clip,'index':i,'rect':[(start+i)*W,row*H,W,H],'visibleBounds':list(im.getbbox()),'contacts':{name:{'planted':c['planted'],'foot':c['screen']['foot'],'ground':c['screen']['ground']} for name,c in r['contacts'].items()}})
sheet.save(OUT/'sheet.png')
metadata['sheetSha256']=hashlib.sha256((OUT/'sheet.png').read_bytes()).hexdigest()
metadata['motionIdentity']='fox-pilot-v2-motion-02'
metadata['gifTiming']='Alternating 120/130ms samples; exact 8fps mean; 4000ms full sequence'
(OUT/'sprite.json').write_text(json.dumps(metadata,indent=2))

contact=Image.new('RGBA',(W*17,H*4+40),'#879b82')
contact.alpha_composite(sheet,(0,30))
d=ImageDraw.Draw(contact)
d.text((4,4),'FOX pilot-v2  | idle | eight walk poses | eight tail-flick poses',fill='white')
contact.save(OUT/'contact-sheet-native.png')
contact.resize((contact.width*3,contact.height*3),Image.Resampling.NEAREST).save(OUT/'contact-sheet.png')
for f in FACINGS:
    strip=Image.new('RGBA',(W*8,H*3+36),'#879b82')
    d=ImageDraw.Draw(strip)
    for row,clip in enumerate(['idle','walk','action']):
        d.text((0,row*H+row*12),f'{f} {clip}',fill='white')
        count=1 if clip=='idle' else 8
        for i in range(count):strip.alpha_composite(frames[f,clip,i],(i*W,row*(H+12)+12))
    strip.resize((strip.width*4,strip.height*4),Image.Resampling.NEAREST).save(OUT/f'strip-{f}.png')

# True source crops and approved person are placed without resampling in a scene.
atlas=Image.open(ROOT/'public/assets/tilesets/me-complete.png').convert('RGBA')
def crop(rect):
    x,y,w,h=rect
    return atlas.crop((x,y,x+w,y+h))
background=Image.new('RGBA',(320,208),'#769458')
background.alpha_composite(crop([1920,7312,160,160]),(160,-96))
background.alpha_composite(crop([0,1152,208,64]),(96,130))
background.alpha_composite(crop([256,96,48,64]),(8,4))
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scene_frame(i,clip='walk'):
    im=background.copy()
    for n,f in enumerate(FACINGS):
        anchor=(76+n*64,107)
        im.alpha_composite(frames[f,clip,i],(anchor[0]-24,anchor[1]-31))
        p=person.crop((0,n*32,32,n*32+32))
        im.alpha_composite(p,(anchor[0]-16,66-27))
    return im
scene_frame(0,'idle').save(OUT/'scene-native.png')
scene_frame(0,'idle').resize((1280,832),Image.Resampling.NEAREST).save(OUT/'scene-4x.png')
background.save(OUT/'scene-background.png')
# Two full locomotion loops, action, return to idle. No root travel.
sequence=[('idle',0)]*4+[('walk',i) for _ in range(2) for i in range(8)]+[('action',i) for i in range(8)]+[('idle',0)]*4
def gif_save(images,path):
    # GIF format has transparent index but review previews use an opaque scene.
    images=[im.convert('RGB') for im in images]
    # GIF stores centiseconds: a scalar 125ms silently truncates to 120ms.
    # Alternate 120/130ms to retain exact 8fps mean and a 4-second sequence.
    durations=[120 if i%2==0 else 130 for i in range(len(images))]
    images[0].save(path,save_all=True,append_images=images[1:],duration=durations,loop=0,disposal=2,optimize=False)
native=[]
for clip,i in sequence:
    im=Image.new('RGBA',(W*4,H),'#879b82')
    for n,f in enumerate(FACINGS): im.alpha_composite(frames[f,clip,i],(n*W,0))
    native.append(im)
gif_save(native,OUT/'preview-native.gif')
gif_save([im.resize((im.width*6,im.height*6),Image.Resampling.NEAREST) for im in native],OUT/'preview.gif')
gif_save([scene_frame(i,clip) for clip,i in sequence],OUT/'scene-native.gif')
gif_save([scene_frame(i,clip).resize((1280,832),Image.Resampling.NEAREST) for clip,i in sequence],OUT/'scene-4x.gif')

# Projection evidence overlay is drawn from bpy-exported vertices, not pixel art.
guide_sheet=Image.new('RGBA',(W*8,H*4),'#23343b')
for row,f in enumerate(FACINGS):
    for index in range(8):
        r=next(r for r in records if (r['facing'],r['clip'],r['index'])==(f,'walk',index))
        im=Image.new('RGBA',(W,H),'#23343b');d=ImageDraw.Draw(im)
        for name,v in r['volumes'].items():
            color='#b5dba0' if 'skull' in name or 'ear-' in name else '#597d8a'
            contour=[xy(point) for point in v['hull']]
            d.line(contour+[contour[0]],fill=color,width=1)
        for name,c in r['contacts'].items():
            points=[xy(c['screen'][k]) for k in ['hip','knee','foot']]
            d.line(points,fill='#f8c878',width=1)
            p=xy(c['screen']['ground'])
            d.point(p,fill='#ff5555' if c['planted'] else '#5588ff')
        guide_sheet.alpha_composite(im,(index*W,row*H))
guide_sheet.resize((guide_sheet.width*4,guide_sheet.height*4),Image.Resampling.NEAREST).save(OUT/'projected-volume-contact-sheet.png')
head_guides=Image.new('RGBA',(W*4,H),'#23343b')
for column,f in enumerate(FACINGS):
    r=next(r for r in records if r['facing']==f and r['clip']=='idle')
    im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im)
    for name,v in r['volumes'].items():
        if any(part in name for part in ['skull','cheek','muzzle','ear-','nose','eye-']):
            d.polygon([xy(point) for point in v['hull']],fill='#b5dba0')
    im.save(OUT/'guides'/f'head-silhouette-{f}.png')
    head_guides.alpha_composite(im,(column*W,0))
head_guides.resize((head_guides.width*6,H*6),Image.Resampling.NEAREST).save(OUT/'head-silhouettes.png')
camera_comparison=Image.new('RGBA',(W*4*4,H*4+20),'#879b82')
camera_scenes=Image.new('RGBA',(320,208),'#879b82')
d=ImageDraw.Draw(camera_comparison)
for row,elevation in enumerate([40]):
    comparison_scene=background.copy()
    for column,f in enumerate(FACINGS):
        guide=Image.open(OUT/'guides'/f'camera-{elevation}-{f}.png').convert('RGBA')
        camera_comparison.alpha_composite(guide,(column*W*4,row*(H*4+20)+20))
        d.text((column*W*4,row*(H*4+20)),f'{elevation} degrees ABOVE GROUND {f}',fill='white')
        anchor=(76+column*64,107)
        comparison_scene.alpha_composite(person.crop((0,column*32,32,column*32+32)),(anchor[0]-16,39))
        comparison_scene.alpha_composite(guide.resize((W,H),Image.Resampling.NEAREST),(anchor[0]-24,anchor[1]-31))
    ImageDraw.Draw(comparison_scene).text((4,180),f'{elevation} degrees ABOVE GROUND - Blender guide',fill='white')
    camera_scenes.alpha_composite(comparison_scene,(0,row*208))
camera_comparison.save(OUT/'camera-comparison.png')
camera_scenes.resize((1280,208*4),Image.Resampling.NEAREST).save(OUT/'camera-scene-comparison.png')

# Integrity assertions are distinct from visual review and approval.
allowed=set(PALETTE.values())|{(0,0,0,0)}
issues=[]
heights={}
for r in records:
    im=frames[r['facing'],r['clip'],r['index']]
    assert set(im.getchannel('A').get_flattened_data())<={0,255}
    assert set(im.get_flattened_data())<=allowed
    bbox=im.getbbox();assert bbox and bbox[0]>=2 and bbox[1]>=2 and bbox[2]<=W-2 and bbox[3]<=H-2, (r['facing'],r['clip'],r['index'],bbox)
    assert abs(r['anchor'][0]-24)<.01 and abs(r['anchor'][1]-31)<.01
    for c in r['contacts'].values():
        assert abs(c['lengths'][0]-.36)<1e-6 and abs(c['lengths'][1]-.34)<1e-6
        if c['planted']:assert abs(c['foot'][2]-.065)<1e-6
    if r['clip']=='idle': heights[r['facing']]=bbox[3]-bbox[1]
for f in FACINGS:
    p,offset=pattern('heads',f)
    head_positions=[xy(r['head']) for r in records if r['facing']==f and r['clip']=='walk']
    assert len(set(head_positions))==1
    baseline=None
    for i in range(8):
        pos=(head_positions[i][0]+offset[0],head_positions[i][1]+offset[1])
        patch_image=frames[f,'walk',i].crop((*pos,pos[0]+p.width,pos[1]+p.height))
        # Only the complete opaque template is the head; transparent bounding-box
        # corners contain legitimately moving legs/background and are excluded.
        patch=bytes(channel for y in range(p.height) for x in range(p.width) if p.getpixel((x,y))[3] for channel in patch_image.getpixel((x,y)))
        if baseline is None: baseline=patch
        assert patch==baseline,('full head patch changed',f,i)
decoded=Image.open(OUT/'sheet.png').convert('RGBA')
assert decoded.tobytes()==sheet.tobytes()
validation={'status':'draft-integrity only; visual findings in review-observations.md','visibleIdleHeights':heights,'nativeCanvas':[W,H],'alpha':[0,255],'paletteColors':len(set(PALETTE.values())),'constantAnchor':G['anchor'],'fixedLimbLengths':[.36,.34],'fullWalkHeadPatchIdentity':True,'decodedSheetIdentity':True,'geometryScaleKeys':False,'finisherSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'masterSha256':hashlib.sha256((SOURCE/'masters.json').read_bytes()).hexdigest(),'sceneSources':{'atlas':'public/assets/tilesets/me-complete.png','roof':[1920,7312,160,160],'tree':[256,96,48,64],'cars':[0,1152,208,64],'Explorer':'public/demos/pixel-characters/person-32.png'},'limitations':['Scenes use a plain green ground behind exact Modern Exteriors assets; not a captured gameplay world.','Rigid-volume guides are anatomy/motion references, not finished pixel art.','Human approval and coordinator style/motion gates remain pending.']}
(OUT/'validation.json').write_text(json.dumps(validation,indent=2))
print(json.dumps(validation,indent=2))
