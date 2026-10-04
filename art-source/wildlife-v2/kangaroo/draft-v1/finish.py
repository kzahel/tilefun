"""Authored kangaroo integer pixel composition from independent volume guides."""
from pathlib import Path
import json,math,hashlib
from PIL import Image,ImageDraw,ImageSequence,ImageFilter,ImageChops
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/kangaroo/draft-v1'
G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};F=list(G['cameraContract']['modelYawDegrees']);W=96;clips=[('idle',0,1),('hop',1,10),('action',11,8)]
def snap(v):return int(math.floor(v+.5))
def xy(p):return tuple(snap(v) for v in p[:2])
def pattern(p):
 im=Image.new('RGBA',(len(p['pixels'][0]),len(p['pixels'])))
 for y,row in enumerate(p['pixels']):
  for x,ch in enumerate(row):
   if ch!='.':im.putpixel((x,y),P[ch])
 return im
parts={g:{f:pattern(M[g][f]) for f in F} for g in ['heads','bodies','hands']};idle={f:next(r for r in G['records'] if r['facing']==f and r['clip']=='idle') for f in F};hd={f:xy([idle[f]['head'][j]-idle[f]['body'][j] for j in [0,1]]) for f in F}
def anchors(r):b=xy(r['body']);d=hd[r['facing']];return b,(b[0]+d[0],b[1]+d[1])
def paste(im,g,f,a):off=M[g][f]['offset'];im.alpha_composite(parts[g][f],(a[0]+off[0],a[1]+off[1]))
def polygon(im,v,color,outline=True):
 ps=[xy(p) for p in v['hull']];d=ImageDraw.Draw(im);d.polygon(ps,fill=P[color])
 if outline:d.line(ps+[ps[0]],fill=P['o'])
def ribbon(im,points,radii,near):
 normals=[]
 for j,p in enumerate(points):
  a,b=points[max(0,j-1)],points[min(len(points)-1,j+1)];dx,dy=b[0]-a[0],b[1]-a[1];L=math.hypot(dx,dy) or 1;normals.append((-dy/L*radii[j],dx/L*radii[j]))
 ps=[(snap(p[0]+n[0]),snap(p[1]+n[1])) for p,n in zip(points,normals)]+[(snap(p[0]-n[0]),snap(p[1]-n[1])) for p,n in reversed(list(zip(points,normals)))];d=ImageDraw.Draw(im);d.polygon(ps,fill=P['b'] if near else P['s']);d.line(ps+[ps[0]],fill=P['o'])
 if near:d.line([(p[0]-1,p[1]) for p in points],fill=P['h'])
def tail(im,r):
 layer=Image.new('RGBA',(W,W))
 for n,v in sorted(r['volumes'].items(),key=lambda e:e[1]['depthRange'][0],reverse=True):
  if n.startswith('tail-'):polygon(layer,v,'b',False)
 mask=layer.getchannel('A');edge=ImageChops.subtract(mask,mask.filter(ImageFilter.MinFilter(3)));layer.paste(P['o'],(0,0,W,W),edge)
 # Connect the tiny distal hulls along their independently projected joint chain.
 # Integer hull rounding may otherwise leave a one-pixel gap between real joints.
 ps=[xy(p) for p in r['tailScreen']];d=ImageDraw.Draw(layer);d.line(ps,fill=P['b']);d.line(ps[:-1],fill=P['h']);im.alpha_composite(layer)
def limb(im,n,c,r,near):
 hind=n.startswith('hind');ps=[xy(c['screen'][k]) for k in ['hip','joint','distal']];ribbon(im,ps,[2.1,1.6,1.0] if hind else [1.0,.8,.7],near)
 if hind:
  polygon(im,r['volumes']['muscular-thigh-'+n],'h' if near else 's');d=ImageDraw.Draw(im);d.line([ps[0],ps[1]],fill=P['b'])
  for name,v in sorted(r['volumes'].items(),key=lambda e:e[1]['depthRange'][0],reverse=True):
   if n in name and name.startswith(('heel','long-metatarsus','toe','claw')):
    if name.startswith('claw') and r['facing']=='up':continue
    polygon(im,v,'n' if name.startswith('claw') else 'b' if near else 's',name.startswith(('heel','long-metatarsus')))
  d.line([ps[-1],xy(r['volumes']['toe-'+n+'-4']['hull'][0])],fill=P['h'] if near else P['s'])
 else:paste(im,'hands',r['facing'],ps[-1])
def ears(im,r):
 for n,v in sorted(r['volumes'].items(),key=lambda e:e[1]['depthRange'][0],reverse=True):
  if n.startswith('ear-shell'):polygon(im,v,'h')
  if n.startswith('ear-inner') and r['facing']!='up':polygon(im,v,'i',False)
def compose(r):
 im=Image.new('RGBA',(W,W));f=r['facing'];b,h=anchors(r);tail(im,r)
 ordered=sorted(r['contacts'].items(),key=lambda e:e[1]['screen']['hip'][2],reverse=True)
 for j,(n,c) in enumerate(ordered):limb(im,n,c,r,j>=2)
 paste(im,'bodies',f,b);ears(im,r);paste(im,'heads',f,h)
 # The tucked near forearm lies on the pale chest, with a connected shoulder.
 if f!='up':
  near=max(((n,c) for n,c in ordered if n.startswith('fore')),key=lambda e:-e[1]['screen']['hip'][2]);limb(im,*near,r,True)
 return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']};sheet=Image.new('RGBA',(W*19,W*4))
J={'identity':M['identity'],'reviewStatus':'pending','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'fps':6.25,'rootMotion':False,'cameraContract':G['cameraContract'],'orthoScale':G['orthoScale'],'shiftY':G['shiftY'],'previewTravelWorldPerCycle':1.50,'clips':{},'facings':{}}
for c,start,count in clips:J['clips'][c]={'start':start,'count':count,'durationMs':count*160,'description':{'idle':'Male red kangaroo alert stance','hop':'Synchronous hind push2, flight3-8, landing9; long feet and fixed-length balancing tail','action':'Independent ear swivel/listening, rigid skull and quiet tail'}[c]}
for row,f in enumerate(F):
 J['facings'][f]={'row':row,'frames':[]}
 for c,start,count in clips:
  for i in range(count):
   im=frames[f,c,i];sheet.alpha_composite(im,((start+i)*W,row*W));r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,c,i));b,h=anchors(r);J['facings'][f]['frames'].append({'clip':c,'index':i,'rect':[(start+i)*W,row*W,W,W],'visibleBounds':list(im.getbbox()),'bodyAnchor':b,'headAnchor':h,'contacts':r['contacts']})
sheet.save(O/'sheet.png');J['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest();(O/'sprite.json').write_text(json.dumps(J,indent=2)+'\n',encoding='utf-8');(O/'masters.json').write_bytes((S/'masters.json').read_bytes())
contact=Image.new('RGBA',(W*19,W*4+20),'#879b82');contact.alpha_composite(sheet,(0,20));ImageDraw.Draw(contact).text((4,4),'Red kangaroo | idle | synchronous hop0-9 | ear listening0-7 | down/up/left/right',fill='white');contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*2,contact.height*2),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 im=Image.new('RGBA',(W*10,(W+14)*3),'#879b82');d=ImageDraw.Draw(im)
 for row,(c,_,count) in enumerate(clips):
  d.text((2,row*(W+14)+2),f'{f} {c} chronological',fill='white')
  for i in range(count):im.alpha_composite(frames[f,c,i],(i*W,row*(W+14)+14))
 im.save(O/f'strip-{f}-native.png');im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(R/'public/assets/tilesets/me-complete.png').convert('RGBA');bg=Image.new('RGBA',(520,240),'#769458')
for rect,pos in [([1920,7312,160,160],(360,-85)),([256,96,48,64],(4,2)),([0,1152,208,64],(175,168))]:x,y,w,h=rect;bg.alpha_composite(atlas.crop((x,y,x+w,y+h)),pos)
person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scenery(c,i,travel=None):
 im=bg.copy()
 for row,f in enumerate(F):
  x,y=32+row*120,41
  if travel is not None:
   yaw=math.radians(G['cameraContract']['modelYawDegrees'][f]);D=1.5*travel;x+=snap(-10*math.sin(yaw)*D);y+=snap(-10*math.sin(math.radians(40))*math.cos(yaw)*D)
  im.alpha_composite(frames[f,c,i],(x,y));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(4+row*120,80))
 return im
bg.save(O/'scene-background.png');scenery('idle',0).save(O/'scene-native.png');scenery('idle',0).resize((2080,960),Image.Resampling.NEAREST).save(O/'scene-4x.png')
seq=[('idle',0)]*3+[('hop',i) for _ in range(2) for i in range(10)]+[('action',i) for i in range(8)]+[('idle',0)]*3
def gif(ims,p):ims=[im.convert('RGB') for im in ims];ims[0].save(p,save_all=True,append_images=ims[1:],duration=160,loop=0,disposal=2,optimize=False)
native=[]
for c,i in seq:
 im=Image.new('RGBA',(W*4,W),'#879b82')
 for row,f in enumerate(F):im.alpha_composite(frames[f,c,i],(row*W,0))
 native.append(im)
gif(native,O/'preview-native.gif');gif([im.resize((1536,384),Image.Resampling.NEAREST) for im in native],O/'preview.gif');gif([scenery(c,i) for c,i in seq],O/'scene-native.gif');gif([scenery(c,i).resize((2080,960),Image.Resampling.NEAREST) for c,i in seq],O/'scene-4x.gif');gif([scenery('hop',i%10,i/10) for i in range(20)],O/'preview-travel-native.gif')
guides=Image.new('RGBA',(W*10,W*4),'#23343b')
for row,f in enumerate(F):
 for i in range(10):
  r=next(r for r in G['records'] if (r['facing'],r['clip'],r['index'])==(f,'hop',i));im=Image.new('RGBA',(W,W),'#23343b');d=ImageDraw.Draw(im)
  for v in r['volumes'].values():ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#55767a')
  for c in r['contacts'].values():d.line([xy(c['screen'][k]) for k in ['hip','joint','distal']],fill='#e0bc79');d.point(xy(c['screen']['ground']),fill='#ed6659' if c['planted'] else '#809ce8')
  guides.alpha_composite(im,(i*W,row*W))
guides.resize((guides.width*2,guides.height*2),Image.Resampling.NEAREST).save(O/'projected-volume-contact-sheet.png')
over=Image.new('RGBA',(W*4,W*2),'#879b82')
for row,f in enumerate(F):
 im=frames[f,'idle',0].copy();d=ImageDraw.Draw(im)
 for v in idle[f]['volumes'].values():ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#e4a96c')
 over.alpha_composite(frames[f,'idle',0],(row*W,0));over.alpha_composite(im,(row*W,W))
over.resize((1536,768),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
assert set(sheet.getchannel('A').get_flattened_data())=={0,255};assert set(sheet.get_flattened_data())<=set(P.values())|{(0,0,0,0)}
for k,im in frames.items():b=im.getbbox();assert min(b[:2])>=2 and max(b[2:])<=W-2,(k,b)
timings={n:sum(fr.info['duration'] for fr in ImageSequence.Iterator(Image.open(O/n))) for n in ['preview-native.gif','preview.gif','scene-native.gif','scene-4x.gif']};assert set(timings.values())=={5440}
report={'status':'draft-integrity only; visual review separate','frameCount':76,'binaryAlpha':True,'palette':M['palette'],'padding':True,'gifDurationMs':timings,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F},'headDelta':hd,'intentionalStylization':M['stylization'],'travelPreviewLimit':'Separate travel resets at loop; actual source and sheet root fixed.'};(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('KANGAROO_FINISH_OK',report['idleVisibleHeights'])
