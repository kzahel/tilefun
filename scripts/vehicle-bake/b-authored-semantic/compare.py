"""Read-only final-candidate replay audit and an unregistered ladder sheet."""
import json, hashlib
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
from finish import read_glb,accessor
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'scripts/vehicle-bake/README.md').is_file())
ROUTE='b-authored-semantic';OUT=ROOT/'public/demos/vehicle-bake'/ROUTE;DATA=ROOT/'data/vehicle-bake'/ROUTE
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 receipt={}
 for final,replay in [('v4','replay-check-high'),('budget-low-v4','replay-check-low')]:
  checks={name:sha(OUT/final/name)==sha(OUT/replay/name) for name in ['atlas.png']+[f'view-{i}.png' for i in range(8)]}
  assert all(checks.values()),checks
  g,b=read_glb(OUT/final/'model.glb');h,c=read_glb(OUT/replay/'model.glb');assert g==h
  index_ids={p['indices'] for m in g['meshes'] for p in m['primitives']}
  for i in range(len(g['accessors'])):
   a=accessor(g,b,i);z=accessor(h,c,i)
   if i in index_ids:
    canonical=lambda row:min(tuple(row),tuple(np.roll(row,1)),tuple(np.roll(row,2)))
    assert sorted(map(canonical,a.reshape(-1,3)))==sorted(map(canonical,z.reshape(-1,3)))
   else:assert np.array_equal(a,z)
  receipt[final]={'replayRevision':replay,'exactByteMatches':checks,'exactGlbByteMatch':sha(OUT/final/'model.glb')==sha(OUT/replay/'model.glb'),'sameJsonAndVertexAttributes':True,'sameOrientedTriangleMultiset':True,'modelSha256':sha(OUT/final/'model.glb'),'note':'Blender can reorder equivalent body triangles between background runs; canonical triangle comparison preserves winding.'}
 assert sha(OUT/'v4/atlas.png')==sha(OUT/'budget-low-v4/atlas.png')
 receipt['identicalBudgetAtlases']=True
 (DATA/'replay-audit.json').write_text(json.dumps(receipt,indent=2)+'\n')
 sheet=Image.new('RGBA',(1024,1600),(25,29,39,255));d=ImageDraw.Draw(sheet)
 d.text((12,8),'B / approach-3 target, 2378 tris, 1324 tris / identical atlas / actual exported GLBs',fill='white')
 for i in range(8):
  x=(i%4)*256;y=40+(i//4)*776
  paths=[ROOT/f'public/demos/vehicle-style-study/03-guide-pixel-finish/view-{i}.png',OUT/f'v4/view-{i}.png',OUT/f'budget-low-v4/view-{i}.png']
  for j,(name,p) in enumerate(zip(['Target 141 approach 3','High: 2378 triangles','Low: 1324 triangles'],paths)):
   tile=Image.new('RGBA',(256,256),(32,37,48,255));tile.alpha_composite(Image.open(p).convert('RGBA').resize((256,256),Image.Resampling.NEAREST));sheet.alpha_composite(tile,(x,y+j*256));d.text((x+6,y+j*256+6),f'{i} / {name}',fill='white')
 sheet.save(OUT/'ladder-comparison.png')
 for name in ('v4','budget-low-v4'):
  r=json.loads((OUT/name/'report.json').read_text());print(name,{k:r[k] for k in ['triangles','exportedVertices','sourceVertices','vertexSplitOverhead','textureBytes','glbBytes']},'meanIoU',sum(r['silhouetteIoU'])/8)
 print('Replay atlas and all 8 PNG bytes match; actual GLB JSON, attributes and oriented triangles match for both budgets')
if __name__=='__main__':main()
