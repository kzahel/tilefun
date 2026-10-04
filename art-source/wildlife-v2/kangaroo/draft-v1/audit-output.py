"""Head marking stability, decoded pixels, deterministic replay, actual Chromium."""
from pathlib import Path
import json,hashlib,subprocess,sys
from PIL import Image,ImageSequence
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/kangaroo/draft-v1';M=json.loads((S/'masters.json').read_text());J=json.loads((O/'sprite.json').read_text());sheet=Image.open(O/'sheet.png').convert('RGBA');W=96;heads=0
P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
for f,data in J['facings'].items():
 part=M['heads'][f];baseline=None
 for e in data['frames']:
  a=e['headAnchor'];ox,oy=part['offset'];pixels=[]
  for y,row in enumerate(part['pixels']):
   for x,ch in enumerate(row):
    if ch!='.':pixels.append(sheet.getpixel((e['rect'][0]+a[0]+ox+x,e['rect'][1]+a[1]+oy+y)))
  if baseline is None:baseline=pixels
  assert pixels==baseline,(f,e['clip'],e['index']);heads+=1
assert set(sheet.getchannel('A').get_flattened_data())=={0,255};assert set(sheet.get_flattened_data())<=set(P.values())|{(0,0,0,0)}
for data in J['facings'].values():
 for e in data['frames']:
  x,y,w,h=e['rect'];b=sheet.crop((x,y,x+w,y+h)).getbbox();assert list(b)==e['visibleBounds'] and min(b[:2])>=2 and max(b[2:])<=W-2
files=sorted(list(O.glob('*.png'))+list(O.glob('*.gif'))+[O/'sprite.json',O/'masters.json',O/'validation.json']);before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files};r=subprocess.run([sys.executable,str(S/'finish.py')],capture_output=True,text=True);assert r.returncode==0,r.stderr;assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
timings={}
for name in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif','preview-travel-native.gif']:
 timings[name]=sum(fr.info['duration'] for fr in ImageSequence.Iterator(Image.open(O/name)));assert timings[name]==(3200 if name=='preview-travel-native.gif' else 5440)
D=R/'data/wildlife-campaign-v2/background-01-worker/kangaroo-browser';C=json.loads((D/'capture.json').read_text());assert C['errors']==[];bg=Image.open(O/'scene-background.png').convert('RGBA');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');checks=0
for s in C['samples']:
 col=J['clips'][s['clip']]['start']+s['pose'];expected=bg.copy()
 for row,f in enumerate(J['facings']):expected.alpha_composite(sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)),(32+row*120,41));expected.alpha_composite(person.crop((0,row*32,32,row*32+32)),(4+row*120,80))
 assert Image.open(D/s['filename']).convert('RGBA').tobytes()==expected.tobytes(),s['filename'];checks+=1
for scale in [1,4]:assert C['durations'][str(scale)]>=10880 and set(s['sequenceIndex'] for s in C['samples'] if s['scale']==scale)==set(range(34))
report={'status':'passed','fullHeadAllPoseChecks':heads,'deterministicReplayFiles':len(files),'binaryAlpha':True,'palette':True,'padding':True,'gifDurationMs':timings,'actualChromiumPixelChecks':checks,'captureDurationMs':C['durations'],'browser':C['browser'],'all34ChronologicalStatesAtBothScales':True,'limits':'Ear shells intentionally swivel independently. Near forearm legitimately occludes chest markings; body occlusion and visual quality require direct review.'};(O/'output-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('KANGAROO_OUTPUT_AUDIT_OK',heads,checks)
