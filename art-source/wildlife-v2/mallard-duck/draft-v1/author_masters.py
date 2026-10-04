"""Deliberate palette-letter drake masters; independent guides inform contours."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
S=Path(__file__).parent
P={'o':'#3c493b','g':'#28744f','h':'#4d9562','v':'#164d3d','k':'#202925','b':'#7a4939','c':'#a76946','s':'#717c73','t':'#939d8e','l':'#bbc4ae','w':'#e2debe','y':'#d3b456','a':'#c67635','u':'#55729a'}
def draw():im=Image.new('RGBA',(48,48));return im,ImageDraw.Draw(im)
def poly(d,ps,c):d.polygon(ps,fill=P[c])
def outline(d,ps):d.line(ps+[ps[0]],fill=P['o'])
def part(im):
 b=im.getbbox();im=im.crop(b);lookup={tuple(bytes.fromhex(v[1:]))+(255,):k for k,v in P.items()}
 return {'offset':[b[0]-24,b[1]-34],'pixels':[''.join(lookup.get(im.getpixel((x,y)),'.') for x in range(im.width)) for y in range(im.height)]}
bodies={}
im,d=draw();ps=[(20,27),(23,26),(28,26),(31,28),(32,30),(30,32),(24,33),(20,33),(18,31),(18,29)]
poly(d,ps,'t');poly(d,[(22,27),(28,27),(30,28),(29,29),(24,29),(22,30)],'l')
poly(d,[(23,31),(30,30),(30,32),(24,33),(21,33)],'s');poly(d,[(18,28),(21,28),(22,31),(21,33),(19,32),(18,30)],'b')
d.line([(19,28),(20,29)],fill=P['c']);outline(d,ps)
# Folded wing: grey mantle, restrained blue speculum and one cream border.
poly(d,[(23,28),(28,28),(30,30),(27,31),(23,31),(22,30)],'s');d.line([(24,28),(28,28)],fill=P['l'])
d.line([(26,30),(29,30)],fill=P['u']);d.line([(26,31),(28,31)],fill=P['w'])
d.line([(18,28),(19,28)],fill=P['w']);d.line([(18,27),(19,27)],fill=P['g'])
bodies['left']=part(im);bodies['right']=part(im.transpose(Image.Transpose.FLIP_LEFT_RIGHT))
for f in ['down','up']:
 im,d=draw()
 if f=='down':
  ps=[(23,24),(25,24),(27,26),(27,30),(26,33),(22,33),(21,30),(21,27)]
  poly(d,ps,'t');poly(d,[(23,25),(25,25),(26,27),(25,29),(22,29),(22,27)],'l')
  poly(d,[(22,30),(26,30),(26,33),(22,33)],'b');outline(d,ps)
  d.line([(21,28),(21,30)],fill=P['u']);d.line([(27,28),(27,30)],fill=P['u']);d.point((21,31),fill=P['w']);d.point((27,31),fill=P['w'])
 else:
  ps=[(23,25),(25,25),(27,28),(27,32),(26,35),(22,35),(21,32),(21,28)]
  poly(d,ps,'t');poly(d,[(23,26),(25,26),(26,29),(25,32),(23,32),(22,29)],'l')
  poly(d,[(26,28),(27,29),(27,33),(25,35),(22,35),(22,33),(25,33)],'s');outline(d,ps)
  d.line([(22,25),(26,25)],fill=P['w']);d.line([(21,30),(21,32)],fill=P['u']);d.line([(27,30),(27,32)],fill=P['u']);d.point((21,33),fill=P['w']);d.point((27,33),fill=P['w'])
 bodies[f]=part(im)
heads={
 'left':{'offset':[-3,-2],'pixels':['.oggo.','oghhgo','ogkggo','ovgggo','.ovvo.']},
 'right':{'offset':[-2,-2],'pixels':['.oggo.','ogh hgo'.replace(' ',''),'oggkgo','ogggvo','.ovvo.']},
 'down':{'offset':[-3,-2],'pixels':['.oggo.','ogh hgo'.replace(' ',''),'okggko','ovggvo','.ovvo.']},
 'up':{'offset':[-3,-2],'pixels':['.oggo.','oghhgo','oghggo','ovggvo','.ovvo.']}
}
M={'identity':'mallard-duck-draft-v1-drawing-02','palette':P,'canvas':[48,48],'bodies':bodies,'heads':heads,
 'stylization':'Deliberate six-pixel green heads with stable eyes/cap, chestnut breast, gray mantle and cream collar; broad speculum bars. Profile shading mirrors intentionally. Final web/wing/feather contours use integer hull/joint guides with authored palette clusters, not render sampling. Rear eyes/bill hidden deliberately.'}
(S/'masters.json').write_text(json.dumps(M,indent=2)+'\n');print('MALLARD_MASTERS_AUTHORED')
