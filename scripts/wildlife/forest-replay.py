"""Rebuild only new banks from minimal retained inputs in an isolated workspace."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys,uuid
R=Path(__file__).resolve().parents[2];a=sys.argv[1];revision='behavior-v8' if a=='foraging-resources' else 'behavior-v1';source=f'art-source/wildlife-v2/{a}/{revision}';output=f'public/demos/wildlife-v2/{a}/{revision}';S=R/source;O=R/output;check='--check' in sys.argv
assert check or not (S/'receipt.json').exists(),'Registered banks are immutable'
root=R/'data/wildlife-172/replays'/f'{a}-{uuid.uuid4().hex[:8]}'
helpers=['scripts/wildlife/forest-build.py','scripts/wildlife/forest-finish.py','scripts/wildlife/forest-resources.py','scripts/wildlife/meadow-playback.js']
inputs=json.loads((S/'inputs.json').read_text(encoding='utf8'));paths=list(inputs['sha256'])+[f'{source}/inputs.json']+helpers+['art-source/wildlife-v2/camera.json','public/demos/pixel-characters/person-32.png']
if a=='foraging-resources':paths+=[f'{source}/paint.json']
for path in paths:
 dest=root/path;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(R/path,dest)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected={p.name:sha(p) for p in O.iterdir() if p.suffix in ['.png','.gif','.html','.js','.json'] and p.name!='validation.json'}
blender=os.environ.get('BLENDER_BIN') or shutil.which('blender') or 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
if a=='foraging-resources':commands=[[sys.executable,str(root/'scripts/wildlife/forest-resources.py')]]
else:
 commands=[[blender,'-b','--factory-startup','-t','2','--python-exit-code','1','--python',str(root/'scripts/wildlife/forest-build.py'),'--',a],[sys.executable,str(root/'scripts/wildlife/forest-finish.py'),a]]
with (root/'replay.log').open('w') as log:
 for cmd in commands:subprocess.run(cmd,cwd=root,check=True,stdout=log,stderr=subprocess.STDOUT)
actual={name:sha(root/output/name) for name in expected};assert expected==actual,[name for name in expected if expected[name]!=actual[name]]
result=dict(identity=f'{a}-{revision}',status='byte-identical',isolation='minimal retained inputs only',artifacts=len(expected),sha256=actual)
(root/'replay.json' if check else S/'replay.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8',newline='\n');print('FOREST_REPLAY_OK',a,len(expected))
