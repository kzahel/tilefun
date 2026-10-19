"""Fixed-palette, no-dither pixel finish; Pillow only. python .../finish.py"""
from pathlib import Path
from collections import Counter
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import hashlib
import json

ROOT=Path(__file__).resolve().parents[3]
DATA=ROOT/'data/vehicle-style-study/02-detailed-toon'
OUT=ROOT/'public/demos/vehicle-style-study/02-detailed-toon'
SCRIPTS=ROOT/'scripts/vehicle-style-study/02-detailed-toon'
geom=json.loads((DATA/'geometry.json').read_text())
roles=geom['materialRoles']
palette=list(dict.fromkeys(tuple(c) for group in roles.values() for c in group))
ink=(32,29,43)
assert ink in palette

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

refs=sorted((ROOT/'art-source/vehicle-models/compact-4/v1/refs').glob('*.png'))
reference_colours=Counter()
for path in refs:
    reference_colours.update(p[:3] for p in Image.open(path).convert('RGBA').get_flattened_data() if p[3]>128)
palette_records=[]
for col in palette:
    names=[role for role,cols in roles.items() if list(col) in cols]
    assert col in reference_colours or col==ink,col
    palette_records.append({'rgb':list(col),'hex':'#'+''.join(f'{c:02x}' for c in col),'roles':names,'source':'compact-4/v1/refs exact pixel' if col in reference_colours else 'explicit named trim/ink supplement','sourcePixelOccurrences':reference_colours[col]})

cache={}
def nearest(rgb):
    if rgb not in cache:
        cache[rgb]=min(palette,key=lambda c:sum((a-b)**2 for a,b in zip(rgb,c)))
    return cache[rgb]

def backdrop(size,cell=16):
    im=Image.new('RGB',size,(231,229,226))
    dr=ImageDraw.Draw(im)
    for y in range(0,size[1],cell):
        for x in range(0,size[0],cell):
            if ((x//cell)+(y//cell))%2:
                dr.rectangle((x,y,x+cell-1,y+cell-1),fill=(218,216,214))
    return im

def oncheck(im,scale=1):
    if scale!=1:
        im=im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)
    bg=backdrop(im.size,8*scale)
    bg.paste(im,(0,0),im)
    return bg

font_path=Path('C:/Windows/Fonts/consola.ttf')
def font(size):
    return ImageFont.truetype(str(font_path),size) if font_path.exists() else ImageFont.load_default(size=size)
F=font(18)
SM=font(15)
BIG=font(27)
native=[]
reduced=[]
before_ink=[]
measure=[]
for i in range(8):
    raw=Image.open(OUT/f'raw-{i}.png').convert('RGBA')
    assert raw.size==(512,512)
    small=raw.resize((128,128),Image.Resampling.NEAREST)
    shifted=Image.new('RGBA',(128,128))
    shifted.paste(small,(0,28))
    shifted.save(DATA/f'reduced-{i}.png')
    reduced.append(shifted)
    mapped=Image.new('RGBA',(128,128))
    mapped.putdata([nearest(p[:3])+(255,) if p[3]>=128 else (0,0,0,0) for p in shifted.get_flattened_data()])
    mapped.save(DATA/f'palette-{i}.png')
    before_ink.append(mapped)
    a=mapped.getchannel('A')
    # Exactly one 4-connected exterior pixel, with no internal posterization ink.
    neighbours=[]
    for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
        part=Image.new('L',(128,128))
        part.paste(a,(dx,dy))
        neighbours.append(part)
    # Pillow's 3x3 max filter would add diagonal pixels; use explicit cardinal union.
    ink_mask=Image.new('L',(128,128))
    ink_mask.putdata([max(ps) if here==0 else 0 for ps,here in zip(zip(*(q.get_flattened_data() for q in neighbours)),a.get_flattened_data())])
    final=Image.new('RGBA',(128,128),ink+(0,))
    final.putalpha(ink_mask)
    final.alpha_composite(mapped)
    final.save(OUT/f'view-{i}.png')
    native.append(final)
    measure.append({'view':i,'angleDegrees':45*i,'bounds':list(final.getbbox()),'opaquePixels':sum(p[3]>0 for p in final.get_flattened_data()),'inkPixels':sum(v>0 for v in ink_mask.get_flattened_data()),'colours':len({p[:3] for p in final.get_flattened_data() if p[3]})})

sheet=Image.new('RGBA',(1024,128))
for i,im in enumerate(native):
    sheet.paste(im,(128*i,0))
sheet.save(OUT/'sheet.png')
oncheck(sheet,4).save(DATA/'sheet-4x.png')

# Single fixed GIF palette, transparency index=0 in every frame. No adaptive colours.
gif_palette=[0,0,0]+[v for c in palette for v in c]
gif_palette += [0]*(768-len(gif_palette))
index={col:i+1 for i,col in enumerate(palette)}
frames=[]
for im in native:
    frame=Image.new('P',(128,128))
    frame.putpalette(gif_palette)
    frame.putdata([index[p[:3]] if p[3] else 0 for p in im.get_flattened_data()])
    frame=frame.resize((512,512),Image.Resampling.NEAREST)
    frame.info['transparency']=0
    frames.append(frame)
frames[0].save(OUT/'turntable.gif',save_all=True,append_images=frames[1:],duration=350,loop=0,transparency=0,disposal=2,optimize=False)

raw_contact=Image.new('RGB',(1024,560),(246,243,237))
rd=ImageDraw.Draw(raw_contact)
for i in range(8):
    rd.text(((i%4)*256+8,(i//4)*280+4),f'Raw {i} / {45*i} deg',fill=(35,33,43),font=F)
    raw=Image.open(OUT/f'raw-{i}.png').convert('RGBA').resize((256,256),Image.Resampling.NEAREST)
    raw_contact.paste(oncheck(raw),((i%4)*256,(i//4)*280+24))
raw_contact.save(DATA/'raw-contact.png')

# Native 1x remains exactly 128x128; the large panel is exactly nearest 4x.
comparison=Image.new('RGB',(1440,2520),(247,244,238))
d=ImageDraw.Draw(comparison)
d.text((24,16),'02 / DETAILED TOON  |  curved sports coupe',fill=(40,32,44),font=BIG)
d.text((24,55),f'{geom["evaluatedTriangles"]:,} evaluated triangles | six pre-raster toon roles | fixed camera / palette / origin',fill=(65,54,66),font=F)
d.text((24,87),'Existing compact-4 source references (unaltered pixels; 2x nearest)',fill=(65,54,66),font=F)
for i,path in enumerate(refs):
    ref=Image.open(path).convert('RGBA')
    x=24+i*350
    d.text((x,118),path.name,fill=(45,35,48),font=F)
    comparison.paste(oncheck(ref,2),(x,146))
d.text((24,270),'Raw reduction -> shared-palette native -> final native + 4x. Checkers are presentation only.',fill=(65,54,66),font=SM)
for i in range(8):
    x=(i%2)*720
    y=310+(i//2)*550
    d.text((x+14,y),f'VIEW {i} / {45*i} degrees',fill=(40,32,44),font=F)
    for offset, label, im in [(30,'Raw reduction 1x',reduced[i]),(201,'Palette only 1x',before_ink[i]),(372,'Final ink 1x',native[i])]:
        d.text((x+14,y+offset),label,fill=(65,54,66),font=SM)
        comparison.paste(oncheck(im),(x+14,y+offset+23))
    comparison.paste(oncheck(native[i],4),(x+190,y+29))
comparison.save(OUT/'comparison.png')

all_colours={p[:3] for im in native for p in im.get_flattened_data() if p[3]}
assert all_colours<=set(palette)
assert all(set(im.getchannel('A').get_flattened_data())<={0,255} for im in native)
assert all(b[0]>0 and b[1]>0 and b[2]<128 and b[3]<128 for b in (im.getbbox() for im in native))
with Image.open(OUT/'turntable.gif') as gif:
    assert gif.n_frames==8 and gif.size==(512,512)
    for i in range(8):
        gif.seek(i)
        decoded=gif.convert('RGBA').resize((128,128),Image.Resampling.NEAREST)
        assert decoded.getchannel('A').tobytes()==native[i].getchannel('A').tobytes(),f'GIF alpha mismatch {i}'
        assert all(a[:3]==b[:3] for a,b in zip(decoded.get_flattened_data(),native[i].get_flattened_data()) if b[3]),f'GIF opaque RGB mismatch {i}'

expected=[f'raw-{i}.png' for i in range(8)]+[f'view-{i}.png' for i in range(8)]+['sheet.png','comparison.png','turntable.gif']
assert all((OUT/p).is_file() for p in expected)
assert (DATA/'sports-coupe.blend').is_file()
inspection_path=DATA/'inspection.json'
inspection=json.loads(inspection_path.read_text()) if inspection_path.exists() else {'status':'pending','note':'Awaiting actual native and contact-sheet inspection.'}
scene_validation_path=DATA/'scene-validation.json'
scene_validation=json.loads(scene_validation_path.read_text()) if scene_validation_path.exists() else {'status':'pending'}
if inspection.get('status')=='performed':
    for file,sha in inspection['files'].items():
        assert digest(ROOT/file)==sha,f'Inspection stale: {file}'
    assert scene_validation['status']=='passed','Verify the saved .blend before marking complete'
report={
    'route':'02-detailed-toon',
    'title':'Detailed smooth coupe with pre-raster toon lighting',
    'status':'complete' if inspection.get('status')=='performed' else 'awaiting-inspection',
    'method':'Original dense longitudinal body loft with exact boolean wheel openings and curved fender patches; swept compound-curved cabin; detailed radial tires, split spokes, drilled rotors and calipers. Eevee Diffuse -> ShaderToRGB -> CONSTANT role ramp -> Emission supplies bands before reduction. 512px RGBA -> nearest centre-sample 128px -> constant (0,+28) -> fixed shared RGB lookup -> binary alpha -> cardinal one-pixel exterior ink. No dither, no per-view fitting or repaint.',
    'evaluatedTriangles':geom['evaluatedTriangles'],
    'evaluatedMeshCount':geom['evaluatedMeshCount'],
    'nativeMeshCount':geom['nativeMeshCount'],
    'curveCount':geom['curveCount'],
    'nativeSize':[128,128],
    'rawSize':[512,512],
    'groundAnchor':[64,92],
    'translation':[0,28],
    'forward':'local -X',
    'units':'metres; Z up',
    'visualBounds':geom['bounds'],
    'camera':geom['camera'],
    'anglesDegrees':geom['anglesDegrees'],
    'wheelGroundContacts':geom['wheels'],
    'renderEngine':'BLENDER_EEVEE',
    'renderThreads':4,
    'palette':palette_records,
    'paletteSize':len(palette),
    'colourCount':len(all_colours),
    'perView':measure,
    'blendPath':'data/vehicle-style-study/02-detailed-toon/sports-coupe.blend',
    'sourcePaths':['scripts/vehicle-style-study/02-detailed-toon/build.py','scripts/vehicle-style-study/02-detailed-toon/finish.py','scripts/vehicle-style-study/02-detailed-toon/verify_scene.py'],
    'sourceHashes':{str(p.relative_to(ROOT)).replace('\\','/'):digest(p) for p in [SCRIPTS/'build.py',SCRIPTS/'finish.py',SCRIPTS/'verify_scene.py',DATA/'sports-coupe.blend']},
    'referencePaths':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':digest(p)} for p in refs],
    'commands':['& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python scripts/vehicle-style-study/02-detailed-toon/build.py','& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python scripts/vehicle-style-study/02-detailed-toon/verify_scene.py','python scripts/vehicle-style-study/02-detailed-toon/finish.py'],
    'authoredPixelClusters':[],
    'authoredClusterExplanation':'No per-view manual pixel clusters. Only deterministic shared-palette mapping and one-pixel exterior ink; all lamps, seams, spokes and glass borders originate in editable geometry/material roles.',
    'limitations':['Experimental original car; no human acceptance or production integration.','High-detail scene is an offline sprite source, not a runtime geometry budget.','Fine brake drilling, split spokes and door seams are partly lost or merge at native size.','Fixed world-space lighting intentionally changes face bands across rotations.','Nearest reduction can produce isolated highlight/trim pixels; geometry detail alone does not author clean pixel clusters.','No ground shadow receiver; ground anchor and four tire contacts are explicit metadata.','Wheel rolls/steering were not animated or clearance-qualified.'],
    'inspection':inspection,
    'savedSceneValidation':scene_validation,
    'validation':{'dimensions':True,'binaryAlpha':True,'sharedPalette':True,'noClipping':True,'gifFramesAndPixelParity':True,'allRequiredOutputsExist':True},
    'outputs':[{'path':p,'sha256':digest(OUT/p)} for p in expected],
}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
(DATA/'palette.json').write_text(json.dumps(palette_records,indent=2)+'\n')
print(json.dumps({'status':report['status'],'triangles':report['evaluatedTriangles'],'meshes':report['evaluatedMeshCount'],'palette':len(palette),'usedColours':len(all_colours),'bounds':measure},indent=2))
