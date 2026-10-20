"""Append finite shrub/root stocks; never change existing material pixels."""
from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json
R=Path(__file__).resolve().parents[2];S=R/'art-source/wildlife-v2/foraging-resources/behavior-v5';O=R/'public/demos/wildlife-v2/foraging-resources/behavior-v5'
assert not (S/'receipt.json').exists(),'Immutable registered bank'
I=json.loads((S/'inputs.json').read_text(encoding='utf8'))
for p,h in I['sha256'].items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
base=Image.open(R/I['sheet']).convert('RGBA');sheet=Image.new('RGBA',(52*32,128));sheet.alpha_composite(base)
for i,ops in enumerate(json.loads((S/'paint.json').read_text(encoding='utf8'))['frames'],39):
 tile=Image.new('RGBA',(32,32));d=ImageDraw.Draw(tile)
 for shape,points,color,width in ops:
  if shape=='line':d.line(points,fill=color,width=width)
  else:getattr(d,shape)(points,fill=color)
 for row in range(4):sheet.alpha_composite(tile,(i*32,row*32))
O.mkdir(parents=True,exist_ok=True);assert sheet.crop((0,0,base.width,base.height)).tobytes()==base.tobytes();sheet.save(O/'sheet.png');sheet.crop((1248,0,1664,128)).save(O/'contact-sheet-native.png')
scene=Image.new('RGBA',(416,64),'#77947d');scene.alpha_composite(sheet.crop((1248,0,1664,32)),(0,16));scene.save(O/'scene-native.png');scene.save(O/'preview.png')
(O/'sprite.json').write_text(json.dumps(dict(identity='foraging-resources-behavior-v5',frameWidth=32,frameHeight=32,anchor=[16,16],sheetSha256=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest()),indent=2)+'\n',encoding='utf8',newline='\n')
(O/'pixel-audit.json').write_text(json.dumps(dict(binaryAlpha=set(sheet.getchannel('A').get_flattened_data())<={0,255},priorThirtyNineCellsUnchanged=True,sourceStages=13),indent=2)+'\n',encoding='utf8',newline='\n')
(O/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Scratching and nectar supplies</title><h1>Finite soil and flower stocks</h1><p>Empty through three portions; pollen-marked blooms and nectar. Pending human review.</p><img alt="Soil and flower stock stages" style="image-rendering:pixelated;width:864px" src="scene-native.png">',encoding='utf8',newline='\n')
print('GARDEN_RESOURCES_OK')
