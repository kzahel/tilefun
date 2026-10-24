"""Build/check new immutable wildlife banks using their single paint contract.

python scripts/wildlife/finish-bank.py [--animals deer,red-panda] [--check]
Existing registered banks are read-only. Normal application builds never run it.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SHARED = ROOT/'art-source/wildlife-v2/finishing-v1'
sys.path.insert(0, str(SHARED))
from painter import POLICY, compose_surface, rgba_palette, surface_paint
from parts import RetainedParts

FACINGS = ['down', 'up', 'left', 'right']


def read(path):
    return json.loads((ROOT/path).read_text(encoding='utf8'))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2)+'\n', encoding='utf8', newline='\n')


def metadata(image):
    return read('public/'+image.rsplit('/', 1)[0]+'/sprite.json')


def input_palette(source, inputs, projection):
    if 'palette' in inputs:
        return inputs['palette']
    if 'palette' in projection:
        return projection['palette']
    if 'masters' in inputs:
        return read(inputs['masters'])['palette']
    if 'profile' in inputs:
        return inputs['profile']['palette']
    return read(source+'/masters.json')['palette']


def source_layer(image, pins):
    source = 'art-source/'+image.removeprefix('demos/').rsplit('/', 1)[0]
    inputs_path = source+'/inputs.json'
    inputs = read(inputs_path) if (ROOT/inputs_path).exists() else {}
    own_projection = source+'/projection.json'
    # Some older inputs call their *native input* "projection" while keeping
    # the appended action projection beside inputs.json. Prefer the bank's
    # own evaluated output; variants may deliberately share another bank's.
    projection_path = own_projection if (ROOT/own_projection).exists() else inputs['projection']
    projection = read(projection_path)
    for path in [inputs_path, projection_path, 'public/'+image,
                 'public/'+image.rsplit('/', 1)[0]+'/sprite.json', inputs.get('masters', ''),
                 inputs.get('blend', ''), inputs.get('paintHelper', '')]:
        if path and (ROOT/path).is_file():
            pins.add(path)
    for path in (ROOT/source).glob('*.blend'):
        pins.add(path.relative_to(ROOT).as_posix())
    return source, inputs, projection


def clip_name(record, projection, meta):
    name = record['clip']
    if name == 'feed' and name not in meta['clips']:
        name = 'action'
    if name == 'walk' and name not in meta['clips']:
        name = projection['motionClip']
    assert name in meta['clips'], (name, list(meta['clips']))
    return name


def material_bank(image, pins, expected_palette, audit):
    meta = metadata(image)
    source, inputs, projection = source_layer(image, pins)
    colors = input_palette(source, inputs, projection)
    assert colors == expected_palette, (source, 'palette drift between clips')
    palette = rgba_palette(colors)
    width, height = meta['frameWidth'], meta['frameHeight']
    original = Image.open(ROOT/'public'/image)
    sheet = Image.new('RGBA', original.size)
    covered = set()
    if inputs.get('sheet'):
        base_image = inputs['sheet'].removeprefix('public/')
        base = material_bank(base_image, pins, expected_palette, audit)
        sheet.alpha_composite(base)
        covered.update((row, col) for row in range(4) for col in range(base.width//width))
    for record in projection['records']:
        name = clip_name(record, projection, meta)
        clip = meta['clips'][name]
        assert record['index'] < clip['count']
        row, col = FACINGS.index(record['facing']), clip['start']+record['index']
        tile = compose_surface(width, record, palette)
        raw = surface_paint(width, record['volumes'], palette)
        assert tile.getchannel('A').tobytes() == raw.getchannel('A').tobytes()
        sheet.alpha_composite(tile, (col*width, row*height))
        covered.add((row, col))
        audit['surfaceCells'] += 1
    required = {(row, clip['start']+i) for row in range(4)
                for clip in meta['clips'].values() for i in range(clip['count'])}
    assert required <= covered, (source, 'unpainted clip cells', sorted(required-covered))
    return sheet


def retained_bank(entry, pins, audit):
    species = entry['id']
    meta = metadata(entry['sourceImage'])
    source, inputs, _ = source_layer(entry['sourceImage'], pins)
    base_image = inputs['sheet']
    pins.add(base_image)
    base = Image.open(ROOT/base_image).convert('RGBA')
    old = Image.open(ROOT/'public'/entry['sourceImage'])
    sheet = Image.new('RGBA', old.size)
    sheet.alpha_composite(base)
    native_source = 'art-source/'+base_image.removeprefix('public/demos/').rsplit('/', 1)[0]
    master_path = native_source+'/masters.json'
    masters = read(master_path)
    pins.add(master_path)
    projection_path = f'art-source/wildlife-v2/{species}/finish-v1/paint-projection.json'
    projection = read(projection_path)
    pins.add(projection_path)
    pins.update(projection['inputBlends'])
    assert projection['sourceScenesUnchanged']
    painter = RetainedParts(species, meta['frameWidth'], rgba_palette(masters['palette']), masters, projection, base)
    if species == 'deer':
        painter.hooves = masters['hooves']
    if species == 'donkey':
        native_projection = read(native_source+'/projection.json')
        painter.neck_radius = native_projection['neckRadius']
        pins.add(native_source+'/projection.json')
    for record in projection['records']:
        clip = meta['clips'][record['clip']]
        col = clip['start']+record['index']
        row = FACINGS.index(record['facing'])
        tile = painter.compose(record)
        sheet.alpha_composite(tile, (col*meta['frameWidth'], row*meta['frameHeight']))
        audit['retainedPartCells'] += 1
    assert sheet.crop((0, 0, base.width, base.height)).tobytes() == base.tobytes()
    audit['nativeCellsUnchanged'] = True
    return sheet, masters['palette']


def output_bank(entry, destination):
    species = entry['id']
    original_meta = metadata(entry['sourceImage'])
    assert sha(ROOT/'public'/entry['sourceImage']) == entry['sourceSha256']
    pins = {'art-source/wildlife-v2/camera.json', 'public/demos/pixel-characters/person-32.png',
            'art-source/wildlife-v2/finishing-v1/painter.py', 'art-source/wildlife-v2/finishing-v1/parts.py',
            'scripts/wildlife/finish-bank.py', 'scripts/wildlife/project-paint.py', 'scripts/wildlife/meadow-playback.js'}
    audit = dict(identity=f'{species}-finish-v1', policy=POLICY, method=entry['policy'],
                 surfaceCells=0, retainedPartCells=0, noExteriorAlphaGrowth=True,
                 geometryAndMotionUnchanged=True)
    if entry['policy'] == 'retained-parts':
        sheet, colors = retained_bank(entry, pins, audit)
    else:
        source, inputs, projection = source_layer(entry['sourceImage'], pins)
        colors = input_palette(source, inputs, projection)
        sheet = material_bank(entry['sourceImage'], pins, colors, audit)
    meta = dict(original_meta)
    meta.update(identity=f'{species}-finish-v1', image='sheet.png', reviewStatus='pending human review',
                sheetSha256=None, finishing=dict(policy=POLICY, method=entry['policy'], contract=f'{species}-finish-v1',
                                                predecessorImage=entry['sourceImage'], predecessorSha256=entry['sourceSha256'],
                                                source=entry['source']))
    width, height = meta['frameWidth'], meta['frameHeight']
    assert sheet.size == Image.open(ROOT/'public'/entry['sourceImage']).size
    audit['binaryAlpha'] = set(sheet.getchannel('A').get_flattened_data()) <= {0, 255}
    assert audit['binaryAlpha']
    destination.mkdir(parents=True, exist_ok=True)
    sheet.save(destination/'sheet.png')
    meta['sheetSha256'] = sha(destination/'sheet.png')
    meta.pop('facings', None)
    write_json(destination/'sprite.json', meta)
    samples = [(name, i) for name, clip in meta['clips'].items()
               for i in sorted({0, clip['count']//2, clip['count']-1})]
    contact = Image.new('RGBA', (width*len(samples), height*4))
    for col, (name, index) in enumerate(samples):
        original = meta['clips'][name]['start']+index
        for row in range(4):
            tile = sheet.crop((original*width, row*height, (original+1)*width, (row+1)*height))
            contact.alpha_composite(tile, (col*width, row*height))
    contact.save(destination/'contact-sheet-native.png')
    person = Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
    def four(name, index):
        image = Image.new('RGB', ((width+40)*4, height+32), '#879b82')
        column = meta['clips'][name]['start']+index
        for row in range(4):
            tile = sheet.crop((column*width, row*height, (column+1)*width, (row+1)*height))
            image.paste(tile, (row*(width+40)+36, 8), tile)
            human = person.crop((0, row*32, 32, (row+1)*32))
            image.paste(human, (row*(width+40), 8+meta['anchor'][1]-28), human)
        return image
    default = meta.get('defaultClip', 'action' if 'action' in meta['clips'] else 'idle')
    four(default, meta['clips'][default]['count']//2).save(destination/'scene-native.png')
    sequence = [(name, i, clip.get('frameDuration', 100)) for name, clip in meta['clips'].items() for i in range(clip['count'])]
    frames = [four(name, i) for name, i, _ in sequence]
    for name, scale in [('preview-native.gif', 1), ('preview.gif', 3)]:
        scaled = [image.resize((image.width*scale, image.height*scale), Image.Resampling.NEAREST) for image in frames]
        scaled[0].save(destination/name, save_all=True, append_images=scaled[1:], duration=[ms for _, _, ms in sequence],
                       disposal=2, loop=0, optimize=False)
    (destination/'playback.js').write_bytes((ROOT/'scripts/wildlife/meadow-playback.js').read_bytes())
    options = ''.join(f'<option>{name}</option>' for name in meta['clips'])
    html = f'''<!doctype html><html lang="en"><meta charset="utf-8"><title>{entry['name']} · shared paint</title>
<style>body{{background:#283b36;color:white;font:16px sans-serif}}canvas,img{{image-rendering:pixelated;max-width:100%}}</style>
<h1>{entry['name']} · finish-v1</h1><p>Pending human review. Retained source motion; shared native-pixel finishing.</p>
<label>Action <select id="clip">{options}</select></label> <button id="pause" type="button">Play</button>
<button id="step" type="button">Next pose</button> <label>Pose <input id="pose" type="range" min="0" value="0"></label>
<label>Speed <select id="speed"><option value="0.5">Half</option><option value="1" selected>Normal</option><option value="2">Double</option></select></label>
<p><canvas aria-label="Four animal directions"></canvas></p><img alt="Native animal beside person" src="scene-native.png">
<p><a href="preview.gif">Chronological enlarged animation</a> · <a href="contact-sheet-native.png">Native sampled poses</a></p>
<script type="module" src="playback.js"></script></html>'''
    (destination/'index.html').write_text(html, encoding='utf8', newline='\n')
    audit['poses'] = sum(clip['count'] for clip in meta['clips'].values())*4
    audit['sheetSha256'] = meta['sheetSha256']
    write_json(destination/'pixel-audit.json', audit)
    inputs = dict(identity=meta['identity'], policy=POLICY, contract=entry, palette=colors,
                  sha256={p: sha(ROOT/p) for p in sorted(pins)})
    write_json(destination/'source-audit.json', dict(identity=meta['identity'],
               geometryAndMotionUnchanged=True, cameraAnchorAndTimingUnchanged=True,
               editableScenes={p: digest for p, digest in inputs['sha256'].items() if p.endswith('.blend')},
               policy=POLICY, method=entry['policy']))
    return meta, inputs, audit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--animals', help='Comma-separated IDs; otherwise all correction contracts')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--record-replay', action='store_true', help='Record a successful isolated replay before registration')
    args = parser.parse_args()
    assert not args.record_replay or args.check, '--record-replay requires --check'
    contracts = read('art-source/wildlife-v2/finishing.json')
    selected = set(args.animals.split(',')) if args.animals else None
    entries = [entry for entry in contracts['animals'] if entry['policy'] != 'retained-bank' and (selected is None or entry['id'] in selected)]
    assert not selected or selected == {entry['id'] for entry in entries}, 'Unknown/retained selection'
    results = {}
    for entry in entries:
        source = ROOT/f"art-source/wildlife-v2/{entry['id']}/finish-v1"
        public = ROOT/f"public/demos/wildlife-v2/{entry['id']}/finish-v1"
        assert args.check or not (source/'receipt.json').exists(), 'Registered banks are immutable'
        if args.check:
            assert not args.record_replay or not (source/'receipt.json').exists(), 'Registered replay is immutable'
            with tempfile.TemporaryDirectory(prefix='tilefun-wildlife-paint-') as scratch:
                isolated = Path(scratch)
                inputs = read((source/'inputs.json').relative_to(ROOT).as_posix())
                for path, digest in inputs['sha256'].items():
                    assert sha(ROOT/path) == digest, ('Changed declared input', path)
                    target = isolated/path
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(ROOT/path, target)
                write_json(isolated/'art-source/wildlife-v2/finishing.json', dict(animals=[entry]))
                command = [sys.executable, str(isolated/'scripts/wildlife/finish-bank.py'), '--animals', entry['id']]
                subprocess.run(command, cwd=isolated, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                output = isolated/f"public/demos/wildlife-v2/{entry['id']}/finish-v1"
                expected = {p.name: sha(p) for p in output.iterdir()}
                assert all((public/name).exists() and sha(public/name) == digest for name, digest in expected.items()), entry['id']
                reproduced_inputs = json.loads((isolated/f"art-source/wildlife-v2/{entry['id']}/finish-v1/inputs.json").read_text())
                assert inputs == reproduced_inputs
                results[entry['id']] = dict(identity=f"{entry['id']}-finish-v1", status='byte-identical', isolation='declared inputs only', artifacts=expected)
                if args.record_replay:
                    write_json(source/'replay.json', results[entry['id']])
        else:
            meta, inputs, audit = output_bank(entry, public)
            write_json(source/'inputs.json', inputs)
            source.joinpath('README.md').write_text(f"# {entry['name']} shared paint\n\nOwner-authorized correction, tactical 187. Exact human review pending.\n\nThe complete bank uses `{entry['policy']}` under `{POLICY}`.\nEditable Blender sources and palette/projection inputs remain at the exact\nchecksum-pinned paths in inputs.json. They are read-only; this revision\nchanges finishing only, preserving camera, motion, timing and sockets.\n\nRebuild before registration with `python scripts/wildlife/finish-bank.py --animals {entry['id']}`.\nAfter registration use the same command with `--check` for read-only byte replay.\n", encoding='utf8', newline='\n')
            results[entry['id']] = dict(identity=meta['identity'], sha256=meta['sheetSha256'], policy=entry['policy'], poses=audit['poses'])
        print('FINISH_BANK_OK', entry['id'], results[entry['id']].get('status', results[entry['id']].get('poses')), flush=True)
    if not args.check:
        write_json(ROOT/'data/wildlife-187/banks.json', results)


if __name__ == '__main__':
    main()
