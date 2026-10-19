from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys
R=Path(__file__).resolve().parents[3];O=R/'public/demos/vehicle-bake/beetle/v1';E=O/'engine'
quick='--quick' in sys.argv
bg=(30,34,45);font=ImageFont.load_default(size=16)
def sheet(mode,count,scale,name):
 w=128*scale;h=w+28;im=Image.new('RGB',(w*4,h*((count+3)//4)),bg);d=ImageDraw.Draw(im)
 for i in range(count):
  x=i%4*w;y=i//4*h
  p=Image.open(E/f'{mode}-{i}.png').convert('RGBA').resize((w,w),Image.Resampling.NEAREST)
  im.paste(p,(x,y+28),p);d.text((x+8,y+6),f'{mode} {i*(45 if quick or mode=="roll" else 22.5):g} degrees',font=font,fill='white')
 im.save(O/name)
sheet('study',8 if quick else 16,3,'quick-preview.png' if quick else 'inspection-study.png')
if not quick:
 sheet('engine',16,3,'inspection-engine.png');sheet('roll',8,3,'inspection-roll.png')
 for i in range(8):Image.open(E/f'study-{2*i}.png').save(O/f'view-{i}.png')
 # Native views above 3x pixels; no post-render feature editing.
 im=Image.new('RGB',(1536,1072),bg);d=ImageDraw.Draw(im)
 for i in range(8):
  x=(i%4)*384;y=(i//4)*536;p=Image.open(O/f'view-{i}.png').convert('RGBA')
  d.text((x+8,y+6),f'{i*45} degrees / actual GLB native + 3x',font=font,fill='white');im.paste(p,(x+128,y+28),p)
  z=p.resize((384,384),Image.Resampling.NEAREST);im.paste(z,(x,y+152),z)
 im.save(O/'comparison.png')
 frames=[]
 for i in range(16):
  p=Image.open(E/f'study-{i}.png').convert('RGBA');f=Image.new('RGB',(384,384),bg);p=p.resize((384,384),Image.Resampling.NEAREST);f.paste(p,(0,0),p);frames.append(f)
 frames[0].save(O/'turntable.gif',save_all=True,append_images=frames[1:],duration=130,loop=0)
print(O/('quick-preview.png' if quick else 'comparison.png'))
