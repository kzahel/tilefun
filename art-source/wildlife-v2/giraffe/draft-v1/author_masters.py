"""Deliberate integer contours and patch clusters, transcribed to palette letters.
Coordinates authored after opening independent giraffe volume renders. No guide
colors, silhouette quantization, resampling, or other animal masters are used.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import json
S=Path(__file__).parent
P={'o':'#59422f','s':'#86603b','t':'#c49a5c','h':'#dfb97b','c':'#ead2a0','p':'#976033','q':'#b87b3e','k':'#302d26','w':'#f7e7c3'}
def studio():
 im=Image.new('RGBA',(144,144));return im,ImageDraw.Draw(im)
def poly(d,ps,color):d.polygon(ps,fill=P[color])
def outline(d,ps):d.line(ps+[ps[0]],fill=P['o'],width=1)
def part(im):
 b=im.getbbox();im=im.crop(b);lookup={tuple(bytes.fromhex(v[1:]))+(255,):k for k,v in P.items()}
 return {'offset':[b[0]-72,b[1]-120],'pixels':[''.join(lookup.get(im.getpixel((x,y)),'.') for x in range(im.width)) for y in range(im.height)]}
bodies={};heads={};ears={}
im,d=studio()
ps=[(46,58),(51,57),(58,70),(66,82),(76,82),(86,84),(90,87),(90,92),(87,96),(83,98),(65,97),(60,93),(56,82),(51,69),(47,63)]
poly(d,ps,'t');poly(d,[(46,58),(49,59),(58,82),(61,93),(66,96),(84,97),(87,93),(64,92),(59,82),(53,68)],'s')
poly(d,[(48,58),(51,58),(62,82),(76,83),(86,85),(88,87),(67,86),(59,82),(55,73)],'h')
poly(d,[(51,60),(54,68),(61,83),(65,86),(84,87),(85,90),(64,90),(59,83),(54,71)],'c')
# Broad polygon patches, cream channels; seven neck/withers patches, five torso patches.
for ps2,col in [([(49,62),(51,62),(53,66),(52,69),(50,67)],'p'), ([(53,71),(55,71),(57,76),(55,79),(53,75)],'q'), ([(57,81),(60,82),(62,87),(59,89),(57,85)],'p'),
 ([(64,84),(68,84),(69,87),(66,89),(63,87)],'q'), ([(71,84),(76,84),(77,88),(73,89),(70,87)],'q'),
 ([(80,85),(84,86),(87,88),(85,91),(81,90),(79,88)],'p'), ([(65,91),(69,90),(71,93),(68,95),(65,94)],'p'),
 ([(73,91),(77,90),(79,93),(76,96),(72,95)],'p'), ([(82,93),(86,92),(87,94),(84,96),(81,96)],'q')]:poly(d,ps2,col)
# Posterior mane stays on back edge of neck; irregular one-pixel step rhythm is authored.
d.line([(51,59),(54,68),(57,75),(60,82),(64,85)],fill=P['o'],width=2);outline(d,ps)
bodies['left']=part(im)
imr=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT);bodies['right']=part(imr)
for f in ['down','up']:
 im,d=studio()
 if f=='down':
  ps=[(68,69),(76,69),(78,72),(79,79),(78,87),(75,92),(70,93),(66,89),(65,82),(65,76),(66,72)]
  poly(d,ps,'t');poly(d,[(67,70),(73,69),(76,72),(77,82),(74,88),(68,87),(66,81)],'h')
  poly(d,[(68,72),(73,71),(75,74),(75,82),(72,87),(68,84)],'c')
  poly(d,[(76,73),(78,76),(78,87),(74,92),(70,92),(70,90),(75,84)],'s');outline(d,ps)
  # Neck lies in front of torso but head covers its upper portion.
  psn=[(69,71),(75,71),(77,79),(76,88),(72,91),(68,88),(67,79)]
  poly(d,psn,'t');poly(d,[(69,71),(72,72),(72,88),(69,87),(68,79)],'h')
  for p in [[(70,75),(73,74),(74,77),(72,79),(70,78)],[(69,81),(72,80),(74,83),(72,85),(69,84)],[(72,86),(75,85),(74,88),(72,89)]]:poly(d,p,'p')
  outline(d,psn)
 else:
  ps=[(69,41),(75,41),(75,49),(76,57),(77,66),(78,72),(79,79),(79,88),(77,94),(74,98),(70,98),(67,95),(65,89),(65,80),(66,74),(67,67),(68,57)]
  poly(d,ps,'t');poly(d,[(69,42),(72,43),(71,69),(70,77),(72,93),(69,96),(66,88),(67,76),(68,61)],'h')
  poly(d,[(74,43),(75,54),(76,64),(77,73),(79,81),(78,90),(75,97),(72,98),(73,88),(74,78),(73,66)],'s')
  poly(d,[(68,78),(71,75),(75,77),(76,84),(73,93),(70,91),(68,86)],'c')
  for p in [[(69,47),(71,46),(72,49),(70,52),(69,51)],[(72,54),(74,53),(75,57),(73,59),(72,57)],[(69,60),(71,59),(72,63),(70,66),(68,64)],[(72,68),(75,67),(76,72),(74,74),(71,72)],[(67,77),(69,74),(72,76),(71,80),(68,81)],[(73,78),(76,77),(77,82),(75,84),(72,82)],[(68,84),(71,83),(73,87),(71,90),(68,88)],[(74,88),(77,87),(76,92),(73,94),(72,91)]]:poly(d,p,'p')
  d.line([(73,42),(73,50),(72,59),(73,67),(73,74)],fill=P['o'],width=1);outline(d,ps)
 # Lower withers/torso redraw: screen height follows new independent anatomy.
 # Move torso pixels by eight; extend neck with newly spaced authored patches.
 if f=='down':
  im,d=studio()
  ps=[(68,77),(76,77),(78,80),(79,87),(78,95),(75,100),(70,101),(66,97),(65,90),(65,84),(66,80)]
  poly(d,ps,'t');poly(d,[(67,78),(73,77),(76,80),(77,90),(74,96),(68,95),(66,89)],'h')
  poly(d,[(76,81),(78,84),(78,95),(74,100),(70,100),(70,98),(75,92)],'s');outline(d,ps)
  psn=[(69,71),(75,71),(77,84),(76,96),(72,99),(68,96),(67,84)]
  poly(d,psn,'t');poly(d,[(69,71),(72,72),(72,96),(69,95),(68,84)],'h')
  for p in [[(70,77),(73,76),(74,80),(72,83),(70,81)],[(69,85),(72,84),(74,87),(72,90),(69,88)],[(72,93),(75,92),(74,96),(72,97)]]:poly(d,p,'p')
  outline(d,psn)
 else:
  im,d=studio()
  ps=[(69,41),(75,41),(75,53),(76,64),(77,74),(78,80),(79,87),(79,96),(77,102),(74,106),(70,106),(67,103),(65,97),(65,88),(66,82),(67,75),(68,63)]
  poly(d,ps,'t');poly(d,[(69,42),(72,43),(71,77),(70,85),(72,101),(69,104),(66,96),(67,84),(68,65)],'h')
  poly(d,[(74,43),(75,60),(76,72),(77,81),(79,89),(78,98),(75,105),(72,106),(73,96),(74,86),(73,73)],'s')
  poly(d,[(68,86),(71,83),(75,85),(76,92),(73,101),(70,99),(68,94)],'c')
  for p in [[(69,47),(71,46),(72,51),(70,54),(69,52)],[(72,57),(74,56),(75,61),(73,64),(72,61)],[(69,67),(71,65),(72,70),(70,74),(68,71)],[(72,76),(75,75),(76,80),(74,82),(71,80)],[(67,85),(69,82),(72,84),(71,88),(68,89)],[(73,86),(76,85),(77,90),(75,92),(72,90)],[(68,92),(71,91),(73,95),(71,98),(68,96)],[(74,96),(77,95),(76,100),(73,102),(72,99)]]:poly(d,p,'p')
  d.line([(73,42),(73,54),(72,65),(73,76),(73,82)],fill=P['o']);outline(d,ps)
 bodies[f]=part(im)
# Skull, cheek, muzzle and ossicone masters preserve every pixel in all poses.
im,d=studio();ps=[(46,54),(51,54),(54,57),(53,61),(49,63),(46,63),(43,64),(38,63),(37,61),(38,59),(42,58),(44,55)]
poly(d,ps,'t');poly(d,[(46,55),(50,55),(52,57),(49,58),(44,60),(40,60),(39,59),(43,58)],'h')
poly(d,[(38,60),(43,60),(46,61),(45,63),(39,63),(37,61)],'c');poly(d,[(48,61),(51,60),(52,59),(53,61),(49,63),(46,63)],'s')
outline(d,ps);d.line([(38,63),(42,63)],fill=P['o']);d.point((38,60),fill=P['k'])
d.rectangle((45,57,46,58),fill=P['k']);d.point((45,57),fill=P['w']);d.point((47,56),fill=P['p'])
# Two ossicones at different depths, not a duplicated vertical line.
d.line([(49,55),(49,51)],fill=P['t'],width=2);d.line([(50,58),(51,53)],fill=P['s'],width=2)
d.rectangle((48,50,50,51),fill=P['o']);d.rectangle((50,52,52,53),fill=P['o'])
heads['left']=part(im);heads['right']=part(im.transpose(Image.Transpose.FLIP_LEFT_RIGHT))
for f in ['down','up']:
 im,d=studio()
 if f=='down':
  ps=[(70,67),(74,67),(76,70),(76,74),(75,79),(73,80),(70,79),(68,76),(68,71)]
  poly(d,ps,'t');poly(d,[(70,68),(73,68),(74,70),(73,74),(70,74),(69,72)],'h')
  poly(d,[(69,75),(71,74),(74,75),(75,77),(74,79),(70,78)],'c');outline(d,ps)
  d.rectangle((69,71,70,72),fill=P['k']);d.rectangle((74,71,75,72),fill=P['k']);d.point((69,71),fill=P['w']);d.point((74,71),fill=P['w'])
  d.point((70,77),fill=P['s']);d.point((74,77),fill=P['s']);d.line([(71,79),(73,79)],fill=P['o'])
  d.line([(70,68),(70,64)],fill=P['t'],width=2);d.line([(74,68),(74,64)],fill=P['t'],width=2)
  d.rectangle((69,63,71,64),fill=P['o']);d.rectangle((73,63,75,64),fill=P['o'])
 else:
  ps=[(70,35),(74,35),(76,38),(76,42),(74,45),(70,45),(68,42),(68,38)]
  poly(d,ps,'t');poly(d,[(70,36),(73,36),(74,38),(73,41),(70,41),(69,39)],'h')
  poly(d,[(73,40),(75,39),(75,42),(73,44),(70,44),(69,42)],'s');outline(d,ps)
  poly(d,[(71,38),(73,37),(74,39),(72,40),(71,39)],'q')
  d.line([(70,37),(70,34)],fill=P['t'],width=2);d.line([(74,37),(74,34)],fill=P['t'],width=2)
  d.rectangle((69,34,71,35),fill=P['o']);d.rectangle((73,34,75,35),fill=P['o'])
 heads[f]=part(im)
# Ears are separately authored fixed templates placed at their projected root.
earpatterns={'down':['..oo....','otthho..','.othhho.','..ossooo','....oo..'], 'up':['...oo...','.ohhtto.','ohhttso.','.ooosoo.','....o...'], 'near':['.oo.','ott.','oth.','oth.','osso','.oo.'], 'far':['.oo','ott','ots','.oo']}
M={'identity':'giraffe-draft-v1-drawing-02','palette':P,'canvas':[144,144],'bodies':bodies,'heads':heads,'ears':earpatterns,
 'stylization':'Authored screen contours fitted to independent volumes. Profile top/neck cream channels, broad fixed polygon patches, separate ear depths, stepped muzzle and hoof clusters. Body/head are fixed full palette-letter masters; joint ribbons follow saved guide contacts. Right contour/shading deliberately mirrors left.'}
(S/'masters.json').write_text(json.dumps(M,indent=2)+'\n')
print('GIRAFFE_MASTERS_AUTHORED')
