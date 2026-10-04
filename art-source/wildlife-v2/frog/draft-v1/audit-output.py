"""Decoded pixel stability, deterministic replay and real Chromium parity."""
from pathlib import Path
import json,hashlib,subprocess,sys
from PIL import Image,ImageSequence
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/frog/draft-v1'
G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());J=json.loads((O/'sprite.json').read_text());sheet=Image.open(O/'sheet.png').convert('RGBA');W=48
P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};heads=bodychecks=0
for f,data in J['facings'].items():
 for name,group,anchor in [('head','heads','headAnchor'),('body','bodies','bodyAnchor')]:
  part=M[group][f];baseline=None
  for e in data['frames']:
   if e['clip']=='action':continue
   a=e[anchor];ox,oy=part['offset'];pixels=[]
   for y,line in enumerate(part['pixels']):
    for x,ch in enumerate(line):
     if ch!='.':pixels.append(sheet.getpixel((e['rect'][0]+a[0]+ox+x,e['rect'][1]+a[1]+oy+y)))
   if baseline is None:baseline=pixels
   assert pixels==baseline,(f,name,e['clip'],e['index'])
   if name=='head':heads+=1
   else:bodychecks+=1
assert set(sheet.getchannel('A').get_flattened_data())=={0,255}
assert set(sheet.get_flattened_data())<=set(P.values())|{(0,0,0,0)}
for f,data in J['facings'].items():
 for e in data['frames']:
  x,y,w,h=e['rect'];im=sheet.crop((x,y,x+w,y+h));b=im.getbbox();assert list(b)==e['visibleBounds'] and min(b[:2])>=2 and max(b[2:])<=W-2
files=sorted(list(O.glob('*.png'))+list(O.glob('*.gif'))+[O/'sprite.json',O/'masters.json',O/'validation.json']);before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
result=subprocess.run([sys.executable,str(S/'finish.py')],capture_output=True,text=True);assert result.returncode==0,result.stderr
assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
timings={}
for name in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif']:
 timings[name]=sum(fr.info['duration'] for fr in ImageSequence.Iterator(Image.open(O/name)));assert timings[name]==6160
D=R/'data/wildlife-campaign-v2/background-01-worker/frog-browser';C=json.loads((D/'capture.json').read_text());assert C['errors']==[]
bg=Image.open(O/'scene-background.png').convert('RGBA');wet=Image.open(O/'scene-water-background.png').convert('RGBA');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');checks=0
for s in C['samples']:
 c=s['clip'];i=s['pose'];col=J['clips'][c]['start']+i;expected=(wet if c=='swim' else bg).copy()
 for row,f in enumerate(J['facings']):
  expected.alpha_composite(sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)),(42+row*88,78));expected.alpha_composite(person.crop((0,row*32,32,row*32+32)),(14+row*88,83))
 assert Image.open(D/s['filename']).convert('RGBA').tobytes()==expected.tobytes(),s['filename'];checks+=1
for scale in [1,4]:
 assert C['durations'][str(scale)]>=12320
 assert set(s['sequenceIndex'] for s in C['samples'] if s['scale']==scale)==set(range(44))
report={'status':'passed','fullHeadLocomotionChecks':heads,'stableBodyLocomotionChecks':bodychecks,'deterministicReplayFiles':len(files),'binaryAlpha':True,'padding':True,'palette':True,'gifDurationMs':timings,'actualChromiumPixelChecks':checks,'captureDurationMs':C['durations'],'browser':C['browser'],'all44ChronologicalStatesAtBothScales':True,'limit':'Blink eye patches intentionally retract/close; locomotion head/body markings stay invariant. Integrity does not imply visual approval.'}
(O/'output-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('FROG_OUTPUT_AUDIT_OK',heads,bodychecks,checks)
