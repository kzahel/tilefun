from pathlib import Path
from PIL import Image,ImageSequence
import json,hashlib,subprocess,sys
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/manta-ray/draft-v1';B=R/'data/wildlife-campaign-v2/background-01-worker/manta-ray-browser';M=json.loads((S/'masters.json').read_text());J=json.loads((O/'sprite.json').read_text());P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};P['.']=(0,0,0,0)
def hashes():return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in O.iterdir() if p.suffix in ['.png','.gif'] or p.name in ['sprite.json','masters.json','validation.json']}
before=hashes();subprocess.run([sys.executable,str(S/'finish.py')],check=True);assert hashes()==before;sheet=Image.open(O/'sheet.png').convert('RGBA');assert set(sheet.getchannel('A').get_flattened_data())=={0,255};assert set(sheet.get_flattened_data())<=set(P.values());heads=0
for f,data in J['facings'].items():
 for fr in data['frames']:
  x,y,w,h=fr['rect'];im=sheet.crop((x,y,x+w,y+h));bb=im.getbbox();assert min(bb[:2])>=3 and max(bb[2:])<=141;hp=M['heads'][f];hx,hy=fr['headAnchor'];ox,oy=hp['offset']
  for yy,row in enumerate(hp['pixels']):
   for xx,c in enumerate(row):
    if c!='.':assert im.getpixel((hx+ox+xx,hy+oy+yy))==P[c];heads+=c!='.'
  # Actual finished silhouette, including thin whip/cephalic/wing joints, must remain8-connected.
  pixels={(xx,yy) for yy in range(h) for xx in range(w) if im.getpixel((xx,yy))[3]};todo=[pixels.pop()]
  while todo:
   xx,yy=todo.pop()
   for dx in [-1,0,1]:
    for dy in [-1,0,1]:
     p=(xx+dx,yy+dy)
     if p in pixels:pixels.remove(p);todo.append(p)
  assert not pixels,(f,fr['clip'],fr['index'],len(pixels))
timings={p.name:sum(f.info['duration'] for f in ImageSequence.Iterator(Image.open(p))) for p in O.glob('*.gif')};assert all(t==(3840 if 'travel' in n else 6080) for n,t in timings.items());cap=json.loads((B/'capture.json').read_text());assert not cap['errors'];assert min(cap['durations'].values())>=12160;checks=0
for scale in [1,4]:
 assert {s['sequenceIndex'] for s in cap['samples'] if s['scale']==scale}==set(range(38))
 for s in [s for s in cap['samples'] if s['scale']==scale]:
  actual=Image.open(B/s['filename']).convert('RGBA');column=J['clips'][s['clip']]['start']+s['pose']
  for row in range(4):
   art=sheet.crop((column*144,row*144,(column+1)*144,(row+1)*144));scene=actual.crop((58+row*180,62,202+row*180,206));assert all(a==b for a,b in zip(art.get_flattened_data(),scene.get_flattened_data()) if a[3]);checks+=1
report={'deterministicReplay':len(before),'posesPadding':84,'binaryAlpha':True,'sharedPalette':True,'fullStableHeadTemplatePixels':heads,'all84Silhouettes8Connected':True,'decodedGifDurationMs':timings,'actualFullChromiumDurationMs':cap['durations'],'all38StatesAtBothScales':True,'actualSpritePixelChecks':checks,'artAcceptance':'Actual observations decide ready or blocked, not these tests.'};(O/'output-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('MANTA_RAY_OUTPUT_AUDIT_OK',report)
