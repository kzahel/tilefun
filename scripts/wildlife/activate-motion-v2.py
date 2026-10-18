"""Explicitly select verified motion banks for existing shared Fauna profiles."""
from pathlib import Path
import json, re, sys

ROOT=Path(__file__).resolve().parents[2]
p=ROOT/'src/wildlife/Fauna.ts';code=p.read_text(encoding='utf8')
for species in sys.argv[1:]:
    ledger=json.loads((ROOT/'art-source/wildlife-v2/autonomous-140.json').read_text(encoding='utf8'))
    task=ledger['tasks'][species];revision=task['revision']
    assert task['state']=='in-progress'
    base=ROOT/f'public/demos/wildlife-v2/{species}/{revision}'
    meta=json.loads((base/'sprite.json').read_text(encoding='utf8'))
    receipt=ROOT/f'art-source/wildlife-v2/{species}/{revision}/receipt.json'
    assert receipt.exists(),'Register the verified bank before activation'
    start=code.index(f'    species: "{species}",')
    next_profile=code.find('\n    species: ',start+1)
    end=next_profile if next_profile>=0 else code.index('\n];',start)
    block=code[start:end]
    block=re.sub(r'image: "[^"]+"',f'image: "demos/wildlife-v2/{species}/{revision}/sheet.png"',block,count=1)
    block=re.sub(r'identity: "[^"]+"',f'identity: "{meta["identity"]}"',block,count=1)
    block=re.sub(r'sha256: "[0-9a-f]{64}"',f'sha256: "{meta["sheetSha256"]}"',block,count=1)
    cs=block.index('    clips: [');ce=block.index('    ],',cs)+len('    ],')
    lines=['    clips: [']
    for name in ['idle','walk','action','flee']:
        c=meta['clips']['walk' if name=='flee' else name]
        duration=c['frameDuration']/(2 if name=='flee' else 1)
        lines+=['      {',f'        name: "{name}",',f'        start: {c["start"]},',f'        count: {c["count"]},',f'        frameDuration: {duration:g},',f'        loop: {str(name!="action").lower()},','      },']
    lines+=['    ],'];block=block[:cs]+'\n'.join(lines)+block[ce:]
    code=code[:start]+block+code[end:]
p.write_text(code,encoding='utf8',newline='\n')
print('Activated existing profiles:',', '.join(sys.argv[1:]))
