"""Explicit authoring verification only; ordinary builds never regenerate art."""
from pathlib import Path
import hashlib, json, os, shutil, subprocess, sys

ROOT=Path(__file__).resolve().parents[2]
species=sys.argv[1];revision=sys.argv[2] if len(sys.argv)>2 else 'behavior-v1'
assert all(c.islower() or c.isdigit() or c=='-' for c in species+revision)
S=ROOT/f'art-source/wildlife-v2/{species}/{revision}'
O=ROOT/f'public/demos/wildlife-v2/{species}/{revision}'
assert not (S/'receipt.json').exists(),'Use an isolated replay checkout for registered banks'
blender=os.environ.get('BLENDER_BIN') or shutil.which('blender') or 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
files=[p for p in O.iterdir() if p.suffix in ['.png','.gif'] or p.name in ['sprite.json','source-audit.json','pixel-audit.json']]
assert files and (O/'source-audit.json').exists()
before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
D=ROOT/f'data/wildlife-155/{species}/{revision}';D.mkdir(parents=True,exist_ok=True)
with (D/'replay.log').open('w',encoding='utf8') as log:
    for command in [[blender,'-b','--factory-startup','-t','2','--python-exit-code','1','--python',str(S/'build.py')],[sys.executable,str(S/'finish.py')],[blender,'-b','--factory-startup','-t','2','--python-exit-code','1','--python',str(S/'audit.py')]]:
        subprocess.run(command,cwd=ROOT,check=True,stdout=log,stderr=subprocess.STDOUT)
after={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
assert before==after,[n for n,h in before.items() if after[n]!=h]
result=dict(identity=f'{species}-{revision}',status='byte-identical',artifacts=len(files),sha256=after)
(D/'replay.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps(result|{'sha256':'omitted'}))
