"""Retain exact blue-train prototype sources, exports and comparison/motion evidence."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont

from pipeline import ROOT, digest, read, write


def relative(path):return path.resolve().relative_to(ROOT).as_posix()


def retain(prefix, engine, clearance, revision):
    source=ROOT/'art-source/train-models/blue'/revision
    review=ROOT/'public/assets/models/trains/review'/('blue-'+revision)
    catalog_path=ROOT/'art-source/train-models/catalog.json'
    if source.exists() or review.exists() or catalog_path.exists():
        raise FileExistsError('Use a new retainer/revision; never overwrite retained train evidence')
    report=read(engine/'train-engine.json')
    if len(report['wheels'])!=3 or not report['disposed'] or not report['disabledFallback']:
        raise ValueError('Missing actual engine wheel/lifecycle proof')
    if not all(r['reloaded'] for r in report['motion']) or not any(r['reversal'] for r in report['motion']):
        raise ValueError('Missing actual moving/reversal/reload evidence')
    proofs={r['assetId']:r for r in read(clearance)}
    source.mkdir(parents=True);review.mkdir(parents=True)
    font=ImageFont.load_default(size=16)
    bundles=[]
    for part in ['rear','middle','front']:
        model=Path(str(prefix)+'-'+part+'-fit-001')
        render=Path(str(prefix)+'-'+part+'-render-001')
        projection=Path(str(prefix)+'-'+part+'-projection-001')
        inspection=Path(str(prefix)+'-'+part+'-inspection-001')
        packed=Path(str(prefix)+'-'+part+'-packed-001.blend')
        proof=proofs['train-blue-'+part]
        if proof['glbSha256']!=digest(render/'asset.glb') or not proof['bodyTriangleIntoTireRejected'] or not proof['restored']:
            raise ValueError('Clearance evidence does not match the exact export')
        dst=source/part;dst.mkdir();(dst/'refs').mkdir()
        for name in ['car-atlas.png','mesh-spec.json','family-config.json','paint-ownership.json','rig.json']:
            shutil.copyfile(model/name,dst/name)
        shutil.copyfile(packed,dst/'car.blend')
        for name in ['projection-draft.png','projection-coverage.png','projection-with-authored-fill.png','coverage.json']:
            shutil.copyfile(projection/name,dst/name)
        shutil.copyfile(render/'audit.json',dst/'geometry-audit.json')
        recipe=read(model/'recipe.json')
        for view in recipe['views']:shutil.copyfile(model/view['source'],dst/view['source'])
        recipe['source']['image']=relative(Path(recipe['source']['image']))
        recipe['template']={'path':relative(dst/'car.blend'),'sha256':digest(dst/'car.blend')}
        recipe['reviewStatus']='Retained train prototype; moving-art review before live activation'
        write(dst/'recipe.json',recipe)
        write(dst/'body-wheel-clearance.json',proof)
        write(dst/'engine-wheel-validation.json',next(r for r in report['wheels'] if r['assetId']=='train-blue-'+part+'-authored-v1'))
        write(dst/'inspection.json',{'contours':read(inspection/'inspection.json'),'metrics':read(render/'metrics.json')})
        glb=ROOT/'public/assets/models/trains'/('blue-'+part+'-'+revision+'.glb')
        if glb.exists() and digest(glb)!=digest(render/'asset.glb'):raise ValueError('Existing prototype export changed')
        shutil.copyfile(render/'asset.glb',glb)
        for a,b in [('comparison.png',part+'-comparison.png')]:shutil.copyfile(render/a,review/b)
        shutil.copyfile(inspection/'silhouette.png',review/(part+'-silhouette.png'))
        shutil.copyfile(inspection/'orbit-strip.png',review/(part+'-orbit.png'))
        geometry=read(render/'audit.json')
        bundles.append({'assetId':'train-blue-'+part,'revision':revision,'source':relative(dst),'glb':relative(glb),
            'geometry':{'meshObjects':geometry['meshObjects'],'triangles':geometry['triangles']},
            'files':[{'path':relative(p),'sha256':digest(p)} for p in sorted(dst.rglob('*')) if p.is_file()]+[{'path':relative(glb),'sha256':digest(glb)}],
            'nativeAndNovelRenderSha256':{n:digest(render/n) for n in [d+'-render.png' for d in ['east','west','north','south']]+[f'orbit-{k}.png' for k in range(4)]}})
    # Full consist compares the same physical identities under their declared
    # source cameras. Actual fixed gameplay projection is in the motion captures.
    sheet=Image.new('RGBA',(2048,876),'#253139');draw=ImageDraw.Draw(sheet)
    orders={'east':['rear','middle','front'],'west':['front','middle','rear'],
            'north':['front','middle','rear'],'south':['rear','middle','front']}
    for col,(direction,parts) in enumerate(orders.items()):
        for row,kind in enumerate(['source','render']):
            cell=Image.new('RGBA',(480,400))
            crops=[]
            for part in parts:
                recipe=read(source/part/'recipe.json');view=next(v for v in recipe['views'] if v['id']==direction)
                crops.append((part,view,Image.open(Path(str(prefix)+'-'+part+'-render-001')/(direction+'-'+kind+'.png')).convert('RGBA')))
            vertical=direction in ['north','south']
            total=sum(v['rect'][3 if vertical else 2] for _,v,_ in crops)
            cursor=(400-total)//2 if vertical else (480-total)//2
            for _,v,im in crops:
                w,h=v['rect'][2:];ox,oy=v['offset']
                x=(480-w)//2 if vertical else cursor;y=cursor if vertical else (400-h)//2
                cell.alpha_composite(im,(x-ox,y-oy))
                cursor+=h if vertical else w
            x=col*512+16;y=row*430+32
            sheet.alpha_composite(cell,(x,y));draw.text((x,row*430+8),('SPRITE / ' if row==0 else 'BLENDER / ')+direction,fill='white',font=font)
    draw.text((16,858),'Blue train: matched carriage source cameras. Fixed game projection and native joins are shown in motion review.',fill='#b4c4cd',font=font)
    sheet.convert('RGB').save(review/'comparison.png')
    for scenario in ['loop','reversal']:
        names=sorted(p for p in engine.glob(scenario+'-*-sprite.png'))
        sequence=[]
        for name in names:
            a=Image.open(name).convert('RGB');b=Image.open(name.with_name(name.name.replace('-sprite','-mesh'))).convert('RGB')
            frame=Image.new('RGB',(a.width*2,a.height+32),'#253139');frame.paste(a,(0,32));frame.paste(b,(a.width,32))
            d=ImageDraw.Draw(frame);d.text((12,8),'Native sprites',fill='white',font=font);d.text((a.width+12,8),'Authored model · unchanged service spacing',fill='white',font=font)
            sequence.append(frame)
        sequence[0].save(review/(scenario+'.gif'),save_all=True,append_images=sequence[1:],duration=160,loop=0,disposal=2)
    shutil.copyfile(engine/'train-engine.json',source/'motion-validation.json')
    deps=[ROOT/'scripts/authored-assets'/name for name in [
        'author_blue_train.py','build_blue_train.py','blue-train-family.json','retain_blue_train.py',
        'author_emergency_vehicle.py','build_emergency_vehicle.py','pipeline.py','projection_math.py','render.py','project.py','pixel_style.py','pack_draft.py','inspect_vehicle.py','silhouette_report.py','verify_vehicle_body_clearance.py',
        'verify_blue_train.mjs','verify_train_bundles.py']]
    deps += [ROOT/'src/railway/RailwaySource.json',ROOT/'public/assets/tilesets/railway-review-v1.png']
    provenance={'schema':'tilefun-train-authoring-v1','dependencies':[{'path':relative(p),'sha256':digest(p)} for p in deps],
        'liveActivation':'Pending owner moving-art review; main-game train rendering/physics unchanged',
        'limits':['Source side/end lengths differ; matched-camera comparison is not fixed-camera game parity.',
                  'Static couplers have gaps/overlaps on native curved spacing; see moving review.',
                  'Bogies/couplers remain at rest; wheels are inferred under opaque skirts.']}
    write(source/'authoring-provenance.json',provenance)
    identity={'assetId':'blue-train','revision':revision,'sourceFingerprint':read(source/'front/recipe.json')['source']['sha256'],
        'sourceBundles':[{'part':part,'blendSha256':digest(source/part/'car.blend'),'atlasSha256':digest(source/part/'car-atlas.png')} for part in ['rear','middle','front']],
        'files':[{'url':p.relative_to(ROOT/'public').as_posix(),'sha256':digest(p)} for p in [ROOT/b['glb'] for b in bundles]+sorted(review.iterdir())]}
    fingerprint=hashlib.sha256(json.dumps(identity,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    write(review/'review.json',{'schema':'tilefun-authored-train-review-v1','candidateId':'projection:authored-blue-train-'+revision,'candidateFingerprint':fingerprint,'identity':identity,'status':'Awaiting exact moving-art review before live activation','limits':provenance['limits']})
    (review/'index.html').write_bytes(('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blue train · sprite and model review</title>
<style>body{margin:0 auto;padding:24px;max-width:1500px;background:#253139;color:#edf3f5;font:16px/1.5 system-ui}img{width:100%;height:auto;image-rendering:pixelated}a{color:#9bdaff}figure{margin:24px 0}</style>
<h1>Blue train · three authored carriages</h1><p>Original sprites above, matched Blender carriage views below. The moving comparisons use the fixed game projection and existing service spacing.</p>
<figure><img src="comparison.png" alt="Four original train compositions above matched Blender carriage views"></figure>
<h2>Curves and carriage joins</h2><img src="loop.gif" alt="Native train beside authored train travelling around the existing loop">
<h2>Reversal</h2><img src="reversal.gif" alt="Existing service stops and reverses; physical carriage ends retain their identity">
<p>Source side/end lengths differ. Static couplers leave gaps or overlap under existing native spacing, especially near vertical poses. Bogies and couplers remain at rest; all 24 wheels rotate independently under the original skirts. The live game still uses its existing train sprites.</p>
<p><a href="/tilefun/workshop.html?geometry=train-authored-loop&amp;renderer=gpu&amp;meshes#/tool/world-geometry">Interactive curve review</a> · <a href="/tilefun/workshop.html?geometry=train-authored-winding&amp;renderer=gpu&amp;meshes#/tool/world-geometry">Interactive reversal review</a> · <a href="/tilefun/workshop.html?geometry=train-authored-city&amp;renderer=gpu&amp;meshes#/tool/world-geometry">Existing city service with prototype visuals</a></p>
'''+''.join(f'<details><summary>{part.title()} carriage: 4×2, contours and additional angles</summary><img src="{part}-comparison.png" alt="{part} comparison"><img src="{part}-silhouette.png" alt="{part} contours"><img src="{part}-orbit.png" alt="{part} novel angles"><a href="../../blue-{part}-{revision}.glb">Download {part} model</a></details>' for part in ['rear','middle','front'])+'''
<p>Modern Exteriors source artwork by LimeZu. Exact moving-art review remains pending; no production approval is inferred.</p></html>
''').encode())
    write(catalog_path,{'schema':'tilefun-retained-train-bundles-v1','status':'Blue train retained for inspection; live activation awaits moving-art review','bundles':bundles,
        'dependencies':provenance['dependencies'],
        'sharedFiles':[{'path':relative(p),'sha256':digest(p)} for p in sorted(source.iterdir()) if p.is_file()]+[{'path':relative(p),'sha256':digest(p)} for p in sorted(review.iterdir()) if p.is_file()]})
    print('Retained three exact blue carriage bundles:',fingerprint)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ['prefix','engine','clearance']:parser.add_argument('--'+key,type=Path,required=True)
    parser.add_argument('--revision',default='v1');args=parser.parse_args()
    retain(args.prefix.resolve(),args.engine.resolve(),args.clearance.resolve(),args.revision)
