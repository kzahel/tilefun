"""Decoded output/contact/head checks and byte-for-byte finishing replay."""
from pathlib import Path
from PIL import Image,ImageSequence
import json,hashlib,subprocess,sys,math
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/giraffe/draft-v1'
M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text());J=json.loads((O/'sprite.json').read_text());W=144
files=sorted(list(O.glob('*.png'))+list(O.glob('*.gif'))+[O/'sprite.json',O/'masters.json',O/'validation.json'])
hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
completed=subprocess.run([sys.executable,str(S/'finish.py')],check=True,capture_output=True,text=True)
assert {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}==hashes
sheet=Image.open(O/'sheet.png').convert('RGBA');palette={tuple(bytes.fromhex(v[1:]))+(255,) for v in M['palette'].values()}
assert set(sheet.getdata())<=palette|{(0,0,0,0)};assert set(sheet.getchannel('A').getdata())=={0,255}
headchecks=0
for f,rs in J['facings'].items():
 part=M['heads'][f];rows=part['pixels'];off=part['offset']
 # Check stable interior skull/muzzle features. Overlaid rigid ears intentionally
 # cover some outer pixels, and rear neck covers the lower rear skull edge.
 row=rs['row'];baseline=None
 for entry in rs['frames']:
  r=G['records'][entry['guideRecord']];ax=int(math.floor(r['body'][0]+.5))+off[0];ay=int(math.floor(r['body'][1]+.5))+off[1]
  if entry['clip']=='action':continue
  pixels=[]
  for y,letters in enumerate(rows):
   for x,k in enumerate(letters):
    if k in ['k','w'] or (2<x<len(letters)-3 and 2<y<len(rows)-3 and k!='.'):
     pixels.append(sheet.getpixel((entry['rect'][0]+ax+x,row*W+ay+y)))
  if baseline is None:baseline=pixels
  assert pixels==baseline,(f,entry['clip'],entry['index'],'head flicker')
  headchecks+=1
decoded={}
for name in ['preview-native.gif','preview.gif','scene-native.gif']:
 im=Image.open(O/name);frames=[fr.copy().convert('RGB') for fr in ImageSequence.Iterator(im)]
 duration=sum(fr.info['duration'] for fr in ImageSequence.Iterator(im));assert duration==9200
 decoded[name]={'frames':len(frames),'durationMs':duration}
cap=ROOT/'data/wildlife-campaign-v2/background-01-worker/giraffe-browser';R=json.loads((cap/'capture.json').read_text())
assert not R['errors'];assert all(d>=18400 for d in R['durations'].values())
parity=0
bg=Image.open(O/'scene-background.png').convert('RGBA');person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
for s in R['samples']:
 expected=bg.copy();spec=J['clips'][s['clip']];col=spec['start']+s['pose']
 for row in range(4):
  expected.alpha_composite(sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)),(24+row*152,43));expected.alpha_composite(person.crop((0,row*32,32,row*32+32)),(35+row*152,142))
 actual=Image.open(cap/s['filename']).convert('RGB');expected=expected.convert('RGB')
 assert actual.tobytes()==expected.tobytes(),s['filename']
 parity+=1
report={'status':'integrity passed; no visual approval inferred','deterministicFinish':True,'outputsReplayed':list(hashes),'nativeAnd4xBrowserSamplesMatch':parity,'headInteriorChecks':headchecks,'decodedGifs':decoded,'browser':R['browser'],'capturedDurationMs':R['durations'],'pixelStylization':M['stylization']}
(O/'output-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('GIRAFFE_OUTPUT_AUDIT_OK',headchecks,parity)
