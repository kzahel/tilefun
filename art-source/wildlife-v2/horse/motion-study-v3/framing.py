"""Check transparent margins on every actual Blender render before review."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
TMP = ROOT/'data/horse-motion-139/renders'
OUT = ROOT/'public/demos/wildlife-v2/horse/motion-study-v3'
records = []
for view,count in [('down',32),('up',32),('left',32),('right',32),('side',32),('travel',64)]:
    margins = []
    for pose in range(count):
        im = Image.open(TMP/f'{view}-{pose:02}.png').convert('RGBA')
        x,y,right,bottom = im.getbbox()
        margin = min(x,y,im.width-right,im.height-bottom)
        assert margin > 0, (view,pose,'clipped render')
        margins.append(margin)
    records.append(dict(view=view,poses=count,minimumTransparentMarginPixels=min(margins)))
(OUT/'framing-audit.json').write_text(json.dumps(dict(identity='horse-motion-study-v3',renders=224,views=records),indent=2)+'\n',encoding='utf8')
print('HORSE_FRAMING_OK',224)
