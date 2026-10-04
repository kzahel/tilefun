from pathlib import Path
from PIL import Image,ImageSequence
import json,hashlib,subprocess,sys
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/cat/draft-v1';B=R/'data/wildlife-campaign-v2/background-01-worker';G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());J=json.loads((O/'sprite.json').read_text());files=sorted([p for p in O.iterdir() if p.suffix in ['.png','.gif']]+[O/'sprite.json',O/'validation.json']);before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files};subprocess.run([sys.executable,str(S/'finish.py')],check=True);assert all(hashlib.sha256(p.read_bytes()).hexdigest()==before[p.name] for p in files)
sheet=Image.open(O/'sheet.png').convert('RGBA');assert set(sheet.getchannel('A').get_flattened_data())=={0,255};P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};assert set(sheet.get_flattened_data())<=set(P.values())|{(0,0,0,0)};heads=0;connected=0
for row,f in enumerate(['down','up','left','right']):
 for info in J['facings'][f]['frames']:
  x,y,w,h=info['rect'];im=sheet.crop((x,y,x+w,y+h));box=im.getbbox();assert box[0]>=2 and box[1]>=2 and box[2]<=46 and box[3]<=46;hx,hy=info['headAnchor']
  for yy,line in enumerate(M['headTemplates'][f]):
   for xx,ch in enumerate(line):
    if ch!='.':assert im.getpixel((hx-3+xx,hy-3+yy))==P[ch],(f,info['clip'],info['index'],xx,yy);heads+=1
  pts={(x,y) for y in range(48) for x in range(48) if im.getpixel((x,y))[3]};todo=[next(iter(pts))];seen=set(todo)
  while todo:
   a,b=todo.pop()
   for dx in [-1,0,1]:
    for dy in [-1,0,1]:
     q=(a+dx,b+dy)
     if q in pts and q not in seen:seen.add(q);todo.append(q)
  assert seen==pts,(f,info['clip'],info['index'],len(pts-seen));connected+=1
durations={}
for p in O.glob('*.gif'):
 durations[p.name]=sum(fr.info.get('duration',0) for fr in ImageSequence.Iterator(Image.open(p)));assert durations[p.name]==(3840 if 'travel' in p.name else 6080)
cap=json.loads((B/'cat-browser/capture.json').read_text());assert cap['errors']==[];assert min(cap['durations'].values())>=12160;checks=0;bg=Image.open(O/'scene-background.png').convert('RGBA')
for scale in [1,4]:assert set(s['sequenceIndex'] for s in cap['samples'] if s['scale']==scale)==set(range(38))
for s in cap['samples']:
 actual=Image.open(B/'cat-browser'/s['filename']).convert('RGBA')
 for row,f in enumerate(['down','up','left','right']):
  info=next(v for v in J['facings'][f]['frames'] if v['clip']==s['clip'] and v['index']==s['pose']);x,y,w,h=info['rect'];expected=bg.crop((68+row*150,88,116+row*150,136));expected.alpha_composite(sheet.crop((x,y,x+w,y+h)));assert actual.crop((68+row*150,88,116+row*150,136)).tobytes()==expected.tobytes();checks+=1
report={'deterministicReplayFiles':len(files),'posesPadding':84,'binaryAlpha':True,'sharedPalette':True,'fullStableHeadTemplatePixels':heads,'all84Silhouettes8Connected':connected==84,'decodedGifDurationMs':durations,'actualFullChromiumDurationMs':cap['durations'],'actualSpritePixelChecks':checks,'all38StatesAtBothScales':True,'artAcceptance':'Actual images decide ready or blocked, not assertions.'};(O/'output-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('CAT_OUTPUT_AUDIT_OK',report)
