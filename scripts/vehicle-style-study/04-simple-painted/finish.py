"""Fixed palette/alpha/ink finishing, evidence sheets and bounded output checks."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import struct
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
ROUTE='04-simple-painted'
DATA=ROOT/'data/vehicle-style-study'/ROUTE
OUT=ROOT/'public/demos/vehicle-style-study'/ROUTE
REFS=ROOT/'art-source/vehicle-models/compact-4/v1/refs'
G=json.loads((DATA/'geometry.json').read_text())
COLORS=[tuple(bytes.fromhex(v[1:])) for v in G['paletteRoles'].values()]
INK=COLORS[0]
BG=(228,230,234);GRID=(218,222,228);TEXT=(48,49,64)

def font(size):
    return ImageFont.load_default(size=size)

def checker(size, step=16):
    im=Image.new('RGB',size,BG);d=ImageDraw.Draw(im)
    for y in range(0,size[1],step):
        for x in range(0,size[0],step):
            if (x//step+y//step)%2:d.rectangle((x,y,x+step-1,y+step-1),fill=GRID)
    return im

def display(im,size):
    tile=checker(size)
    im=im.resize(size,Image.Resampling.NEAREST)
    tile.paste(im,(0,0),im)
    return tile

def finish(raw):
    # Point sampling avoids the new intermediate colors of a filtered reduction.
    small=raw.resize((128,128),Image.Resampling.NEAREST)
    shifted=Image.new('RGBA',(128,128))
    shifted.paste(small,(0,28))
    result=Image.new('RGBA',(128,128))
    visible={(x,y) for y in range(128) for x in range(128) if shifted.getpixel((x,y))[3]>=128}
    for x,y in visible:
        rgb=shifted.getpixel((x,y))[:3]
        color=min(COLORS,key=lambda c:sum((a-b)**2 for a,b in zip(c,rgb)))
        # A restrained inward, 4-connected silhouette keeps canvas/scale intact.
        if any((x+dx,y+dy) not in visible for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):color=INK
        result.putpixel((x,y),color+(255,))
    return result

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def glb_stats(path):
    content=path.read_bytes()
    magic,version,length=struct.unpack_from('<4sII',content)
    assert magic==b'glTF' and version==2 and length==len(content)
    n,kind=struct.unpack_from('<II',content,12)
    assert kind==0x4e4f534a
    doc=json.loads(content[20:20+n])
    total=0;primitives=0
    for m in doc['meshes']:
        for p in m['primitives']:
            assert p.get('mode',4)==4
            total+=doc['accessors'][p['indices']]['count']//3
            primitives+=1
    wheels=[n for n in doc['nodes'] if n.get('name','').startswith('Wheel_')]
    assert len(wheels)==4
    assert all(n.get('extras',{}).get('radius')==.33 for n in wheels)
    assert total==G['triangles'],(total,G['triangles'])
    assert all('KHR_materials_unlit' in m.get('extensions',{}) for m in doc['materials'])
    return {'triangles':total,'meshCount':len(doc['meshes']),'materialCount':len(doc['materials']),'materialPrimitives':primitives,'independentWheelNodes':len(wheels),'unlit':True,'bytes':len(content)}

def main(verified):
    source_colors=Counter()
    references={}
    for p in sorted(REFS.glob('*.png')):
        im=Image.open(p).convert('RGBA')
        source_colors.update(c[:3] for c in im.get_flattened_data() if c[3]>=128)
        references[p.name]={'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'size':list(im.size)}
    assert all(c in source_colors for c in COLORS),'Palette must be sampled from exact compact-4 references'
    views=[];bounds=[];raws=[];colors=set()
    for i in range(8):
        raw=Image.open(OUT/f'raw-{i}.png').convert('RGBA')
        assert raw.size==(512,512)
        raws.append(raw)
        view=finish(raw);view.save(OUT/f'view-{i}.png');views.append(view)
        assert set(view.getchannel('A').get_flattened_data())<={0,255}
        bound=view.getbbox();bounds.append(bound)
        assert bound and bound[0]>0 and bound[1]>0 and bound[2]<128 and bound[3]<128
        colors.update(c[:3] for c in view.get_flattened_data() if c[3])
    assert len({v.tobytes() for v in views})==8
    sheet=Image.new('RGBA',(1024,128))
    for i,v in enumerate(views):sheet.paste(v,(i*128,0))
    sheet.save(OUT/'sheet.png')

    raw_sheet=checker((2048,1090))
    d=ImageDraw.Draw(raw_sheet)
    d.text((16,8),'RAW 512 RGBA / no palette finish / camera and scale fixed',font=font(24),fill=TEXT)
    for i,r in enumerate(raws):
        x=(i%4)*512;y=42+(i//4)*524
        raw_sheet.paste(display(r,(512,512)),(x,y))
        ImageDraw.Draw(raw_sheet).text((x+12,y+8),f'{i*45} degrees',font=font(18),fill=TEXT)
    raw_sheet.save(DATA/'raw-contact.png')

    comparison=checker((2160,1740));d=ImageDraw.Draw(comparison)
    d.text((20,12),'04 / ROSSO SPRINT / SIMPLE PAINTED LOW-POLY',font=font(30),fill=TEXT)
    d.text((20,52),f"{G['triangles']} triangles | 5 editable meshes | flat unlit paint | shared {len(COLORS)}-role source palette",font=font(21),fill=TEXT)
    d.text((20,86),'REFERENCE PALETTE: existing compact-4 sprites; original sports-car shape below (not a reconstruction).',font=font(19),fill=TEXT)
    for i,name in enumerate(['east','south','west','north']):
        ref=Image.open(REFS/f'{name}.png').convert('RGBA')
        tile=Image.new('RGBA',(128,128))
        tile.paste(ref,((128-ref.width)//2,(128-ref.height)//2))
        comparison.paste(display(tile,(256,256)),(280+i*470,110))
        d.text((20+i*470,168),name,font=font(22),fill=TEXT)
    for i,v in enumerate(views):
        x=12+(i%4)*538;y=390+(i//4)*670
        d.text((x,y),f'{i*45} DEG / NATIVE + RAW GUIDE + FINAL 4X',font=font(17),fill=TEXT)
        comparison.paste(display(v,(128,128)),(x,y+28))
        comparison.paste(display(raws[i],(128,128)),(x+154,y+28))
        # The raw guide above is intentionally pre-anchor; enlarged final below.
        d.text((x+306,y+40),'128 px final',font=font(15),fill=TEXT)
        d.text((x+306,y+66),'Fixed shift 0,+28',font=font(15),fill=TEXT)
        d.text((x+306,y+92),'Ink stays inward',font=font(15),fill=TEXT)
        comparison.paste(display(v,(512,512)),(x,y+155))
    comparison.save(OUT/'comparison.png')

    # Explicit global palette, shared by all frames; no adaptive colors or dither.
    global_colors=COLORS+[BG,GRID,TEXT]
    palette=Image.new('P',(1,1));palette.putpalette([c for rgb in global_colors for c in rgb]+[0]*(768-3*len(global_colors)))
    gif_frames=[]
    for i,v in enumerate(views):
        frame=display(v,(512,512));d=ImageDraw.Draw(frame)
        d.text((16,16),f'04 SIMPLE PAINTED / {i*45} DEG',font=font(19),fill=TEXT)
        # Ground-center marker is fixed; it is a guide, not a contact shadow.
        d.line((248,368,264,368),fill=TEXT,width=1)
        d.line((256,360,256,376),fill=TEXT,width=1)
        frame=frame.quantize(palette=palette,dither=Image.Dither.NONE)
        gif_frames.append(frame)
    gif_frames[0].save(OUT/'turntable.gif',save_all=True,append_images=gif_frames[1:],loop=0,duration=250,disposal=2,optimize=False)
    gif=Image.open(OUT/'turntable.gif');assert gif.n_frames==8
    decoded=checker((2048,1024))
    for i in range(8):
        gif.seek(i);assert gif.info['duration']==250
        decoded.paste(gif.convert('RGB'),((i%4)*512,(i//4)*512))
    decoded.save(DATA/'gif-decoded-contact.png')
    exported=glb_stats(OUT/'sports-coupe.glb')
    commands=[
        '& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-style-study/04-simple-painted/build.py',
        'python scripts/vehicle-style-study/04-simple-painted/finish.py',
        '& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-style-study/04-simple-painted/verify_scene.py',
        'python scripts/vehicle-style-study/04-simple-painted/finish.py --verified',
    ]
    expected=[f'raw-{i}.png' for i in range(8)]+[f'view-{i}.png' for i in range(8)]+['sheet.png','comparison.png','turntable.gif','sports-coupe.glb']
    assert all((OUT/f).exists() for f in expected)
    assert (DATA/'sports-coupe.blend').exists()
    inspection=json.loads((DATA/'inspection.json').read_text()) if verified else {'state':'pending visual inspection'}
    if verified:
        assert inspection['inspectedAllRawViews'] and inspection['inspectedAllFinalViews'] and inspection['inspectedGifDecodedFrames']
        assert (DATA/'scene-verification.json').exists()
    report={
        'route':ROUTE,'title':G['title'],'status':'complete' if verified else 'rendered_pending_inspection',
        'method':'Original sectional low-poly shell with actual curved open wheel arches; four rigid wheels; shared flat unlit palette materials, geometric internal ink, fixed point reduction, binary alpha and one-pixel inward silhouette ink.',
        'evaluatedTriangleCount':G['triangles'],'evaluatedMeshCount':G['meshCount'],'components':G['components'],
        'nativeSize':[128,128],'rawSize':[512,512],'sheetSize':[1024,128],
        'modelUnits':G['units'],'camera':G['camera'],'renderSettings':G['renderer'],
        'headingDegrees':[i*45 for i in range(8)],'translationPixels':[0,28],'groundAnchorPixels':[64,92],
        'palette':G['paletteRoles'],'paletteColorCount':len(COLORS),'usedColorCount':len(colors),'usedColors':['#'+bytes(c).hex() for c in sorted(colors)],
        'paletteProvenance':'Every role is an exact opaque source RGB sampled from compact-4/v1/refs; no supplemental colors.',
        'sourceReferences':references,
        'blendPath':G['blend'],'glbPath':G['glb'],
        'sourcePaths':['scripts/vehicle-style-study/04-simple-painted/build.py','scripts/vehicle-style-study/04-simple-painted/finish.py','scripts/vehicle-style-study/04-simple-painted/verify_scene.py'],
        'commands':commands,'glbValidation':exported,
        'finishing':{'reduction':'nearest point, one fixed 512-to-128 reduction','alphaThreshold':128,'outline':'one-native-pixel inward 4-neighbor silhouette','dither':False,'perViewPalette':False,'perViewFitting':False,'authoredPixelClusters':[],'internalInk':'3D painted glass apertures, hood shutlines, arch lips, intakes and door seams; no view-specific pixel redrawing'},
        'wheelCenters':G['wheelCenters'],'wheelRadius':G['wheelRadius'],'bounds':bounds,
        'validation':{'binaryAlpha':True,'allOutputsExist':True,'allEightDistinct':True,'paddingPass':True,'fixedGlobalPalette':True,'gifFrames':8,'gifFrameDurationMs':250,'glbUnlit':True},
        'visualInspection':inspection,
        'sceneVerification':json.loads((DATA/'scene-verification.json').read_text()) if (DATA/'scene-verification.json').exists() else None,
        'limitations':[
            'Original offline baseline candidate; no human approval or production qualification.',
            'Faceted shoulders and broad unlit highlight bands trade surface nuance for low cost; the red source palette is pink-magenta rather than saturated automotive red.',
            'Small handles, grille and five-spoke rim detail simplify or vanish at the fixed native scale; no per-view pixel repair was applied.',
            'Wheel roll is independent and static-body clearance is checked; steering, suspension, physics/collision integration and gameplay performance are unqualified.',
            'Flat palette materials export as multiple GLB material primitives; triangle count alone is not a device draw-call budget.',
            'Sprite ink is a finishing operation and is not part of the GLB; geometric internal trim remains in both.',
            'Static material highlights rotate with the model; they are authored paint rather than physically moving light reflections.',
        ],
        'files':{f:{'bytes':(OUT/f).stat().st_size,'sha256':sha(OUT/f)} for f in expected},
    }
    (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'triangles':G['triangles'],'usedColors':len(colors),'glb':exported,'bounds':bounds},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--verified',action='store_true')
    main(parser.parse_args().verified)
