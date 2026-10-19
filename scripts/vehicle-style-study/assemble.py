"""Validate completed route evidence and assemble a frozen comparison/gallery index."""
import hashlib
import base64
import json
import mimetypes
from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/demos/vehicle-style-study'
ROUTES = [
    ('01-detailed-shaded', 'Detailed + glossy',
     'Smooth detailed geometry, glossy shading, then palette reduction and pixel ink.'),
    ('02-detailed-toon', 'Detailed + toon',
     'Detailed geometry with controlled colour bands before pixel reduction.'),
    ('03-guide-pixel-finish', 'Guides + pixel finish',
     'Detailed 3D guides with deliberately authored pixel clusters and highlights.'),
    ('04-simple-painted', 'Simple + painted',
     'A low-poly family with shared red, glass and trim paint roles.'),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def find_triangles(report):
    for key in ('evaluatedTriangles', 'evaluatedTriangleCount', 'triangles',
                'triangleCount', 'evaluated_triangles', 'triangle_count'):
        if isinstance(report.get(key), (int, float)):
            return int(report[key])
    for value in report.values():
        if isinstance(value, dict):
            result = find_triangles(value)
            if result:
                return result
    return 0


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default(size=16)
    small = ImageFont.load_default(size=12)
    title_font = ImageFont.load_default(size=26)
    overview = Image.new('RGB', (1300, 1380), '#192122')
    draw = ImageDraw.Draw(overview)
    draw.text((28, 22), 'TILEFUN / ORIGINAL SPORTS CAR STUDY', font=title_font, fill='#eee5d4')
    draw.text((28, 62), 'Independent workflows. Native pixels + nearest enlargements. Same camera / scale / ground anchor.',
              font=small, fill='#b1c1b6')
    manifest = {'version': 1, 'status': 'exploratory-unapproved',
                'renderContract': {'size': [128, 128], 'groundAnchor': [64, 92],
                                   'cameraElevation': 50, 'orthoScale': 7.2,
                                   'headings': list(range(0, 360, 45))},
                'routes': [], 'references': []}
    for row, (route, title, description) in enumerate(ROUTES):
        folder = OUT / route
        report = json.loads((folder / 'report.json').read_text(encoding='utf-8-sig'))
        assert report.get('status') == 'complete', f'{route}: report is not complete'
        triangles = find_triangles(report)
        assert triangles > 0, f'{route}: evaluated triangle count missing'
        palette = set()
        boxes = []
        required = [folder / file for file in ('comparison.png', 'turntable.gif', 'sheet.png', 'report.json')]
        required.extend(folder / f'{prefix}-{i}.png' for prefix in ('view', 'raw') for i in range(8))
        for path in required:
            assert path.is_file() and path.stat().st_size, f'Missing {path}'
        with Image.open(folder / 'sheet.png') as sheet:
            assert sheet.size == (1024, 128), f'{route}: incorrect sheet dimensions'
            for i in range(8):
                with Image.open(folder / f'view-{i}.png') as frame:
                    assert sheet.convert('RGBA').crop((i*128, 0, (i+1)*128, 128)).tobytes() == frame.convert('RGBA').tobytes(), f'{route}: sheet differs from frame'
        with Image.open(folder / 'turntable.gif') as turntable:
            assert turntable.n_frames == 8, f'{route}: turntable frame count differs'
        for i in range(8):
            with Image.open(folder / f'raw-{i}.png') as raw:
                assert raw.size == (512, 512), f'{route}: incorrect raw dimensions'
            with Image.open(folder / f'view-{i}.png') as image:
                rgba = image.convert('RGBA')
                assert rgba.size == (128, 128), f'{route}: incorrect native dimensions'
                alphas = set(rgba.getchannel('A').get_flattened_data())
                assert alphas == {0, 255}, f'{route}: nonbinary or empty alpha'
                box = rgba.getbbox()
                assert box and box[0] > 0 and box[1] > 0 and box[2] < 128 and box[3] < 128, f'{route}: clipped sprite'
                boxes.append(box)
                palette.update(p[:3] for p in rgba.get_flattened_data() if p[3])
                if i in (0, 1, 2, 3):
                    x, y = 300 + (i * 240), 106 + row * 250
                    native = rgba
                    overview.paste(native, (x, y), native)
                    big = rgba.resize((384, 384), Image.Resampling.NEAREST)
                    crop = big.getbbox()
                    # Trim display-only enlarged views; source frames/anchors stay fixed.
                    big = big.crop(crop)
                    factor = min(1, 210 / big.width, 112 / big.height)
                    if factor < 1:
                        # Enlarge selected isolated crop with an integer factor instead.
                        native_crop = rgba.crop(box)
                        k = max(1, min(3, 210 // native_crop.width, 112 // native_crop.height))
                        big = native_crop.resize((native_crop.width*k, native_crop.height*k), Image.Resampling.NEAREST)
                    overview.paste(big, (x - 20, y + 135), big)
        y = 125 + row * 250
        draw.text((28, y), f'{row+1:02}  {title}', font=font, fill='#edc28c')
        draw.text((28, y+29), f'{triangles:,} triangles', font=small, fill='#b1c1b6')
        draw.text((28, y+49), f'{len(palette)} final colours', font=small, fill='#b1c1b6')
        required_files = [{'url': str(path.relative_to(ROOT / 'public')).replace('\\', '/'),
                           'sha256': digest(path)} for path in required]
        scene = ROOT / f'data/vehicle-style-study/{route}/sports-coupe.blend'
        assert scene.is_file(), f'{route}: editable source scene missing'
        retained_scene = ROOT / f'art-source/vehicle-style-study/{route}/sports-coupe.blend'
        retained_scene.parent.mkdir(parents=True, exist_ok=True)
        if retained_scene.exists():
            assert digest(scene) == digest(retained_scene), f'{route}: retained source would change'
        else:
            shutil.copyfile(scene, retained_scene)
        # Keep the exact semantic guides, source metadata and inspection receipts,
        # rather than requiring local scratch state to understand the finish.
        evidence_root = ROOT / f'data/vehicle-style-study/{route}'
        for evidence in evidence_root.rglob('*'):
            if evidence.is_file() and evidence.suffix in ('.json', '.png'):
                target = retained_scene.parent / 'evidence' / evidence.relative_to(evidence_root)
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    assert digest(target) == digest(evidence), f'{route}: retained evidence would change'
                else:
                    shutil.copyfile(evidence, target)
        manifest['routes'].append({'id': route, 'number': f'{row+1:02}', 'title': title,
                                   'description': description, 'triangles': triangles,
                                   'colors': len(palette), 'nativeBounds': boxes,
                                   'sourceScene': str(retained_scene.relative_to(ROOT)).replace('\\', '/'),
                                   'sourceSha256': digest(retained_scene),
                                   'files': required_files})
    refdir = OUT / 'references'
    refdir.mkdir(exist_ok=True)
    for index, (asset, title) in enumerate([('compact-4', 'Original red compact'),
                                           ('car-8', 'Original green car')]):
        src = ROOT / f'art-source/vehicle-models/{asset}/v1/refs/east.png'
        dst = refdir / f'{asset}.png'
        shutil.copyfile(src, dst)
        with Image.open(dst) as image:
            manifest['references'].append({'title': title, 'file': f'references/{asset}.png',
                                           'width': image.width, 'sha256': digest(dst)})
            big = image.convert('RGBA').resize((image.width*3, image.height*3), Image.Resampling.NEAREST)
            overview.paste(big, (320+index*400, 1160), big)
    draw.text((28, 1160), 'SOURCE SPRITES', font=font, fill='#edc28c')
    draw.text((28, 1190), 'Original art, enlarged 3x', font=small, fill='#b1c1b6')
    overview.save(OUT / 'overview.png')
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    # File-URL-safe delivery: no server, fetch permission or external assets needed.
    assets = {}
    for path in OUT.rglob('*'):
        if path.is_file() and path.suffix in ('.png', '.gif', '.json'):
            mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
            assets[path.relative_to(OUT).as_posix()] = f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode('ascii')
    html = (OUT / 'index.html').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="gallery.css" />',
                        '<style>' + (OUT / 'gallery.css').read_text(encoding='utf-8') + '</style>')
    js = (OUT / 'gallery.js').read_text(encoding='utf-8')
    offline = json.dumps({'manifest': manifest, 'assets': assets}).replace('</', '<\\/')
    html = html.replace('<script type="module" src="gallery.js"></script>',
                        '<script>window.vehicleStudyOffline=' + offline + ';\n' + js + '</script>')
    for name in ('overview.png', 'manifest.json'):
        html = html.replace(f'href="{name}"', f'href="{assets[name]}" download="{name}"')
    standalone = ROOT / 'data/vehicle-style-study/standalone.html'
    standalone.write_text(html, encoding='utf-8')
    print(json.dumps({'routes': [{key: r[key] for key in ('id', 'triangles', 'colors')} for r in manifest['routes']],
                      'overview': str(OUT / 'overview.png')}, indent=2))


if __name__ == '__main__':
    main()
