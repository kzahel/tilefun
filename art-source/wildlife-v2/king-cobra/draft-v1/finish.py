"""Cobra palette-letter masters, integer composition over independent bpy guides."""
import json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/king-cobra/draft-v1'
G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text())
P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
W=96;F=list(G['cameraContract']['modelYawDegrees']);clips=[('idle',0,1),('slither',1,8),('action',9,6)]
def snap(v):return int(math.floor(v+.5))
def xy(p):return tuple(snap(v) for v in p[:2])
def master(part):
    rows=part['pixels'];im=Image.new('RGBA',(len(rows[0]),len(rows)))
    for y,row in enumerate(rows):
        assert len(row)==im.width
        for x,ch in enumerate(row):
            if ch!='.':im.putpixel((x,y),P[ch])
    return im
parts={g:{f:master(M[g][f]) for f in F} for g in ['heads','hoods']}
def compose(r):
    im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im)
    # Union of actual projected hulls removes arbitrary link-boundary outlines.
    mask=Image.new('1',(W,W));md=ImageDraw.Draw(mask)
    for name,v in r['volumes'].items():
        if name.startswith(('body-link-','joint-','low-neck-link')):
            md.polygon([xy(p) for p in v['hull']],fill=1)
    im.paste(P['s'],(0,0,W,W),mask)
    # Inner band follows the centreline; no mesh colors are sampled.
    points=[xy(p) for p in r['nodes']]
    for j,(a,b) in enumerate(zip(points,points[1:])):
        d.line([a,b],fill=P['b'] if j<10 else P['s'],width=2 if j<7 else 1)
        if j<9:d.line([(a[0],a[1]-1),(b[0],b[1]-1)],fill=P['h'],width=1)
    # Broad, sparse adult band clusters follow fixed body positions, not frame noise.
    for j in [3,7,11]:
        p=points[j];d.point(p,fill=P['s'])
    for group in ['hoods','heads']:
        off=M[group][r['facing']]['offset'];a=xy(r['head'])
        im.alpha_composite(parts[group][r['facing']],(a[0]+off[0],a[1]+off[1]))
    if r['clip']=='action' and r['index'] in [2,3,4] and r['facing']!='up':
        # Only projected section beyond the stable skull can be visible.
        for a,b in r['tongue']:
            aa,bb=xy(a),xy(b)
            if r['facing']=='left' and bb[0]<xy(r['head'])[0]-3:d.line([aa,bb],fill=P['t'])
            elif r['facing']=='right' and bb[0]>xy(r['head'])[0]+3:d.line([aa,bb],fill=P['t'])
            elif r['facing']=='down' and bb[1]>xy(r['head'])[1]+1:d.line([aa,bb],fill=P['t'])
        # Re-paste opaque skull to occlude the retracted/internal tongue root.
        off=M['heads'][r['facing']]['offset'];a=xy(r['head'])
        im.alpha_composite(parts['heads'][r['facing']],(a[0]+off[0],a[1]+off[1]))
    return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']}
sheet=Image.new('RGBA',(W*15,W*4));meta={'identity':M['identity'],'reviewStatus':'pending','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'fps':6.25,'rootMotion':False,'cameraContract':G['cameraContract'],'orthoScale':G['orthoScale'],'shiftY':G['shiftY'],'clips':{},'facings':{}}
for c,start,count in clips:meta['clips'][c]={'start':start,'count':count,'durationMs':count*160,'description':{'idle':'Alert raised head and hood','slither':'Eight-pose posterior travelling bend wave, continuous sliding ventral support, fixed link lengths','action':'Fixed skull tongue extension/retraction with fixed-length distal tail curl; rear tongue hidden'}[c]}
for row,f in enumerate(F):
    meta['facings'][f]={'row':row,'frames':[]}
    for c,start,count in clips:
        for i in range(count):
            im=frames[f,c,i];sheet.alpha_composite(im,((start+i)*W,row*W))
            meta['facings'][f]['frames'].append({'clip':c,'index':i,'rect':[(start+i)*W,row*W,W,W],'visibleBounds':list(im.getbbox())})
sheet.save(O/'sheet.png');meta['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest()
(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');(O/'masters.json').write_bytes((S/'masters.json').read_bytes())
contact=Image.new('RGBA',(W*15,W*4+20),'#879b82');contact.alpha_composite(sheet,(0,20));ImageDraw.Draw(contact).text((4,4),'King cobra | idle | slither 0-7 | tongue 0-5 | down/up/left/right',fill='white')
contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*2,contact.height*2),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
    strip=Image.new('RGBA',(W*8,(W+14)*3),'#879b82');d=ImageDraw.Draw(strip)
    for row,(c,_,count) in enumerate(clips):
        d.text((2,row*(W+14)+2),f'{f} {c} chronological',fill='white')
        for i in range(count):strip.alpha_composite(frames[f,c,i],(i*W,row*(W+14)+14))
    strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*2,strip.height*2),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(R/'public/assets/tilesets/me-complete.png').convert('RGBA')
def crop(rect):x,y,w,h=rect;return atlas.crop((x,y,x+w,y+h))
bg=Image.new('RGBA',(520,208),'#769458');bg.alpha_composite(crop([1920,7312,160,160]),(350,-84));bg.alpha_composite(crop([256,96,48,64]),(4,0));bg.alpha_composite(crop([0,1152,208,64]),(180,145))
person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scenery(c,i):
    im=bg.copy()
    for n,f in enumerate(F):
        im.alpha_composite(frames[f,c,i],(32+n*120,31));im.alpha_composite(person.crop((0,n*32,32,n*32+32)),(4+n*120,62))
    return im
bg.save(O/'scene-background.png');scenery('idle',0).save(O/'scene-native.png');scenery('idle',0).resize((2080,832),Image.Resampling.NEAREST).save(O/'scene-4x.png')
seq=[('idle',0)]*3+[('slither',i) for _ in range(2) for i in range(8)]+[('action',i) for i in range(6)]+[('idle',0)]*3
def gif(ims,path):
    ims=[im.convert('RGB') for im in ims];ims[0].save(path,save_all=True,append_images=ims[1:],duration=160,loop=0,disposal=2,optimize=False)
native=[]
for c,i in seq:
    im=Image.new('RGBA',(W*4,W),'#879b82')
    for n,f in enumerate(F):im.alpha_composite(frames[f,c,i],(n*W,0))
    native.append(im)
gif(native,O/'preview-native.gif');gif([im.resize((W*16,W*4),Image.Resampling.NEAREST) for im in native],O/'preview.gif')
gif([scenery(c,i) for c,i in seq],O/'scene-native.gif');gif([scenery(c,i).resize((2080,832),Image.Resampling.NEAREST) for c,i in seq],O/'scene-4x.gif')
guides=Image.new('RGBA',(W*8,W*4),'#23343b')
for row,f in enumerate(F):
    for i in range(8):
        r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,'slither',i));im=Image.new('RGBA',(W,W),'#23343b');d=ImageDraw.Draw(im)
        for v in r['volumes'].values():
            ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#71928a')
        d.line([xy(p) for p in r['nodes']],fill='#dfcc70')
        for c in r['contacts'].values():d.point(xy(c['screen']),fill='#ee6c56')
        guides.alpha_composite(im,(i*W,row*W))
guides.resize((W*16,W*8),Image.Resampling.NEAREST).save(O/'projected-volume-contact-sheet.png')
over=Image.new('RGBA',(W*4,W*2),'#879b82')
for n,f in enumerate(F):
    r=next(r for r in G['records'] if r['facing']==f and r['clip']=='idle');im=frames[f,'idle',0].copy();d=ImageDraw.Draw(im)
    for v in r['volumes'].values():
        ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#e3a773')
    over.alpha_composite(frames[f,'idle',0],(n*W,0));over.alpha_composite(im,(n*W,W))
over.resize((W*16,W*8),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
assert set(sheet.getchannel('A').getdata())=={0,255};assert set(sheet.getdata())<=set(P.values())|{(0,0,0,0)}
for k,im in frames.items():
    b=im.getbbox();assert b and b[0]>=2 and b[1]>=2 and b[2]<=W-2 and b[3]<=W-2,(k,b)
timings={}
for name in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif']:
    timings[name]=sum(fr.info['duration'] for fr in ImageSequence.Iterator(Image.open(O/name)));assert timings[name]==4480
report={'status':'draft-integrity only; visual review separate','identity':M['identity'],'frameCount':60,'binaryAlpha':True,'palette':M['palette'],'padding':True,'gifDurationMs':timings,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F}}
(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('COBRA_FINISH_OK',report['idleVisibleHeights'])
