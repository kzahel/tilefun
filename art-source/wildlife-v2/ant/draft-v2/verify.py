from pathlib import Path
from PIL import Image,ImageSequence
import json,hashlib,subprocess,sys
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/ant/draft-v2';W=32;files=sorted(list(O.glob('*.png'))+list(O.glob('*.gif'))+[O/'sprite.json',O/'masters.json',O/'validation.json']);before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files};subprocess.run([sys.executable,str(S/'finish.py')],check=True,capture_output=True);assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
J=json.loads((O/'sprite.json').read_text());M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text());sheet=Image.open(O/'sheet.png').convert('RGBA');heads=bodychecks=0;counts={}
for f,rs in J['facings'].items():
 part=M['heads'][f];base=None
 for e in rs['frames']:
  x,y=e['headAnchor'];x+=part['offset'][0];y+=part['offset'][1];pixels=[sheet.getpixel((e['rect'][0]+x+dx,rs['row']*W+y+dy)) for dy,row in enumerate(part['pixels']) for dx,k in enumerate(row) if k!='.']
  if base is None:base=pixels
  assert pixels==base,(f,e['clip'],e['index']);heads+=1
 for name,group,landmark in [('thorax','thoraces','thorax'),('gaster','gasters','gaster')]:
  part=M[group][f];baseBody=None
  for e in rs['frames']:
   r=G['records'][e['guideRecord']];x,y=[int(__import__('math').floor(v+.5)) for v in r[landmark]];x+=part['offset'][0];y+=part['offset'][1];pixels=[sheet.getpixel((e['rect'][0]+x+dx,rs['row']*W+y+dy)) for dy,row in enumerate(part['pixels']) for dx,k in enumerate(row) if k!='.']
   if baseBody is None:baseBody=pixels
   assert pixels==baseBody,(f,e['clip'],e['index'],name,'marking flicker');bodychecks+=1
 for clip in J['clips']:counts[f+':'+clip]=len({sheet.crop((e['rect'][0],e['rect'][1],e['rect'][0]+W,e['rect'][1]+W)).tobytes() for e in rs['frames'] if e['clip']==clip})
cap=R/'data/wildlife-campaign-v2/background-01-worker/ant-browser-draft-v2';C=json.loads((cap/'capture.json').read_text());assert not C['errors'];assert all(d>=7840 for d in C['durations'].values());bg=Image.open(O/'scene-background.png').convert('RGBA');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');parity=0
for s in C['samples']:
 im=bg.copy();col=J['clips'][s['clip']]['start']+s['pose']
 for row in range(4):im.alpha_composite(sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)),(42+row*65,83));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(39+row*65,28))
 assert Image.open(cap/s['filename']).convert('RGB').tobytes()==im.convert('RGB').tobytes(),s['filename'];parity+=1
decoded={}
for name in ['preview-native.gif','preview.gif','scene-native.gif']:
 im=Image.open(O/name);duration=sum(f.info['duration'] for f in ImageSequence.Iterator(im));assert duration==3920;decoded[name]={'durationMs':duration,'frames':len(list(ImageSequence.Iterator(im)))}
(O/'output-audit.json').write_text(json.dumps({'status':'output integrity passed; visual review separate','deterministicFinishing':True,'wholeHeadChecks':heads,'wholeBodyMarkingChecks':bodychecks,'distinctPoseCounts':counts,'decodedGifs':decoded,'actualBrowserParitySamples':parity,'capturedDurationMs':C['durations'],'browser':C['browser']},indent=2)+'\n',encoding='utf-8');print('ANT_OUTPUT_AUDIT_OK',heads,bodychecks,parity,counts)
