"""Validate encoded deliverables and optionally record completed human-agent inspection.
Does not change PNG/GIF pixels. --complete-inspected is an explicit inspection record.
"""
import json,hashlib,sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[3];D=ROOT/'data/vehicle-style-study/03-guide-pixel-finish';O=ROOT/'public/demos/vehicle-style-study/03-guide-pixel-finish'
r=json.loads((O/'report.json').read_text());scene=json.loads((D/'scene-audit.json').read_text())
assert scene['triangles']==r['evaluatedTriangles']
palette={tuple(bytes.fromhex(c[1:])) for c in r['palette'].values()}
sheet=Image.open(O/'sheet.png').convert('RGBA');assert sheet.size==(1024,128)
guides={k:0 for k in ('body','glass','wheels','lamps','intakes','panels')};views=[]
for i in range(8):
 raw=Image.open(O/f'raw-{i}.png');assert raw.size==(512,512) and raw.mode=='RGBA'
 im=Image.open(O/f'view-{i}.png');assert im.size==(128,128) and im.mode=='RGBA'
 assert set(im.getchannel('A').get_flattened_data())<={0,255}
 assert {p[:3] for p in im.get_flattened_data() if p[3]}<=palette
 assert sheet.crop((i*128,0,(i+1)*128,128)).tobytes()==im.tobytes()
 visible=set()
 for y in range(128):
  for x in range(128):
   if im.getpixel((x,y))[3]:visible.add((x,y))
 # No disconnected little fragments, using eight-neighbor pixel connectivity.
 todo=set(visible);components=[]
 while todo:
  p=todo.pop();q=[p];n=1
  while q:
   x,y=q.pop()
   for dx in (-1,0,1):
    for dy in (-1,0,1):
     p=x+dx,y+dy
     if p in todo:todo.remove(p);q.append(p);n+=1
  components.append(n)
 assert min(components)>3,('stray alpha island',i,components)
 ids=Image.open(O/f'guide-{i}.png')
 assert all(ids.getpixel(p)[3]>0 for p in visible),'No finished pixel outside actual projected guide silhouette'
 for k in guides:
  for size in (128,512):
   mask=Image.open(D/'guides'/f'{k}-{i}-{size}.png');assert mask.size==(size,size)
   assert set(mask.get_flattened_data())<={0,255}
  guides[k]+=sum(p>0 for p in Image.open(D/'guides'/f'{k}-{i}-128.png').get_flattened_data())
 views.append({'view':i,'alphaComponents':components,'finishedPixelsOutsideGuide':0})
assert all(n>0 for n in guides.values())
gif=Image.open(O/'turntable.gif');assert gif.n_frames==8
dur=0
for i in range(8):
 gif.seek(i);dur+=gif.info['duration'];frame=gif.convert('RGB');assert frame.size==(640,600)
 # Capture at 1/2 resolution in two rows for direct inspection of every encoded frame.
strip=Image.new('RGB',(1280,600))
for i in range(8):
 gif.seek(i);strip.paste(gif.convert('RGB').resize((320,300),Image.Resampling.NEAREST),((i%4)*320,(i//4)*300))
strip.save(D/'encoded-gif-contact.png');assert dur==1760
expected=[*(f'raw-{i}.png' for i in range(8)),*(f'view-{i}.png' for i in range(8)),'sheet.png','comparison.png','turntable.gif']
for f in expected:assert (O/f).is_file()
assert (D/'sports-coupe.blend').is_file()
summary={'status':'passed','views':views,'guideCoveragePixels':guides,'gifFrames':8,'gifTotalMs':dur,'scene':scene,'requiredFiles':len(expected),'broadChecks':'Not run, per isolated experiment scope; coordinator owns shared validation.'}
(D/'validation.json').write_text(json.dumps(summary,indent=2)+'\n')
if '--complete-inspected' in sys.argv:
 r['status']='complete'
 r['visualInspection']=[
  {'artifact':'raw-sheet.png','inspection':'Viewed all eight 512px geometry captures: continuous hood and deck after short side-local cutter repair; near/far tires, roof, glazing and lamp placement inspected.'},
  {'artifact':'comparison.png','inspection':'Viewed every native and 4x final plus raw/ID stages. Glass borders and broad reflection bands read consistently. Rear louver speckles replaced by three continuous endpoint-guided slats; reviewed all diagonals.'},
  {'artifact':'sheet.png','inspection':'Viewed native 1024x128 strip at original resolution; checked coherent scale, glass, front/rear distinction and wheel positions.'},
  {'artifact':'data/vehicle-style-study/03-guide-pixel-finish/encoded-gif-contact.png','inspection':'Viewed all eight decoded GIF frames as a contact sheet; consistent placement and no missing frames. Continuous real-time playback was not used.'}]
 r['validation'].update({'sceneAuditPassed':True,'artifactAuditPassed':True,'allSixGuideClassesPresent':True,'finishedPixelsOutsideGuide':0,'tinyDisconnectedAlphaIslands':0,'gifDurationMs':dur})
 r['files']={f:hashlib.sha256((O/f).read_bytes()).hexdigest() for f in expected}
 r['commands'].append('python scripts/vehicle-style-study/03-guide-pixel-finish/validate.py')
 r['sourcePaths']=['scripts/vehicle-style-study/03-guide-pixel-finish/'+f for f in ('build.py','finish.py','audit_scene.py','validate.py')]
 r['sceneAuditPath']='data/vehicle-style-study/03-guide-pixel-finish/scene-audit.json'
 r['validationPath']='data/vehicle-style-study/03-guide-pixel-finish/validation.json'
 r['bounds']=scene['bounds']
 r['nominalCoachworkLength']=4.6
 r['limitations'].append('Nominal coachwork length is 4.6; splitter, curve bevels and exhaust extend the complete evaluated envelope to 4.713 x 2.066 x 1.070.')
 r['pixelFreeze']='Final PNG/GIF pixels frozen after visual inspection; report hashes identify exact candidate bytes.'
 (O/'report.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({'status':summary['status'],'reportStatus':r['status'],'triangles':scene['triangles'],'views':8,'allGuidesPresent':True,'gifMs':dur},indent=2))
