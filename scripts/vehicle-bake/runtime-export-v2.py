"""Package a reviewed original family without modifying or regenerating its art.

python scripts/vehicle-bake/runtime-export-v2.py --config FAMILY_CONFIG --blender BLENDER

Keep the original runtime-export.py for the Beetle's exact historical receipt.

Use --output-root data/vehicle-bake/beetle-runtime/replay for an isolated replay.
Only the selected catalog entry and its runtime files/receipt are written.
Square captures keep their native pixel density, including larger bus viewports;
their occupied pixels must fit the shared 192x224 frame around origin (96,144).
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ROWS = ('south', 'north', 'west', 'east')
FRAME_SIZE = (192, 224)
GROUND_ORIGIN = (96, 144)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and read(path) == value:
        return
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def verify_replay_dependencies(config, replay, pinned):
    """Accept retained-input maps and the original coupe-era role receipt."""
    if 'inputHashes' in replay:
        declared = replay['inputHashes']
        assert declared and config['build'] in declared and config['family'] in declared, 'Missing replay builder/family pin'
        for path, expected in declared.items():
            pinned(path, expected)
    else:
        pinned(config['build'], replay['retainedBuildSha256'])
        pinned(config['family'], replay['familySha256'])
        for path, expected in zip(replay['inputs'], (replay['retainedBuildSha256'], replay['familySha256']), strict=True):
            pinned(path, expected)


def pack_frame(sheet, frame, row, frame_size, ground_origin):
    """Place native pixels; transparent margins may extend beyond the target."""
    assert tuple(frame.size) == tuple(frame_size), 'Unexpected capture dimensions'
    n, h = frame_size
    assert n == h and n > 0 and n % 2 == 0, 'Capture must be an even square'
    assert tuple(ground_origin) == (n // 2, n // 2), 'Expected centered capture ground origin'
    bounds = frame.getchannel('A').getbbox()
    assert bounds is not None, 'Empty capture'
    x0, y0, x1, y1 = bounds
    assert 0 < x0 < x1 < n and 0 < y0 < y1 < n, 'Capture touches viewport edge'
    pad_x, pad_y = (GROUND_ORIGIN[i] - ground_origin[i] for i in range(2))
    assert 0 <= x0 + pad_x < x1 + pad_x <= FRAME_SIZE[0], 'Occupied pixels crop horizontally'
    assert 0 <= y0 + pad_y < y1 + pad_y <= FRAME_SIZE[1], 'Occupied pixels crop vertically'
    # Crop only transparent margins, so a >192px viewport cannot spill into
    # another row. No resize, resampling, rotation, reflection or model scaling.
    sheet.paste(frame.crop(bounds), (x0 + pad_x, row * FRAME_SIZE[1] + y0 + pad_y))
    return [x0 + pad_x, y0 + row * FRAME_SIZE[1] + pad_y, x1 - x0, y1 - y0], bounds


def export(config_path, blender, output_root, work_dir):
    config_path = config_path.resolve()
    config = read(config_path)
    assert config['version'] == 1
    inputs = {config_path.relative_to(ROOT).as_posix(): sha(config_path)}
    for helper in (Path(__file__), Path(__file__).with_name('runtime-measure.py')):
        inputs[helper.relative_to(ROOT).as_posix()] = sha(helper)

    def pinned(path, expected):
        target = ROOT / path
        assert sha(target) == expected, f'Frozen input hash mismatch: {path}'
        inputs[path] = expected
        return target

    review = config['review']
    manifest = pinned(review['manifest'], review['sha256'])
    candidate = next(c for c in read(manifest)['candidates'] if c['id'] == review['candidateId'])
    pins = {f['url']: f['sha256'] for f in candidate['files']}

    def reviewed(path):
        public_path = (ROOT / path).relative_to(ROOT / 'public').as_posix()
        return pinned(path, pins[public_path])

    model = reviewed(review['model'])
    atlas = reviewed(review['atlas'])
    assert sha(model) == review['modelSha256'] == candidate['audit']['sha256']
    capture = read(reviewed(review['capture']))
    assert capture['status'] == 'passed' and capture['glbSha256'] == sha(model)
    assert capture['stats']['triangles'] == review['triangles']
    source_replay = config['sourceReplay']
    replay = read(pinned(source_replay['receipt'], source_replay['sha256']))
    assert replay['byteIdentical'] and replay['scratchInputDependencies'] == []
    assert replay['glbSha256'] == sha(model) and replay['atlasSha256'] == sha(atlas)
    verify_replay_dependencies(source_replay, replay, pinned)

    work_dir.mkdir(parents=True, exist_ok=True)
    measurements_path = work_dir / 'imported-bounds.json'
    subprocess.run([str(blender), '--background', '--factory-startup', '--threads', '4',
                    '--python-exit-code', '1', '--python', str(Path(__file__).with_name('runtime-measure.py')),
                    '--', str(model), str(measurements_path.resolve())], check=True)
    measured = read(measurements_path)
    assert measured['modelSha256'] == sha(model)
    assert measured['triangles'] == review['triangles'] and measured['meshes'] == review['meshes']
    bounds = measured['worldBounds']
    assert abs(bounds['min'][2]) < 0.00001, 'Authored tire contacts must remain at Z=0'
    length, width, height = map(math.ceil, bounds['size'])
    assert config['mesh']['lateralScale'] == 1, 'Original family keeps native physical proportions'
    assert config['mesh']['radius'] == config['capture']['frameSize'][0] / 2
    sheet = Image.new('RGBA', (FRAME_SIZE[0], FRAME_SIZE[1] * 4))
    views = []
    for row, direction in enumerate(ROWS):
        index = config['capture']['cardinals'][direction]
        frame_path = reviewed(f"{review['captures']}/engine-{index}.png")
        with Image.open(frame_path) as image:
            rect, (x0, y0, _, _) = pack_frame(sheet, image.convert('RGBA'), row,
                                            config['capture']['frameSize'], config['capture']['groundOrigin'])
        side = direction in ('east', 'west')
        w, h = (length, width) if side else (width, length)
        gx, gy = config['capture']['groundOrigin']
        views.append({'id': f"original-vehicle:{config['id']}:{direction}",
                      'vehicleId': config['id'], 'direction': direction, 'rect': rect,
                      'metadata': {'name': f"{config['name']} · {direction}", 'category': 'vehicle',
                                   'kind': 'prop', 'tags': config['tags'], 'settings': ['road'],
                                   'facing': direction, 'anchor': [gx - x0, gy - y0 + h / 2],
                                   'footprint': [-w / 2, -h, w, h],
                                   'colliders': [{'offsetX': 0, 'offsetY': 0, 'width': w,
                                                  'height': h, 'zHeight': height}], 'depthOffset': -h / 2}})
    entry = {key: config[key] for key in ('id', 'name', 'sprite', 'mesh', 'performance')}
    entry['views'] = views
    model_out = output_root / 'public' / config['mesh']['path']
    sheet_out = output_root / 'public' / config['sprite']
    for target in (model_out, sheet_out):
        target.parent.mkdir(parents=True, exist_ok=True)
    if model_out.exists():
        assert sha(model_out) == sha(model), 'Runtime model revision is immutable'
    else:
        shutil.copyfile(model, model_out)
    if sheet_out.exists():
        with Image.open(sheet_out) as previous:
            assert previous.size == sheet.size and previous.convert('RGBA').tobytes() == sheet.tobytes(), 'Fallback revision is immutable'
    else:
        sheet.save(sheet_out)
    catalog_path = output_root / 'src/traffic/original-vehicles.json'
    catalog = read(catalog_path if catalog_path.exists() else ROOT / 'src/traffic/original-vehicles.json')
    existing = next((i for i, vehicle in enumerate(catalog['vehicles']) if vehicle['id'] == entry['id']), None)
    if existing is None:
        catalog['vehicles'].append(entry)
    else:
        catalog['vehicles'][existing] = entry
    write(catalog_path, catalog)
    evidence = {'modelSha256': sha(model_out), 'spriteSha256': sha(sheet_out), 'inputs': inputs,
                'physicalBounds': [length, width, height], 'measurement': measured,
                'frameSize': list(FRAME_SIZE), 'groundOrigin': list(GROUND_ORIGIN),
                'capture': config['capture'], 'rows': list(ROWS),
                'sourceOnlyReplay': {'receipt': source_replay['receipt'], 'sha256': source_replay['sha256'],
                                     'byteIdentical': True, 'scratchInputDependencies': []},
                'projection': 'Unchanged shared game projection and native dimensions; exact reviewed GLB/capture pixels',
                'replay': f"python scripts/vehicle-bake/runtime-export-v2.py --config {config_path.relative_to(ROOT).as_posix()} --blender BLENDER"}
    write(output_root / config['receipt'], evidence)
    print(json.dumps({'id': entry['id'], 'physicalBounds': evidence['physicalBounds'],
                      'modelSha256': evidence['modelSha256'], 'spriteSha256': evidence['spriteSha256']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--blender', type=Path, required=True)
    parser.add_argument('--output-root', type=Path, default=ROOT)
    parser.add_argument('--work-dir', type=Path, default=ROOT / 'data/vehicle-bake/beetle-runtime')
    args = parser.parse_args()
    export(args.config, args.blender, args.output_root, args.work_dir)
