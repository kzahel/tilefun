"""Pin existing completed candidate bytes and actual-GLB capture evidence in the review manifest."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/demos/vehicle-bake'
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
clearance=json.loads((OUT/'clearance.json').read_text(encoding='utf-8'))
by_id={r['id']:r for r in clearance}
for candidate in manifest['candidates']:
    proof=by_id[candidate['id']]
    assert proof['status']=='passed' and proof['glbSha256']==candidate['audit']['sha256']
    capture=OUT/'captures'/candidate['id']
    receipt=json.loads((capture/'capture.json').read_text(encoding='utf-8'))
    assert receipt['glbSha256']==candidate['audit']['sha256']
    assert receipt['stats']['triangles']==candidate['audit']['triangles']
    for file in candidate['files']:
        path=ROOT/'public'/file['url']
        assert hashlib.sha256(path.read_bytes()).hexdigest()==file['sha256'],f'Completed candidate changed: {path}'
    pinned = {file['url']:file for file in candidate['files']}
    shared = [OUT/name for name in ('index.html','review.css','viewer.js')]
    shared += sorted((OUT/'reference').glob('*.png'))
    for path in sorted(capture.iterdir())+shared:
        if path.suffix in ('.png','.json','.gif'):
            pass
        elif path not in shared:
            continue
        url='demos/vehicle-bake/'+path.relative_to(OUT).as_posix()
        pinned[url]={'url':url,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    candidate['files']=[pinned[url] for url in sorted(pinned)]
    candidate['qualification']={'neutralRollClearance':proof,'sharedEngineCapture':receipt['rig'],
                                'steering':'unqualified','art':'awaiting owner review','runtime':'not integrated'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(f"Pinned {len(manifest['candidates'])} candidates and their actual shared-engine captures.")
