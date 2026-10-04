"""Deterministic replay plus encoded output and actual browser pixel checks."""
from pathlib import Path
import json,hashlib,subprocess,sys,math
from PIL import Image
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/rabbit/pilot-v1';D=ROOT/'data/wildlife-campaign-v2/manual-rabbit-01'
def hashes():return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in O.iterdir() if p.suffix in ['.png','.gif'] or p.name in ['sprite.json','validation.json']}
if '--replay' in sys.argv:
    before=hashes();subprocess.run([sys.executable,str(S/'finish.py')],check=True);after=hashes();assert before==after
    report={'status':'passed','byteIdenticalOutputs':list(before),'outputHashes':after}
    # Read back visible opaque skull pixels, rather than checking only template
    # declarations. Rear hop has legitimate body occlusion, checked visually.
    sheet=Image.open(O/'sheet.png').convert('RGBA');master=json.loads((S/'masters.json').read_text());guide=json.loads((S/'projected-guides.json').read_text())
    head_checks={}
    for row,f in enumerate(guide['facings']):
        entry=master['heads'][f];rows=master['heads'][entry['mirror']]['pixels'] if 'mirror' in entry else entry['pixels']
        if 'mirror' in entry:rows=[line[::-1] for line in rows]
        off=entry['offset'];baseline=None;count=0
        for r in guide['records']:
            if r['facing']!=f or (f=='up' and r['clip']=='hop'):continue
            col=(0 if r['clip']=='idle' else 1 if r['clip']=='hop' else 9)+r['index'];frame=sheet.crop((col*32,row*32,col*32+32,row*32+32));pos=[math.floor(v+.5) for v in r['landmarks']['HEAD-stable-volume'][:2]]
            patch=bytes(channel for y,line in enumerate(rows) for x,ch in enumerate(line) if ch!='.' for channel in frame.getpixel((pos[0]+off[0]+x,pos[1]+off[1]+y)))
            if baseline is None:baseline=patch
            assert patch==baseline,(f,r['clip'],r['index'],'visible head marking changed');count+=1
        head_checks[f]=count
    report['decodedFullOpaqueHeadPatchChecks']=head_checks
    report['rearHopHead']='Fixed skull master; changing torso occlusion inspected in captured chronological cycles.'
    for name in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif']:
        gif=Image.open(O/name);dur=0;count=0
        for i in range(gif.n_frames):gif.seek(i);gif.load();dur+=gif.info['duration'];count+=1
        assert dur==4000,(name,dur);report[name]={'decodedFrames':count,'durationMs':dur}
    (O/'replay-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('RABBIT_DETERMINISTIC_REPLAY_OK',len(before))
if '--browser' in sys.argv:
    capture=json.loads((D/'browser/capture.json').read_text());sheet=Image.open(O/'sheet.png').convert('RGBA');background=Image.open(O/'scene-background.png').convert('RGBA');person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
    def expected(clip,i):
        im=background.copy();col=(0 if clip=='idle' else 1 if clip=='hop' else 9)+i
        for row in range(4):
            x=76+row*64;im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(x-16,39));im.alpha_composite(sheet.crop((col*32,row*32,col*32+32,row*32+32)),(x-16,83))
        return im
    for s in capture['samples']:
        im=Image.open(D/'browser'/s['filename']).convert('RGBA');assert im.tobytes()==expected(s['clip'],s['pose']).tobytes(),s['filename']
    report={'status':'passed','continuousBrowserSamples':len(capture['samples']),'durationMs':capture['durationMs'],'browser':capture['browser'],'everyCanvasMatchesAuthoredScene':True,'errors':capture['errors']}
    (O/'browser-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('RABBIT_BROWSER_PIXELS_OK',len(capture['samples']))
