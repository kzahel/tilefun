"""Source-projected action finishing; native travel cells remain byte-exact."""
from pathlib import Path
import hashlib, json, math, sys
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[2]; species=sys.argv[1]
S=ROOT/f'art-source/wildlife-v2/{species}/behavior-v1'; O=ROOT/f'public/demos/wildlife-v2/{species}/behavior-v1'
assert not (S/'receipt.json').exists(), 'Registered banks are immutable'
inputs=json.loads((S/'inputs.json').read_text()); base=json.loads((ROOT/inputs['metadata']).read_text())
W=inputs['canvas']; F=['down','up','left','right']; G=json.loads((S/'projection.json').read_text(encoding='utf8')); records=G['records']
source=Image.open(ROOT/inputs['sheet']).convert('RGBA'); original_columns=source.width//W
clips={name:{**c,'frameDuration':c.get('frameDuration',125 if species=='rabbit' else 120 if species=='robin' else 100)} for name,c in base['clips'].items()}
extras=G['clips']
column=original_columns
for name,count,duration in extras: clips[name]=dict(start=column,count=count,frameDuration=duration,loop=name in ['browse','eat']);column+=count
sheet=Image.new('RGBA',(column*W,4*W));sheet.alpha_composite(source)
M=json.loads((ROOT/inputs['masters']).read_text(encoding='utf8')); PAL={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
ns=dict(G=G,M=M,W=W,PAL=PAL,P=PAL,F=F,math=math,Image=Image,ImageDraw=ImageDraw,species=species,horse=True)
exec((S/'paint.py').read_text(encoding='utf8'),ns)
compose=ns['compose']
for r in records:
    tile=compose(r);bbox=tile.getbbox();assert bbox and min(bbox[:2])>=2 and max(bbox[2:])<=W-2,(species,r['facing'],r['clip'],r['index'],bbox)
    sheet.alpha_composite(tile,((clips[r['clip']]['start']+r['index'])*W,F.index(r['facing'])*W))
assert sheet.crop((0,0,source.width,source.height)).tobytes()==source.tobytes()
sheet.save(O/'sheet.png')
meta=dict(identity=f'{species}-behavior-v1',reviewStatus='pending human review',frameWidth=W,frameHeight=W,anchor=inputs['anchor'],image='sheet.png',rootMotion=False,defaultClip=extras[0][0],clips=clips,sheetSha256=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest())
(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n')
# Exact native cells, all four directions, appropriate person scale reference.
contact=Image.new('RGBA',(sum(c for _,c,_ in extras)*W,W*4),'#77947d')
for row in range(4):contact.alpha_composite(sheet.crop((original_columns*W,row*W,column*W,(row+1)*W)),(0,row*W))
contact.save(O/'contact-sheet-native.png')
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
panel=W+48
def four(clip,i):
    im=Image.new('RGBA',(panel*4,W+40),'#77947d');draw=ImageDraw.Draw(im)
    for y in range(0,im.height,16):draw.line((0,y,im.width,y),fill='#6c866f')
    for row in range(4):
        tile=sheet.crop(((clips[clip]['start']+i)*W,row*W,(clips[clip]['start']+i+1)*W,(row+1)*W))
        im.alpha_composite(tile,(row*panel+36,10));im.alpha_composite(person.crop((0,row*32,32,(row+1)*32)),(row*panel,10+inputs['anchor'][1]-28))
    return im
four(extras[0][0],extras[0][1]//2).save(O/'scene-native.png')
sequence=[(name,i,ms) for name,count,ms in extras for i in range(count)]
images=[four(c,i).convert('RGB') for c,i,ms in sequence];durations=[ms for c,i,ms in sequence]
for name,scale in [('preview-native.gif',1),('preview.gif',3)]:
    frames=[im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST) for im in images]
    frames[0].save(O/name,save_all=True,append_images=frames[1:],duration=durations,disposal=2,loop=0,optimize=False)
audit=dict(identity=meta['identity'],poses=len(records),binaryAlpha=set(sheet.getchannel('A').get_flattened_data())<={0,255},nativeCellsUnchanged=True,minimumPadding=2,distinctActionFrames={f:{c:len({sheet.crop(((clips[c]['start']+i)*W,row*W,(clips[c]['start']+i+1)*W,(row+1)*W)).tobytes() for i in range(n)}) for c,n,_ in extras} for row,f in enumerate(F)})
assert audit['binaryAlpha'] and all(n>=3 for groups in audit['distinctActionFrames'].values() for n in groups.values()),audit
# Pixel paint must keep the anatomical head attached to the same visible body.
connections=0
for r in records:
    row=F.index(r['facing']);c=clips[r['clip']];tile=sheet.crop(((c['start']+r['index'])*W,row*W,(c['start']+r['index']+1)*W,(row+1)*W))
    occupied={(x,y) for y in range(W) for x in range(W) if tile.getpixel((x,y))[3]};groups={};group=0
    for p in occupied:
        if p in groups:continue
        group+=1;todo=[p];groups[p]=group
        for x,y in todo:
            for dx in [-1,0,1]:
                for dy in [-1,0,1]:
                    q=(x+dx,y+dy)
                    if q in occupied and q not in groups:groups[q]=group;todo.append(q)
    nearest=lambda p:min(occupied,key=lambda q:math.hypot(q[0]-p[0],q[1]-p[1]))
    assert groups[nearest(r['head'])]==groups[nearest(r['body'])],(species,r['clip'],r['facing'],r['index'],'disconnected head/body paint')
    connections+=1
audit['connectedHeadBodyChecks']=connections
(O/'pixel-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(O/'playback.js').write_bytes((ROOT/'scripts/wildlife/meadow-playback.js').read_bytes())
(O/'index.html').write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8"><title>{species} actions</title><style>body{{background:#283b36;color:white;font:16px sans-serif}}canvas{{image-rendering:pixelated;width:min(100%,1000px);background:#77947d}}img{{image-rendering:pixelated;max-width:100%}}</style><h1>{species} - behavior-v1</h1><p>Pending human review.</p><label>Action <select id="clip">{''.join(f'<option>{c}</option>' for c in clips)}</select></label> <button type="button" id="pause">Play</button> <button type="button" id="step">Next pose</button> <label>Pose <input id="pose" type="range" min="0" value="0"></label> <label>Speed <select id="speed"><option value="0.5">Half</option><option value="1" selected>Normal</option><option value="2">Double</option></select></label><p><canvas aria-label="Four animal directions"></canvas></p><p>All four directions at game scale alongside Trail Explorer:</p><img alt="Four animal directions beside Trail Explorer" src="scene-native.png"><p><a href="contact-sheet-native.png">All action cells</a> - <a href="sprite.json">Source metadata</a></p><script type="module" src="playback.js"></script></html>''', encoding='utf8', newline='\n')
print('PASTURE_FINISH_OK',species,meta['sheetSha256'])
