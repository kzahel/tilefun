"""Build matched actual-GLB comparison sheets and geometry-only image metrics."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/demos/vehicle-bake'


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--draft',action='store_true')
    args=parser.parse_args()
    captures=ROOT/'data/vehicle-bake/draft-capture' if args.draft else OUT/'captures'
    manifest=json.loads((OUT/'manifest.json').read_text())
    rows=[('Art target · approach 3',OUT/'reference',True)]+[(c['title'],captures/c['id'],False) for c in manifest['candidates']]
    im=Image.new('RGB',(1240,110+len(rows)*230),'#1c2526')
    d=ImageDraw.Draw(im);font=ImageFont.load_default(size=17);small=ImageFont.load_default(size=12)
    d.text((24,20),'RED COUPE / ACTUAL LOW-POLY GLB COMPARISON',font=ImageFont.load_default(size=24),fill='#eee5d5')
    d.text((24,58),'Identical authoring camera and scale. Mesh atlas paint + shared pixel-outline shader. No final-screen feature redraw.',font=small,fill='#b3c4b2')
    metrics=[]
    for row,(title,folder,target) in enumerate(rows):
        yy=105+row*230
        d.text((24,yy+38),title,font=font,fill='#e4b582')
        if not target:
            candidate=manifest['candidates'][row-1]
            d.text((24,yy+68),f"{candidate['audit']['glbBytes']/1024:.1f} KiB GLB / {candidate['audit']['primitives']} primitives",font=small,fill='#b3c4b2')
        scores=[]
        for column,index in enumerate((0,1,2,3)):
            file=folder/(f'view-{index}.png' if target else f'study-{index*2}.png')
            frame=Image.open(file).convert('RGBA')
            # Same display crop for every model/view, never a per-asset fit.
            big=frame.crop((10,36,118,124)).resize((216,176),Image.Resampling.NEAREST)
            x=290+column*235
            im.paste(big,(x,yy+24),big)
            d.text((x,yy),f'{index*45} deg / 2x pixels',font=small,fill='#8ca28e')
            if not target:
                original=Image.open(OUT/f'reference/view-{index}.png').convert('RGBA')
                a={i for i,p in enumerate(original.get_flattened_data()) if p[3]>=128}
                b={i for i,p in enumerate(frame.get_flattened_data()) if p[3]>=128}
                scores.append(len(a&b)/len(a|b))
        if not target:
            metrics.append({'id':candidate['id'],'fourViewSilhouetteIoU':scores,'meanFourViewSilhouetteIoU':sum(scores)/4,
                            'meaning':'Geometry occupancy only, not an art quality or approval score'})
    destination=ROOT/'data/vehicle-bake/draft-comparison.png' if args.draft else OUT/'comparison.png'
    im.save(destination)
    (captures/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
    print(json.dumps({'comparison':str(destination),'metrics':metrics},indent=2))


if __name__=='__main__':main()
