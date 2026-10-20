from pathlib import Path
from collections import Counter
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

R = Path.cwd()
D = R / 'data/vehicle-riders/classic-outline-comparison'
OUT = D / 'v2'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
comparisons = {v: read(D / v / 'comparison.json') for v in ['v1', 'v2']}
controls = {v: read(D / v / 'identity-eye-control.json') for v in ['v1', 'v2']}
audit = read(OUT / 'peer-component-audit.json')
identity = read(R / 'art-source/vehicle-riders/classic-upright/v2/identity.json')
palette = {tuple(bytes.fromhex(c[1:])): k for k, c in identity['palette'].items()}
standing = Image.open(R / identity['sourcePNG']).convert('RGBA')
assert sha(R / identity['sourcePNG']) == identity['sourceSha256']
protected = {}
for comp in comparisons.values():
    for p, h in comp['inputHashes'].items():
        assert sha(R / p) == h, p
        protected[p] = h
for p, h in audit['inputHashes'].items():
    assert sha(R / p) == h, p
    protected[p] = h
assert len(audit['unchangedOwners']) == 18 and audit['profileBytesExact']

def load(v, name, mode, i):
    return Image.open(D / v / 'captures' / f'{name}-{mode}-{i}.png').convert('RGBA')

def bounds(points):
    if not points:
        return None
    return [min(p[0] for p in points), min(p[1] for p in points),
            max(p[0] for p in points) + 1, max(p[1] for p in points) + 1]

def span(box):
    return [box[2] - box[0], box[3] - box[1]] if box else None

def color_points(im, rgb):
    return [[x, y] for y in range(224) for x in range(224)
            if im.getpixel((x, y)) == (*rgb, 255)]

rows = {}
for v, control in controls.items():
    assert control['originalAtlasAndGeometryRestoredExactAll32']
    rows[v] = []
    for row in control['rows']:
        mode, yaw = row['mode'], row['yaw']
        i = round(yaw / 22.5)
        images = {k: load(v, n, mode, i) for k, n in [
            ('raw', 'raw-unoutlined'), ('violet', 'source-violet-rider'),
            ('common', 'common-vehicle-ink-rider')]}
        assert all(im.getchannel('A').tobytes() == images['raw'].getchannel('A').tobytes()
                   for im in images.values())
        owners = {}
        for p in row['surfacePixels']:
            owners.setdefault(p['owner'], []).append(p['pixel'])
        head_points = [p['pixel'] for p in row['surfacePixels']
                       if 'face UV' in p['owner'] or 'pointed ear' in p['owner']]
        ear_points = [p['pixel'] for p in row['surfacePixels'] if 'pointed ear' in p['owner']]
        pink_ears = [p['pixel'] for p in row['surfacePixels']
                     if 'pointed ear' in p['owner'] and tuple(p['color'][:3]) == (232, 181, 172)]
        face_points = [p['pixel'] for p in row['surfacePixels'] if 'face UV' in p['owner']]
        color_receipt = {}
        for variant, im in images.items():
            color_receipt[variant] = {}
            for role in ['n', 'l', 'p', 'y', 'v']:
                rgb = tuple(bytes.fromhex(identity['palette'][role][1:]))
                points = color_points(im, rgb)
                color_receipt[variant][role] = {'count': len(points), 'bounds': bounds(points), 'pixels': points}
        for role in ['n', 'l']:
            raw_points = {tuple(p) for p in color_receipt['raw'][role]['pixels']}
            color_receipt['raw'][role]['actualSurfaceOwners'] = dict(Counter(
                p['owner'] for p in row['surfacePixels'] if tuple(p['pixel']) in raw_points))
        rows[v].append({
            'mode': mode, 'yaw': yaw,
            'rawBounds': list(images['raw'].getbbox()),
            'outlinedBounds': list(images['violet'].getbbox()),
            'rawSpan': span(images['raw'].getbbox()),
            'outlinedSpan': span(images['violet'].getbbox()),
            'rawOpaquePixelCount': sum(1 for p in images['raw'].get_flattened_data() if p[3]),
            'outlinedOpaquePixelCount': sum(1 for p in images['violet'].get_flattened_data() if p[3]),
            'allThreeAlphaIdentical': True,
            'visibleHeadBounds': bounds(head_points), 'visibleHeadSpan': span(bounds(head_points)),
            'visibleEarSurfacePixels': len(ear_points), 'pinkEarSurfacePixels': len(pink_ears),
            'earPixelsAboveHighestFacePixel': max(0, bounds(face_points)[1] - bounds(ear_points)[1]) if ear_points and face_points else None,
            'pinkEarSurfaceCoordinates': pink_ears,
            'actualOwnerVisibility': {k: {'count': len(p), 'bounds': bounds(p)} for k, p in owners.items()},
            'paint': color_receipt,
            'rawEyePaintPixels': row['rawEyePixels'],
            'sourceInteriorEyePixels': row['sourceInteriorEyeSurvival'],
            'commonInteriorEyePixels': row['commonInteriorEyeSurvival'],
            'sourceInteriorEyeCoordinates': row['interiorPixelCoordinates']['violet'],
            'commonInteriorEyeCoordinates': row['interiorPixelCoordinates']['common'],
            'projectedEyeBounds': {k: a for k, a in row['projectedFeatureBounds'].items() if 'Eye' in k},
            'projectedFrontChartBounds': row['projectedFeatureBounds']['wholeFrontFaceChart'],
        })

font = ImageFont.load_default(size=12)
small = ImageFont.load_default(size=11)
bg = '#263d37'

def crop(im, mode):
    box = (80, 108, 144, 172) if mode == 'study' else (80, 80, 144, 144)
    b = im.getbbox()
    assert box[0] <= b[0] and box[1] <= b[1] and box[2] >= b[2] and box[3] >= b[3], b
    return im.crop(box)

def reference(source_row=0):
    im = Image.new('RGBA', (64, 64))
    im.paste(standing.crop((0, source_row * 16, 16, (source_row + 1) * 16)), (24, 19))
    return im

def paste(canvas, im, x, y, scale=1):
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
    canvas.paste(im, (x, y), im)

# All art cells share one fixed64-pixel crop and one density. Native and2x beside each.
poses = [(m, i) for m in ['study', 'engine'] for i in [0, 2, 3, 4, 5, 6, 8, 12]]
sheet = Image.new('RGB', (1232, 90 + len(poses) * 154), bg)
pen = ImageDraw.Draw(sheet)
pen.text((8, 8), 'CLASSIC PEER: original standing | v1 violet | v2 violet | v2 common ink | v2 eyes removed | v2 raw', font=font, fill='white')
pen.text((8, 28), 'Each cell: native64 crop + nearest2x. Same80/4.6 density, fixed projection/mount. No per-angle/model fit.', font=small, fill='#eed299')
pen.text((8, 46), 'Standing16px art stays literal pixels. Reference hip registration inferred; pose/projection differ. Agent QA only; no bike/normal/human approval.', font=small, fill='#eed299')
for n, (mode, i) in enumerate(poses):
    y = 88 + n * 154
    r1, r2 = rows['v1'][(['study', 'engine'].index(mode)) * 16 + i], rows['v2'][(['study', 'engine'].index(mode)) * 16 + i]
    pen.text((8, y), f"{mode} {i*22.5:g}deg; interior eyes v1={r1['sourceInteriorEyePixels']} v2={r2['sourceInteriorEyePixels']}; v2 N/L={r2['paint']['violet']['n']['count']}/{r2['paint']['violet']['l']['count']}", font=small, fill='white')
    refrow = 0 if i in [2, 3, 4, 5, 6] else {0: 2, 8: 3, 12: 1}[i]
    cells = [reference(refrow), crop(load('v1', 'source-violet-rider', mode, i), mode)]
    cells += [crop(load('v2', name, mode, i), mode) for name in [
        'source-violet-rider', 'common-vehicle-ink-rider', 'eyes-removed-source-violet', 'raw-unoutlined']]
    for c, im in enumerate(cells):
        paste(sheet, im, 8 + c * 204, y + 48)
        paste(sheet, im, 76 + c * 204, y + 20, 2)
sheet.save(OUT / 'peer-native-identity.png')

# Exhaustive32 native views in both revisions and both strokes, no auto-scale.
sheet = Image.new('RGB', (852, 60 + 32 * 142), bg)
pen = ImageDraw.Draw(sheet)
pen.text((8, 8), 'ALL32: v1 source violet | v2 source violet | v1 common vehicle ink | v2 common vehicle ink', font=font, fill='white')
pen.text((8, 28), 'Each cell native + nearest2x; same fixed64 crop. Raw source, not engine qualification.', font=small, fill='#eed299')
for n in range(32):
    mode, i = ('study' if n < 16 else 'engine'), n % 16
    y = 60 + n * 142
    pen.text((8, y), f'{mode} {i*22.5:g}deg', font=small, fill='white')
    for c, (v, name) in enumerate([('v1', 'source-violet-rider'), ('v2', 'source-violet-rider'), ('v1', 'common-vehicle-ink-rider'), ('v2', 'common-vehicle-ink-rider')]):
        im = crop(load(v, name, mode, i), mode)
        paste(sheet, im, 8 + c * 212, y + 45)
        paste(sheet, im, 76 + c * 212, y + 14, 2)
sheet.save(OUT / 'peer-all32.png')

# Literal224 renderer target / common Explorer ruler, including both strokes and revisions.
sheet = Image.new('RGB', (936, 1050), bg)
pen = ImageDraw.Draw(sheet)
pen.text((8, 8), 'UNCHANGED COMMON WORLD RULER: columns v1 violet / v2 violet / v1 common ink / v2 common ink', font=small, fill='white')
for m, mode in enumerate(['study', 'engine']):
    y = 45 + m * 500
    pen.text((8, y), f'{mode} front90: native224 above; fixed96x64 crop nearest2x below (no rescaling models)', font=small, fill='white')
    for c, (v, name) in enumerate([('v1', 'source-violet-ruler'), ('v2', 'source-violet-ruler'), ('v1', 'common-vehicle-ink-ruler'), ('v2', 'common-vehicle-ink-ruler')]):
        im = load(v, name, mode, 4)
        paste(sheet, im, 8 + c * 232, y + 20)
        # A96px-wide fixed crop holds Explorer and Classic. The identical ruler is never fitted to either.
        box = (48, 108, 144, 172) if mode == 'study' else (48, 80, 144, 144)
        paste(sheet, im.crop(box), 8 + c * 232, y + 264, 2)
sheet.save(OUT / 'peer-world-ruler.png')

result = {
    'status': 'complete-agent-peer-analysis', 'agentQAOnly': True,
    'humanApproval': False, 'formalHumanVerdict': None,
    'normalActivation': False, 'productionQualified': False,
    'actualBikeFitQualified': False, 'CarMeshAssetQualified': False,
    'rootOwnsVisualJudgementAndFitRelease': True,
    'sourceChanged': False, 'sourceRevision': 'v2',
    'glbSha256': comparisons['v2']['riderSha256'], 'triangles': 1766,
    'v1GlbSha256': comparisons['v1']['riderSha256'],
    'assessment': 'Substantial native face/collar readability improvement supported by independent eye-removal and surface-owner evidence. Remaining projection/identity differences are visible; this is not standing-silhouette parity or a human verdict.',
    'outlineEvidence': {k: comparisons['v2'][k] for k in [
        'rider32', 'alphaMasksIdenticalAll128Comparisons', 'visibleFixtureOcclusionMask32Identical',
        'originalSourceVioletRiderCombinedRuler96RGBAPixelExact',
        'projectionGeometryYawMountUnchanged', 'oneSharedRawDepthTargetForBothStrokes',
        'sharedCarPixelOutlineUsedUnchanged', 'originalSourceBytesUnchanged']},
    'independentGeometryAudit': {'unchangedOwnerCount': 18, 'unchangedOwners': audit['unchangedOwners'],
        'changedOwners': audit['changedOwners'], 'addedOwners': audit['addedOwners'],
        'removedOwners': audit['removedOwners'], 'profileBytesExact': True,
        'method': 'Exact unrounded component position/polygon-UV signatures, insensitive to vertex/face order and cyclic polygon start but preserving winding; actual GLB triangles independently mapped to master semantic owners.'},
    'eyeControl': {'all32PerRevision': True, 'v1EyeOnlyTexelsRemoved': 776, 'v2EyeOnlyTexelsRemoved': 944,
        'ignoredInMemoryTextureOnly': True, 'geometryAlphaAndRestoredPixelsExact': True,
        'projectedFeatureBoundsIncludeOccludedTriangles': True,
        'projectedRectangleHeightIsNotRasterSurvivalCount': True,
        'frontStudyInteriorV1V2': [2, 4], 'frontGameInteriorV1V2': [2, 4]},
    'originalStanding': {'sha256': identity['sourceSha256'], 'frontOccupiedSpan': [14, 16],
        'sideOccupiedSpan': [10, 16], 'eyes': [[4, 7], [11, 7]],
        'noVerifiedSeparateMouth': True, 'jawCollarCue': 'Original row10 N band and yellow center below it, not a separately identified smile.',
        'registration': 'Unscaled16px standing frame pasted at24,19 in fixed64px crop; inferred hip row13. Pose and camera differ.'},
    'anatomicalChange': {'headFrontHeightSourceV1V2': [0.32, 0.42],
        'exposedEarsSourceV1V2': [0.27, 0.17], 'earToFaceRatioV1V2': [0.27 / 0.32, 0.17 / 0.42],
        'headPlusEarHeightSourceUnchanged': 0.59, 'headWidthSourceUnchanged': 0.78,
        'hipProfileAndLowerBodyUnchanged': True,
        'rounding': 'V2 own ring head tapers upper/rear depth and adds a real closed neck collar. It is not an outline-only change.'},
    'limitations': [
        'Elevated front study v2 ears do not rise above the highest visible face pixel (v1:1px). Four pink inner-ear pixels survive, but the outer head reads rounder and less pointed than the original. Game front retains2px ear rise. Root should judge this identity tradeoff.',
        'Profile remains taller than the standing16px reference, especially game projection. Actual breadth contributes to vertical screen extent; no per-angle fit or morphology normalization was used.',
        'Side/rear collar and far eye visibility vary with real occlusion; projected UV rectangle bounds can include hidden surfaces.',
        'No actual-bike contact, runtime, animation, AI, fallback, all-avatar or human approval claim.'
    ],
    'all32Rows': rows,
    'protectedInputCount': len(protected), 'inputHashes': protected,
    'evidence': ['comparison.json', 'identity-eye-control.json', 'peer-component-audit.json',
        'peer-native-identity.png', 'peer-all32.png', 'peer-world-ruler.png'],
}
(OUT / 'peer-analysis.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
for v in ['v1', 'v2']:
    print(v)
    for row in rows[v]:
        if row['yaw'] in [0, 67.5, 90, 112.5, 180, 270]:
            print(row['mode'], row['yaw'], 'span', row['outlinedSpan'], 'head', row['visibleHeadSpan'],
                  'eye', row['rawEyePaintPixels'], row['sourceInteriorEyePixels'],
                  'N/L', [(k, row['paint'][k]['n']['count'], row['paint'][k]['l']['count']) for k in ['raw', 'violet', 'common']],
                  'ears', row['visibleEarSurfacePixels'], row['pinkEarSurfacePixels'])
print('Protected hashes unchanged:', len(protected))
