"""Replayable native-pixel plants/seeds; preserve every earlier material cell."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[2];S=R/'art-source/wildlife-v2/foraging-resources/behavior-v2';O=R/'public/demos/wildlife-v2/foraging-resources/behavior-v2'
assert not (S/'receipt.json').exists(), 'Registered resources are immutable'
recipe=json.loads((S/'paint.json').read_text());S.mkdir(parents=True,exist_ok=True);O.mkdir(parents=True,exist_ok=True)
base=Image.open(R/'public/demos/wildlife-v2/foraging-resources/behavior-v1/sheet.png').convert('RGBA')
sheet=Image.new('RGBA',(448,128));sheet.alpha_composite(base)
for column,ops in enumerate(recipe['frames'],10):
    tile=Image.new('RGBA',(32,32));draw=ImageDraw.Draw(tile)
    for shape,points,key,width in ops:
        if shape=='line':draw.line(points,fill=recipe['palette'][key],width=width)
        else:getattr(draw,shape)(points,fill=recipe['palette'][key])
    for row in range(4):sheet.alpha_composite(tile,(column*32,row*32))
assert sheet.crop((0,0,320,128)).tobytes()==base.tobytes()
sheet.save(O/'sheet.png');sheet.save(O/'contact-sheet-native.png')
scene=Image.new('RGBA',(192,64),'#77947d');scene.alpha_composite(sheet.crop((320,0,448,32)),(32,16));scene.save(O/'scene-native.png');scene.save(O/'preview.png')
(O/'sprite.json').write_text(json.dumps(dict(identity='foraging-resources-behavior-v2',frameWidth=32,frameHeight=32,anchor=[16,16],sheetSha256=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest()),indent=2)+'\n')
(O/'pixel-audit.json').write_text(json.dumps(dict(binaryAlpha=set(sheet.getchannel('A').get_flattened_data())<={0,255},priorTenCellsUnchanged=True,plantStages=3,distinctPlantStages=len({sheet.crop((c*32,0,(c+1)*32,32)).tobytes() for c in range(10,13)})),indent=2)+'\n')
(O/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Edible plants and bird seed</title><h1>Finite edible plants and bird seed</h1><p>Three plant portions, then removal. Pending human review.</p><img alt="Three edible plant stages and bird seed" style="image-rendering:pixelated;width:768px" src="scene-native.png">')
print('MEADOW_RESOURCES_OK')
