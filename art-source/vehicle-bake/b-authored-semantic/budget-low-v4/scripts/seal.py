"""Freeze an inspected candidate and verify exact source/output bytes later."""
import argparse, hashlib, json, shutil
from pathlib import Path
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'scripts/vehicle-bake/README.md').is_file())
ROUTE='b-authored-semantic'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--revision',required=True);ap.add_argument('--verify',action='store_true');a=ap.parse_args()
 src=ROOT/'art-source/vehicle-bake'/ROUTE/a.revision;out=ROOT/'public/demos/vehicle-bake'/ROUTE/a.revision;lock=src/'complete.lock.json'
 if a.verify:
  manifest=json.loads(lock.read_text())
  for name,digest in manifest['files'].items():
   p=ROOT/name;assert p.is_file() and sha(p)==digest,f'Changed or missing completed file: {name}'
  print(f'{a.revision}: {len(manifest["files"])} immutable files verified');return
 if lock.exists():raise SystemExit('Completed candidate is immutable')
 report=json.loads((out/'report.json').read_text());inspection=json.loads((src/'inspection.json').read_text())
 assert inspection['allEightViewsInspected'] and inspection['nativeAnd4x'] and inspection['intermediateAndRollInspected']
 assert report['unlit'] and report['actualExportWheelClearancePassed'] and report['packedSourceAtlas']
 assert report['meshCount']==5 and report['primitiveCount']==5 and report['materialCount']==1
 assert 1200<=report['triangles']<=3000
 scripts=src/'scripts';scripts.mkdir(exist_ok=True)
 for p in Path(__file__).parent.iterdir():
  if p.suffix=='.py' or p.name in ('requirements.txt','README.md'):shutil.copyfile(p,scripts/p.name)
 report['status']='complete';report['visualInspection']=inspection;report['scriptSnapshot']=str(scripts.relative_to(ROOT)).replace('\\','/')
 report['scriptHashes']={p.name:sha(p) for p in scripts.glob('*.py')}
 report['transferLimitations']+=inspection['remainingLimitations']
 report['coordinatorEvidence']=inspection['coordinatorEvidence']
 report['coordinatorNext']='Register these exact final revisions and present the red coupe budget/style comparison for owner review. No family expansion yet.'
 budget='low' if 'low' in a.revision else 'high'
 sp=str(scripts.relative_to(ROOT)).replace('\\','/')
 report['replayCommands']=[f'python {sp}/paint.py --revision NEW',f'& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python {sp}/build.py -- --revision NEW --budget {budget}',f'python {sp}/finish.py --revision NEW']
 report['files']={p.name:sha(p) for p in out.iterdir() if p.is_file() and p.name!='report.json'}
 (out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
 # Blender's local save backup is a draft, not a replay dependency.
 for p in src.glob('*.blend1'):p.unlink()
 files={str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for directory in (src,out) for p in directory.rglob('*') if p.is_file() and p!=lock and '__pycache__' not in p.parts}
 lock.write_text(json.dumps({'route':ROUTE,'revision':a.revision,'status':'complete','files':files},indent=2)+'\n')
 print(f'{a.revision}: completed and frozen {len(files)} files')
if __name__=='__main__':main()
