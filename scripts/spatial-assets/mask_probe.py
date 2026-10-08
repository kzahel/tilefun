"""Offline mask ablation on a saved generated image; no manual drawing or inference."""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label
from reference import digest, name
from stage_sheet import font, image_panel

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bundle', type=Path, required=True)
parser.add_argument('--reference', type=name, required=True)
parser.add_argument('--id', type=name, required=True)
parser.add_argument('--tolerances', type=int, nargs='+', default=[8,16,24])
args = parser.parse_args()
source = args.bundle / 'references' / args.reference
output = args.bundle / 'mask-probes' / args.id
output.mkdir(parents=True, exist_ok=False)
image_path = source / 'generated-rgb.png'
image = Image.open(image_path).convert('RGB')
rgb = np.array(image).astype(np.float32)
border = np.concatenate([rgb[0], rgb[-1], rgb[:,0], rgb[:,-1]])
background = np.median(border, axis=0)
distance = np.linalg.norm(rgb-background, axis=2)
variants = [('Saved U2Net', source / 'mask.png', source / 'reference.png')]
records = []
for tolerance in args.tolerances:
    components, _ = label(distance <= tolerance)
    ids = np.unique(np.concatenate([components[0],components[-1],components[:,0],components[:,-1]]))
    ids = ids[ids > 0]
    mask = (~np.isin(components,ids)).astype(np.uint8)*255
    mask_path = output / f'border-{tolerance}-mask.png'
    cutout_path = output / f'border-{tolerance}-rgba.png'
    Image.fromarray(mask).save(mask_path)
    cutout = image.convert('RGBA'); cutout.putalpha(Image.fromarray(mask)); cutout.save(cutout_path)
    variants.append((f'Border RGB distance <= {tolerance}',mask_path,cutout_path))
    records.append({'tolerance':tolerance,'foregroundPixels':int((mask>0).sum()),'maskSha256':digest(mask_path),'rgbaSha256':digest(cutout_path)})
canvas = Image.new('RGB',(550*len(variants),1100),'#f1f4f7'); draw=ImageDraw.Draw(canvas)
draw.text((18,15),'Automatic mask ablation on identical saved SDXL pixels',fill='#243142',font=font(28))
draw.text((18,60),'Unreviewed alternatives; border connectivity can retain shadows or lose similar-colored parts.',fill='#243142',font=font(20))
for index,(title,mask,cutout) in enumerate(variants):
    draw.text((index*550+14,105),title,fill='#243142',font=font(20))
    image_panel(canvas,mask,(index*550+14,145,520,430))
    image_panel(canvas,cutout,(index*550+14,600,520,470))
canvas.save(output/'comparison.png')
record={'reference':args.reference,'inputSha256':digest(image_path),'backgroundRgbMedian':background.tolist(),'implementationSha256':digest(__file__),'method':'4-neighbor connected border color; binary alpha, no pixel recoloring','variants':records,'review':'Unreviewed automatic mask hypotheses; original files unchanged'}
(output/'implementation.py').write_bytes(Path(__file__).read_bytes())
(output/'probe.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
print(json.dumps({'output':str(output),'variants':records}))
