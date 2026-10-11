"""Retain an exact reviewed offline checkpoint and register its immutable catalog capture.

Does not rebuild models, change older revisions, promote art or deploy the game.
Run asset probes first; pass their exact frames and a packed evaluated scene.
"""
import argparse
import html
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont

from pipeline import ROOT, digest, read, write


def relative(path):
    return path.resolve().relative_to(ROOT).as_posix()


def comparison(render, recipe, output, title):
    width,height=[n*2 for n in recipe['canvas']]
    gap,pad=10,14;cell_width=width+2*pad;cell_height=height+44
    sheet=Image.new('RGB',(4*cell_width+5*gap,2*cell_height+3*gap+34),'#253139')
    draw=ImageDraw.Draw(sheet);font=ImageFont.load_default(size=16)
    for col,view in enumerate(['east','west','north','south']):
        for row,label,suffix in [(0,'SPRITE','source'),(1,'BLENDER','render')]:
            x=gap+col*(cell_width+gap);y=gap+row*(cell_height+gap)
            draw.rectangle((x,y,x+cell_width-1,y+cell_height-1),fill='#53636b')
            image=Image.open(render/f'{view}-{suffix}.png').convert('RGBA').resize((width,height),Image.Resampling.NEAREST)
            sheet.paste(image,(x+pad,y+34),image)
            draw.text((x+12,y+10),f'{label} / {view}',font=font,fill='white')
    draw.text((16,sheet.height-26),title+' · awaiting review',font=font,fill='#b4c4cd')
    sheet.save(output)


def retain(args):
    model,render,projection,inspection,flash=[getattr(args,key).resolve() for key in ['model','render','projection','inspection','flash']]
    recipe=read(model/'recipe.json');asset=recipe['assetId'];revision=args.revision
    if not revision.startswith('v') or not revision[1:].isdigit():raise ValueError('Use an explicit vN revision')
    source=ROOT/f'art-source/vehicle-models/{asset}/{revision}'
    review=ROOT/f'public/assets/models/vehicles/review/{asset}-{revision}'
    glb=ROOT/f'public/assets/models/vehicles/{asset}-{revision}.glb'
    if source.exists() or review.exists() or glb.exists():raise FileExistsError('Retained revision already exists; choose a new revision')
    catalog_path=ROOT/'art-source/vehicle-models/catalog.json';catalog=read(catalog_path)
    if any(b['assetId']==asset and b['revision']==revision for b in catalog['bundles']):raise ValueError('Catalog revision already exists')
    for path in [args.packed,render/'asset.glb',projection/'projection-draft.png',flash/'light-browser.json']:
        if not path.is_file():raise FileNotFoundError(path)
    clearance = read(model/'body-wheel-clearance.json')
    if clearance['assetId'] != asset or clearance['glbSha256'] != digest(render/'asset.glb') or not clearance['bodyTriangleIntoTireRejected'] or not clearance['restored']:
        raise ValueError('Exact whole-body neutral-roll evidence required')
    source.mkdir(parents=True);review.mkdir()
    for name in ['car-atlas.png','mesh-spec.json','family-config.json','rig.json','paint-ownership.json','lights.json','wheel-alignment.json','body-wheel-clearance.json']:
        shutil.copyfile(model/name,source/name)
    if (model/'floor-revision.json').exists():shutil.copyfile(model/'floor-revision.json',source/'floor-revision.json')
    shutil.copytree(model/'refs',source/'refs');shutil.copyfile(args.packed,source/'car.blend')
    for name in ['projection-draft.png','projection-coverage.png','projection-with-authored-fill.png','coverage.json']:
        shutil.copyfile(projection/name,source/name)
    shutil.copyfile(render/'audit.json',source/'geometry-audit.json')
    recipe['source']['image']=relative(Path(recipe['source']['image']))
    recipe['template']={'path':relative(source/'car.blend'),'sha256':digest(source/'car.blend')}
    write(source/'recipe.json',recipe)
    report=read(inspection/'inspection.json');report['recipeSha256']=digest(source/'recipe.json');report['metrics']=read(render/'metrics.json')
    write(source/'inspection.json',report)
    write(source/'authoring-provenance.json',{'sourceFingerprint':recipe['source']['sha256'],
        'constructionScripts':{relative(p):digest(p) for p in args.constructor},
        'configuration':relative(args.config),'configurationSha256':digest(args.config),
        'retentionScript':relative(Path(__file__)),'retentionScriptSha256':digest(Path(__file__))})
    shutil.copyfile(render/'asset.glb',glb)
    comparison(render,recipe,review/'comparison.png',args.name+' '+revision)
    shutil.copyfile(inspection/'orbit-strip.png',review/'orbit.png');shutil.copyfile(inspection/'silhouette.png',review/'silhouette.png')
    shutil.copyfile(flash/'light-browser.json',source/'light-validation.json')
    frames={};font=ImageFont.load_default(size=16)
    for state in ['off','a','b']:
        shutil.copyfile(flash/f'{state}.png',review/f'lights-{state}.png')
        image=Image.open(review/f'lights-{state}.png').convert('RGB')
        ImageDraw.Draw(image).text((10,10),'Light off' if state=='off' else 'Light pattern · '+state,font=font,fill='white')
        frames[state]=image
    sequence=[frames[key] for key in ['a','off','a','off','b','off','b','off']]
    sequence[0].save(review/'lights.gif',save_all=True,append_images=sequence[1:],duration=[120,80,120,180,120,80,120,180],loop=0,disposal=2)
    identity={'assetId':asset,'revision':revision,'sourceFingerprint':recipe['source']['sha256'],
        'sourceBundleSha256':digest(source/'car.blend'),'sourceAtlasSha256':digest(source/'car-atlas.png'),
        'lightPatternSha256':digest(source/'lights.json'),'lightEffectSourceSha256':digest(ROOT/'src/rendering/VehicleEmergencyLights.ts'),
        'files':[{'url':p.relative_to(ROOT/'public').as_posix(),'sha256':digest(p)} for p in [glb]+[review/name for name in ['comparison.png','orbit.png','silhouette.png','lights.gif','lights-off.png','lights-a.png','lights-b.png']]]}
    import hashlib
    fingerprint=hashlib.sha256(json.dumps(identity,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    candidate=f'projection:authored-{asset}-{revision}'
    write(review/'review.json',{'schema':'tilefun-authored-vehicle-review-v1','candidateId':candidate,
        'candidateFingerprint':fingerprint,'identity':identity,'status':'Awaiting owner inspection; not promoted','notes':args.note})
    # Format before catalog pinning and inventory generation, never after freezing.
    subprocess.run(['node',str(ROOT/'node_modules/@biomejs/biome/bin/biome'),'format','--write',str(review/'review.json')],check=True,cwd=ROOT)
    title=html.escape(args.name+' '+revision);notes=' '.join(html.escape(note) for note in args.note)
    (review/'index.html').write_bytes(f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · sprite and model review</title><style>body{{margin:0 auto;padding:24px;max-width:1320px;background:#253139;color:#edf3f5;font:16px/1.5 system-ui,sans-serif}}img{{width:100%;height:auto;image-rendering:pixelated}}a{{color:#9bdaff}}figure{{margin:24px 0}}figcaption{{color:#b4c4cd}}.flash{{max-width:384px}}</style>
<h1>{title}</h1><p>Original sprites above, matched Blender renders below.</p>
<figure><img src="comparison.png" alt="Four original sprites above matched renders: east, west, rear and front."><figcaption>The same model and texture are used in all four directions.</figcaption></figure>
<figure><img src="orbit.png" alt="Model from four additional angles."></figure><p>{notes}</p>
<figure class="flash"><img src="lights.gif" alt="Actual GLB light pulse preview"><figcaption>Tagged lens paint pulses; body and fixed housing stay unchanged. Authoritative enable state controls isolated lens paint.</figcaption></figure>
<details><summary>Silhouette differences</summary><img src="silhouette.png" alt="Source and model contours in four directions."></details>
<p><a href="../../{asset}-{revision}.glb">Download the model</a> · <a href="../">Other vehicle reviews</a> · <a href="/tilefun/workshop.html">Tilefun Workshop</a></p>
<p>Sprite source: Modern Exteriors by LimeZu. Diagnostic awaiting review; exact production art approval pending.</p></html>
'''.encode())
    geometry=read(source/'geometry-audit.json')
    bundle={'assetId':asset,'revision':revision,'glb':relative(glb),'source':relative(source),
        'capturedCandidateId':candidate,'capturedCandidateSha256':fingerprint,'sourceFingerprint':recipe['source']['sha256'],
        'geometry':{'meshObjects':geometry['meshObjects'],'triangles':geometry['triangles']},
        'files':[{'path':relative(p),'sha256':digest(p)} for p in sorted(source.rglob('*')) if p.is_file()]+[{'path':relative(p),'sha256':digest(p)} for p in [glb]+sorted(review.iterdir())],
        'nativeAndNovelRenderSha256':{p.name:digest(p) for p in [render/f'{view}-render.png' for view in ['east','west','north','south']]+[render/f'orbit-{k}.png' for k in range(4)]}}
    old=catalog_path.read_bytes();newline=b'\r\n' if b'\r\n' in old else b'\n'
    marker=newline+b'  ],'+newline+b'  "dependencies":'
    if old.count(marker)!=1:raise ValueError('Unexpected catalog layout; earlier bytes must be preserved')
    entry=('\n'.join('    '+line for line in json.dumps(bundle,indent=2,ensure_ascii=False).splitlines())).encode().replace(b'\n',newline)
    catalog_path.write_bytes(old.replace(marker,b','+newline+entry+marker,1))
    print('Exact bundle retained:',relative(source),candidate,fingerprint)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ['model','render','projection','inspection','flash','packed','config']:
        parser.add_argument('--'+key,type=Path,required=True)
    parser.add_argument('--constructor',type=Path,action='append',required=True)
    parser.add_argument('--revision',required=True);parser.add_argument('--name',required=True)
    parser.add_argument('--note',action='append',default=[])
    retain(parser.parse_args())
