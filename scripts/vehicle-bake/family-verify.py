"""Verify all frozen public pins, source inputs, actual GLB and exact offline embedding."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import base64

spec = importlib.util.spec_from_file_location('family_package', Path(__file__).with_name('family-package.py'))
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('config', type=Path)
parser.add_argument('--baseline', type=Path)
args = parser.parse_args()
config = package.read(args.config)
candidate = package.verify_frozen(config)
html = (package.ROOT/config['offline']).read_text(encoding='utf-8')
assert html == package.offline_html(config), 'Offline HTML differs from exact frozen JS/CSS/assets embedding; run offline command'
match = re.search(r'window\.familyReviewOffline=(.*?);</script>', html, re.S)
assert match, 'Offline payload not found'
payload = json.loads(match[1])
assert payload['manifest'] == package.read(package.ROOT/config['output']/'candidate.json')
for name, encoded in payload['assets'].items():
    assert base64.b64decode(encoded.split(',', 1)[1]) == (package.ROOT/config['output']/name).read_bytes(), name
assert '<script src=' not in html and '<link rel="stylesheet"' not in html
count = 0
if args.baseline:
    for name, expected in package.read(args.baseline).items():
        assert package.digest(package.ROOT/name) == expected, 'Previous frozen bytes changed: '+name
        count += 1
print(json.dumps({'status': 'passed', 'id': candidate['id'], 'publicFiles': len(candidate['files']),
                  'glbSha256': candidate['audit']['sha256'], 'offlineExact': True,
                  'embeddedAssets': len(payload['assets']), 'unchangedPriorFiles': count}, indent=2))
