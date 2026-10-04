"""Encoded sprite/head checks, replay and actual continuous browser comparison."""
from pathlib import Path
import json,hashlib,subprocess,sys,math
from PIL import Image,ImageDraw
S=Path(__file__).resolve().parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/sheep/draft-v1';D=R/'data/wildlife-campaign-v2/background-02-worker/sheep-browser';I=R/'data/wildlife-campaign-v2/background-02-worker/sheep-inspection';I.mkdir(exist_ok=True)
def hashes():return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in O.iterdir() if p.suffix in ['.png','.gif'] or p.name in ['sprite.json','validation.json']}
if '--replay' in sys.argv:
 before=hashes();subprocess.run([sys.executable,str(S/'finish.py')],check=True);after=hashes();assert before==after
 sheet=Image.open(O/'sheet.png').convert('RGBA');M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text());headchecks={};pixelchecks=0
 for row,f in enumerate(G['facings']):
  e=M['heads'][f];rs=e['pixels'] if 'pixels' in e else [line[::-1] for line in M['heads'][e['mirror']]['pixels']];off=e['offset'];baseline=None;count=0
  for r in G['records']:
   if r['facing']!=f:continue
   col=(0 if r['clip']=='idle' else 1 if r['clip']=='walk' else 17)+r['index'];fr=sheet.crop((col*48,row*48,col*48+48,row*48+48))
   idle=next(q for q in G['records'] if q['facing']==f and q['clip']=='idle')
   rb,ib,ih=[[math.floor(v+.5) for v in q[:2]] for q in [r['body'],idle['body'],idle['head']]];a=[rb[0]+ih[0]-ib[0],rb[1]+ih[1]-ib[1]]
   pix=[fr.getpixel((a[0]+off[0]+x,a[1]+off[1]+y)) for y,line in enumerate(rs) for x,ch in enumerate(line) if ch!='.']
   expected=[]
   be=M['bodies'][f];br=be['pixels'] if 'pixels' in be else [line[::-1] for line in M['bodies'][be['mirror']]['pixels']];ba=[math.floor(v+.5) for v in r['body'][:2]];bo=be['offset']
   for y,line in enumerate(rs):
    for x,ch in enumerate(line):
     if ch=='.':continue
     bx=a[0]+off[0]+x-ba[0]-bo[0];by=a[1]+off[1]+y-ba[1]-bo[1]
     if f=='up' and 0<=by<len(br) and 0<=bx<len(br[by]) and br[by][bx]!='.':ch=br[by][bx]
     expected.append(tuple(bytes.fromhex(M['palette'][ch][1:]))+(255,))
   assert pix==expected,(f,r['clip'],r['index']);pixelchecks+=len(pix)
   patch=bytes(ch for p in pix for ch in p)
   if baseline is None:baseline=patch
   assert patch==baseline;count+=1
  headchecks[f]=count
 coatchecks={}
 for row,f in enumerate(G['facings']):
  e=M['bodies'][f];rs=e['pixels'] if 'pixels' in e else [line[::-1] for line in M['bodies'][e['mirror']]['pixels']];off=e['offset'];baseline=None;count=0
  for r in G['records']:
   if r['facing']!=f or r['clip']!='walk':continue
   col=1+r['index'];fr=sheet.crop((col*48,row*48,col*48+48,row*48+48));a=[math.floor(v+.5) for v in r['body'][:2]]
   patch=bytes(channel for y,line in enumerate(rs) for x,ch in enumerate(line) if ch!='.' for channel in fr.getpixel((a[0]+off[0]+x,a[1]+off[1]+y)))
   if baseline is None:baseline=patch
   assert patch==baseline,(f,r['index'],'visible coat template flicker');count+=1
  coatchecks[f]=count
 report=dict(status='passed integrity; visual review separate',byteIdenticalOutputs=list(before),outputHashes=after,decodedWholeHeadAndEarChecks=headchecks,decodedWholeWalkingCoatChecks=coatchecks,visibleHeadAndCorrectlyOccludedPixelChecks=pixelchecks,rearHead='Complete rigid master; lower back-of-head legitimately covered by stable torso, explicitly decoded.')
 for name in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif']:
  gif=Image.open(O/name);dur=0
  for i in range(gif.n_frames):gif.seek(i);gif.load();dur+=gif.info['duration']
  assert dur==4800,(name,dur);report[name]=dict(decodedFrames=gif.n_frames,durationMs=dur)
 (O/'replay-validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print('SHEEP_REPLAY_OK',len(before),headchecks,pixelchecks)
if '--browser' in sys.argv:
 capture=json.loads((D/'capture.json').read_text());sheet=Image.open(O/'sheet.png').convert('RGBA');bg=Image.open(O/'scene-background.png').convert('RGBA');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');directions=['down','up','left','right']
 def expected(c,i):
  im=bg.copy();col=(0 if c=='idle' else 1 if c=='walk' else 17)+i
  for row in range(4):
   x=76+row*64;im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(x-16,39));im.alpha_composite(sheet.crop((col*48,row*48,col*48+48,row*48+48)),(x-24,72))
  return im
 for s in capture['samples']:assert Image.open(D/s['filename']).convert('RGBA').tobytes()==expected(s['clip'],s['pose']).tobytes(),s['filename']
 coverage={}
 for scale in ['1','4']:
  ss=[s for s in capture['samples'] if s['scale']==scale];coverage[scale]={}
  for cycle in [0,1]:
   selected={s['sequenceIndex']:s for s in ss if s['cycle']==cycle};assert set(selected)==set(range(48)),(scale,cycle,sorted(selected));coverage[scale][cycle]=len(selected)
   for row,f in enumerate(directions):
    panel=Image.new('RGBA',(640,600),'#23343b');d=ImageDraw.Draw(panel)
    for index in range(48):
     s=selected[index];im=Image.open(D/s['filename']).convert('RGBA');x=76+row*64;cell=im.crop((x-36,35,x+36,125));px=(index%8)*80;py=(index//8)*100;panel.alpha_composite(cell,(px,py+10));d.text((px,py),s['clip'][0]+str(s['pose']),fill='white')
    panel.save(I/f'actual-{scale}x-{f}-sequence{cycle}-native.png');panel.resize((panel.width*3,panel.height*3),Image.Resampling.NEAREST).save(I/f'actual-{scale}x-{f}-sequence{cycle}.png')
 report=dict(status='passed integrity; visual review separate',continuousBrowserSamples=len(capture['samples']),durationMs=capture['durationMs'],browser=capture['browser'],everyCanvasMatchesAuthoredScene=True,actualChronologicalSequenceCoverage=coverage,errors=capture['errors'])
 (O/'browser-validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print('SHEEP_BROWSER_OK',len(capture['samples']),coverage)
