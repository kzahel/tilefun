"""Refit fire-truck axles, wheel cap paint and floor openings in a fresh workspace."""
import argparse
import math
from pathlib import Path
import subprocess

from author_emergency_vehicle import Author, INK, fire
from pipeline import HERE, ROOT, digest, read, write
from projection_math import project


def cut_floor(author, fit):
    """Retain one body-static floor mesh with four real tire openings."""
    config = author.config
    wheel, body = config['wheels'], config['body']
    r = wheel['radius'] + fit['floorMargin']
    xs = [body['front'], wheel['frontAxle']-r, wheel['frontAxle']+r,
          wheel['rearAxle']-r, wheel['rearAxle']+r, body['rear']]
    inner = wheel['halfWidthCenter']-wheel['tireWidth']/2-fit['floorMargin']
    ys = [-body['halfWidth'], -inner, inner, body['halfWidth']]
    vertices, faces = [], []
    for i, (xa, xb) in enumerate(zip(xs, xs[1:])):
        for j, (ya, yb) in enumerate(zip(ys, ys[1:])):
            if i in [1, 3] and j in [0, 2]:
                continue
            start = len(vertices)
            vertices.extend([[xa, ya, body['base']], [xb, ya, body['base']],
                             [xb, yb, body['base']], [xa, yb, body['base']]])
            faces.append(list(range(start, start+4)))
    floor = next(o for o in author.objects if o['name'] == 'Underfloor')
    floor.update({'vertices': vertices, 'faces': faces,
                  'uvs': [[floor['uvs'][0][0]]*4 for face in faces]})


def clean_wheel_paint(author, fit):
    wheel_records = {w['roll']: w for w in author.wheels}
    regions = {r['region']: r for r in author.regions}
    by_sign = {sign: view for view, sign in author.config['sideOwners'].items()}
    for obj in author.objects:
        if obj['parent'] not in wheel_records:
            continue
        wheel = wheel_records[obj['parent']]
        sign = -1 if wheel['id'].endswith('L') else 1
        view = by_sign[sign]
        part = obj['name'].split('_')[0]
        front = 'front' if wheel['steering'] else 'rear'
        crop_center = fit['observedCaps'][view][front]
        offset = next(v['offset'] for v in author.recipe['views'] if v['id'] == view)
        center = [crop_center[k]+offset[k] for k in range(2)]
        if part == 'Hub':
            center = [center[k]+fit['hubPaintOffset'][k] for k in range(2)]
        radius = author.config['wheels']['radius' if part == 'Tire' else 'hubRadius']
        paint_x, paint_y = fit['capPaintRadii'][part]
        tile = regions[obj['region']]['rect'][:2]
        color = INK if part == 'Tire' else (108, 110, 133, 255)
        author.atlas.paste(color, (tile[0]+160, tile[1]+164, tile[0]+188, tile[1]+188))
        # The outer cap owns its source wheel. Tread and unseen inner cap use
        # explicit palette paint; they must not inherit fenders or body stripes.
        coords = []
        for face in obj['faces']:
            outer = len(face) == 24 and (face[0] >= 24) == (sign == 1)
            if outer:
                coords.append([author.uv(tile, [center[0]+obj['vertices'][i][0]/radius*paint_x,
                                               center[1]-obj['vertices'][i][2]/radius*paint_y]) for i in face])
            else:
                coords.append([author.uv(tile, [174, 176]) for i in face])
        obj['uvs'] = coords
        regions[obj['region']]['cleanup'] = {'outerCapCropCenter': center,
            'outerCapPaintRadii': [paint_x, paint_y],
            'treadAndInnerCap': 'Explicit source palette fill; unobserved inner face'}


def alignment(author, fit):
    observations = []
    for wheel in author.wheels:
        sign = -1 if wheel['id'].endswith('L') else 1
        view = next(view for view, value in author.config['sideOwners'].items() if value == sign)
        center = list(wheel['center'])
        center[1] += sign*author.config['wheels']['tireWidth']/2
        rendered = project(center, author.config['cameras'][view])
        offset = next(v['offset'] for v in author.recipe['views'] if v['id'] == view)
        measured = fit['observedCaps'][view]['front' if wheel['steering'] else 'rear']
        expected = [measured[k]+offset[k] for k in range(2)]
        error = math.dist(rendered, expected)
        if error > fit['maxCenterErrorPixels']:
            raise ValueError(f"{wheel['id']} misses its source wheel well by {error:.2f} pixels")
        observations.append({'wheel': wheel['id'], 'view': view,
                             'camera': author.config['cameras'][view],
                             'projectedOuterCapCenter': rendered,
                             'sourceCenter': expected, 'errorPixels': error})
    return {'schema': 'tilefun-wheel-well-fit-v1', 'observations': observations,
            'maxCenterErrorPixels': fit['maxCenterErrorPixels'],
            'floorMesh': 'Underfloor', 'floorMargin': fit['floorMargin'],
            'status': 'Rest/roll alignment; steering clearance unqualified'}


def refine(out, blender, fit_path):
    fit = read(fit_path)
    base = ROOT / fit['baseSource']
    if fit['schema'] != 'tilefun-fire-wheel-fit-v1' or digest(base/'car.blend') != fit['baseSceneSha256']:
        raise ValueError('Retained fire-truck source changed')
    config = read(base/'family-config.json')
    config['wheels'] = fit['wheels']
    config['notes'] += fit['notes']
    author = Author('fire-truck-ladder-1', out, config)
    fire(author)
    cut_floor(author, fit)
    author.wheel_rig()
    clean_wheel_paint(author, fit)
    report = alignment(author, fit)
    author.finish()
    rig = read(out/'rig.json')
    rig['wheelWellFit'] = report
    write(out/'rig.json', rig)
    write(out/'wheel-fit.json', fit)
    write(out/'wheel-alignment.json', report)
    # Body detail, roof, ladder and emergency-light geometry must stay exact.
    before = {o['name']: o for o in read(base/'mesh-spec.json')['objects']}
    after = {o['name']: o for o in author.objects}
    changed = []
    for name, obj in before.items():
        mutable = name.startswith(('Tire_', 'Hub_', 'Fender-')) or name in ['Cab-east', 'Cab-west',
                    'Compartments-east', 'Compartments-west', 'Underfloor']
        if not mutable and after.get(name) != obj:
            raise ValueError(f'Wheel-only revision changed fixed component: {name}')
        if after.get(name) != obj:
            changed.append(name)
    write(out/'revision-audit.json', {'baseSource': fit['baseSource'], 'baseSceneSha256': fit['baseSceneSha256'],
                                    'changedComponents': changed,
                                    'fixedBodyRoofLadderLights': 'Exact mesh records preserved'})
    with (out/'build.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(blender), '--background', '--factory-startup', '--python-exit-code', '1',
                        '--python', str(HERE/'build_emergency_vehicle.py'), '--', str(out)],
                       check=True, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    recipe = read(out/'recipe.json')
    recipe['template'] = {'path': (out/'car.blend').relative_to(ROOT).as_posix(),
                          'sha256': digest(out/'car.blend')}
    write(out/'recipe.json', recipe)
    print('Revised fire wheel/arch fit and floor openings:', out)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--blender', type=Path, required=True)
    parser.add_argument('--fit', type=Path, default=HERE/'fire-wheel-fit.json')
    args = parser.parse_args()
    refine(args.out.resolve(), args.blender.resolve(), args.fit.resolve())
