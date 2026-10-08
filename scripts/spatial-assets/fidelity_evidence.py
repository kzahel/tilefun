"""Collect portable previews and byte-exact records for a conditioning study."""
import argparse
import html
import json
from pathlib import Path
from PIL import Image
from reference import digest, name

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--bundle', type=Path, required=True)
p.add_argument('--study', type=name, required=True)
p.add_argument('--meshes', type=name, required=True)
p.add_argument('--report', type=name, required=True)
p.add_argument('--destination', type=Path, required=True)
a = p.parse_args()
bundle = a.bundle.resolve()
study = bundle / 'conditioning-studies' / a.study
report = study / a.report
out = a.destination
out.mkdir(parents=True, exist_ok=False)
results = json.loads((report / 'results.json').read_text(encoding='utf8'))
records = []

def copy(source, relative, preview=False):
    target = out / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    record = {'origin': str(source.relative_to(bundle)), 'file': relative,
              'originSha256': digest(source), 'method': 'exact-copy'}
    if preview:
        image = Image.open(source)
        original_size = list(image.size)
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        image.save(target)
        record.update(method='LANCZOS display preview', originalSize=original_size, previewSize=list(image.size))
    else:
        target.write_bytes(source.read_bytes())
    record['sha256'] = digest(target)
    records.append(record)

for source, relative in [(report / 'results.json', 'results.json'), (study / 'plan.json', 'plan.json'),
                         (study / 'assessment.json', 'assessment.json'),
                         (study / a.meshes / 'execution.json', 'direct-execution.json')]:
    copy(source, relative)
for file in ['sheet.png', 'mesh-sheet.png']:
    copy(report / file, file, True)
for case in results['cases']:
    copy(bundle / 'references' / case['reference'] / 'generation.json', f'references/{case["reference"]}.json')
cards = ''
for case in results['directMeshCases']:
    run = case['run']
    copy(bundle / 'stage-sheets' / run / 'stages/sheet.png', f'stages/{run}.png', True)
    copy(bundle / 'pipelines' / run / 'pipeline.json', f'pipelines/{run}.json')
    copy(bundle / 'runs' / run / 'run.json', f'runs/{run}.json')
    if case.get('export'):
        copy(bundle / 'runs' / run / 'export/export.json', f'exports/{run}.json')
    cards += f'<h2>{html.escape(case["asset"])} strength {case["strength"]}</h2><a href="stages/{run}.png"><img src="stages/{run}.png" alt="Full pipeline stage preview"></a>'
assessment = results['agentAssessment']
page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conditioning fidelity evidence</title><style>body{font:16px system-ui;margin:24px;background:#f1f4f7;color:#243142}main{max-width:1500px;margin:auto}img{max-width:100%;height:auto}p,li{line-height:1.5}code{overflow-wrap:anywhere}</style></head><body><main><h1>Conditioning fidelity: SDXL strength and direct TRELLIS</h1>'
page += '<p>' + html.escape(assessment['summary']) + '</p><ul>' + ''.join('<li>' + html.escape(x) + '</li>' for x in assessment['observations']) + '</ul>'
page += '<p>Unreviewed agent diagnostics. These are display previews; original files, masks, arrays, orbit viewers and full provenance remain in the external bundle. No runtime artwork was replaced.</p><p><a href="results.json">Measurements and observations</a> | <a href="evidence.json">Preview transformations and hashes</a></p>'
page += '<h2>Before and after masking</h2><a href="sheet.png"><img src="sheet.png" alt="Three assets at four SDXL strengths, RGB and learned cutout separately"></a><h2>Matched 3D comparison</h2><a href="mesh-sheet.png"><img src="mesh-sheet.png" alt="Matched direct TRELLIS strength 0.65 and 0.8, front side and oblique"></a>' + cards
page += '<p>External report location: <code>' + html.escape(str(report / 'index.html')) + '</code>.</p></main></body></html>'
(out / 'index.html').write_text(page, encoding='utf8', newline='\n')
records.append({'file': 'index.html', 'sha256': digest(out / 'index.html'), 'method': 'generated portable report'})
(out / 'evidence.json').write_text(json.dumps({'study': a.study, 'inputManifestSha256': results['inputManifestSha256'],
 'implementationSha256': digest(__file__), 'files': records}, indent=2) + '\n', encoding='utf8', newline='\n')
for record in records:
    assert digest(out / record['file']) == record['sha256']
print(json.dumps({'destination': str(out), 'verifiedFiles': len(records)}))
