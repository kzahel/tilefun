"""Append sixteen code-authored resource stages to the immutable material bank."""
from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json
R=Path(__file__).resolve().parents[2];S=R/'art-source/wildlife-v2/foraging-resources/behavior-v3';O=R/'public/demos/wildlife-v2/foraging-resources/behavior-v3';assert not (S/'receipt.json').exists();S.mkdir(parents=True,exist_ok=True);O.mkdir(parents=True,exist_ok=True)
base=Image.open(R/'public/demos/wildlife-v2/foraging-resources/behavior-v2/sheet.png').convert('RGBA');sheet=Image.new('RGBA',(960,128));sheet.alpha_composite(base)
recipe=json.loads((S/'paint.json').read_text())
for i,ops in enumerate(recipe['frames'],14):
 tile=Image.new('RGBA',(32,32));d=ImageDraw.Draw(tile)
 for shape,points,color,width in ops:
  if shape=='line':d.line(points,fill=color,width=width)
  else:getattr(d,shape)(points,fill=color)
 for row in range(4):sheet.alpha_composite(tile,(i*32,row*32))
assert sheet.crop((0,0,448,128)).tobytes()==base.tobytes();sheet.save(O/'sheet.png');sheet.save(O/'contact-sheet-native.png')
scene=Image.new('RGBA',(512,64),'#77947d');scene.alpha_composite(sheet.crop((448,0,960,32)),(0,16));scene.save(O/'scene-native.png');scene.save(O/'preview.png')
(O/'sprite.json').write_text(json.dumps(dict(identity='foraging-resources-behavior-v3',frameWidth=32,frameHeight=32,anchor=[16,16],sheetSha256=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest()),indent=2)+'\n')
(O/'pixel-audit.json').write_text(json.dumps(dict(binaryAlpha=set(sheet.getchannel('A').get_flattened_data())<={0,255},priorFourteenCellsUnchanged=True,sourceStages=16),indent=2)+'\n')
(O/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Renewable forage</title><h1>Renewable plants and tree crops</h1><p>Four stocks: empty, one, two and three portions. Pending human review.</p><img alt="Plants, seeds, nuts and fruit stock stages" style="image-rendering:pixelated;width:1024px" src="scene-native.png">')
print('WOODLAND_RESOURCES_OK')
