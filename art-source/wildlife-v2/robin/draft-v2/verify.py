"""Decoded exports, deterministic replay, rigid head masters and actual browser parity."""
from pathlib import Path
from PIL import Image,ImageSequence
import json,hashlib,subprocess,sys,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/robin/draft-v2';W=32
files=sorted(list(O.glob('*.png'))+list(O.glob('*.gif'))+[O/'sprite.json',O/'masters.json',O/'validation.json']);before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files};subprocess.run([sys.executable,str(S/'finish.py')],check=True,capture_output=True);assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
J=json.loads((O/'sprite.json').read_text());G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());sheet=Image.open(O/'sheet.png').convert('RGBA');heads=0
for f,rs in J['facings'].items():
 part=M['heads'][f];base=None
 for e in rs['frames']:
  r=G['records'][e['guideRecord']];x=int(math.floor(r['head'][0]+.5))+part['offset'][0];y=int(math.floor(r['head'][1]+.5))+part['offset'][1];pixels=[sheet.getpixel((e['rect'][0]+x+dx,rs['row']*W+y+dy)) for dy,row in enumerate(part['pixels']) for dx,k in enumerate(row) if k!='.']
  if base is None:base=pixels
  assert pixels==base,(f,e['clip'],e['index'],'head or marking changed');heads+=1
decoded={}
for name in ['preview-native.gif','preview.gif','scene-native.gif']:
 im=Image.open(O/name);duration=sum(f.info['duration'] for f in ImageSequence.Iterator(im));assert duration==5280;decoded[name]={'frames':len(list(ImageSequence.Iterator(im))),'durationMs':duration}
cap=R/'data/wildlife-campaign-v2/background-01-worker/robin-browser-draft-v2';C=json.loads((cap/'capture.json').read_text());assert not C['errors'];assert all(d>=10560 for d in C['durations'].values());bg=Image.open(O/'scene-background.png').convert('RGBA');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');parity=0
for s in C['samples']:
 im=bg.copy();col=J['clips'][s['clip']]['start']+s['pose']
 for row in range(4):im.alpha_composite(sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)),(42+row*65,70));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(42+row*65,28))
 assert Image.open(cap/s['filename']).convert('RGB').tobytes()==im.convert('RGB').tobytes(),s['filename'];parity+=1
(O/'output-audit.json').write_text(json.dumps({'status':'output integrity passed; visual judgment separate','deterministicFinishing':True,'outputsReplayed':list(before),'wholeHeadMasterChecks':heads,'decodedGifs':decoded,'actualBrowserParitySamples':parity,'capturedDurationMs':C['durations'],'browser':C['browser']},indent=2)+'\n');print('ROBIN_OUTPUT_AUDIT_OK',heads,parity)
