"""Authored native letter masters, deterministic integer Pillow composition."""
from pathlib import Path
import math,json,hashlib
from PIL import Image,ImageDraw
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/rabbit/pilot-v1'
M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text())
PAL={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};W=32;FACINGS=list(G['facings'])
def snap(x):return math.floor(x+.5)
def xy(p):return tuple(snap(x) for x in p[:2])
def pattern(group,facing=None):
    e=M[group][facing] if facing else M[group]
    rows=M[group][e['mirror']]['pixels'] if 'mirror' in e else e['pixels']
    if 'mirror' in e:rows=[r[::-1] for r in rows]
    assert len(set(map(len,rows)))==1,(group,facing)
    im=Image.new('RGBA',(len(rows[0]),len(rows)))
    for y,row in enumerate(rows):
        for x,ch in enumerate(row):
            if ch!='.':im.putpixel((x,y),PAL[ch])
    return im,e['offset']
def paste(im,group,facing,anchor):
    p,off=pattern(group,facing);a=xy(anchor);im.alpha_composite(p,(a[0]+off[0],a[1]+off[1]))
def center(r,name):
    b=r['volumes'][name]['bounds'];return [(b[0]+b[2])/2,(b[1]+b[3])/2]
def limb(im,name,c,near,facing):
    d=ImageDraw.Draw(im);hip,knee,foot=[xy(c['screen'][k]) for k in ['hip','knee','foot']]
    hind=name.startswith('hind')
    if hind:
        d.line([hip,knee],fill=PAL['S' if not near else 'B'],width=3)
        d.line([knee,foot],fill=PAL['K'],width=2)
        d.line([knee,foot],fill=PAL['S' if not near else 'B'],width=1)
    else:d.line([hip,knee,foot],fill=PAL['S' if not near else 'B'],width=1)
    # Paw silhouettes follow the independently projected long-foot mesh hull.
    # Head-facing white muzzle is never applied to rear feet.
    paste(im,'hindpaw' if hind else 'forepaw',None,c['screen']['foot'])
def ears(im,r):
    f=r['facing'];items=[(n,r['landmarks']['ear-hinge'+str(n)]) for n in [-1,1]]
    items.sort(key=lambda p:p[1][2],reverse=True)
    for index,(side,a) in enumerate(items):
        key=f if f in ['up','down'] else f+('-far' if index==0 else '-near')
        if r['clip']=='action' and r['index'] in [1,2,3,4]:
            # Use the SAME authored ear letters. Independent rigid guide-tip
            # changes warp the integer clusters, retaining idle stylization.
            # A second rendering treatment made ears falsely grow in drawing03.
            idle=next(x for x in G['records'] if x['facing']==f and x['clip']=='idle')
            old=idle['landmarks']['ear-tip'+str(side)];tip=r['landmarks']['ear-tip'+str(side)]
            delta=[tip[i]-old[i] for i in range(2)];p,off=pattern('ears',key);base=xy(a)
            for y in range(p.height):
                weight=1-y/(p.height-1)
                for x in range(p.width):
                    color=p.getpixel((x,y))
                    if color[3]:im.putpixel((base[0]+off[0]+x+snap(delta[0]*weight),base[1]+off[1]+y+snap(delta[1]*weight)),color)
        else:paste(im,'ears',key,a)
def compose(r):
    im=Image.new('RGBA',(W,W));f=r['facing']
    contacts=sorted(r['contacts'].items(),key=lambda p:p[1]['screen']['hip'][2],reverse=True)
    for n,c in contacts[:2]:limb(im,n,c,False,f)
    if f=='up':ears(im,r);paste(im,'heads',f,r['landmarks']['HEAD-stable-volume'])
    paste(im,'rump',f,center(r,'rump'));paste(im,'chest',f,center(r,'chest'))
    for n,c in contacts[2:]:limb(im,n,c,True,f)
    if f!='down':paste(im,'tail',None,r['landmarks']['round-tail'])
    if f!='up':ears(im,r);paste(im,'heads',f,r['landmarks']['HEAD-stable-volume'])
    return im
records=G['records'];frames={(r['facing'],r['clip'],r['index']):compose(r) for r in records}
CLIPS=[('idle',0,1),('hop',1,8),('action',9,6)];sheet=Image.new('RGBA',(15*W,4*W))
meta={'identity':M['identity'],'status':'draft pending coordinator review; no approval','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'fps':8,'rootMotion':False,'camera':{**G['cameraContract'],'orthoScale':3.2,'shiftY':.25},'clips':{c:{'start':s,'count':n} for c,s,n in CLIPS},'facings':{}}
for row,f in enumerate(FACINGS):
    meta['facings'][f]={'row':row,'frames':[]}
    for clip,start,count in CLIPS:
        for i in range(count):
            im=frames[f,clip,i];sheet.alpha_composite(im,((start+i)*W,row*W))
            r=next(r for r in records if (r['facing'],r['clip'],r['index'])==(f,clip,i))
            meta['facings'][f]['frames'].append({'clip':clip,'index':i,'phase':r['phase'],'rect':[(start+i)*W,row*W,W,W],'visibleBounds':im.getbbox(),'contacts':{n:{'planted':c['planted'],'foot':c['screen']['foot'],'ground':c['screen']['ground']} for n,c in r['contacts'].items()}})
sheet.save(O/'sheet.png');meta['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest();(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n')
contact=Image.new('RGBA',(15*W,4*W+24),'#82956e');contact.alpha_composite(sheet,(0,24));ImageDraw.Draw(contact).text((3,5),'RABBIT: idle | gather push lift apex reach fore hind settle | listen',fill='white')
contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*4,contact.height*4),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in FACINGS:
    strip=Image.new('RGBA',(W*8,3*(W+16)),'#82956e');d=ImageDraw.Draw(strip)
    for row,(clip,_,count) in enumerate(CLIPS):
        d.text((2,row*(W+16)),f'{f} {clip}',fill='white')
        for i in range(count):strip.alpha_composite(frames[f,clip,i],(i*W,row*(W+16)+14))
    strip.resize((strip.width*4,strip.height*4),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(ROOT/'public/assets/tilesets/me-complete.png').convert('RGBA')
background=Image.new('RGBA',(320,208),'#769458')
for rect,pos in [([1920,7312,160,160],(160,-96)),([0,1152,208,64],(96,130)),([256,96,48,64],(8,4))]:
    x,y,w,h=rect;background.alpha_composite(atlas.crop((x,y,x+w,y+h)),pos)
background.save(O/'scene-background.png');person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scene_frame(clip,i):
    im=background.copy()
    for row,f in enumerate(FACINGS):
        x=76+row*64;im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(x-16,39));im.alpha_composite(frames[f,clip,i],(x-16,107-24))
    return im
scene_frame('idle',0).save(O/'scene-native.png');scene_frame('idle',0).resize((1280,832),Image.Resampling.NEAREST).save(O/'scene-4x.png')
sequence=[('idle',0)]*4+[('hop',i) for _ in range(2) for i in range(8)]+[('action',i) for i in range(6)]+[('idle',0)]*6
def savegif(images,name):
    ims=[im.convert('RGB') for im in images];ims[0].save(O/name,save_all=True,append_images=ims[1:],duration=[120 if i%2==0 else 130 for i in range(len(ims))],loop=0,optimize=False,disposal=2)
native=[]
for clip,i in sequence:
    im=Image.new('RGBA',(W*4,W),'#82956e')
    for row,f in enumerate(FACINGS):im.alpha_composite(frames[f,clip,i],(row*W,0))
    native.append(im)
savegif(native,'preview-native.gif');savegif([im.resize((im.width*6,im.height*6),Image.Resampling.NEAREST) for im in native],'preview.gif')
savegif([scene_frame(c,i) for c,i in sequence],'scene-native.gif');savegif([scene_frame(c,i).resize((1280,832),Image.Resampling.NEAREST) for c,i in sequence],'scene-4x.gif')
# Independent actual mesh hulls overlaid with final pixels and contacts.
guides=Image.new('RGBA',(W*8,W*4),'#23343b');overlay=Image.new('RGBA',guides.size,'#23343b')
for row,f in enumerate(FACINGS):
    for i in range(8):
        r=next(r for r in records if r['facing']==f and r['clip']=='hop' and r['index']==i)
        im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im)
        for name,v in r['volumes'].items():
            ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#bdd899' if name in ['skull','rump','chest'] else '#648fa5',width=1)
        for n,c in r['contacts'].items():
            d.line([xy(c['screen'][k]) for k in ['hip','knee','foot']],fill='#f9b658',width=1);d.point(xy(c['screen']['ground']),fill='red' if c['planted'] else '#718fff')
        guides.alpha_composite(im,(i*W,row*W));art=frames[f,'hop',i].copy();art.alpha_composite(im);overlay.alpha_composite(art,(i*W,row*W))
guides.resize((guides.width*4,guides.height*4),Image.Resampling.NEAREST).save(O/'projected-volume-contact-sheet.png');overlay.resize((overlay.width*4,overlay.height*4),Image.Resampling.NEAREST).save(O/'guide-art-overlay.png')
heights={}
for (f,c,i),im in frames.items():
    assert set(im.getchannel('A').get_flattened_data())<={0,255}
    assert set(im.get_flattened_data())<=set(PAL.values())|{(0,0,0,0)}
    b=im.getbbox();assert b and min(b[:2])>=2 and max(b[2:])<=30,(f,c,i,b)
    if c=='idle':heights[f]=b[3]-b[1]
assert Image.open(O/'sheet.png').convert('RGBA').tobytes()==sheet.tobytes()
report={'status':'draft integrity only','identity':M['identity'],'nativeCanvas':[32,32],'visibleIdleHeights':heights,'paletteColors':len(PAL),'binaryAlpha':True,'constantAnchor':[16,24],'decodedSheetMatches':True,'rootMotion':False,'action':'quiet ear-perk/listen, six poses; skull fixed','headTemplateIdentity':'Same full authored skull patch for each facing in every pose; ears articulated separately','sceneSources':{'atlas':'public/assets/tilesets/me-complete.png','roof':[1920,7312,160,160],'tree':[256,96,48,64],'cars':[0,1152,208,64],'Explorer':'public/demos/pixel-characters/person-32.png'},'stylization':M['stylization']}
(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
