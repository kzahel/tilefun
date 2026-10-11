"""Retain an exact independently fitted bus-family checkpoint.

Preserves earlier bundles and final checkpoint bytes. Own draft, frozen crops,
atlas, packed scene and palette provenance remain available in a fresh checkout.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import shutil
import subprocess

from pipeline import ROOT, digest, read, write
from retain_vehicle import comparison, relative


def retain(model, template, revision, name):
    recipe, config = read(model / 'recipe.json'), read(template)
    asset = recipe['assetId']
    if not revision.startswith('v') or not revision[1:].isdigit():
        raise ValueError('Use vN revision')
    source = ROOT / f'art-source/vehicle-models/{asset}/{revision}'
    review = ROOT / f'public/assets/models/vehicles/review/{asset}-{revision}'
    glb = ROOT / f'public/assets/models/vehicles/{asset}-{revision}.glb'
    if any(p.exists() for p in [source, review, glb]):
        raise FileExistsError('Choose an unused retained revision')
    render, projection, inspection = [model / n for n in ['render-001', 'projection-001', 'inspection-001']]
    required = [model / n for n in ['final.blend', 'car-atlas.png', 'mesh-spec.json', 'family-config.json', 'rig.json', 'paint-ownership.json', 'lights.json', 'wheel-alignment.json']]
    if read(model / 'lights.json')['lenses']:
        raise ValueError('Light-bearing vehicles require actual GLB flashing evidence and the light retainer')
    required += [render / n for n in ['asset.glb', 'audit.json', 'metrics.json']]
    required += [projection / n for n in ['projection-draft.png', 'projection-coverage.png', 'coverage.json']]
    required += [inspection / n for n in ['inspection.json', 'orbit-strip.png', 'silhouette.png']]
    for path in required:
        if not path.is_file():
            raise FileNotFoundError(path)
    source.mkdir(parents=True)
    review.mkdir()
    for original, target in [('final.blend', 'car.blend')] + [(n, n) for n in ['car-atlas.png', 'mesh-spec.json', 'family-config.json', 'rig.json', 'paint-ownership.json', 'lights.json', 'wheel-alignment.json']]:
        shutil.copyfile(model / original, source / target)
    shutil.copytree(model / 'refs', source / 'refs')
    for path in projection.iterdir():
        if path.name in ['projection-draft.png', 'projection-coverage.png', 'projection-with-authored-fill.png', 'coverage.json']:
            shutil.copyfile(path, source / path.name)
    shutil.copyfile(render / 'audit.json', source / 'geometry-audit.json')
    recipe['source']['image'] = relative(Path(recipe['source']['image']))
    recipe['template'] = {'path': relative(source / 'car.blend'), 'sha256': digest(source / 'car.blend')}
    recipe['workingBlend'] = 'car.blend'
    write(source / 'recipe.json', recipe)
    report = read(inspection / 'inspection.json')
    report['recipeSha256'], report['metrics'] = digest(source / 'recipe.json'), read(render / 'metrics.json')
    write(source / 'inspection.json', report)
    write(source / 'authoring-provenance.json', {
        'sourceFingerprint': recipe['source']['sha256'],
        'configuration': relative(template), 'configurationSha256': digest(template),
        'scripts': {relative(ROOT / 'scripts/authored-assets' / script): digest(ROOT / 'scripts/authored-assets' / script)
                    for script in ['author_bus_vehicle.py', 'author_passenger_vehicle.py', 'author_emergency_vehicle.py', 'author_garbage_truck.py', 'build_emergency_vehicle.py', 'prepare_bus_vehicle.py', 'retain_bus.py', 'retain_vehicle.py', 'pack_draft.py']},
        'status': 'Own source paint and independent family geometry; explicit crop registration, hidden fill and projection contradictions; unreviewed'})
    shutil.copyfile(render / 'asset.glb', glb)
    comparison(render, recipe, review / 'comparison.png', name + ' ' + revision)
    for original, target in [('orbit-strip.png', 'orbit.png'), ('silhouette.png', 'silhouette.png')]:
        shutil.copyfile(inspection / original, review / target)
    identity = {'assetId': asset, 'revision': revision, 'sourceFingerprint': recipe['source']['sha256'],
                'sourceBundleSha256': digest(source / 'car.blend'), 'sourceAtlasSha256': digest(source / 'car-atlas.png'),
                'files': [{'url': p.relative_to(ROOT / 'public').as_posix(), 'sha256': digest(p)}
                          for p in [glb] + sorted(review.iterdir())]}
    fingerprint = hashlib.sha256(json.dumps(identity, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    candidate = f'projection:authored-{asset}-{revision}'
    write(review / 'review.json', {'schema': 'tilefun-authored-vehicle-review-v1', 'candidateId': candidate,
          'candidateFingerprint': fingerprint, 'identity': identity, 'name': name,
          'status': 'Awaiting owner inspection; not promoted',
          'notes': config['notes']})
    subprocess.run(['node', str(ROOT / 'node_modules/@biomejs/biome/bin/biome'), 'format', '--write', str(review / 'review.json')],
                   check=True, cwd=ROOT)
    title = html.escape(name + ' ' + revision)
    (review / 'index.html').write_bytes(f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · sprite and model review</title><style>body{{margin:0 auto;padding:24px;max-width:1320px;background:#253139;color:#edf3f5;font:16px/1.5 system-ui,sans-serif}}img{{width:100%;height:auto;image-rendering:pixelated}}a{{color:#9bdaff}}figure{{margin:24px 0}}</style>
<h1>{title}</h1><p>Original sprites above, matched Blender renders below.</p>
<figure><img src="comparison.png" alt="Four original sprites above matched renders: east, west, rear and front."></figure>
<figure><img src="orbit.png" alt="Model from four additional angles."></figure>
<details><summary>Silhouette differences</summary><img src="silhouette.png" alt="Source and model contours in four directions."></details>

<p>Source: Modern Exteriors by LimeZu. Retained diagnostic; exact art review remains open.</p>
<p><a href="../../{asset}-{revision}.glb">Download the model</a> · <a href="../">Other vehicle reviews</a> · <a href="/tilefun/workshop.html">Tilefun Workshop</a></p></html>
'''.encode())
    geometry = read(source / 'geometry-audit.json')
    bundle = {'assetId': asset, 'revision': revision, 'glb': relative(glb), 'source': relative(source),
              'capturedCandidateId': candidate, 'capturedCandidateSha256': fingerprint, 'sourceFingerprint': recipe['source']['sha256'],
              'geometry': {k: geometry[k] for k in ['meshObjects', 'triangles']},
              'files': [{'path': relative(p), 'sha256': digest(p)} for p in
                        sorted(source.rglob('*')) + [glb] + sorted(review.iterdir()) if p.is_file()],
              'nativeAndNovelRenderSha256': {p.name: digest(p) for p in
                        [render / f'{d}-render.png' for d in ['east', 'west', 'north', 'south']] +
                        [render / f'orbit-{i}.png' for i in range(4)]}}
    catalog_path = ROOT / 'art-source/vehicle-models/catalog.json'
    old = catalog_path.read_bytes()
    newline = b'\r\n' if b'\r\n' in old else b'\n'
    marker = newline + b'  ],' + newline + b'  "dependencies":'
    if old.count(marker) != 1:
        raise ValueError('Unexpected catalog layout')
    entry = ('\n'.join('    ' + line for line in json.dumps(bundle, indent=2, ensure_ascii=False).splitlines())).encode().replace(b'\n', newline)
    catalog_path.write_bytes(old.replace(marker, b',' + newline + entry + marker, 1))
    print('Exact variant retained:', asset, revision, fingerprint)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--template', type=Path, required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--name', required=True)
    args = parser.parse_args()
    retain(args.model.resolve(), args.template.resolve(), args.revision, args.name)
