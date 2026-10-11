"""Fit independent passenger-car families with owned paint and cut wheel floors.

Consumes an explicit family configuration, never treats a silhouette match as
permission to reuse a compact's cameras, geometry or unseen texture.
"""
import argparse
import copy
import hashlib
from pathlib import Path
import subprocess

from PIL import Image

from author_emergency_vehicle import Author, INK
from author_garbage_truck import floor, wheels
from pipeline import HERE, ROOT, digest, read, vehicle_spec, write


def geometry(a):
    b, c = a.config['body'], a.config['cab']
    xa, xb, width = b['front'], b['rear'], b['halfWidth']
    side_front, side_rear, end_width = xa + 6, xb - 6, b['endHalfWidth']
    top = [(side_front, b['frontDeck']), (c['screenFront'], b['belt']),
           (c['front'], b['belt']), (c['rear'], b['belt']),
           (c['screenRear'], b['belt']), (side_rear, b['rearDeck'])]
    a.config['wheels'] = {'radius': a.config['axles'][0]['radius']}
    a.side('Passenger-body', side_front, side_rear, top, width, [axle['x'] for axle in a.config['axles']])
    roof, rw = c['roof'], c['halfWidth']
    front_screen_z, rear_screen_z = c['frontScreenBase'], c['rearScreenBase']
    a.face('Roof', [[c['front'], -rw, roof], [c['rear'], -rw, roof],
                    [c['rear'], rw, roof], [c['front'], rw, roof]], 'north')
    # UV rectangle is an observed roof-only region, avoiding rear-window leakage.
    obj, region = a.objects[-1], a.regions[-1]
    tile = region['rect'][:2]
    x0, y0, x1, y1 = c['roofPaintRect']
    for face in obj['faces']:
        obj['uvs'] = [[a.uv(tile, [x0 + (v[1] + rw) / (2 * rw) * (x1 - x0),
                                  y0 + (v[0] - c['front']) / (c['rear'] - c['front']) * (y1 - y0)])
                      for v in obj['vertices']]]
    region['cleanup'] = 'Observed roof rectangle excludes windshield/rear-glass pixels.'
    a.glass('Windshield', [[c['front'], -rw, roof], [c['front'], rw, roof],
                          [c['screenFront'], width, front_screen_z], [c['screenFront'], -width, front_screen_z]], 'south')
    a.glass('Rear-window', [[c['rear'], rw, roof], [c['rear'], -rw, roof],
                           [c['screenRear'], -width, rear_screen_z], [c['screenRear'], width, rear_screen_z]], 'north')
    a.face('Hood', [[xa, -end_width, b['frontEndDeck']], [side_front, -width, b['frontDeck']],
                   [c['screenFront'], -width, front_screen_z], [c['screenFront'], width, front_screen_z],
                   [side_front, width, b['frontDeck']], [xa, end_width, b['frontEndDeck']]], 'south')
    a.face('Trunk', [[c['screenRear'], -width, rear_screen_z], [side_rear, -width, b['rearDeck']],
                    [xb, -end_width, b['rearEndDeck']], [xb, end_width, b['rearEndDeck']],
                    [side_rear, width, b['rearDeck']], [c['screenRear'], width, rear_screen_z]], 'north')
    for owner, sign in a.config['sideOwners'].items():
        # The upper cabin slopes inward. A vertical body side plus a painted
        # roof shoulder hides the side glass from front/back source views.
        a.face(f'Cabin-windows-{owner}', [[c['screenFront'], sign * width, b['belt']],
               [c['screenFront'], sign * width, front_screen_z], [c['front'], sign * rw, roof],
               [c['rear'], sign * rw, roof], [c['screenRear'], sign * width, rear_screen_z],
               [c['screenRear'], sign * width, b['belt']]], owner)
    for name, x, deck, owner in [('Front', xa, b['frontEndDeck'], 'south'), ('Rear', xb, b['rearEndDeck'], 'north')]:
        a.face(name + '-fascia', [[x, -end_width, b['base']], [x, end_width, b['base']],
               [x, end_width, deck], [x, -end_width, deck]], owner)
        side_x = side_front if name == 'Front' else side_rear
        side_deck = b['frontDeck'] if name == 'Front' else b['rearDeck']
        for sign in [-1, 1]:
            a.face(f'{name}-corner-{sign}', [[x, sign * end_width, b['base']],
                   [side_x, sign * width, b['base']], [side_x, sign * width, side_deck],
                   [x, sign * end_width, deck]], owner)
    floor(a)
    for sign in [-1, 1]:
        a.box(f'Mirror-{sign}', c['screenFront'], c['screenFront'] + 2,
              sign * b['mirrorOffset'] - .7, sign * b['mirrorOffset'] + .7,
              b['belt'], b['belt'] + 1.5, color=INK)


def registered_config(vehicle, config):
    """Validate whole-family shape and retain each crop's explicit registration.

    This gate confirms the fitted family's four observed contours. It does not
    claim that silhouette equality alone recovers hidden geometry or UV paint.
    """
    config = copy.deepcopy(config)
    seed = vehicle_spec(config['seed'])
    target = vehicle_spec(vehicle)
    atlas = Image.open(ROOT / seed['source']['image']).convert('RGBA')
    observations = []
    for base, variant in zip(seed['views'], target['views']):
        def shape(view):
            x, y, w, h = view['rect']
            crop = atlas.crop((x, y, x+w, y+h))
            alpha = crop.getchannel('A')
            bounds = alpha.getbbox()
            if bounds is None:
                raise ValueError('Empty vehicle reference')
            canvas = [max(v['rect'][2] for v in target['views']),
                      max(v['rect'][3] for v in target['views'])]
            offset = [(canvas[0]-w)//2, (canvas[1]-h)//2]
            return alpha.crop(bounds), bounds, offset, hashlib.sha256(crop.tobytes()).hexdigest()
        a, bounds_a, offset_a, hash_a = shape(base)
        b, bounds_b, offset_b, hash_b = shape(variant)
        if a.size != b.size or a.tobytes() != b.tobytes():
            raise ValueError(f'{vehicle} {base["id"]}: source shape outside fitted family')
        delta = [bounds_b[k]+offset_b[k]-bounds_a[k]-offset_a[k] for k in range(2)]
        camera = config['cameras'][base['id']]
        camera['origin'] = [camera['origin'][k]+delta[k] for k in range(2)]
        if base['id'] in ['east', 'west']:
            for axle in config['axles']:
                axle['centers'][base['id']] = [axle['centers'][base['id']][k]+bounds_b[k]-bounds_a[k] for k in range(2)]
        observations.append({'view':base['id'], 'seedRect':base['rect'], 'targetRect':variant['rect'],
                             'seedRgbaSha256':hash_a, 'targetRgbaSha256':hash_b,
                             'canvasOriginDelta':delta, 'normalizedAlpha':'exact'})
    config['sourceRegistration'] = {'seed':config['seed'], 'vehicle':vehicle, 'observations':observations,
                                    'paint':'Every UV owner samples this vehicle, including local paint exceptions.'}
    return config


def author(vehicle, config_path, output, blender):
    if output.exists():
        raise FileExistsError('Choose a fresh workspace')
    config = read(config_path)
    if vehicle not in config['vehicles']:
        raise ValueError('Vehicle outside declared family')
    config = registered_config(vehicle, config)
    a = Author(vehicle, output, config)
    geometry(a)
    fit = wheels(a)
    a.finish()
    rig = read(output / 'rig.json')
    rig['wheelWellFit'] = fit
    write(output / 'rig.json', rig)
    write(output / 'wheel-alignment.json', fit)
    with (output / 'build.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(blender), '--background', '--factory-startup', '--python-exit-code', '1',
                        '--python', str(HERE / 'build_emergency_vehicle.py'), '--', str(output)],
                       check=True, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    recipe = read(output / 'recipe.json')
    recipe['template'] = {'path': str(output / 'car.blend'), 'sha256': digest(output / 'car.blend')}
    write(output / 'recipe.json', recipe)
    print('New source-owned passenger family:', vehicle, output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vehicle', required=True)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--blender', type=Path, required=True)
    args = parser.parse_args()
    author(args.vehicle, args.config.resolve(), args.out.resolve(), args.blender.resolve())
