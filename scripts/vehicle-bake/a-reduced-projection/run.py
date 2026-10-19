"""Reusable bounded CLI. Refuses all existing revisions. No shared-file writes.
python scripts/vehicle-bake/a-reduced-projection/run.py --recipe .../coupe.json --revision v5 --triangles 2500 --capture
"""
from pathlib import Path
import argparse,json,subprocess,sys,shutil
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir())
p=argparse.ArgumentParser();p.add_argument('--recipe',type=Path,default=Path(__file__).with_name('coupe.json'));p.add_argument('--revision',required=True);p.add_argument('--triangles',type=int,default=2500);p.add_argument('--budget-factor',type=float);p.add_argument('--capture',action='store_true');args=p.parse_args()
assert args.revision and all(c.isalnum() or c in '-_' for c in args.revision),'Simple revision name required'
recipe=json.loads(args.recipe.read_text());assert recipe['route']=='a-reduced-projection';assert recipe['family']=='approach-3-red-coupe','Other families require explicit geometry/ownership adapter'
assert recipe['renderThreads']==4 and recipe['atlasSize']==512
factor=args.budget_factor if args.budget_factor is not None else recipe['budgetFactors'].get(str(args.triangles))
if factor is None:raise SystemExit('Supply a configured budget or --budget-factor; actual exported count is audited separately')
A=ROOT/'art-source/vehicle-bake/a-reduced-projection'/args.revision;O=ROOT/'public/demos/vehicle-bake/a-reduced-projection'/args.revision
if A.exists() or O.exists():raise SystemExit('Revision already exists. Choose a new revision; retained outputs are immutable.')
A.mkdir(parents=True);recipe.update(outputRevision=args.revision,requestedTriangles=args.triangles,budgetFactor=factor)
(A/'input-recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
S=Path(__file__).resolve().parent
def run(cmd):subprocess.run([str(q) for q in cmd],cwd=ROOT,check=True)
run([sys.executable,S/'prepare.py',args.revision])
blender=[recipe['blenderExecutable'],'--background','--factory-startup','--threads','4','--python-exit-code','1','--python']
run(blender+[S/'build.py','--',args.revision,str(factor)])
run([sys.executable,S/'finish.py',args.revision]);run(blender+[S/'audit.py','--',args.revision])
clearance=json.loads((A/'evidence/clearance.json').read_text())
if not clearance['allNeutralRollBodyClear'] or not clearance['allNeutralRollFloorClear']:raise SystemExit('Draft retained for diagnosis: exported clearance failed')
if args.capture:run(['node',S/'capture.mjs',args.revision])
if args.capture:run([sys.executable,S/'review.py',args.revision])
(A/'scripts').mkdir()
for f in ('run.py','prepare.py','build.py','finish.py','audit.py','capture.mjs','review.py','coupe.json'):shutil.copy2(S/f,A/'scripts'/f)
print('Draft ready for inspection:',O)
