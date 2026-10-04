"""Deterministic decoded output, head markings and actual browser pixel parity."""
from pathlib import Path
from PIL import Image,ImageSequence
import json,hashlib,subprocess,sys,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/penguin/draft-v1';B=R/'data/wildlife-campaign-v2/background-01-worker/penguin-browser';M=json.loads((S/'masters.json').read_text());J=json.loads((O/'sprite.json').read_text());G=json.loads((S/'projected-guides.json').read_text());P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};palette=set(P.values())|{(0,0,0,0)}
def hashes():return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in O.iterdir() if p.suffix in ['.png','.gif'] or p.name in ['sprite.json','masters.json','validation.json']}
before=hashes();subprocess.run([sys.executable,str(S/'finish.py')],check=True);assert hashes()==before
sheet=Image.open(O/'sheet.png').convert('RGBA');assert set(sheet.getchannel('A').get_flattened_data())=={0,255};assert set(sheet.get_flattened_data())<=palette;headPixels=0;occluded=0
for row,f in enumerate(J['facings']):
 for fr in J['facings'][f]['frames']:
  x,y,w,h=fr['rect'];im=sheet.crop((x,y,x+w,y+h));bb=im.getbbox();assert min(bb[:2])>=2 and max(bb[2:])<=62;r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,fr['clip'],fr['index']));p=M['heads'][f];hx,hy=fr['headAnchor'];ox,oy=p['offset']
  for yy,line in enumerate(p['pixels']):
   for xx,ch in enumerate(line):
    if ch=='.':continue
    if f=='up' and r['swim'] and yy>=3:occluded+=1;continue
    assert im.getpixel((hx+ox+xx,hy+oy+yy))==P[ch],(f,fr['clip'],fr['index'],xx,yy,ch,im.getpixel((hx+ox+xx,hy+oy+yy)));headPixels+=1
durations={}
for p in O.glob('*.gif'):
 duration=sum(fr.info['duration'] for fr in ImageSequence.Iterator(Image.open(p)));assert duration==(2560 if '-travel-' in p.name else 7360);durations[p.name]=duration
cap=json.loads((B/'capture.json').read_text());assert not cap['errors'];assert min(cap['durations'].values())>=14720;checks=0
for scale in [1,4]:
 assert {s['sequenceIndex'] for s in cap['samples'] if s['scale']==scale}==set(range(46))
 for sample in [s for s in cap['samples'] if s['scale']==scale]:
  actual=Image.open(B/sample['filename']).convert('RGBA');column=J['clips'][sample['clip']]['start']+sample['pose']
  for row in range(4):
   art=sheet.crop((column*64,row*64,(column+1)*64,(row+1)*64));scene=actual.crop((48+row*120,65,112+row*120,129));assert all(a==b for a,b in zip(art.get_flattened_data(),scene.get_flattened_data()) if a[3]);checks+=1
report={'deterministicReplay':len(before),'binaryAlpha':True,'sharedPalette':True,'posesPadding':100,'fixedHeadTemplatePixelsChecked':headPixels,'rearSwimNaturallyOccludedTemplatePixelsSkipped':occluded,'gifDurationMs':durations,'realFullChromiumDurationMs':cap['durations'],'allFortySixChronologicalStatesAtBothScales':True,'capturedSpritePixelChecks':checks,'artAcceptance':'Only explicit visual observations can accept natural anatomy/motion, not this audit.'};(O/'output-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('PENGUIN_OUTPUT_AUDIT_OK',report)
