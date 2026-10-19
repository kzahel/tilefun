"""Prepare/freeze an original-family review without changing any source candidate.

Usage: python scripts/vehicle-bake/family-package.py CONFIG {prepare,assemble,freeze,offline}
Captures are actual shared-engine PNGs. Pillow only assembles these pixels.
"""
import argparse
import base64
import hashlib
import json
import mimetypes
import subprocess
import sys
from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont
from catalog import audit_glb

ROOT = Path(__file__).resolve().parents[2]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2)+'\n', encoding='utf-8')


def public_url(path):
    return path.relative_to(ROOT/'public').as_posix()


def portable_report(report):
    for field in ['sourceBlend', 'masterBlend', 'recipe']:
        if report.get(field):
            assert '\\' not in report[field], 'Non-POSIX report path: '+field
    for name, expected in report.get('sourceHashes', {}).items():
        assert '\\' not in name, 'Non-POSIX source-hash path: '+name
        path = ROOT/name
        assert path.resolve().is_relative_to(ROOT.resolve()), 'Source path escapes repository'
        assert digest(path) == expected, 'Report source hash is stale: '+name


def prepare(config):
    source, out = ROOT/config['source'], ROOT/config['output']
    glb = ROOT/config['glb'] if config.get('glb') else source/'model.glb'
    atlas = ROOT/config['atlas'] if config.get('atlas') else source/'atlas.png'
    report_path = ROOT/config['report'] if config.get('report') else source/'report.json'
    assert not (out/'review-manifest.json').exists(), 'Frozen revision: use a new output directory'
    report = read(report_path)
    assert report.get('status') == 'complete', 'Author report must be complete before packaging'
    portable_report(report)
    audit = audit_glb(glb)
    out.mkdir(parents=True, exist_ok=True)
    if (out/'candidate.json').exists():
        prior = read(out/'candidate.json')['candidates'][0]
        for item in prior.get('sourceInputs', []):
            if not (ROOT/'public'/item['source']).exists():
                retired = ROOT/'public'/item['retained']
                assert retired.resolve().is_relative_to((out/'inputs').resolve())
                retired.unlink(missing_ok=True)
    # Retain every public source review input verbatim, not editable author files.
    inputs = []
    for path in sorted(source.rglob('*')):
        if not path.is_file():
            continue
        destination = out/'inputs'/path.relative_to(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, destination)
        inputs.append({'source': public_url(path), 'retained': public_url(destination),
                       'sha256': digest(path)})
    if config.get('styleReference'):
        shutil.copyfile(ROOT/config['styleReference'], out/'style-reference.png')
    for src, dest in [('family-review.html', 'index.html'), ('family-review.css', 'review.css')]:
        shutil.copyfile(ROOT/'scripts/vehicle-bake'/src, out/dest)
    candidate = {key: config[key] for key in ['id', 'name', 'title']}
    size = config.get('nativeSize', 128)
    if report.get('render'):
        render = report['render']
        assert render['nativeSize'] == size and render['meshRadius'] == size/2
        assert render['studyGroundOrigin'] == [size/2, size/2+28]
        assert render['engineGroundOrigin'] == [size/2, size/2]
    assert isinstance(size, int) and size >= 128 and size % 2 == 0
    candidate.update({'nativeSize': size, 'engineRadius': size/2, 'dimensions': [size, size],
                      'groundOrigins': {'study': [size//2, size//2+28], 'engine': [size//2, size//2]},
                      'glb': 'inputs/'+glb.relative_to(source).as_posix(),
                      'atlas': 'inputs/'+atlas.relative_to(source).as_posix(),
                      'report': 'inputs/'+report_path.relative_to(source).as_posix(),
                      'method': report.get('method', 'Original family geometry and view-independent UV paint'),
                      'audit': audit, 'sourceInputs': inputs,
                      'status': 'awaiting-owner-review', 'runtime': 'not integrated',
                      'styleReferenceNote': 'Accepted red coupe actual GLB image; STYLE reference, not target.'})
    if config.get('styleReference'):
        candidate['styleReference'] = 'style-reference.png'
    write(out/'candidate.json', {'version': 1, 'candidates': [candidate]})
    qa = ROOT/config['qa']
    write(qa/'clearance-input.json', {'candidates': [{
        'id': config['clearanceId'],
        'glb': glb.relative_to(ROOT/'public/demos/vehicle-bake').as_posix()}]})
    print(json.dumps({'status': 'prepared', 'audit': audit, 'output': str(out)}, indent=2))


def assemble(config):
    out = ROOT/config['output']
    assert not (out/'review-manifest.json').exists(), 'Frozen revision'
    folder = out/'captures'
    candidate = read(out/'candidate.json')['candidates'][0]
    portable_report(read(out/candidate['report']))
    assert read(folder/'capture.json')['glbSha256'] == candidate['audit']['sha256']
    size = candidate.get('nativeSize', 128)
    font, small = ImageFont.load_default(size=18), ImageFont.load_default(size=13)
    def captured(mode, index):
        image = Image.open(folder/f'{mode}-{index}.png').convert('RGBA')
        assert image.size == (size, size), 'Native capture dimensions drifted'
        return image
    # Every panel retains the entire capture, with integer nearest enlargement only.
    for scale in [1, 2, 3]:
        cell, row_height = size*scale+24, size*scale+44
        for mode in ['study', 'engine']:
            sheet = Image.new('RGB', (4*cell+24, 4*row_height+110), '#18272d')
            draw = ImageDraw.Draw(sheet)
            draw.text((20, 16), f'{candidate["name"]} / {mode.upper()} / {scale}x nearest / ACTUAL GLB', font=font, fill='#f3deac')
            draw.text((20, 44), 'Human review pending / fixed pixel density / STYLE references are not targets', font=small, fill='#afc8bd')
            for index in range(16):
                image = captured(mode, index).resize((size*scale, size*scale), Image.Resampling.NEAREST)
                x, y = 24+(index%4)*cell, 78+(index//4)*row_height
                draw.text((x, y), f'{index*22.5:g} deg / {size}px native', font=small, fill='#afc8bd')
                sheet.paste(image, (x, y+22), image)
            sheet.save(folder/f'{mode}-{scale}x.png')
    study = Image.open(folder/'study-1x.png')
    engine = Image.open(folder/'engine-1x.png')
    contact = Image.new('RGB', (study.width, study.height+engine.height), '#18272d')
    contact.paste(study, (0, 0)); contact.paste(engine, (0, study.height))
    contact.save(folder/'contact-sheet.png')
    cell, row_height = size*2+24, size*2+40
    phases = Image.new('RGB', (4*cell+24, 4*row_height+88), '#18272d')
    draw = ImageDraw.Draw(phases)
    draw.text((20, 14), 'WHEEL ROLL / 8 signed phases per camera / 2x nearest', font=font, fill='#f3deac')
    for row, mode in enumerate(['study', 'engine']):
        for index in range(8):
            prefix = 'roll' if mode == 'study' else 'game-roll'
            image = Image.open(folder/f'{prefix}-{index}.png').convert('RGBA').resize((size*2, size*2), Image.Resampling.NEAREST)
            x, y = 24+(index%4)*cell, 60+(row*2+index//4)*row_height
            draw.text((x, y), f'{mode} / {(index if index<4 else index-8)*45} deg roll', font=small, fill='#afc8bd')
            phases.paste(image, (x, y+22), image)
    phases.save(folder/'wheel-phases.png')
    for mode in ['study', 'engine']:
        frames = []
        for index in range(16):
            image = captured(mode, index)
            frame = Image.new('RGB', (size*4+76, size*3+110), '#263d37')
            frame.paste(image, (20, 80+size), image)
            big = image.resize((size*3, size*3), Image.Resampling.NEAREST)
            frame.paste(big, (size+48, 64), big)
            draw = ImageDraw.Draw(frame)
            draw.text((18, 14), f'{candidate["name"]} / {mode} / {index*22.5:g} deg', font=font, fill='#f3deac')
            draw.text((20, 58+size), 'NATIVE 1x', font=small, fill='#afc8bd')
            draw.text((size+48, 42), 'NEAREST 3x', font=small, fill='#afc8bd')
            draw.text((18, frame.height-26), 'Actual GLB / human review pending / no gameplay activation', font=small, fill='#afc8bd')
            frames.append(frame)
        frames[0].save(folder/('turntable.gif' if mode == 'study' else 'game-turntable.gif'),
                       save_all=True, append_images=frames[1:], duration=160, loop=0, disposal=2, optimize=False)
    offline(config)


def offline_html(config):
    out = ROOT/config['output']
    manifest = read(out/'candidate.json')
    assets = {}
    for path in out.rglob('*'):
        if not path.is_file() or path.suffix not in ['.glb', '.png', '.json', '.gif']:
            continue
        mime = 'model/gltf-binary' if path.suffix == '.glb' else mimetypes.guess_type(path)[0] or 'application/octet-stream'
        assets[path.relative_to(out).as_posix()] = 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
    html = (out/'index.html').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="review.css" />', '<style>'+(out/'review.css').read_text(encoding='utf-8')+'</style>')
    data = json.dumps({'manifest': manifest, 'assets': assets}).replace('</', '<\\/')
    js = (out/'viewer.js').read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = html.replace('<script src="viewer.js" defer></script>', '<script>window.familyReviewOffline='+data+';</script><script>'+js+'</script>')
    for name in assets:
        if name in assets:
            html = html.replace('href="'+name+'"', 'href="'+assets[name]+'" download="'+Path(name).name+'"')
    return html


def offline(config):
    destination = (ROOT/config['offline']).resolve()
    assert destination.is_relative_to((ROOT/'data/vehicle-bake').resolve()), 'Offline output must remain ignored scratch'
    relative = destination.relative_to(ROOT).as_posix()
    check = subprocess.run((['wsl'] if sys.platform == 'win32' else []) + ['git', 'check-ignore', '--quiet', '--', relative], cwd=ROOT)
    assert check.returncode == 0, 'Offline output must be Git-ignored'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(offline_html(config), encoding='utf-8')


def verify_frozen(config):
    out = ROOT/config['output']
    frozen = read(out/'review-manifest.json')['candidates'][0]
    batch = read(out.parent/'manifest.json')
    candidate = next(row for row in batch['candidates'] if row['id'] == config['id'])
    assert {k:v for k,v in candidate.items() if k != 'files'} == {k:v for k,v in frozen.items() if k != 'files'}, 'Root candidate metadata drift'
    expected = {public_url(p) for p in out.rglob('*') if p.is_file()}
    pinned = {item['url'] for item in candidate['files']}
    assert len(pinned) == len(candidate['files']) and pinned == expected, 'Public file inventory mismatch'
    assert candidate['files'] == frozen['files'] + [{'url': public_url(out/'review-manifest.json'), 'sha256': digest(out/'review-manifest.json')}]
    for item in candidate['files'] + frozen['sourceInputs']:
        for key in ['url', 'source', 'retained']:
            if key not in item: continue
            path = ROOT/'public'/item[key]
            assert '\\' not in item[key] and path.resolve().is_relative_to((ROOT/'public').resolve())
            assert digest(path) == item['sha256'], item[key]
    sources = {public_url(p) for p in (ROOT/config['source']).rglob('*') if p.is_file()}
    assert sources == {item['source'] for item in frozen['sourceInputs']}, 'Source input inventory drift'
    assert audit_glb(out/frozen['glb']) == frozen['audit'], 'Actual GLB audit drift'
    portable_report(read(out/frozen['report']))
    return candidate


def frozen_offline(config):
    verify_frozen(config)
    offline(config)
    print(json.dumps({'status': 'offline-regenerated', 'id': config['id'], 'offline': config['offline']}))


def freeze(config):
    out, qa = ROOT/config['output'], ROOT/config['qa']
    assert not (out/'review-manifest.json').exists(), 'Frozen revision'
    candidate = read(out/'candidate.json')['candidates'][0]
    assert read(out/candidate['report'])['status'] == 'complete', 'Author report incomplete'
    portable_report(read(out/candidate['report']))
    assert audit_glb(out/candidate['glb']) == candidate['audit'], 'Retained GLB drift'
    for item in candidate['sourceInputs']:
        assert digest(ROOT/'public'/item['source']) == item['sha256'], 'Author inputs changed after capture'
        assert digest(ROOT/'public'/item['retained']) == item['sha256'], 'Retained input changed'
    proof = read(qa/'clearance.json')
    assert len(proof) == 1 and proof[0]['status'] == 'passed'
    assert proof[0]['glbSha256'] == candidate['audit']['sha256']
    capture = read(out/'captures/capture.json')
    assert capture['glbSha256'] == candidate['audit']['sha256'] and capture['status'] == 'passed'
    browser_qa = read(qa/'browser-qa.json')
    assert browser_qa['status'] == 'passed'
    assert isinstance(browser_qa['offline'], dict), 'Run --qa-only after offline assembly'
    assert browser_qa['offline']['exactGlbSha256'] == candidate['audit']['sha256']
    visual = read(qa/'visual-inspection.json')
    assert visual['status'] == 'no-blocking-issues' and visual['glbSha256'] == candidate['audit']['sha256']
    shutil.copyfile(qa/'clearance.json', out/'clearance.json')
    shutil.copyfile(qa/'browser-qa.json', out/'browser-qa.json')
    shutil.copyfile(qa/'visual-inspection.json', out/'visual-inspection.json')
    for name in ['desktop.png', 'mobile.png']:
        shutil.copyfile(qa/name, out/'captures'/('viewer-'+name))
    candidate.update({'url': public_url(out/'index.html'),
                      'qualification': {'neutralRollClearance': proof[0], 'sharedEngine': capture['rig'],
                                        'art': 'awaiting owner review', 'runtime': 'not integrated',
                                        'steering': 'unqualified'},
                      'files': [{'url': public_url(p), 'sha256': digest(p)} for p in sorted(out.rglob('*')) if p.is_file()]})
    write(out/'review-manifest.json', {'version': 1, 'candidates': [candidate]})
    # The root batch also pins the exact frozen per-revision review manifest.
    entry = {**candidate, 'files': candidate['files']+[
        {'url': public_url(out/'review-manifest.json'), 'sha256': digest(out/'review-manifest.json')}]}
    batch_path = out.parent/'manifest.json'
    batch = read(batch_path) if batch_path.exists() else {'version': 1, 'candidates': []}
    assert not any(row['id'] == entry['id'] for row in batch['candidates']), 'Registered revision already exists'
    batch['candidates'].append(entry)
    write(batch_path, batch)
    offline(config)
    print(json.dumps({'status': 'frozen', 'id': entry['id'], 'files': len(entry['files']), 'sha256': candidate['audit']['sha256']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('config', type=Path)
    parser.add_argument('action', choices=['prepare', 'assemble', 'freeze', 'offline'])
    args = parser.parse_args()
    config = read(args.config)
    {'prepare': prepare, 'assemble': assemble, 'freeze': freeze, 'offline': frozen_offline}[args.action](config)
