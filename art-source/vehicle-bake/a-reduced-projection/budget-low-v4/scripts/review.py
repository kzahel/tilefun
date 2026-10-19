"""Review sheets/GIF from actual engine pixels and numerical source comparisons."""
from pathlib import Path
from PIL import Image,ImageDraw
import sys,json,shutil
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir())
REV=sys.argv[1];O=ROOT/'public/demos/vehicle-bake/a-reduced-projection'/REV;A=ROOT/'art-source/vehicle-bake/a-reduced-projection'/REV
assert not (O/'report.json').exists() or json.loads((O/'report.json').read_text()).get('status')!='complete','Finished revision is immutable'
BG=(31,34,45);FG=(235,235,240)
def tile(im,scale=4,crop=True):
 if crop:im=im.crop((16,48,112,128))
 im=im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST);out=Image.new('RGB',im.size,BG);out.paste(im,(0,0),im);return out
def sheet(names,path,cols=4,crop=True):
 height=348 if crop else 412
 out=Image.new('RGB',(cols*384,((len(names)+cols-1)//cols)*height),BG);d=ImageDraw.Draw(out)
 for j,(label,p) in enumerate(names):
  x=j%cols*384;y=j//cols*height;d.text((x+8,y+7),label,fill=FG);out.paste(tile(Image.open(p).convert('RGBA'),4 if crop else 3,crop),(x,y+28))
 out.save(path)
sheet([(f'MESH {i*45} deg',O/f'view-{i}.png') for i in range(8)],O/'inspection-mesh.png')
for mode in ('study','engine'):
 sheet([(f'{mode} {i*22.5} deg',O/f'engine/{mode}-{i:02d}.png') for i in range(16)],O/f'inspection-{mode}.png',crop=mode!='engine')
sheet([(f'roll {i*45} deg',O/f'engine/roll-{i}.png') for i in range(8)],O/'inspection-roll.png')
frames=[tile(Image.open(O/f'engine/study-{i:02d}.png').convert('RGBA'),4,False) for i in range(16)]
frames[0].save(O/'engine/turntable.gif',save_all=True,append_images=frames[1:],duration=120,loop=0,disposal=2,optimize=False)
rows=[]
for i in range(8):
 target=Image.open(A/f'evidence/inputs/target-{i}.png').convert('RGBA');low=Image.open(O/f'view-{i}.png').convert('RGBA');eng=Image.open(O/f'engine/study-{i*2:02d}.png').convert('RGBA')
 ta={k for k,p in enumerate(target.get_flattened_data()) if p[3]>127};la={k for k,p in enumerate(low.get_flattened_data()) if p[3]>127};ea={k for k,p in enumerate(eng.get_flattened_data()) if p[3]>127}
 rows.append({'yaw':i*45,'sourceLowIoU':len(ta&la)/len(ta|la),'sourceEngineIoU':len(ta&ea)/len(ta|ea),'blenderAlphaBounds':low.getbbox(),'engineAlphaBounds':eng.getbbox()})
(A/'evidence/comparison-metrics.json').write_text(json.dumps(rows,indent=2)+'\n')
print(REV,rows)
