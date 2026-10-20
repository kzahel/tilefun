"""Native-pixel finishing of saved Blender action projections; preserve old cells."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import hashlib,json,math,sys
R=Path(__file__).resolve().parents[2];animal=sys.argv[1];S=R/f'art-source/wildlife-v2/{animal}/behavior-v1';O=R/f'public/demos/wildlife-v2/{animal}/behavior-v1';assert not (S/'receipt.json').exists()
I=json.loads((S/'inputs.json').read_text());B=json.loads((R/I['metadata']).read_text());records=json.loads((R/I['projection'] if 'projection' in I else S/'projection.json').read_text())['records'];W=I['canvas'];F=['down','up','left','right'];palette={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in I['palette'].items()}
source=Image.open(R/I['sheet']).convert('RGBA');old=source.width//W;clips=B['clips'].copy();column=old;extras=list(dict.fromkeys(r['clip'] for r in records));durations={'climb':100,'pickup':125,'eat':150,'sit':150,'stalk':125,'pounce':80,'bat':90}
for name in extras:
 count=sum(r['facing']=='down' and r['clip']==name for r in records);clips[name]=dict(start=column,count=count,frameDuration=durations[name],loop=name in ['climb','eat','sit','stalk']);column+=count
sheet=Image.new('RGBA',(column*W,4*W));sheet.alpha_composite(source)
for r in records:
 im=Image.new('RGBA',(W,W));draw=ImageDraw.Draw(im)
 for v in sorted(r['volumes'],key=lambda v:(-v['depth'],v['name'])):
  ps=[tuple(math.floor(x+.5) for x in p) for p in v['points']]
  if len(set(ps))>=3:draw.polygon(ps,fill=palette[v['key']])
 outline=Image.new('RGBA',(W,W),palette['k' if animal.startswith('cat') else 'K']);outline.putalpha(im.getchannel('A').filter(ImageFilter.MaxFilter(3)));outline.alpha_composite(im);box=outline.getbbox();assert box and min(box[:2])>=1 and box[2]<=W-1 and box[3]<=W-1,(animal,r['clip'],r['facing'],box)
 sheet.alpha_composite(outline,((clips[r['clip']]['start']+r['index'])*W,F.index(r['facing'])*W))
assert sheet.crop((0,0,source.width,source.height)).tobytes()==source.tobytes();sheet.save(O/'sheet.png')
meta=dict(identity=f'{animal}-behavior-v1',reviewStatus='pending human review',frameWidth=W,frameHeight=W,anchor=I['anchor'],image='sheet.png',rootMotion=False,defaultClip=extras[0],clips=clips,sheetSha256=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest())
(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n')
contact=sheet.crop((old*W,0,column*W,4*W));contact.save(O/'contact-sheet-native.png');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');panel=W+48

def four(clip,i):
 im=Image.new('RGBA',(panel*4,W+40),'#77947d')
 for row in range(4):
  tile=sheet.crop(((clips[clip]['start']+i)*W,row*W,(clips[clip]['start']+i+1)*W,(row+1)*W));im.alpha_composite(tile,(row*panel+36,10));im.alpha_composite(person.crop((0,row*32,32,(row+1)*32)),(row*panel,10+I['anchor'][1]-28))
 return im
four(extras[0],3).save(O/'scene-native.png');sequence=[(name,i,durations[name]) for name in extras for i in range(clips[name]['count'])];images=[four(c,i).convert('RGB') for c,i,_ in sequence]
for name,scale in [('preview-native.gif',1),('preview.gif',3)]:
 frames=[im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST) for im in images];frames[0].save(O/name,save_all=True,append_images=frames[1:],duration=[ms for _,_,ms in sequence],disposal=2,loop=0,optimize=False)
(O/'playback.js').write_bytes((R/'scripts/wildlife/meadow-playback.js').read_bytes())
(O/'index.html').write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><title>{animal} actions</title><style>body{{background:#283b36;color:white;font:16px sans-serif}}canvas{{image-rendering:pixelated;width:min(100%,1000px);background:#77947d}}img{{image-rendering:pixelated;max-width:100%}}</style><h1>{animal} actions</h1><p>Pending human review.</p><label>Action <select id="clip">'+''.join(f'<option>{c}</option>' for c in clips)+'</select></label> <button type="button" id="pause">Play</button> <button type="button" id="step">Next pose</button> <label>Pose <input id="pose" type="range" min="0" value="0"></label> <label>Speed <select id="speed"><option value="0.5">Half</option><option value="1" selected>Normal</option><option value="2">Double</option></select></label><p><canvas aria-label="Four animal directions"></canvas></p><img alt="Four directions beside Trail Explorer" src="scene-native.png"><script type="module" src="playback.js"></script></html>',encoding='utf8')
distinct={f:{c:len({sheet.crop(((clips[c]['start']+i)*W,row*W,(clips[c]['start']+i+1)*W,(row+1)*W)).tobytes() for i in range(clips[c]['count'])}) for c in extras} for row,f in enumerate(F)}
assert all(n>=3 for group in distinct.values() for n in group.values()),distinct
(O/'pixel-audit.json').write_text(json.dumps(dict(identity=meta['identity'],binaryAlpha=set(sheet.getchannel('A').get_flattened_data())<={0,255},nativeCellsUnchanged=True,poses=len(records),distinctActionFrames=distinct),indent=2)+'\n')
print('WOODLAND_FINISH_OK',animal,len(records))
