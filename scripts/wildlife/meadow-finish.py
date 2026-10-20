"""Source-projected action finishing; native travel cells remain byte-exact."""
from pathlib import Path
import hashlib, json, math, sys
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[2]; species=sys.argv[1]
S=ROOT/f'art-source/wildlife-v2/{species}/behavior-v1'; O=ROOT/f'public/demos/wildlife-v2/{species}/behavior-v1'
assert not (S/'receipt.json').exists(), 'Registered banks are immutable'
inputs=json.loads((S/'inputs.json').read_text()); base=json.loads((ROOT/inputs['metadata']).read_text())
W=inputs['canvas']; F=['down','up','left','right']; records=json.loads((S/'projection.json').read_text())['records']
source=Image.open(ROOT/inputs['sheet']).convert('RGBA'); original_columns=source.width//W
clips={name:{**c,'frameDuration':c.get('frameDuration',125 if species=='rabbit' else 120 if species=='robin' else 100)} for name,c in base['clips'].items()}
extras=[('eat',8,150)] if species!='meerkat' else [('scan',12,125),('alarm',8,90),('rear',8,75),('lower',8,75)]
column=original_columns
for name,count,duration in extras: clips[name]=dict(start=column,count=count,frameDuration=duration,loop=name=='scan');column+=count
sheet=Image.new('RGBA',(column*W,4*W));sheet.alpha_composite(source)
if species!='meerkat':
    G=json.loads((S/'idle-guides.json').read_text());G['records']+=records
    M=json.loads((ROOT/inputs['masters']).read_text()); PAL={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
    ns=dict(G=G,M=M,W=W,PAL=PAL,P=PAL,F=F,math=math,Image=Image,ImageDraw=ImageDraw)
    exec((S/'paint.py').read_text(),ns)
    compose=ns['compose']
else:
    palette={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in inputs['profile']['palette'].items()}
    def compose(r):
        im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im)
        for v in sorted(r['volumes'],key=lambda v:(-v['depth'],v['name'])):
            ps=[tuple(math.floor(x+.5) for x in p) for p in v['points']]
            if len(set(ps))>=3:d.polygon(ps,fill=palette[v['key']])
        outline=Image.new('RGBA',im.size,palette['K']);outline.putalpha(im.getchannel('A').filter(ImageFilter.MaxFilter(3)));outline.alpha_composite(im)
        return outline
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
four(extras[0][0],len(records)//4//2 if species!='meerkat' else 5).save(O/'scene-native.png')
sequence=[(name,i,ms) for name,count,ms in extras for i in range(count)]
images=[four(c,i).convert('RGB') for c,i,ms in sequence];durations=[ms for c,i,ms in sequence]
for name,scale in [('preview-native.gif',1),('preview.gif',3)]:
    frames=[im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST) for im in images]
    frames[0].save(O/name,save_all=True,append_images=frames[1:],duration=durations,disposal=2,loop=0,optimize=False)
audit=dict(identity=meta['identity'],poses=len(records),binaryAlpha=set(sheet.getchannel('A').get_flattened_data())<={0,255},nativeCellsUnchanged=True,minimumPadding=2,distinctActionFrames={f:{c:len({sheet.crop(((clips[c]['start']+i)*W,row*W,(clips[c]['start']+i+1)*W,(row+1)*W)).tobytes() for i in range(n)}) for c,n,_ in extras} for row,f in enumerate(F)})
assert audit['binaryAlpha'] and all(n>=3 for groups in audit['distinctActionFrames'].values() for n in groups.values())
(O/'pixel-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(O/'playback.js').write_bytes((ROOT/'scripts/wildlife/meadow-playback.js').read_bytes())
(O/'index.html').write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8"><title>{species} actions</title><style>body{{background:#283b36;color:white;font:16px sans-serif}}canvas{{image-rendering:pixelated;width:min(100%,1000px);background:#77947d}}img{{image-rendering:pixelated;max-width:100%}}</style><h1>{species} - behavior-v1</h1><p>Pending human review.</p><label>Action <select id="clip">{''.join(f'<option>{c}</option>' for c in clips)}</select></label> <button type="button" id="pause">Play</button> <button type="button" id="step">Next pose</button> <label>Pose <input id="pose" type="range" min="0" value="0"></label> <label>Speed <select id="speed"><option value="0.5">Half</option><option value="1" selected>Normal</option><option value="2">Double</option></select></label><p><canvas aria-label="Four animal directions"></canvas></p><p>All four directions at game scale alongside Trail Explorer:</p><img alt="Four animal directions beside Trail Explorer" src="scene-native.png"><p><a href="contact-sheet-native.png">All action cells</a> - <a href="sprite.json">Source metadata</a></p><script type="module" src="playback.js"></script></html>''', encoding='utf8', newline='\n')
print('MEADOW_FINISH_OK',species,meta['sheetSha256'])
