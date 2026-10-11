"""Source-owned police sedan and fire-truck family authoring into fresh workspaces.

Geometry, camera hypotheses, paint ownership and inferred fills are explicit.
Normal builds use retained assets; this offline constructor never promotes art.
"""
import argparse
from collections import deque
import math
from pathlib import Path
import subprocess

from PIL import Image

from pipeline import HERE, ROOT, digest, initialize, read, vehicle_spec, write
from projection_math import project

INK = (58, 58, 80, 255)


class Author:
    def __init__(self, vehicle, output, config):
        self.out, self.config = output, config
        self.recipe = initialize(vehicle_spec(vehicle), output, {'cameras': config['cameras']})
        self.recipe['family'] = config['family']
        self.cell, self.size = config['atlasCell'], config['atlasCell'] * 8
        self.atlas = Image.new('RGBA', (self.size, self.size), INK)
        self.objects, self.regions, self.owners, self.wheels, self.nodes, self.lenses = [], [], {}, [], [], []
        self.positions = {'Body': [0, 0, 0]}
        self.refs = {}
        for view in self.recipe['views']:
            im = Image.new('RGBA', tuple(self.recipe['canvas']))
            im.alpha_composite(Image.open(output / view['source']).convert('RGBA'), tuple(view['offset']))
            queue = deque((x, y) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3] > 200)
            filled = im.copy()
            while queue:
                x, y = queue.popleft()
                for nx, ny in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)]:
                    if 0 <= nx < im.width and 0 <= ny < im.height and filled.getpixel((nx, ny))[3] == 0:
                        filled.putpixel((nx, ny), filled.getpixel((x, y)))
                        queue.append((nx, ny))
            self.refs[view['id']] = filled

    def tile(self, name, owner, color=None):
        index = len(self.regions)
        if index >= 64:
            raise ValueError('Atlas capacity exceeded; revise the declared island layout.')
        x, y = (index % 8)*self.cell, (index // 8)*self.cell
        if owner:
            self.atlas.paste(self.refs[owner], (x, y))
        if color:
            self.atlas.paste(tuple(color), (x, y, x+self.cell, y+self.cell))
        self.regions.append({'region': name, 'rect': [x, y, x+self.cell, y+self.cell], 'owner': owner,
                             'inferred': 'Nearest opaque edge outside observations; solid hidden faces and palette transfers are authored.'})
        self.owners[name] = [owner] if owner else []
        return x, y

    def uv(self, tile, pixel):
        return [(tile[0]+min(self.cell-1, max(0, pixel[0])))/self.size,
                1-(tile[1]+min(self.cell-1, max(0, pixel[1])))/self.size]

    def mesh(self, name, verts, faces, owner=None, color=None, parent='Body', extras=None):
        tile = self.tile(name, owner, color)
        pixels = [project(v, self.config['cameras'][owner]) if owner else [self.cell/2, self.cell/2] for v in verts]
        origin = self.positions[parent]
        self.objects.append({'name': name, 'region': name,
                             'vertices': [[v[k]-origin[k] for k in range(3)] for v in verts], 'faces': faces,
                             'uvs': [[self.uv(tile, pixels[i]) for i in face] for face in faces],
                             'parent': parent, 'extras': extras or {}})

    def face(self, name, verts, owner=None, color=None, parent='Body'):
        self.mesh(name, verts, [list(range(len(verts)))], owner, color, parent)

    def box(self, name, xa, xb, ya, yb, za, zb, owner_top='north', color=None, parent='Body'):
        # One mesh, owned face islands; solid primitives need only one island.
        verts = [[x, y, z] for z in [za, zb] for y in [ya, yb] for x in [xa, xb]]
        faces = [[4, 5, 7, 6], [0, 2, 3, 1], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]
        if color:
            self.mesh(name, verts, faces, color=color, parent=parent)
        else:
            by_sign = {sign: view for view, sign in self.config['sideOwners'].items()}
            owners = [owner_top, None, by_sign[-1], by_sign[1], 'south', 'north']
            for k, (face, owner) in enumerate(zip(faces, owners)):
                self.face(f'{name}-{k}', [verts[i] for i in face], owner, None if owner else INK, parent)

    def side(self, name, xa, xb, top, width, axles):
        w, b = self.config['wheels'], self.config['body']
        arc = w['radius'] + .6
        profile = [(xa, b['base'])] + top + [(xb, b['base'])]
        for axle in sorted(axles, reverse=True):
            profile.append((axle+arc, b['base']))
            profile += [(axle+arc*math.cos(k*math.pi/20), w['radius']+arc*math.sin(k*math.pi/20)) for k in range(21)]
            profile.append((axle-arc, b['base']))
        for owner, sign in self.config['sideOwners'].items():
            self.face(f'{name}-{owner}', [[x, sign*width, z] for x, z in profile], owner)
            for axle in axles:
                vertices = [[axle+r*math.cos(k*math.pi/20), sign*(width+.1), w['radius']+r*math.sin(k*math.pi/20)]
                            for r in [arc-.1, arc+.35] for k in range(21)]
                self.mesh(f'Fender-{axle}-{owner}', vertices, [[k, k+1, k+22, k+21] for k in range(20)], owner)

    def glass(self, name, corners, owner):
        # Geometric ink bands partition the aperture, keeping corner paint off glass.
        a, b, c, d = corners
        def point(u, v):
            return [a[k]*(1-u)*(1-v)+b[k]*u*(1-v)+c[k]*u*v+d[k]*(1-u)*v for k in range(3)]
        u, v = .035, .075
        inner = [point(u, v), point(1-u, v), point(1-u, 1-v), point(u, 1-v)]
        self.face(f'{name}-glass', inner, owner)
        vertices = corners + inner
        self.mesh(f'{name}-frame', vertices, [[k, (k+1)%4, (k+1)%4+4, k+4] for k in range(4)], color=INK)

    def light(self, name, center, radius, height, color, phase, shape='beacon', halfwidth=0):
        x, y, z = center
        extras = {'tilefun_effect_schema': 1, 'tilefun_role': 'emergency-light', 'tilefun_channel': 'emergencyLights',
                  'tilefun_group': name, 'tilefun_phase': phase}
        if shape == 'beacon':
            vertices = [[x+r*math.cos(k*math.tau/12), y+r*math.sin(k*math.tau/12), z+h]
                        for h, r in [(0, radius), (height*.7, radius*.9), (height, radius*.5)] for k in range(12)]
            faces = [[j*12+k, j*12+(k+1)%12, (j+1)*12+(k+1)%12, (j+1)*12+k] for j in range(2) for k in range(12)]
            faces += [list(range(12)), list(range(24, 36))]
            self.box(f'{name}-base', x-radius-.3, x+radius+.3, y-radius-.3, y+radius+.3, z-.6, z, color=INK)
        else:
            vertices = [[x+dx, y+dy, z+dz] for dz in [0, height] for dy in [-halfwidth, halfwidth] for dx in [-radius, radius]]
            faces = [[4, 5, 7, 6], [0, 2, 3, 1], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]
            self.box(f'{name}-base', x-radius-.3, x+radius+.3, y-halfwidth-.3, y+halfwidth+.3, z-.6, z, color=INK)
        self.mesh(f'{name}-lens', vertices, faces, color=color, extras=extras)
        self.lenses.append({'node': f'{name}-lens', 'group': name, 'phase': phase})

    def wheel_rig(self):
        w = self.config['wheels']
        by_sign = {sign: view for view, sign in self.config['sideOwners'].items()}
        for prefix, axle in [('F', w['frontAxle']), ('R', w['rearAxle'])]:
            for side, suffix in [(-1, 'L'), (1, 'R')]:
                ident, center = prefix+suffix, [axle, side*w['halfWidthCenter'], w['radius']]
                roll = f'Wheel_{ident}_Roll'
                self.positions[roll] = center
                self.wheels.append({'id': ident, 'center': center, 'radius': w['radius'], 'steering': prefix == 'F',
                                    'steer': f'Wheel_{ident}_Steer', 'roll': roll})
                for part, r, depth in [('Tire', w['radius'], w['tireWidth']/2), ('Hub', w['hubRadius'], .2)]:
                    offset = 0 if part == 'Tire' else side*(w['tireWidth']/2+.25)
                    vertices = [[axle+r*math.cos(k*math.tau/24), center[1]+offset+d, center[2]+r*math.sin(k*math.tau/24)]
                                for d in [-depth, depth] for k in range(24)]
                    faces = [[k, (k+1)%24, (k+1)%24+24, k+24] for k in range(24)] + [list(range(24)), list(range(24, 48))]
                    self.mesh(f'{part}_{ident}', vertices, faces, by_sign[side], parent=roll)

    def finish(self):
        material = f'{self.recipe["assetId"]} palette · cleaned UV atlas'
        self.atlas.save(self.out / 'car-atlas.png')
        write(self.out / 'mesh-spec.json', {'assetId': self.recipe['assetId'], 'material': material,
                                           'objects': self.objects, 'wheels': self.wheels, 'nodes': self.nodes})
        write(self.out / 'family-config.json', self.config)
        write(self.out / 'paint-ownership.json', {'regions': self.regions, 'decisions': self.config['notes'],
                                                 'limits': 'Affine owned UV paint is cleaned authoring, not ray-visible recovery. Own projection/coverage remains separate.'})
        write(self.out / 'rig.json', {'root': 'CarRoot', 'body': 'Body', 'units': 'world pixels', 'forward': [-1, 0, 0],
                                    'up': [0, 0, 1], 'rollAxisBlender': [0, 1, 0], 'rollAxisGltf': [0, 0, -1],
                                    'drivingRule': 'angle=-signedForwardDistance/radius; forward is -X',
                                    'wheels': self.wheels, 'steeringClearance': 'unqualified', 'equipmentNodes': self.nodes})
        write(self.out / 'lights.json', {'schema': 'tilefun-vehicle-lights-v1', 'channel': 'emergencyLights',
                                       'periodSeconds': 1, 'pulseWindows': [[0, .12], [.2, .32]], 'peakGain': 4,
                                       'lenses': self.lenses, 'fixedHousings': 'Untagged separate base meshes; no rotations required'})
        self.recipe.update({'workingBlend': 'car.blend', 'projection': {'atlasSize': self.size, 'material': material,
                            'textureNode': 'Clean atlas', 'sourceViews': self.owners},
                            'pixelStyle': {'outline': 'inner', 'outlineColor': list(INK[:3]), 'logicalPixelWidth': 1}})
        write(self.out / 'recipe.json', self.recipe)


def police(a):
    b, c, w = a.config['body'], a.config['cab'], a.config['wheels']
    xa, xb, width = b['front'], b['rear'], b['halfWidth']
    side_front, side_rear, end_width = xa+4, xb-4, 8
    a.side('Sedan', side_front, side_rear, [(side_front, 14), (c['screenFront'], 15), (c['front'], 29), (c['rear'], 29),
                                         (c['screenRear'], 15), (side_rear, 13)], width, [w['frontAxle'], w['rearAxle']])
    roof, rw = c['roof'], c['halfWidth']
    a.face('Roof', [[c['front'], -rw, roof], [c['rear'], -rw, roof], [c['rear'], rw, roof], [c['front'], rw, roof]], 'north')
    # The observed bar belongs to lens geometry. Its hidden roof footprint is an
    # authored fill, preventing a second painted bar beneath the actual meshes.
    tile = a.regions[-1]['rect']
    offset = next(v['offset'] for v in a.recipe['views'] if v['id'] == 'north')
    a.atlas.paste((112, 111, 136, 255), (tile[0]+offset[0]+6, tile[1]+21, tile[0]+offset[0]+26, tile[1]+30))
    a.regions[-1]['cleanup'] = 'Bar footprint [6,21,20,9] filled with inferred roof palette; actual lenses own lamp paint.'
    a.glass('Windshield', [[c['front'], -rw, roof], [c['front'], rw, roof],
                         [c['screenFront'], width, 15], [c['screenFront'], -width, 15]], 'south')
    a.glass('Rear-window', [[c['rear'], rw, roof], [c['rear'], -rw, roof],
                          [c['screenRear'], -width, 15], [c['screenRear'], width, 15]], 'north')
    a.face('Hood', [[xa, -end_width, 14], [side_front, -width, 14], [c['screenFront'], -width, 15],
                   [c['screenFront'], width, 15], [side_front, width, 14], [xa, end_width, 14]], 'south')
    a.face('Trunk', [[c['screenRear'], -width, 15], [side_rear, -width, 13], [xb, -end_width, 13],
                    [xb, end_width, 13], [side_rear, width, 13], [c['screenRear'], width, 15]], 'north')
    for owner, side in a.config['sideOwners'].items():
        a.face(f'Roof-shoulder-{owner}', [[c['front'], side*rw, roof], [c['rear'], side*rw, roof],
                                       [c['rear'], side*width, 29], [c['front'], side*width, 29]], color=(112, 111, 136, 255))
    for name, x, top, owner in [('Front', xa, 14, 'south'), ('Rear', xb, 13, 'north')]:
        a.face(f'{name}-fascia', [[x, -end_width, b['base']], [x, end_width, b['base']], [x, end_width, top], [x, -end_width, top]], owner)
        side_x = side_front if name == 'Front' else side_rear
        for side in [-1, 1]:
            a.face(f'{name}-corner-{side}', [[x, side*end_width, b['base']], [side_x, side*width, b['base']],
                                          [side_x, side*width, top], [x, side*end_width, top]], owner)
    a.face('Underfloor', [[xa, -end_width, b['base']], [side_front, -width, b['base']],
                         [side_rear, -width, b['base']], [xb, -end_width, b['base']],
                         [xb, end_width, b['base']], [side_rear, width, b['base']],
                         [side_front, width, b['base']], [xa, end_width, b['base']]], color=INK)
    a.box('Lightbar-housing', -2.6, 2.6, -9, 9, roof, roof+.6, color=INK)
    a.light('Police-blue', [0, -7, roof+.6], 2.3, 4, (73, 165, 239, 255), 0)
    a.light('Police-red', [0, 7, roof+.6], 2.3, 4, (246, 76, 78, 255), .5)
    for side in [-1, 1]:
        a.box(f'Mirror-{side}', -21, -18, side*15-1, side*15+1, 15, 17, color=INK)


def fire(a):
    b, c, box, p, w, ladder = [a.config[key] for key in ['body', 'cab', 'box', 'pump', 'wheels', 'ladder']]
    a.side('Cab', b['front'], c['rear'], [(b['front'], 47), (c['rear'], c['roof'])], c['halfWidth'], [w['frontAxle']])
    a.side('Compartments', box['front'], box['rear'], [(box['front'], box['sideTop']), (box['rear'], box['sideTop'])], box['halfWidth'], [w['rearAxle']])
    for owner, sign in a.config['sideOwners'].items():
        a.face(f'Roof-shoulder-{owner}', [[box['front'], sign*box['halfWidth'], box['sideTop']],
                                       [box['rear'], sign*box['halfWidth'], box['sideTop']],
                                       [box['rear'], sign*box['roofHalfWidth'], box['roof']],
                                       [box['front'], sign*box['roofHalfWidth'], box['roof']]], owner)
    bw = box['roofHalfWidth']
    a.face('Compartment-roof', [[box['front'], -bw, box['roof']], [box['rear'], -bw, box['roof']],
                              [box['rear'], bw, box['roof']], [box['front'], bw, box['roof']]], 'north')
    tile = a.regions[-1]['rect']
    ox = next(v['offset'][0] for v in a.recipe['views'] if v['id'] == 'north')
    a.atlas.paste((80, 80, 102, 255), (tile[0]+ox+24, tile[1]+70, tile[0]+ox+40, tile[1]+146))
    a.regions[-1]['cleanup'] = 'Hidden central ladder footprint filled; separate hinge geometry owns ladder paint.'
    a.box('Pump-platform', p['front'], p['rear'], -p['halfWidth'], p['halfWidth'], b['base'], p['roof'])
    cw = c['halfWidth']
    a.face('Cab-roof', [[c['front'], -cw, 47], [c['rear'], -cw, c['roof']],
                       [c['rear'], cw, c['roof']], [c['front'], cw, 47]], 'north')
    a.glass('Windshield', [[c['front'], -cw, c['screenTop']], [c['front'], cw, c['screenTop']],
                         [b['front'], cw, c['screenBottom']], [b['front'], -cw, c['screenBottom']]], 'south')
    a.face('Front-fascia', [[b['front'], -cw, 5], [b['front'], cw, 5],
                          [b['front'], cw, c['screenBottom']], [b['front'], -cw, c['screenBottom']]], 'south')
    a.face('Rear-equipment', [[box['rear'], -box['halfWidth'], 5], [box['rear'], box['halfWidth'], 5],
                            [box['rear'], bw, box['roof']], [box['rear'], -bw, box['roof']]], 'north')
    a.face('Underfloor', [[b['front'], -cw, b['base']], [box['rear'], -cw, b['base']],
                         [box['rear'], cw, b['base']], [b['front'], cw, b['base']]], color=INK)
    pivot = ladder['pivot']
    a.positions['Ladder_Hinge'] = pivot
    a.nodes.append({'name': 'Ladder_Hinge', 'parent': 'Body', 'location': pivot,
                    'extras': {'tilefun_component': 'ladder', 'hinge_axis_blender': [0, 1, 0],
                               'hinge_axis_gltf': [0, 0, -1], 'clearance_status': 'unqualified'}})
    lx, ly, lz = pivot
    radius = ladder['railHalfHeight']
    for side in [-1, 1]:
        y = side*ladder['halfWidth']
        a.box(f'Ladder-rail-{side}', lx-ladder['length'], lx, y-.65, y+.65, lz-radius, lz+radius,
              parent='Ladder_Hinge')
    vertices, faces = [], []
    for n in range(1, int(ladder['length']/ladder['rungSpacing'])):
        x = lx-n*ladder['rungSpacing']
        start = len(vertices)
        vertices += [[xx, y, z] for z in [lz-.8, lz+.8] for y in [-ladder['halfWidth'], ladder['halfWidth']] for xx in [x-.6, x+.6]]
        faces += [[start+i for i in face] for face in [[4, 5, 7, 6], [0, 2, 3, 1], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]]
    a.mesh('Ladder-rungs', vertices, faces, color=(181, 178, 204, 255), parent='Ladder_Hinge')
    a.box('Ladder-mount', 56, 65, -9, 9, box['roof'], lz-1.7, color=(80, 80, 102, 255))
    # Cab roof is sloped; both bars sit on its front half, with fixed dark bases.
    for sign, phase in [(-1, 0), (1, .5)]:
        a.light(f'Fire-blue-{sign}', [-58, sign*11, 49.3], 1.5, 1.9, (78, 172, 222, 255), phase, 'bar', 5.5)


def author(vehicle, out, blender, config_path):
    configs = read(config_path)
    if configs['schema'] != 'tilefun-emergency-families-v1' or vehicle not in configs['vehicles']:
        raise ValueError('Choose a supported emergency family with explicit fitting data.')
    a = Author(vehicle, out, configs['vehicles'][vehicle])
    (police if vehicle == 'police-car' else fire)(a)
    a.wheel_rig()
    a.finish()
    with (out / 'build.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(blender), '--background', '--factory-startup', '--python-exit-code', '1',
                        '--python', str(HERE / 'build_emergency_vehicle.py'), '--', str(out)],
                       check=True, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    recipe = read(out / 'recipe.json')
    recipe['template'] = {'path': str((out / 'car.blend').relative_to(ROOT)), 'sha256': digest(out / 'car.blend')}
    write(out / 'recipe.json', recipe)
    print(f'New source-owned emergency vehicle: {out}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vehicle', required=True, choices=['police-car', 'fire-truck-ladder-1'])
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--blender', type=Path, required=True)
    parser.add_argument('--config', type=Path, default=HERE / 'emergency-families.json')
    args = parser.parse_args()
    author(args.vehicle, args.out.resolve(), args.blender.resolve(), args.config.resolve())
