"""Fresh jellyfish pixel finishing from evaluated closed-bell geometry and tendrils."""
import json,math,hashlib,os
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[4];species='jellyfish';S=Path(__file__).resolve().parent;O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/'public/demos/wildlife-v2/jellyfish/roster-v2')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
G=json.loads((S/'projection.json').read_text(encoding='utf8'));W=G['canvas'];F=['down','up','left','right'];P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in G['palette'].items()}
def snap(v):return math.floor(v+.5)
def xy(p):return tuple(snap(v) for v in p[:2])
def tendril(im,ps,near):
    d=ImageDraw.Draw(im);d.line([xy(p) for p in ps],fill=P['T' if near else 'R'],width=1)
def compose(r):
    im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im);order=sorted(r['tendrils'].values(),key=lambda ps:-ps[0][2])
    for ps in order[:4]:tendril(im,ps,False)
    for ps in r['oral'].values():d.line([xy(p) for p in ps],fill=P['B'],width=2)
    vertices=r['bellVertices'];polys=[]
    for face,key in zip(G['bellFaces'],G['bellKeys']):
        pts=[vertices[i] for i in face];polys.append((sum(p[2] for p in pts)/len(pts),pts,key))
    for depth,ps,key in sorted(polys,reverse=True):
        points=[xy(p) for p in ps]
        if len(set(points))>=3:d.polygon(points,fill=P[key])
        elif points:d.line(points,fill=P[key],width=1)
    rim=[xy(p) for p in vertices[81:97]];d.line(rim+[rim[0]],fill=P['R'],width=1)
    for p in r['organs']:d.point(xy(p),fill=P['C'])
    for ps in order[4:]:tendril(im,ps,True)
    return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']}
clips={'idle':dict(start=0,count=1,frameDuration=100),'pulse':dict(start=1,count=32,frameDuration=G['frameDurationMs']),'action':dict(start=33,count=8,frameDuration=100)}
sheet=Image.new('RGBA',(W*41,W*4));metadata=dict(identity=f'{species}-roster-v2-pixels-01',reviewStatus='fresh volume-preserving jellyfish prototype; exact final pixels pending human review',image='sheet.png',frameWidth=W,frameHeight=W,anchor=G['anchor'],rootMotion=False,defaultClip='pulse',clips=clips,facings={},cameraContract=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text()))
for row,f in enumerate(F):
    metadata['facings'][f]=dict(row=row,frames=[])
    for clip,c in clips.items():
        for i in range(c['count']):
            im=frames[f,clip,i];bbox=im.getbbox();assert bbox and min(bbox[:2])>=2 and max(bbox[2:])<=W-2,(f,clip,i,bbox)
            assert set(im.getchannel('A').get_flattened_data())<={0,255}
            sheet.alpha_composite(im,((c['start']+i)*W,row*W))
            metadata['facings'][f]['frames'].append(dict(clip=clip,index=i,rect=[(c['start']+i)*W,row*W,W,W],visibleBounds=bbox))
sheet.save(O/'sheet.png');metadata['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest()
(O/'sprite.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf8')
(S/'masters.json').write_text(json.dumps(dict(identity=metadata['identity'],palette=G['palette'],bellFaces=G['bellFaces'],bellKeys=G['bellKeys'],finishing='Evaluated constant-volume bell surfaces and independent source tendrils'),indent=2)+'\n',encoding='utf8')
contact=Image.new('RGBA',(W*8,W*4))
for row,f in enumerate(F):
    for col,i in enumerate(range(0,32,4)):contact.alpha_composite(frames[f,'pulse',i],(col*W,row*W))
contact.save(O/'contact-sheet-native.png')
scene_panel=W+40;bg=Image.new('RGB',(scene_panel*4,W+40),'#6c99a5');d=ImageDraw.Draw(bg)
for y in range(20,W+40,16):d.line((0,y,scene_panel*4,y),fill='#5a8793')
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
for row in range(4):bg.paste(person.crop((0,row*32,32,(row+1)*32)),(row*scene_panel+2,10+G['anchor'][1]-28),person.crop((0,row*32,32,(row+1)*32)))
bg.save(O/'scene-background.png')
def four(clip,i,travel=0,padded=False):
    margin=40 if padded else 0
    panel=W+2*margin if padded else scene_panel
    im=Image.new('RGB',(panel*4,W+40+2*margin),'#6c99a5') if padded else bg.copy()
    if padded:
        d=ImageDraw.Draw(im)
        for x in range(0,im.width,16):d.line((x,0,x,im.height),fill='#5a8793')
        for y in range(0,im.height,16):d.line((0,y,im.width,y),fill='#5a8793')
    for row,f in enumerate(F):
        yaw=math.radians(metadata['cameraContract']['modelYawDegrees'][f]);dx=snap(-math.sin(yaw)*travel);dy=snap(-math.sin(math.radians(40))*math.cos(yaw)*travel)
        tile=frames[f,clip,i];im.paste(tile,(row*panel+margin+(0 if padded else 36)+dx,10+margin+dy),tile)
    return im
four('idle',0).save(O/'scene-native.png')
def gif(images,name,duration):
    images[0].save(O/name,save_all=True,append_images=images[1:],duration=duration,loop=0,disposal=2,optimize=False)
seq=[('idle',0)]+[('pulse',i) for i in range(32)]+[('action',i) for i in range(8)]
native=[]
for clip,i in seq:
    im=Image.new('RGB',(W*4,W),'#6c99a5')
    for row,f in enumerate(F):im.paste(frames[f,clip,i],(row*W,0),frames[f,clip,i])
    native.append(im)
gif(native,'preview-native.gif',[clips[c]['frameDuration'] for c,i in seq])
gif([im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST) for im in native],'preview.gif',[clips[c]['frameDuration'] for c,i in seq])
gif([four('pulse',i%32,6*1.28*i/32,True) for i in range(64)],'travel-native.gif',G['frameDurationMs'])
allowed=set(P.values())|{(0,0,0,0)};assert set(sheet.get_flattened_data())<=allowed
widths={f:[max(p[0] for p in r['bellVertices'])-min(p[0] for p in r['bellVertices']) for r in G['records'] if r['facing']==f and r['clip']=='pulse'] for f in F}
assert all(max(v)-min(v)>=2 for v in widths.values())
native_widths={f:[frames[f,'pulse',i].getbbox()[2]-frames[f,'pulse',i].getbbox()[0] for i in range(32)] for f in F}
assert all(max(v)-min(v)>=2 for v in native_widths.values())
(O/'pixel-audit.json').write_text(json.dumps(dict(identity=metadata['identity'],poses=164,binaryAlpha=True,fixedPalette=True,minimumPadding=2,freshSpeciesSource=True,evaluatedDeformingBell=True,bellWidthRangePixels={f:max(v)-min(v) for f,v in widths.items()},nativeSilhouetteWidthRangePixels={f:max(v)-min(v) for f,v in native_widths.items()},sourceTendrils=8,pulseDurationMs=32*G['frameDurationMs']),indent=2)+'\n',encoding='utf8')
print('JELLYFISH_FINISH_OK',metadata['sheetSha256'])
