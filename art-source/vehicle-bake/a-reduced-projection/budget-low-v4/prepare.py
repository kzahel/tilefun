"""Freeze byte-exact sprite/mask inputs for Blender, using Pillow only."""
from pathlib import Path
from PIL import Image
import json,hashlib,sys
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir())
revision=sys.argv[1] if len(sys.argv)>1 else 'v1'
report=ROOT/'public/demos/vehicle-bake/a-reduced-projection'/revision/'report.json'
assert not report.exists() or json.loads(report.read_text()).get('status')!='complete','Finished revision is immutable'
D=ROOT/'art-source/vehicle-bake/a-reduced-projection'/revision/'evidence/inputs'
D.mkdir(parents=True,exist_ok=True)
configPath=D.parents[1]/'input-recipe.json';config=json.loads(configPath.read_text()) if configPath.exists() else {}
files={}
for i in range(8):
 for label,p in [('target',ROOT/config.get('targetDirectory','public/demos/vehicle-style-study/03-guide-pixel-finish')/f'view-{i}.png'),('guide',ROOT/config.get('guideDirectory','public/demos/vehicle-style-study/03-guide-pixel-finish')/f'guide-{i}.png')]:
  im=Image.open(p).convert('RGBA');(D/f'{label}-{i}.rgba').write_bytes(im.tobytes());im.save(D/f'{label}-{i}.png')
  files[str(p.relative_to(ROOT))]=hashlib.sha256(p.read_bytes()).hexdigest()
p=ROOT/config.get('sourceBlend','art-source/vehicle-style-study/03-guide-pixel-finish/sports-coupe.blend')
files[str(p.relative_to(ROOT))]=hashlib.sha256(p.read_bytes()).hexdigest()
(D.parent/'source-hashes.json').write_text(json.dumps(files,indent=2)+'\n')
print(D)
