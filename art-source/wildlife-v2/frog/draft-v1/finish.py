"""Common frog pixel masters and integer articulation finishing from bpy guides."""
import json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/frog/draft-v1'
G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text())
P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};F=list(G['cameraContract']['modelYawDegrees']);W=48
clips=[('idle',0,1),('hop',1,8),('swim',9,8),('action',17,6)]
def snap(x):return int(math.floor(x+.5))
def xy(p):return tuple(snap(x) for x in p[:2])
def pattern(rows):
 im=Image.new('RGBA',(len(rows[0]),len(rows)))
 for y,line in enumerate(rows):
  assert len(line)==im.width,(line,im.width)
  for x,ch in enumerate(line):
   if ch!='.':im.putpixel((x,y),P[ch])
 return im
parts={g:{f:pattern(M[g][f]['pixels']) for f in F} for g in ['bodies','heads']}
eyeParts={k:pattern(v) for k,v in M['eyes'].items()}
idle={f:next(r for r in G['records'] if r['facing']==f and r['clip']=='idle') for f in F}
headOffsets={f:xy([idle[f]['head'][j]-idle[f]['body'][j] for j in [0,1]]) for f in F}
eyeOffsets={f:{s:xy([p[j]-idle[f]['head'][j] for j in [0,1]]) for s,p in idle[f]['eyes'].items()} for f in F}
def anchors(r):
 a=xy(r['body']);delta=headOffsets[r['facing']];return a,(a[0]+delta[0],a[1]+delta[1])
def part(im,group,f,anchor):
 o=M[group][f]['offset'];im.alpha_composite(parts[group][f],(anchor[0]+o[0],anchor[1]+o[1]))
def limb(im,n,c,r,near):
 d=ImageDraw.Draw(im);ps=[xy(c['screen'][k]) for k in ['hip','knee','ankle']]
 hind=n.startswith('hind');shade='b' if near else 's'
 d.line(ps,fill=P['o'],width=3 if hind else 2)
 d.line(ps,fill=P[shade],width=2 if hind else 1)
 if near and hind:
  d.line([(x,y-1) for x,y in ps[:2]],fill=P['h'],width=1)
  # Single broad transverse thigh patch, carried by the articulated limb.
  a,b=ps[:2];d.point((snap((a[0]+b[0])/2),snap((a[1]+b[1])/2)),fill=P['s'])
 if hind:
  foot=xy(c['screen']['foot']);d.line([ps[-1],foot],fill=P[shade],width=1)
  hull=r['volumes']['web-'+n]['hull'];d.polygon([xy(p) for p in hull],fill=P[shade])
  # Distal toe hull extremes follow this pose, including rear occlusion.
  for j in [0,2,4]:
   v=r['volumes'][f'toe-{n}-{j}'];d.line([xy(v['hull'][0]),xy(v['hull'][-1])],fill=P['s'] if near else P['o'])
 else:
  # Four anatomical toes compress to two/three deliberate tiny line clusters.
  for j in [0,1,3]:
   v=r['volumes'][f'toe-{n}-{j}'];d.line([ps[-1],xy(max(v['hull'],key=lambda p:p[1]))],fill=P[shade])
def compose(r):
 im=Image.new('RGBA',(W,W));f=r['facing'];bodyA,headA=anchors(r)
 ordered=sorted(r['contacts'].items(),key=lambda item:item[1]['screen']['hip'][2],reverse=True)
 for index,(n,c) in enumerate(ordered):limb(im,n,c,r,index>=2)
 if f=='up':part(im,'heads',f,headA)
 part(im,'bodies',f,bodyA)
 if f!='up':part(im,'heads',f,headA)
 # Eye patches use invariant relative positions in locomotion and independent
 # actual rigid retraction during blink. No skull/head scale changes.
 near=min(r['eyes'],key=lambda s:r['eyes'][s][2])
 for s in sorted(r['eyes'],key=lambda s:r['eyes'][s][2],reverse=True):
  off=eyeOffsets[f][s];x=headA[0]+off[0];y=headA[1]+off[1]
  if r['clip']=='action':y+=snap(r['eyes'][s][1]-idle[f]['eyes'][s][1])
  name='closed' if r['blinkAmount']>=.4 else 'rear' if f=='up' or f in ['left','right'] and s!=near else 'open'
  im.alpha_composite(eyeParts[name],(x-1,y-1))
 return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']}
sheet=Image.new('RGBA',(W*23,W*4));meta={'identity':M['identity'],'reviewStatus':'pending','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'fps':7.142857,'rootMotion':False,'cameraContract':G['cameraContract'],'orthoScale':G['orthoScale'],'shiftY':G['shiftY'],'clips':{},'facings':{}}
desc={'idle':'Brown common frog crouch','hop':'Synchronous hind push, flight, fore-first landing and recovery, fixed limbs','swim':'Paired hind-leg kick/glide/recovery, no ground footfalls','action':'Rigid eye bulb withdrawal/closure, fixed skull; rear iris hidden'}
for c,start,count in clips:meta['clips'][c]={'start':start,'count':count,'durationMs':count*140,'description':desc[c]}
for row,f in enumerate(F):
 meta['facings'][f]={'row':row,'frames':[]}
 for c,start,count in clips:
  for i in range(count):
   im=frames[f,c,i];sheet.alpha_composite(im,((start+i)*W,row*W));r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,c,i));ba,ha=anchors(r)
   meta['facings'][f]['frames'].append({'clip':c,'index':i,'rect':[(start+i)*W,row*W,W,W],'visibleBounds':list(im.getbbox()),'bodyAnchor':ba,'headAnchor':ha,'contacts':r['contacts']})
sheet.save(O/'sheet.png');meta['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest()
(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');(O/'masters.json').write_bytes((S/'masters.json').read_bytes())
contact=Image.new('RGBA',(W*23,W*4+20),'#879b82');contact.alpha_composite(sheet,(0,20));ImageDraw.Draw(contact).text((4,4),'Common frog | idle | hop0-7 | swim0-7 | blink0-5 | down/up/left/right',fill='white');contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*2,contact.height*2),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 strip=Image.new('RGBA',(W*8,(W+14)*4),'#879b82');d=ImageDraw.Draw(strip)
 for row,(c,_,count) in enumerate(clips):
  d.text((2,row*(W+14)+2),f'{f} {c} chronological',fill='white')
  for i in range(count):strip.alpha_composite(frames[f,c,i],(i*W,row*(W+14)+14))
 strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*3,strip.height*3),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(R/'public/assets/tilesets/me-complete.png').convert('RGBA')
def crop(rect):x,y,w,h=rect;return atlas.crop((x,y,x+w,y+h))
bg=Image.new('RGBA',(400,208),'#769458');bg.alpha_composite(crop([1920,7312,160,160]),(236,-105));bg.alpha_composite(crop([256,96,48,64]),(4,0));bg.alpha_composite(crop([0,1152,208,64]),(135,145))
water=Image.open(R/'public/assets/tilesets/water.png').convert('RGBA').crop((0,0,16,16))
wet=bg.copy()
for y in range(84,132,16):
 for x in range(0,400,16):wet.alpha_composite(water,(x,y))
person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scenery(c,i):
 im=(wet if c=='swim' else bg).copy()
 for row,f in enumerate(F):
  im.alpha_composite(frames[f,c,i],(42+row*88,78));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(14+row*88,83))
 return im
bg.save(O/'scene-background.png');wet.save(O/'scene-water-background.png');scenery('idle',0).save(O/'scene-native.png');scenery('idle',0).resize((1600,832),Image.Resampling.NEAREST).save(O/'scene-4x.png');scenery('swim',4).save(O/'scene-water-native.png')
seq=[('idle',0)]*3+[('hop',i) for _ in range(2) for i in range(8)]+[('swim',i) for _ in range(2) for i in range(8)]+[('action',i) for i in range(6)]+[('idle',0)]*3
def gif(ims,path):
 ims=[im.convert('RGB') for im in ims];ims[0].save(path,save_all=True,append_images=ims[1:],duration=140,loop=0,disposal=2,optimize=False)
native=[]
for c,i in seq:
 im=Image.new('RGBA',(W*4,W),'#879b82')
 for row,f in enumerate(F):im.alpha_composite(frames[f,c,i],(row*W,0))
 native.append(im)
gif(native,O/'preview-native.gif');gif([im.resize((W*16,W*4),Image.Resampling.NEAREST) for im in native],O/'preview.gif');gif([scenery(c,i) for c,i in seq],O/'scene-native.gif');gif([scenery(c,i).resize((1600,832),Image.Resampling.NEAREST) for c,i in seq],O/'scene-4x.gif')
guide=Image.new('RGBA',(W*8,W*4),'#23343b')
for row,f in enumerate(F):
 for i in range(8):
  r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,'hop',i));im=Image.new('RGBA',(W,W),'#23343b');d=ImageDraw.Draw(im)
  for n,v in r['volumes'].items():
   ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#85aaa0' if n in ['skull','torso'] else '#57757b')
  for c in r['contacts'].values():
   d.line([xy(c['screen'][k]) for k in ['hip','knee','ankle','foot']],fill='#dfc47a');d.point(xy(c['screen']['ground']),fill='#e45e4c' if c['planted'] else '#7788ed')
  guide.alpha_composite(im,(i*W,row*W))
guide.resize((W*32,W*16),Image.Resampling.NEAREST).save(O/'projected-volume-contact-sheet.png')
over=Image.new('RGBA',(W*4,W*2),'#879b82')
for row,f in enumerate(F):
 im=frames[f,'idle',0].copy();d=ImageDraw.Draw(im)
 for v in idle[f]['volumes'].values():
  ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#e5a56d')
 over.alpha_composite(frames[f,'idle',0],(row*W,0));over.alpha_composite(im,(row*W,W))
over.resize((W*24,W*12),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
assert set(sheet.getchannel('A').get_flattened_data())=={0,255};assert set(sheet.get_flattened_data())<=set(P.values())|{(0,0,0,0)}
for k,im in frames.items():
 b=im.getbbox();assert b and min(b[:2])>=2 and max(b[2:])<=W-2,(k,b)
dur={}
for name in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif']:
 dur[name]=sum(fr.info['duration'] for fr in ImageSequence.Iterator(Image.open(O/name)));assert dur[name]==6160
report={'status':'draft-integrity only; visual judgment separate','frameCount':92,'binaryAlpha':True,'palette':M['palette'],'padding':True,'gifDurationMs':dur,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F},'stableHeadOffsets':headOffsets,'stylizationLimit':'Independent guides are rounded deliberately to stable master anchors, not metadata evidence of visual approval.'}
(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('FROG_FINISH_OK',report['idleVisibleHeights'])
