"""Replay, full head master equality, GIF decode and actual browser scene parity."""
import json,hashlib,subprocess,sys,math
from pathlib import Path
from PIL import Image,ImageSequence
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/mallard-duck/draft-v1';W=48
files=sorted(list(O.glob('*.png'))+list(O.glob('*.gif'))+[O/'sprite.json',O/'masters.json',O/'validation.json']);hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
subprocess.run([sys.executable,str(S/'finish.py')],check=True,capture_output=True)
assert {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}==hashes
J=json.loads((O/'sprite.json').read_text());G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());sheet=Image.open(O/'sheet.png').convert('RGBA')
heads=0
for f,rs in J['facings'].items():
 part=M['heads'][f];rows=part['pixels'];off=part['offset'];reference=None
 for entry in rs['frames']:
  r=G['records'][entry['guideRecord']];x=int(math.floor(r['head'][0]+.5))+off[0];y=int(math.floor(r['head'][1]+.5))+off[1];pixels=[]
  for dy,letters in enumerate(rows):
   for dx,k in enumerate(letters):
    if k!='.':pixels.append(sheet.getpixel((entry['rect'][0]+x+dx,rs['row']*W+y+dy)))
  if reference is None:reference=pixels
  assert pixels==reference,(f,entry['clip'],entry['index'],'head or marking changed')
  heads+=1
decoded={}
for name in ['preview-native.gif','preview.gif','scene-native.gif']:
 im=Image.open(O/name);fs=[fr.copy().convert('RGB') for fr in ImageSequence.Iterator(im)];duration=sum(fr.info['duration'] for fr in ImageSequence.Iterator(im));assert duration==9600;decoded[name]={'frames':len(fs),'durationMs':duration}
cap=ROOT/'data/wildlife-campaign-v2/background-01-worker/mallard-browser';R=json.loads((cap/'capture.json').read_text());assert not R['errors'];assert all(d>=19200 for d in R['durations'].values())
bg=Image.open(O/'scene-background.png').convert('RGBA');person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA');parity=0
for s in R['samples']:
 im=bg.copy();col=J['clips'][s['clip']]['start']+s['pose']
 for row in range(4):im.alpha_composite(sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)),(34+row*65,64));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(39+row*65,28))
 actual=Image.open(cap/s['filename']).convert('RGB');assert actual.tobytes()==im.convert('RGB').tobytes(),s['filename'];parity+=1
report={'status':'output integrity passed, visual judgment separate','deterministicFinishing':True,'outputsReplayed':list(hashes),'wholeHeadMasterChecks':heads,'decodedGifs':decoded,'actualBrowserParitySamples':parity,'capturedDurationMs':R['durations'],'browser':R['browser']}
(O/'output-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('MALLARD_OUTPUT_AUDIT_OK',heads,parity)
