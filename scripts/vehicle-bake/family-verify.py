"""Verify a frozen original-family review, its source inputs and optional old-byte baseline."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re

from catalog import audit_glb

ROOT = Path(__file__).resolve().parents[2]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('config', type=Path)
parser.add_argument('--baseline', type=Path)
args = parser.parse_args()
config = read(args.config)
out = ROOT/config['output']
frozen = read(out/'review-manifest.json')['candidates'][0]
batch = read(out.parent/'manifest.json')
candidate = next(row for row in batch['candidates'] if row['id'] == config['id'])
assert candidate['audit'] == frozen['audit'] == audit_glb(out/frozen['glb'])
expected = {p.relative_to(ROOT/'public').as_posix() for p in out.rglob('*') if p.is_file()}
pinned = {file['url'] for file in candidate['files']}
assert pinned == expected, {'missing': sorted(expected-pinned), 'extra': sorted(pinned-expected)}
for item in candidate['files']:
    assert sha(ROOT/'public'/item['url']) == item['sha256'], item['url']
for item in frozen['sourceInputs']:
    assert sha(ROOT/'public'/item['source']) == item['sha256'], item['source']
    assert sha(ROOT/'public'/item['retained']) == item['sha256'], item['retained']
html = (ROOT/config['offline']).read_text(encoding='utf-8')
match = re.search(r'window\.familyReviewOffline=(.*?);</script>', html, re.S)
assert match, 'Offline payload not found'
payload = json.loads(match[1])
embedded = base64.b64decode(payload['assets'][frozen['glb']].split(',', 1)[1])
assert hashlib.sha256(embedded).hexdigest() == frozen['audit']['sha256']
assert '<script src=' not in html and '<link rel="stylesheet"' not in html
baseline_count = 0
if args.baseline:
    for file, expected_sha in read(args.baseline).items():
        assert sha(ROOT/file) == expected_sha, 'Frozen pre-existing bytes changed: '+file
        baseline_count += 1
print(json.dumps({'status': 'passed', 'id': candidate['id'], 'publicFiles': len(pinned),
                  'glbSha256': frozen['audit']['sha256'], 'offlineExact': True,
                  'unchangedPriorFiles': baseline_count}, indent=2))
