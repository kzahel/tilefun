"""Rebuild new action banks from only retained inputs in an isolated directory."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys,uuid
R=Path(__file__).resolve().parents[2];animal=sys.argv[1]
source=f'art-source/wildlife-v2/{animal}/behavior-v1';output=f'public/demos/wildlife-v2/{animal}/behavior-v1'
S=R/source;O=R/output
assert '--check' in sys.argv or not (S/'receipt.json').exists(), 'Registered banks may only be checked in isolation'
inputs=json.loads((S/'inputs.json').read_text())
root=R/'data/wildlife-157/replay'/f'{animal}-{uuid.uuid4().hex[:8]}'
paths=[str(p.relative_to(R)).replace('\\','/') for p in S.iterdir() if p.name in ['inputs.json','build.py','finish.py','paint.py','idle-guides.json']]
paths+=list(inputs['sha256'])+['art-source/wildlife-v2/camera.json','public/demos/pixel-characters/person-32.png']
paths += [f'scripts/wildlife/meadow-{name}' for name in ['build.py','finish.py','audit.py','playback.js']]
for name in paths:
    dest=root/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(R/name,dest)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected={p.name:sha(p) for p in O.iterdir() if p.suffix in ['.png','.gif','.html','.js','.json'] and p.name!='validation.json'}
blender=os.environ.get('BLENDER_BIN') or shutil.which('blender') or 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
commands=[[blender,'-b','--factory-startup','-t','2','--python-exit-code','1','--python',str(root/source/'build.py')],[sys.executable,str(root/source/'finish.py')],[blender,'-b','--factory-startup','-t','2','--python-exit-code','1','--python',str(root/'scripts/wildlife/meadow-audit.py'),'--',animal]]
root.mkdir(parents=True,exist_ok=True)
with (root/'replay.log').open('w') as log:
    for cmd in commands:subprocess.run(cmd,cwd=root,check=True,stdout=log,stderr=subprocess.STDOUT)
actual={name:sha(root/output/name) for name in expected}
assert expected==actual,[name for name in expected if expected[name]!=actual[name]]
result=dict(identity=f'{animal}-behavior-v1',status='byte-identical',isolation='retained inputs only',artifacts=len(expected),sha256=actual)
(root/'replay.json' if '--check' in sys.argv else S/'replay.json').write_text(json.dumps(result,indent=2)+'\n')
print('MEADOW_REPLAY_OK',animal,len(expected))
