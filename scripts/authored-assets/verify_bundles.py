"""Verify retained model bytes, portable source inputs and embedded GLB textures."""
import argparse
from io import BytesIO
import json
from pathlib import Path
import struct

from PIL import Image

from pipeline import ROOT, digest, read


def local(root, value):
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f'Bundle path leaves the checkout: {value}')
    return path


def glb_content(path, atlas, expected=None, rig=None, lights=None):
    blob = path.read_bytes()
    magic, version, size = struct.unpack_from('<III', blob)
    if (magic, version, size) != (0x46546C67, 2, len(blob)):
        raise ValueError(f'Invalid self-contained GLB: {path}')
    json_size, kind = struct.unpack_from('<II', blob, 12)
    if kind != 0x4E4F534A:
        raise ValueError('Missing GLB JSON chunk')
    model = json.loads(blob[20:20 + json_size])
    offset = 20 + json_size
    binary_size, kind = struct.unpack_from('<II', blob, offset)
    if kind != 0x004E4942 or offset + 8 + binary_size != len(blob):
        raise ValueError('Missing or truncated GLB binary chunk')
    binary = blob[offset + 8:]
    if any('uri' in buffer for buffer in model['buffers']):
        raise ValueError('GLB needs external buffers')
    if len(model['images']) != 1 or 'bufferView' not in model['images'][0]:
        raise ValueError('GLB texture is not embedded')
    view = model['bufferViews'][model['images'][0]['bufferView']]
    start = view.get('byteOffset', 0)
    with Image.open(BytesIO(binary[start:start + view['byteLength']])) as embedded, Image.open(atlas) as expected_image:
        embedded, expected_image = embedded.convert('RGBA'), expected_image.convert('RGBA')
        if embedded.size != expected_image.size or embedded.tobytes() != expected_image.tobytes():
            raise ValueError('Embedded GLB texture differs from retained atlas')
    triangles = sum(model['accessors'][p['indices']]['count'] // 3
                    for mesh in model['meshes'] for p in mesh['primitives'])
    expected = expected or {'meshObjects': 55, 'triangles': 842}
    if len(model['meshes']) != expected['meshObjects'] or triangles != expected['triangles']:
        raise ValueError('Retained geometry differs from its recorded audit')
    nodes = {node['name']: i for i, node in enumerate(model['nodes']) if 'name' in node}
    car, body = nodes['CarRoot'], nodes['Body']
    if body not in model['nodes'][car]['children']:
        raise ValueError('Body is detached from CarRoot')
    wheels = {w['id']: w for w in rig['wheels']} if rig else {}
    for wheel in ['FL', 'FR', 'RL', 'RR']:
        steer, roll = nodes[f'Wheel_{wheel}_Steer'], nodes[f'Wheel_{wheel}_Roll']
        pivot = model['nodes'][roll]
        if (steer not in model['nodes'][car]['children'] or
                roll not in model['nodes'][steer]['children'] or len(pivot['children']) != 2):
            raise ValueError(f'Wheel hierarchy changed: {wheel}')
        expected_wheel = wheels.get(wheel, {'radius': 4.1, 'rollAxisGltf': [0, 0, -1]})
        axis = expected_wheel.get('rollAxisGltf', rig.get('rollAxisGltf') if rig else [0, 0, -1])
        if pivot['extras']['wheel_radius'] != expected_wheel['radius'] or pivot['extras']['roll_axis_gltf'] != axis:
            raise ValueError(f'Wheel radius/axis changed: {wheel}')
    if lights:
        tagged = {node['name']:node for node in model['nodes']
                  if node.get('extras', {}).get('tilefun_role') == 'emergency-light'}
        if set(tagged) != {lens['node'] for lens in lights['lenses']}:
            raise ValueError('Exported light lens set differs from its contract')
        for lens in lights['lenses']:
            node = tagged[lens['node']]
            extra = node['extras']
            if ('mesh' not in node or extra.get('tilefun_effect_schema') != 1 or
                    extra.get('tilefun_channel') != lights['channel'] or
                    extra.get('tilefun_group') != lens['group'] or extra.get('tilefun_phase') != lens['phase']):
                raise ValueError(f"Exported light lens tags changed: {lens['node']}")
        if any(node.get('extras', {}).get('tilefun_role') for node in model['nodes']
               if node.get('name', '').endswith('-base')):
            raise ValueError('A fixed light housing was tagged as a lens')
    for equipment in (rig or {}).get('equipmentNodes', []):
        index = nodes[equipment['name']]
        node = model['nodes'][index]
        parent = model['nodes'][nodes[equipment['parent']]]
        if index not in parent.get('children', []) or not node.get('children'):
            raise ValueError(f"Equipment hierarchy changed: {equipment['name']}")
        if any(node.get('extras', {}).get(key) != value for key, value in equipment['extras'].items()):
            raise ValueError(f"Equipment tags changed: {equipment['name']}")
        x, y, z = equipment['location']
        if any(abs(a-b) > 1e-5 for a,b in zip(node.get('translation', [0,0,0]), [x,z,-y])):
            raise ValueError(f"Equipment hinge moved: {equipment['name']}")
    return {'meshes': len(model['meshes']), 'triangles': triangles, 'wheels': 4, 'embeddedAtlas': 'exact RGBA',
            **({'taggedLenses':len(lights['lenses'])} if lights else {}),
            **({'equipmentNodes':len(rig['equipmentNodes'])} if rig and rig.get('equipmentNodes') else {})}


def verify(root=ROOT):
    catalog = read(root / 'art-source/vehicle-models/catalog.json')
    for file in catalog['dependencies']:
        if digest(local(root, file['path'])) != file['sha256']:
            raise ValueError(f"Bundle dependency changed: {file['path']}")
    results = []
    for bundle in catalog['bundles']:
        for file in bundle['files']:
            if digest(local(root, file['path'])) != file['sha256']:
                raise ValueError(f"Retained asset changed: {file['path']}")
        source = local(root, bundle['source'])
        recipe = read(source / 'recipe.json')
        if digest(local(root, recipe['source']['image'])) != recipe['source']['sha256']:
            raise ValueError('Original vehicle source changed')
        if digest(local(root, recipe['template']['path'])) != recipe['template']['sha256']:
            raise ValueError('Recipe template changed')
        if local(root, str((source / recipe['workingBlend']).relative_to(root))) != source / 'car.blend':
            raise ValueError('Recipe does not use its retained scene')
        for view in recipe['views']:
            if digest(local(root, str((source / view['source']).relative_to(root)))) != view['sourceSha256']:
                raise ValueError('Frozen source crop changed')
        results.append({'assetId': bundle['assetId'], 'revision': bundle['revision'],
                        **glb_content(local(root, bundle['glb']), source / 'car-atlas.png',
                                      bundle.get('geometry'), read(source / 'rig.json'),
                                      read(source / 'lights.json') if (source / 'lights.json').exists() else None)})
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    print(json.dumps(verify(args.root.resolve()), indent=2))
