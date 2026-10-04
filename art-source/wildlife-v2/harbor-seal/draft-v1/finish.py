"""Pillow integer composition from authored palette-letter masters; no image resampling except nearest previews."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
import json,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/harbor-seal/draft-v1';M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text());W=96;F=['down','up','left','right'];P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};P['.']=(0,0,0,0);frames={}
for r in M['frames']:
 im=Image.new('RGBA',(W,W));im.putdata([P[c] for row in r['pixels'] for c in row]);frames[r['facing'],r['clip'],r['index']]=im
clips={'idle':{'start':0,'count':1},'haul':{'start':1,'count':8},'swim':{'start':9,'count':8},'action':{'start':17,'count':6}};J={'identity':M['identity'],'reviewStatus':'pending','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':[48,64],'rootMotion':False,'cameraContract':G['cameraContract'],'orthoScale':9.6,'shiftY':16/96,'waterPlaneZ':3.4,'clips':clips,'facings':{}};sheet=Image.new('RGBA',(23*W,4*W))
for row,f in enumerate(F):
 J['facings'][f]={'frames':[]}
 for c,info in clips.items():
  for i in range(info['count']):
   x=(info['start']+i)*W;y=row*W;im=frames[f,c,i];sheet.alpha_composite(im,(x,y));r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,c,i));J['facings'][f]['frames'].append({'clip':c,'index':i,'rect':[x,y,W,W],'visibleBounds':im.getbbox(),'contacts':r['contacts'],'headAnchor':[math.floor(a+.5) for a in r['head'][:2]]})
sheet.save(O/'sheet.png');(O/'sprite.json').write_text(json.dumps(J,indent=1)+'\n',encoding='utf-8')
cs=Image.new('RGBA',(23*W,4*W+20),'#879b82');cs.alpha_composite(sheet,(0,20));ImageDraw.Draw(cs).text((4,4),'Harbor seal | idle | haul0-7 | swim0-7 | whisker0-5 | down/up/left/right',fill='white');cs.save(O/'contact-sheet-native.png');cs.resize((cs.width*2,cs.height*2),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 strip=Image.new('RGBA',(8*W,4*(W+14)),'#879b82');d=ImageDraw.Draw(strip)
 for row,(c,info) in enumerate(clips.items()):
  d.text((3,row*(W+14)),f'{f} {c}',fill='white')
  for i in range(info['count']):strip.alpha_composite(frames[f,c,i],(i*W,row*(W+14)+14))
 strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*2,strip.height*2),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
bg=Image.new('RGBA',(600,280),'#789258');atlas=Image.open(R/'public/assets/tilesets/me-complete.png').convert('RGBA')
for rect,pos in [([1920,7312,160,160],(440,-85)),([256,96,48,64],(4,2)),([0,1152,208,64],(240,208))]:x,y,w,h=rect;bg.alpha_composite(atlas.crop((x,y,x+w,y+h)),pos)
person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');wet=bg.copy();tile=Image.open(R/'public/assets/tilesets/water.png').convert('RGBA').crop((0,0,16,16))
for y in range(64,160,16):
 for x in range(16,592,16):wet.alpha_composite(tile,(x,y))
def scene(c,i,travel=None):
 im=(wet if c=='swim' else bg).copy()
 for row,f in enumerate(F):
  x,y=50+row*140,58
  if travel is not None:
   yaw=math.radians(G['cameraContract']['modelYawDegrees'][f]);D=travel*(.45 if c=='swim' else .20);x+=round(-10*math.sin(yaw)*D);y+=round(-10*math.sin(math.radians(40))*math.cos(yaw)*D)
  im.alpha_composite(frames[f,c,i],(x,y));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(26+row*140,93))
 return im
bg.save(O/'scene-background.png');wet.save(O/'scene-water-background.png')
for c,n in [('idle','scene'),('swim','scene-swim')]:
 im=scene(c,0);im.save(O/(n+'-native.png'));im.resize((2400,1120),Image.Resampling.NEAREST).save(O/(n+'-4x.png'))
seq=[('idle',0)]*3+[('haul',i%8) for i in range(16)]+[('swim',i%8) for i in range(16)]+[('action',i) for i in range(6)]+[('idle',0)]*3
def gif(fs,path):fs[0].save(path,save_all=True,append_images=fs[1:],duration=160,loop=0,disposal=2,optimize=False)
native=[]
for c,i in seq:
 im=Image.new('RGBA',(4*W,W),'#879b82')
 for row,f in enumerate(F):im.alpha_composite(frames[f,c,i],(row*W,0))
 native.append(im)
gif(native,O/'preview-native.gif');gif([im.resize((1536,384),Image.Resampling.NEAREST) for im in native],O/'preview.gif');gif([scene(c,i) for c,i in seq],O/'scene-native.gif');gif([scene(c,i).resize((2400,1120),Image.Resampling.NEAREST) for c,i in seq],O/'scene-4x.gif')
for c in ['haul','swim']:gif([scene(c,i%8,i/8) for i in range(16)],O/f'preview-{c}-travel-native.gif')
guides=Image.new('RGBA',(8*W,8*W),'#879b82');over=Image.new('RGBA',(4*W,6*W),'#879b82')
for row,f in enumerate(F):
 for cr,c in enumerate(['haul','swim']):
  for i in range(8):
   r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,c,i));im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im)
   for n,v in r['volumes'].items():
    if n.startswith('whisker'):continue
    d.polygon([(round(p[0]),round(p[1])) for p in v['hull']],outline='#dca567')
   for ps in r['contactScreen'].values():
    for p in ps:d.point((round(p[0]),round(p[1])),fill='#ee7373')
   guides.alpha_composite(im,(i*W,(row*2+cr)*W))
 for cr,c in enumerate(['idle','haul','swim']):
  r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,c,0));over.alpha_composite(frames[f,c,0],(row*W,cr*W*2));im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im)
  for v in r['volumes'].values():d.polygon([(round(p[0]),round(p[1])) for p in v['hull']],outline='#dca567')
  over.alpha_composite(im,(row*W,cr*W*2+W))
guides.save(O/'projected-volume-contact-sheet.png');over.resize((1536,2304),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
heights={f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F};report={'status':'integrity only; visual gate separate','poses':92,'binaryAlpha':set(sheet.getchannel('A').get_flattened_data())=={0,255},'idleVisibleHeights':heights,'canvas':[96,96],'anchor':[48,64],'palette':M['palette'],'stylization':M['stylization'],'bodySkin':'Fixed raw mesh, preserve-volume armature, fixed three-link spine; evaluated hulls guide actual silhouette.','sequenceDurationMs':len(seq)*160};assert report['binaryAlpha'];(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('HARBOR_SEAL_FINISH_OK',heights,len(seq)*160)
