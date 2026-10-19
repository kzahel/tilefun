"""Create viewing conveniences from already captured actual-GLB pixels and retained assets."""
import base64
import json
import mimetypes
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/demos/vehicle-bake'
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
selected=next(c for c in manifest['candidates'] if c['id']==manifest['recommended'])
folder=OUT/'captures'/selected['id']
assert json.loads((folder/'capture.json').read_text(encoding='utf-8'))['glbSha256']==selected['audit']['sha256']
canvas=Image.new('RGB',(1200,630),'#1c2526')
draw=ImageDraw.Draw(canvas)
font=ImageFont.load_default(size=16)
small=ImageFont.load_default(size=12)
draw.text((24,18),'RED COUPE / CHOSEN PIXEL ART TO LOW-POLY GLB',font=ImageFont.load_default(size=23),fill='#eee5d4')
draw.text((24,54),'Same camera, scale and anchor. Actual GLB renders with shared pixel outlines; all interior paint is in the texture.',font=small,fill='#a8c0ab')
for row in range(2):
    y=100+row*245
    draw.text((24,y+55),'Chosen art target' if row==0 else 'Low-poly model',font=font,fill='#dfb27f')
    draw.text((24,y+84),'71,390-triangle source' if row==0 else f"{selected['audit']['triangles']:,} tris / 5 draw meshes",font=small,fill='#a8c0ab')
    for column,index in enumerate((0,1,2,3)):
        path=OUT/f'reference/view-{index}.png' if row==0 else folder/f'study-{index*2}.png'
        frame=Image.open(path).convert('RGBA')
        big=frame.crop((10,36,118,124)).resize((216,176),Image.Resampling.NEAREST)
        x=260+column*230
        canvas.paste(big,(x,y+20),big)
        draw.text((x,y),f'{index*45} deg / 2x pixels',font=small,fill='#89a18b')
draw.text((24,592),f"{selected['audit']['glbBytes']/1024:.1f} KiB embedded GLB · one palette atlas · four independent wheels · pending owner review",font=small,fill='#a8c0ab')
canvas.save(OUT/'review.png')

for candidate in manifest['candidates']:
    capture=OUT/'captures'/candidate['id']
    frames=[]
    for i in range(16):
        src=Image.open(capture/f'study-{i}.png').convert('RGBA')
        big=src.resize((384,384),Image.Resampling.NEAREST)
        frame=Image.new('RGB',(440,460),'#303c34')
        frame.paste(big,(28,36),big)
        d=ImageDraw.Draw(frame)
        d.text((18,14),f"{candidate['audit']['triangles']:,} triangles / {i*22.5:g} degrees",font=font,fill='#eee5d4')
        d.text((18,435),'Actual GLB + shared pixel outline',font=small,fill='#b5cbb0')
        frames.append(frame)
    frames[0].save(capture/'turntable.gif',save_all=True,append_images=frames[1:],duration=140,loop=0,disposal=2,optimize=False)

assets={}
required={'comparison.png','review.png'}
required.update(f'reference/view-{i}.png' for i in range(8))
for candidate in manifest['candidates']:
    required.update(candidate[k] for k in ('glb','atlas','report'))
for name in sorted(required):
    path=OUT/name
    mime='model/gltf-binary' if path.suffix=='.glb' else mimetypes.guess_type(path)[0] or 'application/octet-stream'
    assets[name]=f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
html=(OUT/'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="review.css" />','<style>'+(OUT/'review.css').read_text(encoding='utf-8')+'</style>')
offline=json.dumps({'manifest':manifest,'assets':assets}).replace('</','<\\/')
js=(OUT/'viewer.js').read_text(encoding='utf-8').replace('</script','<\\/script')
html=html.replace('<script src="viewer.js" defer></script>','<script>window.vehicleBakeOffline='+offline+';</script><script>'+js+'</script>')
html=html.replace('href="comparison.png"',f'href="{assets["comparison.png"]}" download="comparison.png"')
html=html.replace('<a href="../../workshop.html">← Tilefun Workshop</a>','<span>Tilefun / red coupe review</span>')
standalone=ROOT/'data/vehicle-bake/review.html'
standalone.write_text(html,encoding='utf-8')
print(json.dumps({'recommended':selected['id'],'standalone':str(standalone),'preview':str(OUT/'review.png')},indent=2))
