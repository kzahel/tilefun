"""Prepare/freeze an original-family review without changing any source candidate.

Usage: python scripts/vehicle-bake/family-package.py CONFIG {prepare,assemble,freeze}
Captures are actual shared-engine PNGs. Pillow only assembles these pixels.
"""
import argparse
import base64
import hashlib
import json
import mimetypes
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
    candidate.update({'glb': 'inputs/'+glb.relative_to(source).as_posix(),
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
    font, small = ImageFont.load_default(size=18), ImageFont.load_default(size=13)
    # Full uncropped native cards beside 2x pixels, no image repaint.
    sheet = Image.new('RGB', (1200, 1630), '#18272d')
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 18), candidate['name']+' / ACTUAL GLB / HUMAN REVIEW PENDING', font=font, fill='#f3deac')
    for row, mode in enumerate(['study', 'engine']):
        draw.text((24, 55+row*710), 'STUDY 50 DEG' if mode == 'study' else 'SHARED GAME CAMERA', font=font, fill='#bcd7cb')
        for index in range(16):
            image = Image.open(folder/f'{mode}-{index}.png').convert('RGBA')
            x, y = 24+(index % 4)*294, 88+row*710+(index//4)*172
            # Each cell shows native 128px; preserves all alpha and padding.
            draw.text((x, y), f'{index*22.5:g} deg / native', font=small, fill='#afc8bd')
            sheet.paste(image, (x+68, y+20), image)
    draw.text((24, 1510), 'Fixed unchanged source/game scales. 128px render + shared outline. No gameplay activation.', font=small, fill='#afc8bd')
    draw.text((24, 1540), 'Accepted coupe is a STYLE reference only. Neutral wheel roll clearance does not qualify steering.', font=small, fill='#afc8bd')
    sheet.save(folder/'contact-sheet.png')
    for mode in ['study', 'engine']:
        enlarged = Image.new('RGB', (1600, 1700), '#263d37')
        ed = ImageDraw.Draw(enlarged)
        for index in range(16):
            image = Image.open(folder/f'{mode}-{index}.png').convert('RGBA').resize((384, 384), Image.Resampling.NEAREST)
            x, y = (index % 4)*400+8, (index//4)*425
            ed.text((x, y+8), f'{mode} / {index*22.5:g} deg / 3x', font=small, fill='#f3deac')
            enlarged.paste(image, (x, y+30), image)
        enlarged.save(folder/f'{mode}-3x.png')
    phases = Image.new('RGB', (1120, 620), '#18272d')
    pd = ImageDraw.Draw(phases)
    pd.text((20, 14), '8 WHEEL PHASES / forward and reverse / same heading', font=font, fill='#f3deac')
    for index in range(8):
        image = Image.open(folder/f'roll-{index}.png').convert('RGBA')
        x, y = 12+(index%4)*278, 54+(index//4)*280
        phases.paste(image.resize((256, 256), Image.Resampling.NEAREST), (x, y), image.resize((256, 256), Image.Resampling.NEAREST))
        pd.text((x, y), f'phase {index} / {(index if index<4 else index-8)*45} deg', font=small, fill='#afc8bd')
    phases.save(folder/'wheel-phases.png')
    for mode in ['study', 'engine']:
        frames = []
        for index in range(16):
            image = Image.open(folder/f'{mode}-{index}.png').convert('RGBA')
            frame = Image.new('RGB', (580, 460), '#263d37')
            frame.paste(image, (18, 170), image)
            big = image.resize((384, 384), Image.Resampling.NEAREST)
            frame.paste(big, (176, 44), big)
            d = ImageDraw.Draw(frame)
            d.text((18, 14), f'{candidate["name"]} / {mode} / {index*22.5:g} deg', font=font, fill='#f3deac')
            d.text((18, 142), 'NATIVE 1x', font=small, fill='#afc8bd')
            d.text((18, 434), 'Actual GLB / human review pending / no gameplay activation', font=small, fill='#afc8bd')
            frames.append(frame)
        frames[0].save(folder/('turntable.gif' if mode == 'study' else 'game-turntable.gif'),
                       save_all=True, append_images=frames[1:], duration=160, loop=0, disposal=2, optimize=False)
    offline(config)


def offline(config):
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
    for name in ['captures/contact-sheet.png', 'captures/turntable.gif', 'clearance.json']:
        if name in assets:
            html = html.replace('href="'+name+'"', 'href="'+assets[name]+'" download="'+Path(name).name+'"')
    (ROOT/config['offline']).write_text(html, encoding='utf-8')


def freeze(config):
    out, qa = ROOT/config['output'], ROOT/config['qa']
    assert not (out/'review-manifest.json').exists(), 'Frozen revision'
    candidate = read(out/'candidate.json')['candidates'][0]
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
    parser.add_argument('action', choices=['prepare', 'assemble', 'freeze'])
    args = parser.parse_args()
    config = read(args.config)
    {'prepare': prepare, 'assemble': assemble, 'freeze': freeze}[args.action](config)
