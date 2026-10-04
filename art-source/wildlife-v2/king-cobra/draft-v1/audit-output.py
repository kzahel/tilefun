"""Independent decoded sheet/master/GIF/browser parity and finishing replay audit."""
import json,hashlib,subprocess,sys
from pathlib import Path
from PIL import Image,ImageSequence
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/king-cobra/draft-v1'
M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text());meta=json.loads((O/'sprite.json').read_text())
F=list(meta['facings']);W=96;sheet=Image.open(O/'sheet.png').convert('RGBA');P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
headChecks=0
for r in G['records']:
    row=F.index(r['facing']);col=meta['clips'][r['clip']]['start']+r['index'];part=M['heads'][r['facing']]
    hx=int(r['head'][0]+.5)+part['offset'][0];hy=int(r['head'][1]+.5)+part['offset'][1]
    for y,line in enumerate(part['pixels']):
        for x,ch in enumerate(line):
            if ch!='.':assert sheet.getpixel((col*W+hx+x,row*W+hy+y))==P[ch],(r['facing'],r['clip'],r['index'],x,y)
    headChecks+=1
assert set(sheet.getchannel('A').get_flattened_data())=={0,255}
assert set(sheet.get_flattened_data())<=set(P.values())|{(0,0,0,0)}
for f in F:
    row=F.index(f)
    for fr in meta['facings'][f]['frames']:
        x,y,w,h=fr['rect'];im=sheet.crop((x,y,x+w,y+h));bb=im.getbbox()
        assert list(bb)==fr['visibleBounds'] and min(bb[:2])>=2 and max(bb[2:])<=W-2
files=[p for p in O.rglob('*') if p.is_file() and p.suffix in ['.png','.gif','.json'] and p.name not in ['output-audit.json']]
before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
result=subprocess.run([sys.executable,str(S/'finish.py')],capture_output=True,text=True);assert result.returncode==0,result.stderr
for p in files:assert hashlib.sha256(p.read_bytes()).hexdigest()==before[str(p)],('non-deterministic finishing',p)
durations={}
for name in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif']:
    durations[name]=sum(fr.info['duration'] for fr in ImageSequence.Iterator(Image.open(O/name)));assert durations[name]==4480
D=R/'data/wildlife-campaign-v2/background-01-worker/cobra-browser';C=json.loads((D/'capture.json').read_text());assert C['errors']==[]
bg=Image.open(O/'scene-background.png').convert('RGBA');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');parity=0
for sample in C['samples']:
    c=sample['clip'];i=sample['pose'];col=meta['clips'][c]['start']+i;expected=bg.copy()
    for row,f in enumerate(F):
        expected.alpha_composite(sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)),(32+row*120,31))
        expected.alpha_composite(person.crop((0,row*32,32,row*32+32)),(4+row*120,62))
    actual=Image.open(D/sample['filename']).convert('RGBA');assert actual.tobytes()==expected.tobytes(),sample['filename'];parity+=1
for scale in [1,4]:
    assert C['durations'][str(scale)]>=8960
    assert set(s['sequenceIndex'] for s in C['samples'] if s['scale']==scale)==set(range(28))
report={'status':'passed','fullSkullMasterChecks':headChecks,'binaryAlpha':True,'padding':True,'palette':True,'deterministicFinishingReplayFiles':len(files),'decodedGifDurationMs':durations,'actualChromiumSamples':parity,'playbackDurationMs':C['durations'],'browser':C['browser'],'actualAllSequenceIndicesAtBothScales':True,'observationLimit':'These are integrity checks, not visual art approval.'}
(O/'output-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('COBRA_OUTPUT_AUDIT_OK',headChecks,len(files),parity)
