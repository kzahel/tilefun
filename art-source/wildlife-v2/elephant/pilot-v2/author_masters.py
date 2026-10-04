"""Deliberate integer drawings after opening geometry-02 guide renders.
No render colors/quantization, no downloaded pixels. Editable letter output.
Coordinates are hand chosen on the independently projected 96px grid.
"""
import json
from pathlib import Path
from PIL import Image,ImageDraw
S=Path(__file__).parent
P={'o':'#41494b','s':'#586363','e':'#6d7774','g':'#828b85','h':'#a1aaa0','l':'#bbc2b2','i':'#d9d1b1','k':'#293438'}
def canvas():return Image.new('RGBA',(96,96))
def poly(im,points,color,outline=None):ImageDraw.Draw(im).polygon(points,fill=P[color],outline=P[outline] if outline else None)
def line(im,points,color,width=1):ImageDraw.Draw(im).line(points,fill=P[color],width=width)
def drawbody(f):
    im=canvas()
    if f=='left':
        poly(im,[(29,42),(32,38),(38,35),(45,34),(55,33),(64,35),(69,38),(71,43),(71,52),(69,57),(63,60),(43,60),(35,58),(30,54)],'g','o')
        poly(im,[(31,45),(34,40),(42,37),(57,36),(65,38),(69,43),(66,43),(60,41),(44,40),(36,43)],'h')
        poly(im,[(39,37),(46,35),(56,35),(63,37),(62,38),(45,38)],'l')
        poly(im,[(31,52),(39,54),(54,55),(65,53),(70,48),(70,54),(67,58),(61,59),(42,59),(35,57)],'e')
        poly(im,[(62,41),(68,42),(70,47),(70,52),(66,54),(64,49)],'e')
        line(im,[(33,46),(34,51)],'e')
    else:
        pts=[(43,28),(52,28),(56,32),(59,39),(60,47),(60,56),(58,63),(54,67),(48,69),(41,66),(37,61),(36,52),(36,43),(38,35)]
        if f=='down':pts=[(43,28),(52,28),(56,32),(59,39),(60,47),(59,57),(55,63),(48,66),(41,63),(37,57),(36,48),(37,39),(39,32)]
        poly(im,pts,'g','o')
        poly(im,[(43,30),(51,30),(54,34),(56,42),(55,50),(52,56),(45,57),(41,52),(40,44),(41,35)],'h')
        poly(im,[(44,31),(50,31),(52,35),(53,41),(51,44),(45,44),(43,40)],'l')
        poly(im,[(37,43),(39,51),(43,58),(50,61),(56,57),(59,50),(58,60),(54,65),(48,68),(41,65),(38,60),(37,53)],'e')
        if f=='up':line(im,[(43,64),(48,66),(53,64)],'s')
    return im
def drawhead(f):
    im=canvas()
    if f=='left':
        # Distant fan is foreshortened and higher on the projected ground plane.
        poly(im,[(26,39),(26,34),(28,30),(32,29),(35,32),(35,37),(33,43),(30,47)],'s','o')
        line(im,[(28,34),(29,31),(32,31),(33,33)],'e')
        poly(im,[(23,38),(28,37),(32,39),(34,44),(34,51),(31,55),(26,56),(21,54),(18,50),(18,44),(20,40)],'g','o')
        poly(im,[(22,40),(27,39),(30,40),(31,43),(29,46),(23,46),(20,44)],'h')
        poly(im,[(23,40),(27,40),(28,42),(24,43),(21,43)],'l')
        poly(im,[(19,48),(23,49),(28,49),(30,52),(28,55),(23,55),(19,52)],'e')
        # Near African ear overlaps jaw, shoulder and front leg, not a flat fin.
        poly(im,[(31,44),(35,46),(39,50),(42,56),(42,60),(39,63),(35,62),(32,59),(30,54),(29,48)],'e','o')
        poly(im,[(32,46),(35,48),(38,51),(40,56),(40,59),(38,61),(35,59),(32,55),(31,50)],'g')
        line(im,[(32,46),(35,48),(38,52)],'h')
        line(im,[(21,49),(23,49)],'s');line(im,[(21,50),(22,50)],'k')
        # Two short tusks sit on different depths; neither grows with animation.
        line(im,[(20,49),(16,50),(14,49)],'o',2);line(im,[(19,49),(16,49),(14,48)],'i')
        line(im,[(22,54),(19,56),(16,56)],'o',3);line(im,[(22,53),(19,55),(16,55)],'i',2)
    elif f=='down':
        poly(im,[(42,49),(39,46),(34,46),(30,48),(28,52),(29,57),(32,60),(36,62),(41,61),(44,56)],'e','o')
        poly(im,[(54,49),(57,46),(62,46),(66,48),(68,52),(67,57),(64,60),(60,62),(55,61),(52,56)],'e','o')
        poly(im,[(39,48),(34,48),(30,51),(31,55),(34,58),(38,59),(42,55)],'g')
        poly(im,[(57,48),(62,48),(66,51),(65,55),(62,58),(58,59),(54,55)],'g')
        line(im,[(31,51),(34,49),(38,49)],'h');line(im,[(58,49),(62,49),(65,51)],'h')
        poly(im,[(44,49),(51,49),(54,52),(56,57),(55,64),(52,68),(44,68),(41,64),(40,57),(42,52)],'g','o')
        poly(im,[(44,51),(50,51),(53,54),(53,58),(50,61),(45,61),(42,57)],'h')
        poly(im,[(45,52),(49,52),(51,54),(50,56),(46,56),(44,54)],'l')
        poly(im,[(42,62),(46,64),(50,64),(54,62),(53,67),(49,69),(45,68)],'e')
        line(im,[(42,61),(43,61)],'s');line(im,[(53,61),(54,61)],'s')
        ImageDraw.Draw(im).point((42,62),fill=P['k']);ImageDraw.Draw(im).point((54,62),fill=P['k'])
        line(im,[(43,65),(43,69),(42,70)],'o',3);line(im,[(43,65),(43,69),(42,69)],'i')
        line(im,[(53,65),(53,69),(54,70)],'o',3);line(im,[(53,65),(53,69),(54,69)],'i')
    else:
        # Rear cap has no eyes, muzzle, tusks or frontal trunk details.
        poly(im,[(42,28),(38,26),(34,28),(30,32),(28,37),(29,41),(33,44),(38,43),(42,37)],'e','o')
        poly(im,[(54,28),(58,26),(62,28),(66,32),(68,37),(67,41),(63,44),(58,43),(54,37)],'e','o')
        poly(im,[(32,33),(36,29),(39,29),(39,35),(36,40),(31,41)],'g')
        poly(im,[(64,33),(60,29),(57,29),(57,35),(60,40),(65,41)],'g')
        poly(im,[(44,21),(51,21),(54,24),(56,30),(54,36),(49,39),(44,37),(40,33),(40,27),(42,23)],'g','o')
        poly(im,[(44,23),(50,23),(53,26),(53,30),(50,33),(45,32),(42,29)],'h')
        line(im,[(44,24),(47,23),(50,24)],'l',2)
    return im
def letters(im):
    box=im.getbbox();im=im.crop(box);reverse={tuple(bytes.fromhex(v[1:]))+(255,):k for k,v in P.items()}
    return {'offset':[box[0]-48,box[1]-72],'pixels':[''.join(reverse.get(im.getpixel((x,y)),'.') for x in range(im.width)) for y in range(im.height)]}
M={'identity':'elephant-pilot-v2-drawing-01','palette':P,'canvas':[112,112],
   'stylization':'Hand-authored stepped contours and broad light bands fitted after independently projected geometry-02 renders. Full head/ear/tusk masters remain identical through walk and trunk action. Side baked shading mirrors intentionally; trunk and legs are integer ribbons from rigid joint guides.',
   'bodies':{},'heads':{},'foot':{'pixels':['..eeee..','.egggge.','egghggge','egggggge','osissiso','.oooooo.'],'offset':[-4,-2]}}
M['rearHeel']={'pixels': ['..eeee..', '.egggge.', 'egghggge', 'egggggge', 'oseeeeso', '.oooooo.'], 'offset': [-4, -2]}
M['rearHeelStylization']='Up-facing heel uses continuous gray pad shading, with no ivory toe marks; silhouette, anchor and all other masters unchanged.'
for f in ['down','up','left']:
    M['bodies'][f]=letters(drawbody(f));M['heads'][f]=letters(drawhead(f))
for group,fun in [('bodies',drawbody),('heads',drawhead)]:
    # Exact symmetrical side yaws of the contract allow reflected geometry,
    # but do not imply a resized drawing or changed lighting simulation.
    reflected=fun('left').transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    # Camera's origin is x48; Pillow reflects around47.5: shift one px right.
    fixed=canvas();fixed.alpha_composite(reflected,(1,0));M[group]['right']=letters(fixed)
(S/'masters.json').write_text(json.dumps(M,indent=2)+'\n')
print('MASTERS_AUTHORED',M['identity'])
