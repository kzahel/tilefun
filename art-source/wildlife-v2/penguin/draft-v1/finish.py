"""Emperor letter masters and integer actual-guide feet/flipper composition."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
import json,math,hashlib
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/penguin/draft-v1';G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};F=list(G['cameraContract']['modelYawDegrees']);W=64;clips=[('idle',0,1),('walk',1,8),('swim',9,8),('action',17,8)]
def snap(v):return int(math.floor(v+.5))
def xy(v):return tuple(snap(p) for p in v[:2])
def letters(p):
 im=Image.new('RGBA',(len(p['pixels'][0]),len(p['pixels'])))
 for y,row in enumerate(p['pixels']):
  for x,ch in enumerate(row):
   if ch!='.':im.putpixel((x,y),P[ch])
 return im
T={g:{f:letters(M[g][f]) for f in F} for g in ['heads','standing','swimming']}
def polygon(im,v,c,outline=False):
 ps=[xy(p) for p in v['hull']];d=ImageDraw.Draw(im);d.polygon(ps,fill=P[c])
 if outline:d.line(ps+[ps[0]],fill=P['o'])
def wing(im,r,s,near):
 for n in ['upper','fore','tip']:polygon(im,r['volumes'][f'flipper-{n}-{s}'],'d' if near else 'k',True)
 # Connected projected bone axes retain thin shoulder/elbow/wrist continuity.
 ImageDraw.Draw(im).line([xy(p) for p in r['wings'][str(s)]['screenNodes']],fill=P['d'] if near else P['k'])
def compose(r):
 im=Image.new('RGBA',(W,W));f=r['facing'];v=r['volumes'];polygon(im,v['short-triangular-tail'],'k',True)
 for s in [-1,1]:
  for part in ['femur','tibia']:polygon(im,v[f'leg-{s}-{part}'],'f')
  polygon(im,v['webbed-foot-'+str(s)],'f',True)
  # Rear heels do not inherit forward toe/tip finishing.
  if f!='up':
   for j in range(3):polygon(im,v[f'toe-{s}-{j}'],'o')
 sides=sorted([-1,1],key=lambda s:v['flipper-upper-'+str(s)]['depthRange'][0],reverse=True)
 for j,s in enumerate(sides):wing(im,r,s,j==1)
 polygon(im,v['neck'],'k')
 b=v['pear-torso']['bbox'];center=xy([(b[0]+b[2])/2,(b[1]+b[3])/2]);group='swimming' if r['swim'] else 'standing';p=M[group][f];headpos=xy(r['head']);hp=M['heads'][f]
 def drawBody():im.alpha_composite(T[group][f],(center[0]+p['offset'][0],center[1]+p['offset'][1]))
 def drawHead():im.alpha_composite(T['heads'][f],(headpos[0]+hp['offset'][0],headpos[1]+hp['offset'][1]))
 if f=='up' and r['swim']:drawHead();drawBody()
 else:drawBody();drawHead()
 if f in ['left','right']:wing(im,r,sides[-1],True)
 # In down/front both flippers frame white belly; up wings remain outside back.
 elif f=='down':
  for j,s in enumerate(sides):wing(im,r,s,j==1)
 return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']};sheet=Image.new('RGBA',(W*25,W*4));J={'identity':M['identity'],'reviewStatus':'pending','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'fps':6.25,'rootMotion':False,'cameraContract':G['cameraContract'],'orthoScale':6.4,'shiftY':12/64,'waterPlaneZ':3.0,'previewWalkWorldPerCycle':.32,'previewSwimWorldPerCycle':.65,'clips':{},'facings':{}}
for c,start,count in clips:J['clips'][c]={'start':start,'count':count,'durationMs':count*160,'description':{'idle':'Upright emperor, short dark web feet','walk':'Alternating short-leg waddle, fixed-length links, planted floor contacts','swim':'Rigid75deg forward posture, counter-pitched fixed-volume head; swept/feathered flippers','action':'Eight-pose flipper stretch/return, fixed skull/torso volumes'}[c]}
for row,f in enumerate(F):
 J['facings'][f]={'row':row,'frames':[]}
 for c,start,count in clips:
  for i in range(count):
   im=frames[f,c,i];sheet.alpha_composite(im,((start+i)*W,row*W));r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,c,i));J['facings'][f]['frames'].append({'clip':c,'index':i,'rect':[(start+i)*W,row*W,W,W],'visibleBounds':list(im.getbbox()),'contacts':r['contacts'],'headAnchor':xy(r['head'])})
sheet.save(O/'sheet.png');J['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest();(O/'sprite.json').write_text(json.dumps(J,indent=2)+'\n',encoding='utf-8');(O/'masters.json').write_bytes((S/'masters.json').read_bytes())
contact=Image.new('RGBA',(W*25,W*4+20),'#879b82');contact.alpha_composite(sheet,(0,20));ImageDraw.Draw(contact).text((4,4),'Emperor penguin | idle | walk0-7 | swim0-7 | stretch0-7 | down/up/left/right',fill='white');contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*3,contact.height*3),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 im=Image.new('RGBA',(W*8,(W+14)*4),'#879b82');d=ImageDraw.Draw(im)
 for row,(c,_,count) in enumerate(clips):
  d.text((2,row*(W+14)+2),f'{f} {c} chronological',fill='white')
  for i in range(count):im.alpha_composite(frames[f,c,i],(i*W,row*(W+14)+14))
 im.save(O/f'strip-{f}-native.png');im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(R/'public/assets/tilesets/me-complete.png').convert('RGBA');bg=Image.new('RGBA',(520,240),'#769458')
for rect,pos in [([1920,7312,160,160],(360,-85)),([256,96,48,64],(4,2)),([0,1152,208,64],(175,168))]:x,y,w,h=rect;bg.alpha_composite(atlas.crop((x,y,x+w,y+h)),pos)
wet=bg.copy();tile=Image.open(R/'public/assets/tilesets/water.png').convert('RGBA').crop((0,0,16,16))
for y in range(56,152,16):
 for x in range(16,496,16):wet.alpha_composite(tile,(x,y))
person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scene(c,i,travel=None):
 im=(wet if c=='swim' else bg).copy()
 for row,f in enumerate(F):
  x,y=48+row*120,65
  if travel is not None:
   yaw=math.radians(G['cameraContract']['modelYawDegrees'][f]);D=(.65 if c=='swim' else .32)*travel;x+=snap(-10*math.sin(yaw)*D);y+=snap(-10*math.sin(math.radians(40))*math.cos(yaw)*D)
  im.alpha_composite(frames[f,c,i],(x,y));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(24+row*120,80))
 return im
bg.save(O/'scene-background.png');wet.save(O/'scene-water-background.png');scene('idle',0).save(O/'scene-native.png');scene('idle',0).resize((2080,960),Image.Resampling.NEAREST).save(O/'scene-4x.png');scene('swim',0).save(O/'scene-swim-native.png');scene('swim',0).resize((2080,960),Image.Resampling.NEAREST).save(O/'scene-swim-4x.png')
seq=[('idle',0)]*3+[('walk',i) for _ in range(2) for i in range(8)]+[('swim',i) for _ in range(2) for i in range(8)]+[('action',i) for i in range(8)]+[('idle',0)]*3
def gif(ims,path):ims=[im.convert('RGB') for im in ims];ims[0].save(path,save_all=True,append_images=ims[1:],duration=160,loop=0,disposal=2,optimize=False)
native=[]
for c,i in seq:
 im=Image.new('RGBA',(W*4,W),'#879b82')
 for row,f in enumerate(F):im.alpha_composite(frames[f,c,i],(row*W,0))
 native.append(im)
gif(native,O/'preview-native.gif');gif([im.resize((1024,256),Image.Resampling.NEAREST) for im in native],O/'preview.gif');gif([scene(c,i) for c,i in seq],O/'scene-native.gif');gif([scene(c,i).resize((2080,960),Image.Resampling.NEAREST) for c,i in seq],O/'scene-4x.gif');gif([scene('walk',i%8,travel=i/8) for i in range(16)],O/'preview-walk-travel-native.gif');gif([scene('swim',i%8,travel=i/8) for i in range(16)],O/'preview-swim-travel-native.gif')
guides=Image.new('RGBA',(W*8,W*8),'#23343b')
for row,f in enumerate(F):
 for cr,c in enumerate(['walk','swim']):
  for i in range(8):
   r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,c,i));im=Image.new('RGBA',(W,W),'#23343b');d=ImageDraw.Draw(im)
   for l in r['contacts'].values():d.line([xy(l['screen'][k]) for k in ['hip','knee','ankle','footOrigin']],fill='#e0bc79');d.point(xy(l['screen']['footOrigin']),fill='#ee6659' if l['planted'] else '#80b8df')
   for w in r['wings'].values():d.line([xy(p) for p in w['screenNodes']],fill='#80b8df')
   for n in ['pear-torso','head-black-crown']:ps=[xy(p) for p in r['volumes'][n]['hull']];d.line(ps+[ps[0]],fill='#77aab3')
   guides.alpha_composite(im,(i*W,(row*2+cr)*W))
guides.resize((1024,1024),Image.Resampling.NEAREST).save(O/'projected-volume-contact-sheet.png')
over=Image.new('RGBA',(W*4,W*4),'#879b82')
for row,f in enumerate(F):
 for cr,c in enumerate(['idle','swim']):
  r=next(r for r in G['records'] if r['facing']==f and r['clip']==c and r['index']==0);im=frames[f,c,0].copy();d=ImageDraw.Draw(im)
  for v in r['volumes'].values():ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#e4a96c')
  over.alpha_composite(frames[f,c,0],(row*W,cr*W*2));over.alpha_composite(im,(row*W,cr*W*2+W))
over.resize((1024,1024),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
assert set(sheet.getchannel('A').get_flattened_data())=={0,255};assert set(sheet.get_flattened_data())<=set(P.values())|{(0,0,0,0)}
for k,im in frames.items():bb=im.getbbox();assert min(bb[:2])>=2 and max(bb[2:])<=W-2,(k,bb)
timings={n:sum(fr.info['duration'] for fr in ImageSequence.Iterator(Image.open(O/n))) for n in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif']};assert set(timings.values())=={7360}
report={'status':'draft integrity only; art acceptance separate','frameCount':100,'binaryAlpha':True,'palette':M['palette'],'padding':True,'gifDurationMs':timings,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F},'intentionalStylization':M['stylization'],'mediaLimit':'Ground web contacts; swimming below3.0unit water plane, no refraction/forces/entry transition.'};(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('PENGUIN_FINISH_OK',report['idleVisibleHeights'])
