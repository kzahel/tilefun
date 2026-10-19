"""Read-only frozen byte verification. No candidate output is written."""
from pathlib import Path
import json,hashlib,sys
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir())
for rev in sys.argv[1:] or ['budget-low-v4','budget-mid','v5']:
 A=ROOT/'art-source/vehicle-bake/a-reduced-projection'/rev;O=ROOT/'public/demos/vehicle-bake/a-reduced-projection'/rev
 ledger=json.loads((A/'frozen.json').read_text())
 for base,key in ((A,'sourceFiles'),(O,'publicFiles')):
  for name,h in ledger[key].items():assert hashlib.sha256((base/name).read_bytes()).hexdigest()==h,(rev,name)
 assert json.loads((O/'report.json').read_text())['status']=='complete'
 print('PASS immutable bytes',rev)
