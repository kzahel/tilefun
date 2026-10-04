from pathlib import Path
from PIL import Image,ImageDraw
import json,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/dog/draft-v1';M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text());F=['down','up','left','right'];P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};P['.']=(0,0,0,0);frames={}
for r in M['frames']:
 im=Image.new('RGBA',(64,64));im.putdata([P[c] for line in r['pixels'] for c in line]);frames[r['facing'],r['clip'],r['index']]=im
clips={'idle':{'start':0,'count':1},'walk':{'start':1,'count':16},'action':{'start':17,'count':8}};sheet=Image.new('RGBA',(1600,256));J={'identity':M['identity'],'reviewStatus':'pending','image':'sheet.png','frameWidth':64,'frameHeight':64,'anchor':[32,44],'rootMotion':False,'cameraContract':G['cameraContract'],'orthoScale':6.4,'shiftY':12/64,'clips':clips,'facings':{}}
for row,f in enumerate(F):
 J['facings'][f]={'frames':[]}
 for c,info in clips.items():
  for i in range(info['count']):
   x=(info['start']+i)*64;y=row*64;im=frames[f,c,i];sheet.alpha_composite(im,(x,y));r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,c,i));J['facings'][f]['frames'].append({'clip':c,'index':i,'rect':[x,y,64,64],'visibleBounds':im.getbbox(),'contacts':r['contacts'],'projectedContacts':r['projectedContacts'],'headAnchor':[math.floor(v+.5) for v in r['head'][:2]]})
sheet.save(O/'sheet.png');(O/'sprite.json').write_text(json.dumps(J,indent=1)+'\n',encoding='utf-8');cs=Image.new('RGBA',(1600,276),'#879b82');cs.alpha_composite(sheet,(0,20));ImageDraw.Draw(cs).text((3,3),'Natural tricolor dog | idle | walk0-15 | tail wag0-7 | down/up/left/right',fill='white');cs.save(O/'contact-sheet-native.png');cs.resize((6400,1104),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 strip=Image.new('RGBA',(1024,234),'#879b82');d=ImageDraw.Draw(strip)
 for row,(c,info) in enumerate(clips.items()):
  d.text((3,row*78),f'{f} {c}',fill='white')
  for i in range(info['count']):strip.alpha_composite(frames[f,c,i],(i*64,row*78+14))
 strip.save(O/f'strip-{f}-native.png');strip.resize((3072,702),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(R/'public/assets/tilesets/me-complete.png').convert('RGBA');bg=Image.new('RGBA',(680,260),'#789258')
for rect,pos in [([1920,7312,160,160],(520,-105)),([256,96,48,64],(3,1)),([0,1152,208,64],(236,196))]:x,y,w,h=rect;bg.alpha_composite(atlas.crop((x,y,x+w,y+h)),pos)
person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scene(c,i,travel=None):
 im=bg.copy()
 for row,f in enumerate(F):
  x,y=74+row*170,88
  if travel is not None:
   yaw=math.radians(G['cameraContract']['modelYawDegrees'][f]);D=.60*travel;x+=round(-10*math.sin(yaw)*D);y+=round(-10*math.sin(math.radians(40))*math.cos(yaw)*D)
  im.alpha_composite(frames[f,c,i],(x,y));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(26+row*170,103))
 return im
bg.save(O/'scene-background.png');scene('idle',0).save(O/'scene-native.png');scene('idle',0).resize((2720,1040),Image.Resampling.NEAREST).save(O/'scene-4x.png');seq=[('idle',0)]*3+[('walk',i%16) for i in range(32)]+[('action',i) for i in range(8)]+[('idle',0)]*3
def gif(fs,p):fs[0].save(p,save_all=True,append_images=fs[1:],duration=160,loop=0,disposal=2,optimize=False)
native=[]
for c,i in seq:
 im=Image.new('RGBA',(256,64),'#879b82')
 for row,f in enumerate(F):im.alpha_composite(frames[f,c,i],(row*64,0))
 native.append(im)
gif(native,O/'preview-native.gif');gif([im.resize((1024,256),Image.Resampling.NEAREST) for im in native],O/'preview.gif');gif([scene(c,i) for c,i in seq],O/'scene-native.gif');gif([scene(c,i).resize((2720,1040),Image.Resampling.NEAREST) for c,i in seq],O/'scene-4x.gif');gif([scene('walk',i%16,i/16) for i in range(32)],O/'preview-walk-travel-native.gif')
guide=Image.new('RGBA',(1024,256),'#879b82');over=Image.new('RGBA',(256,256),'#879b82')
for row,f in enumerate(F):
 for i in range(16):
  r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,'walk',i));im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im)
  for v in r['volumes'].values():d.polygon([(round(p[0]),round(p[1])) for p in v['hull']],outline='#dca567')
  for n,p in r['projectedContacts'].items():d.point((round(p[0]),round(p[1])),fill='#bddd98' if r['contacts'][n]['planted'] else '#e4adbc')
  guide.alpha_composite(im,(i*64,row*64))
 for cr,(c,i) in enumerate([('idle',0),('walk',3)]):
  r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,c,i));over.alpha_composite(frames[f,c,i],(row*64,cr*128));im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im)
  for v in r['volumes'].values():d.polygon([(round(p[0]),round(p[1])) for p in v['hull']],outline='#dca567')
  over.alpha_composite(im,(row*64,cr*128+64))
guide.save(O/'projected-volume-contact-sheet.png');over.resize((1024,1024),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png');heights={f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F};report={'status':'Integrity only, independent visual gate separate','poses':100,'binaryAlpha':set(sheet.getchannel('A').get_flattened_data())=={0,255},'idleVisibleHeights':heights,'canvas':[64,64],'anchor':[32,44],'palette':M['palette'],'stylization':M['stylization'],'sequenceDurationMs':7360};assert report['binaryAlpha'];(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('DOG_FINISH_OK',heights)
