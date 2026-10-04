"""Restore exact wildlife evidence from the separately preserved local archive."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive', type=Path)
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
parser.add_argument('--verify-only', action='store_true')
args = parser.parse_args()
root = args.root.resolve()
checkpoint = json.loads((root / 'art-source/wildlife-v2/source-checkpoint-20261004-cleanup.json').read_text())
digest = hashlib.file_digest(args.archive.open('rb'), 'sha256').hexdigest()
if digest != checkpoint['archive']['sha256']:
    raise SystemExit('Archive checksum does not match the source checkpoint')
with zipfile.ZipFile(args.archive) as archive:
    files = json.loads(archive.read('checkpoint/files.json'))
    # Verify every archived byte and destination before making any writes.
    for name, record in files.items():
        target = (root / name).resolve()
        if not target.is_relative_to(root) or not name.startswith(('art-source/wildlife-v2/', 'public/demos/wildlife-v2/')):
            raise SystemExit(f'Unsafe archive path: {name}')
        data = archive.read(name)
        if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']:
            raise SystemExit(f'Archived artifact changed: {name}')
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != record['sha256']:
            raise SystemExit(f'Refusing to overwrite changed artifact: {name}')
    restored = 0
    if not args.verify_only:
        for name in files:
            target = root / name
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(name))
                restored += 1
print(f'Verified {len(files)} exact artifacts; restored {restored} missing files.')
