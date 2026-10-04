from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
import json,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/ant/draft-v2';W=32;F=['down','up','left','right'];G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());P={k:tuple(v) for k,v in M['palette'].items()};O.mkdir(exist_ok=True)
def pt(v):return tuple(int(math.floor(x+.5)) for x in v)
def patch(im,part,pos):
 x,y=pt(pos);x+=part['offset'][0];y+=part['offset'][1]
 for dy,row in enumerate(part['pixels']):
  for dx,k in enumerate(row):
   if k!='.':im.putpixel((x+dx,y+dy),P[k])
def legs(im,r,side,shade):
 d=ImageDraw.Draw(im)
 for n,l in r['legs'].items():
  if n.endswith(str(side)):d.line([pt(v) for v in l['screen']],fill=P[shade],width=1)
frames={};clips={'idle':{'start':0,'count':1},'crawl':{'start':1,'count':8},'action':{'start':9,'count':6}};sheet=Image.new('RGBA',(15*W,4*W))
meta={'identity':M['identity'],'motionIdentity':'ant-draft-v2-motion-01','reviewStatus':'pending production and human review','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'rootMotion':False,'frameDurationMs':140,'fps':1000/140,'cameraContract':G['cameraContract'],'orthoScale':G['orthoScale'],'shiftY':G['shiftY'],'clips':clips,'facings':{}}
for row,f in enumerate(F):
 meta['facings'][f]={'row':row,'frames':[]}
 for gi,r in enumerate(G['records']):
  if r['facing']!=f:continue
  im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im);depths={side:r['meshes'][f'fore-{side}-coxa']['depth'] for side in [-1,1]};far=max(depths,key=depths.get);near=-far;legs(im,r,far,'b')
  # Legs attach underneath the thorax. Draw near shafts before the opaque body
  # finish too, so rounded body surfaces hide the rasterized joint overlap.
  legs(im,r,near,'k')
  # Authored parts use the actual camera-depth order for rear gaster occlusion.
  parts=[('petiole',M['petiole'],r['petiole'],'petiole-scale'),('thorax',M['thoraces'][f],r['thorax'],'mesosoma'),('gaster',M['gasters'][f],r['gaster'],'gaster')]
  for _,master,position,_ in sorted(parts,key=lambda v:r['meshes'][v[3]]['depth'],reverse=True):patch(im,master,position)
  for a in r['antennae'].values():d.line([pt(v) for v in a],fill=P['b'],width=1)
  if f!='up':
   for a in r['mandibles'].values():d.line([pt(v) for v in a],fill=P['b'],width=1)
  patch(im,M['heads'][f],r['head']);col=clips[r['clip']]['start']+r['pose'];sheet.alpha_composite(im,(col*W,row*W));frames[f,r['clip'],r['pose']]=im;meta['facings'][f]['frames'].append({'clip':r['clip'],'index':r['pose'],'rect':[col*W,row*W,W,W],'guideRecord':gi,'contacts':r['contacts'],'headAnchor':pt(r['head'])})
sheet.save(O/'sheet.png');(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');(O/'masters.json').write_text(json.dumps(M,indent=2)+'\n',encoding='utf-8')
BG=(135,157,135,255);contact=Image.new('RGBA',(15*W,4*W+16),BG);contact.alpha_composite(sheet,(0,16));ImageDraw.Draw(contact).text((3,2),'Wood ant | idle1 tripod-crawl8 antenna6 | down/up/left/right',fill='white');contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*4,contact.height*4),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 strip=Image.new('RGBA',(8*W,2*W+32),BG);d=ImageDraw.Draw(strip)
 for row,k in enumerate(['crawl','action']):
  d.text((2,row*(W+16)+2),f'{f} {k}',fill='white')
  for p in range(clips[k]['count']):strip.alpha_composite(frames[f,k,p],(p*W,row*(W+16)+16))
 strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*6,strip.height*6),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
overlay=Image.new('RGBA',(4*W,3*W),BG)
for row,(k,p) in enumerate([('idle',0),('crawl',2),('crawl',6)]):
 for col,f in enumerate(F):
  r=next(v for v in G['records'] if (v['facing'],v['clip'],v['pose'])==(f,k,p));im=frames[f,k,p].copy();d=ImageDraw.Draw(im)
  for l in r['legs'].values():d.line([pt(v) for v in l['screen']],fill=(120,240,130),width=1)
  for n in ['skull','mesosoma','gaster']:
   h=r['meshes'][n]['hull'];d.line([pt(v) for v in h]+[pt(h[0])],fill=(240,80,210),width=1)
  overlay.alpha_composite(im,(col*W,row*W))
overlay.resize((overlay.width*6,overlay.height*6),Image.Resampling.NEAREST).save(O/'guide-overlay.png')
vendor=Image.open(R/'public/assets/tilesets/me-complete.png').convert('RGBA');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA');scene=Image.new('RGBA',(320,208),(121,149,88,255));scene.alpha_composite(vendor.crop((1920,7312,2080,7472)),(160,-88));scene.alpha_composite(vendor.crop((256,96,304,160)),(3,9));scene.alpha_composite(vendor.crop((0,1152,208,1216)),(58,145));scene.save(O/'scene-background.png')
def inscene(k,p):
 im=scene.copy()
 for row,f in enumerate(F):im.alpha_composite(person.crop((0,row*32,32,(row+1)*32)),(39+row*65,28));im.alpha_composite(frames[f,k,p],(42+row*65,83))
 return im
inscene('idle',0).save(O/'scene-native.png');inscene('idle',0).resize((1280,832),Image.Resampling.NEAREST).save(O/'scene-4x.png')
seq=[('idle',0)]*3+[('crawl',p) for _ in range(2) for p in range(8)]+[('action',p) for p in range(6)]+[('idle',0)]*3;native=[];scenes=[]
for k,p in seq:
 im=Image.new('RGBA',(4*W,W),BG)
 for row,f in enumerate(F):im.alpha_composite(frames[f,k,p],(row*W,0))
 native.append(im.convert('RGB'));scenes.append(inscene(k,p).convert('RGB'))
for name,ims in [('preview-native.gif',native),('preview.gif',[i.resize((i.width*6,i.height*6),Image.Resampling.NEAREST) for i in native]),('scene-native.gif',scenes)]:ims[0].save(O/name,save_all=True,append_images=ims[1:],duration=140,loop=0,optimize=False,disposal=2)
assert set(sheet.getchannel('A').get_flattened_data())=={0,255}
for key,im in frames.items():b=im.getbbox();assert b and min(b[:2])>=2 and max(b[2:])<=W-2,(key,b)
assert Image.open(O/'sheet.png').convert('RGBA').tobytes()==sheet.tobytes();durations={}
for name in ['preview-native.gif','preview.gif','scene-native.gif']:
 im=Image.open(O/name);durations[name]=sum(f.info['duration'] for f in ImageSequence.Iterator(im));assert durations[name]==3920
(O/'validation.json').write_text(json.dumps({'status':'integrity pass; visual review separate','frames':60,'binaryAlpha':True,'padding':True,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F},'decodedGifDurationMs':durations,'stylization':M['stylization']},indent=2)+'\n',encoding='utf-8');print('ANT_FINISH_OK',json.loads((O/'validation.json').read_text())['idleVisibleHeights'])
