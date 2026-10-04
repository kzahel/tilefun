from pathlib import Path
from PIL import Image,ImageSequence,ImageDraw
import json,hashlib,subprocess,sys,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/dog/draft-v1';B=R/'data/wildlife-campaign-v2/background-01-worker';G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());J=json.loads((O/'sprite.json').read_text());files=sorted([p for p in O.iterdir() if p.suffix in ['.png','.gif']]+[O/'sprite.json',O/'validation.json']);before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files};subprocess.run([sys.executable,str(S/'finish.py')],check=True);assert all(hashlib.sha256(p.read_bytes()).hexdigest()==before[p.name] for p in files)
sheet=Image.open(O/'sheet.png').convert('RGBA');assert set(sheet.getchannel('A').get_flattened_data())=={0,255};P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};assert set(sheet.get_flattened_data())<=set(P.values())|{(0,0,0,0)};heads=0;occluded=0;walkheads=0;connected=0
for row,f in enumerate(['down','up','left','right']):
 idle=sheet.crop((0,row*64,64,row*64+64))
 for info in J['facings'][f]['frames']:
  x,y,w,h=info['rect'];im=sheet.crop((x,y,x+w,y+h));box=im.getbbox();assert box[0]>=2 and box[1]>=2 and box[2]<=62 and box[3]<=62;hx,hy=info['headAnchor'];dx,dy=M['headOffsets'][f];r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,info['clip'],info['index']));mask=Image.new('1',(64,64));d=ImageDraw.Draw(mask);names=['pendent-ear--1','pendent-ear-1'];names=names if f in ['down','up'] else [min(names,key=lambda n:sum(r['volumes'][n]['depthRange']))]
  for n in names:d.polygon([(math.floor(x+.5),math.floor(y+.5)) for x,y in r['volumes'][n]['hull']],fill=1)
  for yy,line in enumerate(M['headTemplates'][f]):
   for xx,ch in enumerate(line):
    if ch!='.':
     p=(hx+dx+xx,hy+dy+yy)
     if not mask.getpixel(p):assert im.getpixel(p)==P[ch],(f,info['clip'],info['index'],xx,yy);heads+=1
     else:occluded+=1
     if info['clip']=='walk':assert im.getpixel(p)==idle.getpixel(p);walkheads+=1
  pts={(x,y) for y in range(64) for x in range(64) if im.getpixel((x,y))[3]};todo=[next(iter(pts))];seen=set(todo)
  while todo:
   a,b=todo.pop()
   for ddx in [-1,0,1]:
    for ddy in [-1,0,1]:
     q=(a+ddx,b+ddy)
     if q in pts and q not in seen:seen.add(q);todo.append(q)
  assert seen==pts,(f,info['clip'],info['index'],len(pts-seen));connected+=1
durations={}
for p in O.glob('*.gif'):
 durations[p.name]=sum(fr.info.get('duration',0) for fr in ImageSequence.Iterator(Image.open(p)));assert durations[p.name]==(5120 if 'travel' in p.name else 7360)
cap=json.loads((B/'dog-browser/capture.json').read_text());assert cap['errors']==[];assert min(cap['durations'].values())>=14720;checks=0;bg=Image.open(O/'scene-background.png').convert('RGBA')
for scale in [1,4]:assert set(s['sequenceIndex'] for s in cap['samples'] if s['scale']==scale)==set(range(46))
for s in cap['samples']:
 actual=Image.open(B/'dog-browser'/s['filename']).convert('RGBA')
 for row,f in enumerate(['down','up','left','right']):
  info=next(v for v in J['facings'][f]['frames'] if v['clip']==s['clip'] and v['index']==s['pose']);x,y,w,h=info['rect'];expected=bg.crop((74+row*170,88,138+row*170,152));expected.alpha_composite(sheet.crop((x,y,x+w,y+h)));assert actual.crop((74+row*170,88,138+row*170,152)).tobytes()==expected.tobytes();checks+=1
report={'deterministicReplayFiles':len(files),'posesPadding':100,'binaryAlpha':True,'sharedPalette':True,'visibleStableHeadTemplatePixels':heads,'nearEarOccludedHeadPixelsReviewedSeparately':occluded,'fullWalkingHeadPatternPixelsIncludingEar':walkheads,'all100Silhouettes8Connected':connected==100,'decodedGifDurationMs':durations,'actualFullChromiumDurationMs':cap['durations'],'actualSpritePixelChecks':checks,'all46StatesAtBothScales':True,'artAcceptance':'Actual images decide ready/blocked.'};(O/'output-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('DOG_OUTPUT_AUDIT_OK',report)
