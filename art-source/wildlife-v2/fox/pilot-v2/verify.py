"""Deterministic final checks and review evidence from actual Chromium samples."""
from pathlib import Path
import json,hashlib,math
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[4]
S=Path(__file__).parent
O=ROOT/'public/demos/wildlife-v2/fox/pilot-v2'
STATE=ROOT/'data/wildlife-campaign-v2/manual-fox-02'
B=STATE/'browser'
capture=json.loads((B/'capture.json').read_text())
sheet=Image.open(O/'sheet.png').convert('RGBA')
background=Image.open(O/'scene-background.png').convert('RGBA')
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def expected(clip,pose):
    im=background.copy()
    column=0 if clip=='idle' else (1 if clip=='walk' else 9)+pose
    for row in range(4):
        x=76+row*64
        im.alpha_composite(person.crop((0,row*32,32,(row+1)*32)),(x-16,39))
        im.alpha_composite(sheet.crop((column*48,row*48,(column+1)*48,(row+1)*48)),(x-24,76))
    return im
for sample in capture['samples']:
    decoded=Image.open(B/sample['filename']).convert('RGBA')
    assert decoded.tobytes()==expected(sample['clip'],sample['pose']).tobytes(),sample
event_groups={}
for scale in ['1','4']:
    samples=[s for s in capture['samples'] if s['scale']==scale]
    events=[]
    for s in samples:
        if not events or (s['clip'],s['pose'])!=(events[-1]['clip'],events[-1]['pose']):events.append(s)
    assert len([s for s in events if s['clip']=='walk'])>=32
    assert len([s for s in events if s['clip']=='action'])>=16
    event_groups[scale]=events
    # Actual continuously sampled pixels, arranged chronologically without inventing poses.
    contact=Image.new('RGBA',(256*8,64*math.ceil(len(events)/8)),'#879b82')
    d=ImageDraw.Draw(contact)
    for n,s in enumerate(events):
        x,y=(n%8)*256,(n//8)*64
        d.text((x,y),f"{n:02} {s['clip']} {s['pose']+1} {s['time']:.0f}ms",fill='white')
        crop=Image.open(B/s['filename']).convert('RGBA').crop((52,76,308,124))
        contact.alpha_composite(crop,(x,y+16))
    contact.save(O/f'browser-cycle-{scale}x-native-samples.png')
    contact.resize((contact.width*2,contact.height*2),Image.Resampling.NEAREST).save(O/f'browser-cycle-{scale}x-samples.png')
gif_reports={}
for name in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif','v1-v2-native.gif','v1-v2-6x.gif']:
    im=Image.open(O/name)
    duration=0;frames=[]
    for index in range(im.n_frames):
        im.seek(index);frames.append(im.convert('RGB').copy());duration+=im.info['duration']
    assert duration==4000,(name,duration)
    assert im.info['loop']==0
    gif_reports[name]={'decodedFrames':len(frames),'durationMs':duration,'loop':0,'size':list(im.size)}
original=json.loads((STATE/'v1-preservation-hashes.json').read_text())
for path,digest in original.items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,path
guides=json.loads((O/'projected-guides.json').read_text())
assert (S/'projected-guides.json').read_bytes()==(O/'projected-guides.json').read_bytes()
assert len(guides['records'])==68
for r in guides['records']:
    assert all('vertices' not in v and len(v['hull'])>=3 for v in r['volumes'].values())
    assert abs(r['anchor'][0]-24)<.01 and abs(r['anchor'][1]-31)<.01
report={'status':'passed draft integrity; coordinator quality gate remains closed','pixelIdentity':'fox-pilot-v2-drawing-03','browser':capture['browser'],'sampleCount':len(capture['samples']),'durationMs':capture['durationMs'],'allBrowserSamplesMatchAuthoredSceneBytes':True,'observedWalkPoseTransitionsPerScale':{s:len([e for e in events if e['clip']=='walk']) for s,events in event_groups.items()},'observedActionPoseTransitionsPerScale':{s:len([e for e in events if e['clip']=='action']) for s,events in event_groups.items()},'gifs':gif_reports,'v1PreservedFiles':len(original),'compactGuideBytes':(O/'projected-guides.json').stat().st_size,'guideSchema':guides['guideSchema']}
(O/'playback-validation.json').write_text(json.dumps(report,indent=2)+'\n')
(O/'browser-capture.json').write_text(json.dumps({k:v for k,v in capture.items() if k!='executable'},indent=2)+'\n')
print(json.dumps(report,indent=2))
