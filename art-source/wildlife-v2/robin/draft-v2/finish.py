"""Authored robin palette-letter masters plus integer articulated guide finishing."""
import json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/robin/draft-v2';W=32
G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());F=list(G['cameraContract']['modelYawDegrees']);P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
def xy(v):return tuple(int(math.floor(a+.5)) for a in v[:2])
def letter(p):
 rows=p['pixels'];im=Image.new('RGBA',(len(rows[0]),len(rows)))
 for y,row in enumerate(rows):
  assert len(row)==im.width
  for x,k in enumerate(row):
   if k!='.':im.putpixel((x,y),P[k])
 return im
parts={g:{f:letter(M[g][f]) for f in F} for g in ['bodies','heads']}
def paste(im,g,r):
 x,y=xy(r['head'] if g=='heads' else r['body']);a,b=M[g][r['facing']]['offset'];im.alpha_composite(parts[g][r['facing']],(x+a,y+b))
def fan(im,r,s,near):
 d=ImageDraw.Draw(im)
 for group,col in [('secondary','b' if near else 's'),('primary','s')]:
  v=r['volumes'][f'{group}-{s}-volume'];ps=[xy(p) for p in v['hull']];d.polygon(ps,fill=P[col]);d.line(ps+[ps[0]],fill=P['o'])
  d.line([ps[0],ps[len(ps)//2]],fill=P['h'])
  if group=='primary':
   a=xy(r['wings'][str(s)]['elbow']);b=xy([(v['bbox'][0]+v['bbox'][2])/2,(v['bbox'][1]+v['bbox'][3])/2]);d.line([a,b],fill=P['b'])
 v=r['volumes'][f'bar-{s}-volume'];d.line([xy(p) for p in v['hull'][:2]],fill=P['l'])
def foot(im,r,s,near):
 d=ImageDraw.Draw(im);c=r['contacts'][str(s)];ps=[xy(c['screen'][k]) for k in ['hip','knee','hock','ankle']];d.line(ps,fill=P['t'] if near else P['s'])
 if r['clip']=='flap':return
 for j in range(4):
  v=r['volumes'][f'toe-{s}-{j}-volume'];ps=[xy(p) for p in v['hull']];d.polygon(ps,fill=P['t'] if near else P['s'])
def tail(im,r):
 d=ImageDraw.Draw(im);ps=[xy(p) for p in r['volumes']['tail-volume']['hull']];d.polygon(ps,fill=P['s']);d.line(ps+[ps[0]],fill=P['o']);a=xy(r['landmarks']['TAIL-cock']);b=xy(r['landmarks']['tail-tip']);d.line([a,b],fill=P['b'])
def bill(im,r):
 if r['facing']=='up':return
 idle=next(g for g in G['records'] if g['clip']=='idle' and g['facing']==r['facing']);h0,h=xy(idle['head']),xy(r['head']);delta=(h[0]-h0[0],h[1]-h0[1]);p0,q0=xy(idle['landmarks']['bill-tip']),xy(idle['landmarks']['lower-bill-tip']);p=(p0[0]+delta[0],p0[1]+delta[1]);q=(q0[0]+delta[0],q0[1]+delta[1])
 if r['clip']=='action':q=xy(r['landmarks']['lower-bill-tip'])
 d=ImageDraw.Draw(im)
 if r['facing']=='down':d.point(p,fill=P['k']);d.point(q,fill=P['k'])
 else:
  # Fine bill stays beyond the complete face patch; no eye/head morphing.
  step=-1 if r['facing']=='left' else 1;d.line([(p[0]-step,p[1]),p],fill=P['k']);d.point(q,fill=P['k'])
def compose(r):
 im=Image.new('RGBA',(W,W));order=sorted([-1,1],key=lambda s:r['contacts'][str(s)]['screen']['hip'][2],reverse=True)
 foot(im,r,order[0],False)
 if r['clip']=='flap':
  wo=sorted([-1,1],key=lambda s:r['volumes'][f'secondary-{s}-volume']['depthRange'][0],reverse=True);fan(im,r,wo[0],False)
 tail(im,r);paste(im,'bodies',r);foot(im,r,order[1],True);paste(im,'bodies',r)
 if r['facing']=='up':tail(im,r)
 if r['clip']=='flap':fan(im,r,wo[1],True)
 paste(im,'heads',r);bill(im,r);return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']}
clips={'idle':{'start':0,'count':1},'hop':{'start':1,'count':8,'description':'Paired gather/push/rise/apex/descend/landing/absorb/recover; three fixed segments per leg'},'flap':{'start':9,'count':8,'description':'Shoulder downstroke with folding elbow recovery, rigid head/body and tucked feet'},'action':{'start':17,'count':6,'description':'Perched-song bill hinge and tail cock; fixed head, no audio'}}
for c in clips.values():c['durationMs']=c['count']*120
meta={'identity':M['identity'],'motionIdentity':'robin-draft-v2-motion-02','reviewStatus':'pending production gate and human review','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'rootMotion':False,'frameDurationMs':120,'fps':1000/120,'cameraContract':G['cameraContract'],'orthoScale':G['orthoScale'],'shiftY':G['shiftY'],'clips':clips,'facings':{}}
sheet=Image.new('RGBA',(W*23,W*4))
for row,f in enumerate(F):
 meta['facings'][f]={'row':row,'frames':[]}
 for c,cs in clips.items():
  for i in range(cs['count']):
   im=frames[f,c,i];col=cs['start']+i;sheet.alpha_composite(im,(col*W,row*W));meta['facings'][f]['frames'].append({'clip':c,'index':i,'rect':[col*W,row*W,W,W],'visibleBounds':im.getbbox(),'guideRecord':next(n for n,r in enumerate(G['records']) if (r['facing'],r['clip'],r['index'])==(f,c,i))})
sheet.save(O/'sheet.png');meta['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest();(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n');(O/'masters.json').write_bytes((S/'masters.json').read_bytes())
contact=Image.new('RGBA',(W*23,W*4+18),'#899780');contact.alpha_composite(sheet,(0,18));ImageDraw.Draw(contact).text((3,3),'Robin | idle | hop8 | flap8 | song6 | down/up/left/right',fill='white');contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*4,contact.height*4),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 strip=Image.new('RGBA',(W*8,(W+12)*4),'#899780');d=ImageDraw.Draw(strip)
 for row,c in enumerate(clips):
  d.text((2,row*(W+12)+1),f'{f} {c}: chronological',fill='white')
  for i in range(clips[c]['count']):strip.alpha_composite(frames[f,c,i],(i*W,row*(W+12)+12))
 strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*4,strip.height*4),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(R/'public/assets/tilesets/me-complete.png').convert('RGBA')
def crop(rect):x,y,w,h=rect;return atlas.crop((x,y,x+w,y+h))
bg=Image.new('RGBA',(320,208),'#769458');bg.alpha_composite(crop([1920,7312,160,160]),(160,-93));bg.alpha_composite(crop([256,96,48,64]),(4,5));bg.alpha_composite(crop([0,1152,208,64]),(58,143));bg.save(O/'scene-background.png');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scene(c,i):
 im=bg.copy()
 for row,f in enumerate(F):im.alpha_composite(frames[f,c,i],(42+row*65,70));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(42+row*65,28))
 return im
scene('idle',0).save(O/'scene-native.png');scene('idle',0).resize((1280,832),Image.Resampling.NEAREST).save(O/'scene-4x.png')
seq=[('idle',0)]*3+[(c,i) for c in ['hop','flap'] for _ in range(2) for i in range(8)]+[('action',i) for i in range(6)]+[('idle',0)]*3;native=[]
for c,i in seq:
 im=Image.new('RGBA',(W*4,W),'#899780')
 for row,f in enumerate(F):im.alpha_composite(frames[f,c,i],(row*W,0))
 native.append(im)
def gif(ims,name):
 ims=[im.convert('RGB') for im in ims];ims[0].save(O/name,save_all=True,append_images=ims[1:],duration=120,loop=0,disposal=2,optimize=False)
gif(native,'preview-native.gif');gif([im.resize((W*16,W*4),Image.Resampling.NEAREST) for im in native],'preview.gif');gif([scene(c,i) for c,i in seq],'scene-native.gif')
overlay=Image.new('RGBA',(W*4,W*2),'#899780')
for row,f in enumerate(F):
 r=next(r for r in G['records'] if r['clip']=='idle' and r['facing']==f);im=frames[f,'idle',0].copy();d=ImageDraw.Draw(im)
 for v in r['volumes'].values():ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#f1bc78')
 overlay.alpha_composite(frames[f,'idle',0],(row*W,0));overlay.alpha_composite(im,(row*W,W))
overlay.resize((W*16,W*8),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
assert set(sheet.getdata())<=set(P.values())|{(0,0,0,0)};assert set(sheet.getchannel('A').getdata())=={0,255}
for key,im in frames.items():b=im.getbbox();assert b and min(b[:2])>=2 and max(b[2:])<=W-2,(key,b)
assert Image.open(O/'sheet.png').convert('RGBA').tobytes()==sheet.tobytes()
timings={}
for name in ['preview-native.gif','preview.gif','scene-native.gif']:
 im=Image.open(O/name);timings[name]=sum(fr.info['duration'] for fr in ImageSequence.Iterator(im));assert timings[name]==len(seq)*120
report={'status':'integrity pass; visual judgment separate','identity':M['identity'],'frames':92,'binaryAlpha':True,'padding':True,'palette':M['palette'],'gifDurationMs':timings,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F},'stylization':M['stylization']};(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print('ROBIN_FINISH_OK',report['idleVisibleHeights'])
