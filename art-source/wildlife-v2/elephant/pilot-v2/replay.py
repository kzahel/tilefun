"""One final deterministic finish replay, decoded head stability and GIF timing."""
import json,hashlib,subprocess,sys,math
from pathlib import Path
from PIL import Image
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/elephant/pilot-v2';D=ROOT/'data/wildlife-campaign-v2/manual-elephant-02'
paths=[p for p in O.iterdir() if p.suffix in ['.png','.gif'] or p.name in ['sprite.json','masters.json','validation.json']]
before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
command=[sys.executable,str(S/'finish.py')]
with (D/'finishing-replay-inner.log').open('w',encoding='utf-8') as log:
    result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
assert result.returncode==0
after={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
assert before==after,'non-deterministic output'
M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text());meta=json.loads((O/'sprite.json').read_text())
sheet=Image.open(O/'sheet.png').convert('RGBA');palette={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
def snap(v):return int(math.floor(v+.5))
checked=0
for r in G['records']:
    f=r['facing'];entry=M['heads'][f];offset=entry['offset'];anchor=[snap(x) for x in r['body'][:2]]
    frame=next(fr for fr in meta['facings'][f]['frames'] if fr['clip']==r['clip'] and fr['index']==r['index'])
    bx,by,w,h=frame['rect']
    # Rear cap is correctly occluded by torso. Its remaining opaque head pixels
    # are compared against decoded sheet bytes, not hashes of the source alone.
    body=M['bodies'][f]
    for y,row in enumerate(entry['pixels']):
        for x,ch in enumerate(row):
            if ch=='.':continue
            px=anchor[0]+offset[0]+x;py=anchor[1]+offset[1]+y
            if f=='up':
                xx=offset[0]+x-body['offset'][0];yy=offset[1]+y-body['offset'][1]
                if 0<=yy<len(body['pixels']) and 0<=xx<len(body['pixels'][0]) and body['pixels'][yy][xx]!='.':continue
            assert sheet.getpixel((bx+px,by+py))==palette[ch],(f,r['clip'],r['index'],px,py,'head pixel changed')
            checked+=1
report={'status':'passed deterministic final replay and decoded head checks; no art approval','command':command,'exitCode':result.returncode,'byteIdenticalOutputs':before,'decodedHeadPixelChecks':checked,'headPoseRecords':len(G['records'])}
(O/'finishing-replay.json').write_text(json.dumps(report,indent=2)+'\n')
print('DETERMINISTIC_ELEPHANT_FINISH_REPLAY_OK',len(before),checked)
