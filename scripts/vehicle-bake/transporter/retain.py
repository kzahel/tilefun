"""Freeze a new constructor/capture bundle and its declared mutable inputs.
python THIS SOURCE_DIRECTORY CAPTURE_DIRECTORY NEW_RETAINED_DIRECTORY
"""
import hashlib, json, re, shutil, sys
from pathlib import Path

ROOT = next(p for p in Path(__file__).resolve().parents if (p / 'AGENTS.md').exists())
source, captures, output = [(ROOT / p).resolve() for p in sys.argv[1:]]
assert all(p.is_relative_to(ROOT) for p in [source, captures, output])
assert not output.exists(), 'Retained outputs are immutable; choose a new revision.'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
construction = json.loads((source / 'recipe.json').read_text(encoding='utf-8'))
for file, expected in construction['inputs'].items():
    assert sha(ROOT / file) == expected, file
assert sha(source / 'model.glb') == sha(ROOT / 'public/assets/models/vehicles/car-transporter-v2.glb')
output.mkdir(parents=True)
for name in ['car.blend', 'model.glb', 'atlas.png', 'recipe.json']:
    shutil.copy2(source / name, output / name)
files = ['scripts/vehicle-bake/transporter/Capture.ts', 'scripts/vehicle-bake/transporter/capture.mjs',
    'public/assets/models/vehicles/car-transporter-v2.glb', 'package.json', 'package-lock.json']
seen = set(files)
for file in files:
    path = ROOT / file
    if path.suffix not in ['.ts', '.tsx', '.mjs']: continue
    text = path.read_text(encoding='utf-8')
    for match in re.finditer(r'^import(?![ \t]+type\b)[ \t]+[\s\S]*?\bfrom\s+["\'](\.[^"\']+)["\']', text, re.M):
        dependency = (path.parent / match.group(1).removesuffix('?raw')).resolve()
        if not dependency.exists() and dependency.suffix == '.js': dependency = dependency.with_suffix('.ts')
        assert dependency.is_relative_to(ROOT), dependency
        local = dependency.relative_to(ROOT).as_posix()
        if local not in seen: seen.add(local); files.append(local)
inputs = {file: sha(ROOT / file) for file in files}
snapshots = {}
for file in files:
    snapshot = output / 'inputs' / file
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / file, snapshot)
    snapshots[file] = snapshot.relative_to(output).as_posix()
outputs = {}
for p in sorted(captures.glob('*.png')):
    target = output / 'captures' / p.name
    target.parent.mkdir(exist_ok=True)
    shutil.copy2(p, target); outputs[p.name] = sha(target)
assert len(outputs) == 34
shutil.copy2(captures / 'capture.json', output / 'captures/capture.json')
receipt = {'revision': construction['revision'], 'inputs': inputs, 'snapshots': snapshots, 'outputs': outputs,
    'artReviewStatus': 'awaiting-owner-inspection',
    'runtime': {'model': inputs['public/assets/models/vehicles/car-transporter-v2.glb'],
        'sprite': outputs['normal.png'], 'rampSprite': outputs['sheet.png']}}
(output / 'capture-recipe.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
construction_inputs = dict(construction['inputs'])
construction_inputs['AGENTS.md'] = sha(ROOT / 'AGENTS.md')
construction_snapshots = {}
for file, expected in construction_inputs.items():
    target = output / 'construction-inputs' / file
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / file, target)
    construction_snapshots[file] = target.relative_to(output).as_posix()
(output / 'construction-inputs.json').write_text(json.dumps({'inputs': construction_inputs, 'snapshots': construction_snapshots}, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'output': str(output), 'inputs': len(inputs), 'captures': len(outputs)}, indent=2))
