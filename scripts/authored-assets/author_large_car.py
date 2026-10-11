"""Fit three independent large-car families with owned paint and cut wheel floors.

Consumes an explicit family configuration, never treats a silhouette match as
permission to reuse a compact's cameras, geometry or unseen texture.
"""
import argparse
from pathlib import Path
import subprocess

from author_emergency_vehicle import Author, INK
from author_passenger_vehicle import registered_config
from author_garbage_truck import floor, wheels
from pipeline import HERE, ROOT, digest, read, write


def geometry(a):
    b, c = a.config['body'], a.config['cab']
    xa, xb, width = b['front'], b['rear'], b['halfWidth']
    inset = b.get('cornerInset', 6)
    side_front, side_rear, end_width = xa + inset, xb - inset, b['endHalfWidth']
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
    # Rectify glass inside observed apertures instead of projecting hood/roof
    # artwork across them when opposite sprite camera depths disagree.
    for name, key in [('Windshield', 'windshieldPaintCorners'), ('Rear-window', 'rearWindowPaintCorners')]:
        if key not in c:
            continue
        obj = next(obj for obj in a.objects if obj['name'] == name + '-glass')
        region = next(region for region in a.regions if region['region'] == name + '-glass')
        tile = region['rect'][:2]
        obj['uvs'] = [[a.uv(tile, point) for point in c[key]]]
        region['cleanup'] = {'observedGlassCorners': c[key], 'limits': 'Bounded own glass paint; independent source projections disagree.'}
    a.face('Hood', [[xa, -end_width, b['frontEndDeck']], [side_front, -width, b['frontDeck']],
                   [c['screenFront'], -width, front_screen_z], [c['screenFront'], width, front_screen_z],
                   [side_front, width, b['frontDeck']], [xa, end_width, b['frontEndDeck']]], 'south')
    a.face('Trunk', [[c['screenRear'], -width, rear_screen_z], [side_rear, -width, b['rearDeck']],
                    [xb, -end_width, b['rearEndDeck']], [xb, end_width, b['rearEndDeck']],
                    [side_rear, width, b['rearDeck']], [c['screenRear'], width, rear_screen_z]], 'north')
    for name, key, start, end, direction in [
            ('Hood', 'hoodPaintRect', c['screenFront'], xa, -1),
            ('Trunk', 'trunkPaintRect', c['screenRear'], xb, 1)]:
        if key not in c:
            continue
        obj = next(obj for obj in a.objects if obj['name'] == name)
        region = next(region for region in a.regions if region['region'] == name)
        tile = region['rect'][:2]
        x0, y0, x1, y1 = c[key]
        obj['uvs'] = [[a.uv(tile, [min(x1, max(x0, (x0+x1)/2 + direction*v[1])),
                       y0 + (v[0]-start)/(end-start)*(y1-y0)]) for v in obj['vertices']]]
        region['cleanup'] = {'observedPaintRect': c[key], 'limits': 'Bounded own deck paint excludes adjacent glass/fascia.'}
    for owner, sign in a.config['sideOwners'].items():
        # The upper cabin slopes inward. A vertical body side plus a painted
        # roof shoulder hides the side glass from front/back source views.
        a.face(f'Cabin-windows-{owner}', [[c['screenFront'], sign * width, b['belt']],
               [c['screenFront'], sign * width, front_screen_z], [c['front'], sign * rw, roof],
               [c['rear'], sign * rw, roof], [c['screenRear'], sign * width, rear_screen_z],
               [c['screenRear'], sign * width, b['belt']]], owner)
    for name, x, deck, owner in [('Front', xa, b['frontEndDeck'], 'south'), ('Rear', xb, b['rearEndDeck'], 'north')]:
        a.face(name + '-fascia', [[x, -end_width, b['endBase']], [x, end_width, b['endBase']],
               [x, end_width, deck], [x, -end_width, deck]], owner)
        side_x = side_front if name == 'Front' else side_rear
        side_deck = b['frontDeck'] if name == 'Front' else b['rearDeck']
        for sign in [-1, 1]:
            a.face(f'{name}-corner-{sign}', [[x, sign * end_width, b['endBase']],
                   [side_x, sign * width, b['base']], [side_x, sign * width, side_deck],
                   [x, sign * end_width, deck]], next(view for view, side in a.config['sideOwners'].items() if side == sign))
    for name, key, direction in [('Front', 'frontFasciaPaintRect', -1), ('Rear', 'rearFasciaPaintRect', 1)]:
        if key not in c:
            continue
        obj = next(obj for obj in a.objects if obj['name'] == name + '-fascia')
        region = next(region for region in a.regions if region['region'] == name + '-fascia')
        x0, y0, x1, y1 = c[key]
        u0, u1 = (x1, x0) if direction == -1 else (x0, x1)
        obj['uvs'] = [[a.uv(region['rect'][:2], point) for point in [[u0,y1],[u1,y1],[u1,y0],[u0,y0]]]]
        region['cleanup'] = {'observedFasciaRect': c[key], 'limits': 'Own bumper/grille/lights paint; source height differs across projections.'}
    b['front'], b['rear'] = side_front, side_rear
    floor(a)
    b['front'], b['rear'] = xa, xb
    a.face('Underfloor-front-bevel', [[xa, -end_width, b['endBase']], [side_front, -width, b['base']],
           [side_front, width, b['base']], [xa, end_width, b['endBase']]], color=INK)
    a.face('Underfloor-rear-bevel', [[side_rear, -width, b['base']], [xb, -end_width, b['endBase']],
           [xb, end_width, b['endBase']], [side_rear, width, b['base']]], color=INK)
    for sign in [-1, 1]:
        a.box(f'Mirror-{sign}', c['screenFront'], c['screenFront'] + 2,
              sign * b['mirrorOffset'] - .7, sign * b['mirrorOffset'] + .7,
              b['belt'], b['belt'] + 1.5, color=INK)


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
    fit['extraFloorMeshes'] = ['Underfloor-front-bevel', 'Underfloor-rear-bevel']
    fit['status'] = 'Measured source centers and main-floor rest/roll; separately declared tapered ends; steering unqualified'
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
    print('New source-owned large-car family:', vehicle, output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vehicle', required=True)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--blender', type=Path, required=True)
    args = parser.parse_args()
    author(args.vehicle, args.config.resolve(), args.out.resolve(), args.blender.resolve())
