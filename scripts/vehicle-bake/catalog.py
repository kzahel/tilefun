"""Inventory actual GLBs and prepare the comparison manifest; never rewrite candidate bytes."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/demos/vehicle-bake'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and length == len(data), path
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    gltf = json.loads(data[20:20+size])
    nodes, active, visiting = gltf.get('nodes', []), [], set()
    def visit(index):
        assert index not in visiting, 'Cycle or multiple parents in exported graph'
        visiting.add(index)
        active.append(index)
        for child in nodes[index].get('children', []):
            visit(child)
    for node in gltf['scenes'][gltf.get('scene', 0)].get('nodes', []):
        visit(node)
    meshes, primitives, triangles, vertices = 0, 0, 0, 0
    materials, used_images = set(), set()
    for index in active:
        node = nodes[index]
        if 'mesh' not in node:
            continue
        meshes += 1
        for primitive in gltf['meshes'][node['mesh']]['primitives']:
            assert primitive.get('mode', 4) == 4, 'Expected triangulated mesh'
            count = gltf['accessors'][primitive.get('indices', primitive['attributes']['POSITION'])]['count']
            assert count % 3 == 0
            triangles += count // 3
            vertices += gltf['accessors'][primitive['attributes']['POSITION']]['count']
            primitives += 1
            material = primitive['material']
            materials.add(material)
            mat = gltf['materials'][material]
            assert 'KHR_materials_unlit' in mat.get('extensions', {}), f'Non-unlit material in {path}: {mat.get("name")}'
            texture = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
            if texture:
                used_images.add(gltf['textures'][texture['index']]['source'])
    wheel_nodes = {}
    for wheel in ('FL', 'FR', 'RL', 'RR'):
        matching = [nodes[i] for i in active if nodes[i].get('name') == f'Wheel_{wheel}_Roll']
        assert len(matching) == 1, f'Missing/duplicate {wheel}: {path}'
        extras = matching[0].get('extras', {})
        assert extras.get('wheel_radius', 0) > 0
        assert extras.get('roll_axis_gltf') == [0, 0, -1], extras
        wheel_nodes[wheel] = extras
    return {'triangles': triangles, 'vertices': vertices, 'meshes': meshes,
            'primitives': primitives, 'materials': len(materials), 'textures': len(used_images),
            'glbBytes': len(data), 'sha256': sha(path), 'wheels': wheel_nodes}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--draft', action='store_true')
    parser.add_argument('--recommended')
    parser.add_argument('--only', help='Comma-separated candidate IDs for an explicit comparison slice')
    args = parser.parse_args()
    candidates = []
    for model in sorted(OUT.glob('*/*/model.glb')):
        folder = model.parent
        candidate_id = folder.relative_to(OUT).as_posix().replace('/', '--')
        if args.only and candidate_id not in args.only.split(','):
            continue
        report_path = folder / 'report.json'
        report = json.loads(report_path.read_text(encoding='utf-8-sig')) if report_path.exists() else {}
        if not args.draft and report.get('status') != 'complete':
            continue
        try:
            audit = audit_glb(model)
        except (AssertionError, KeyError) as error:
            if not args.draft:
                raise
            print(f'Skipping unfinished export {model.relative_to(OUT)}: {error}')
            continue
        relative = folder.relative_to(OUT).as_posix()
        method_name = {'a': 'Projected paint', 'b': 'Authored UV paint', 'c': 'Surface bake'}[folder.parent.name[0]]
        candidate = {'id': candidate_id, 'route': folder.parent.name,
                     'revision': folder.name, 'title': f'{method_name} · {audit["triangles"]:,} triangles',
                     'method': report.get('method', folder.parent.name),
                     'glb': f'{relative}/model.glb', 'atlas': f'{relative}/atlas.png',
                     'report': f'{relative}/report.json', 'audit': audit, 'files': []}
        for file in sorted(folder.iterdir()):
            if file.is_file() and file.suffix in ('.glb', '.png', '.gif', '.json'):
                candidate['files'].append({'url': 'demos/vehicle-bake/' + file.relative_to(OUT).as_posix(), 'sha256': sha(file)})
        candidates.append(candidate)
    assert candidates, 'No valid GLB candidates available'
    selected = args.recommended or candidates[0]['id']
    assert any(c['id'] == selected for c in candidates), selected
    manifest = {'version': 1, 'status': 'draft' if args.draft else 'awaiting-owner-review',
                'recommended': selected, 'candidates': candidates}
    (OUT/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    refs = OUT/'reference'
    refs.mkdir(exist_ok=True)
    for i in range(8):
        src = ROOT/f'public/demos/vehicle-style-study/03-guide-pixel-finish/view-{i}.png'
        target = refs/src.name
        if target.exists():
            assert sha(src) == sha(target), 'Chosen source art changed'
        else:
            shutil.copyfile(src, target)
    print(json.dumps([{k: c[k] for k in ('id', 'audit')} for c in candidates], indent=2))


if __name__ == '__main__':
    main()
