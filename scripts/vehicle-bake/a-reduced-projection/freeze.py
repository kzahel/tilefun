"""Finalize manually inspected candidates, assert actual export, persist byte ledger.
This is not human art approval. Only invoke after inspecting all named sheets.
"""
from pathlib import Path
from PIL import Image
import json,sys,struct,hashlib,shutil,io
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir())
R=ROOT/'public/demos/vehicle-bake/a-reduced-projection';AR=ROOT/'art-source/vehicle-bake/a-reduced-projection';S=Path(__file__).resolve().parent
REVS=['budget-low-v4','budget-mid','v5']
shared={r['id'].split('--')[1]:r for r in json.loads((AR/'ladder-clearance.json').read_text())}
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for rev in REVS:
 O=R/rev;A=AR/rev;report=json.loads((O/'report.json').read_text());assert report['status']!='complete','Already frozen'
 clearance=json.loads((A/'evidence/clearance.json').read_text());assert clearance['allNeutralRollBodyClear'] and clearance['allNeutralRollFloorClear'];assert shared[rev]['status']=='passed' and shared[rev]['collidingBodyRejected']
 gbytes=(O/'model.glb').read_bytes();length=struct.unpack_from('<I',gbytes,12)[0];g=json.loads(gbytes[20:20+length]);binary=gbytes[28+length:]
 assert all('KHR_materials_unlit' in m.get('extensions',{}) and m.get('emissiveFactor',[0,0,0])==[0,0,0] and 'emissiveTexture' not in m for m in g['materials'])
 assert len(g['materials'])==len(g['textures'])==1
 view=g['bufferViews'][g['images'][0]['bufferView']];embedded=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
 atlas=Image.open(O/'atlas.png').convert('RGBA');assert set(atlas.getchannel('A').get_flattened_data())=={255}
 assert list(Image.open(io.BytesIO(embedded)).convert('RGBA').get_flattened_data())==list(atlas.get_flattened_data()),'Actual embedded glTF texture differs'
 palette=set()
 for i in range(8):palette.update(p[:3] for p in Image.open(A/f'evidence/inputs/target-{i}.png').convert('RGBA').get_flattened_data() if p[3])
 assert set(p[:3] for p in atlas.get_flattened_data())<=palette
 receipt=json.loads((O/'engine/receipt.json').read_text());assert not receipt['errors'];assert len(receipt['samples'])==32;assert all(m['unlit'] and not m['emissiveMap'] for m in receipt['materialAudit']['materials']);assert all(r['changed'] and r['othersUnchanged'] for r in receipt['independentRoll'])
 hashes=json.loads((A/'evidence/source-hashes.json').read_text());assert all(digest(ROOT/p)==h for p,h in hashes.items()),'Immutable source changed'
 for name in ('run.py','prepare.py','build.py','finish.py','audit.py','capture.mjs','review.py','freeze.py','verify.py','README.md'):
  shutil.copy2(S/name,A/'scripts'/name)
 for name in ('prepare.py','build.py'):shutil.copy2(S/name,A/name)
 # Candidate-specific configuration; old fender minima remain deliberate.
 shutil.copy2(A/'input-recipe.json',A/'scripts/coupe.json')
 recipe=json.loads((A/'recipe.json').read_text());recipe['inputRecipe']=json.loads((A/'input-recipe.json').read_text());(A/'recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
 shutil.copy2(A/'recipe.json',O/'recipe.json');shutil.copy2(AR/'ladder-clearance.json',A/'evidence/shared-ladder-clearance.json')
 metrics=json.loads((A/'evidence/comparison-metrics.json').read_text())
 report.update(status='complete',artReviewStatus='awaiting-owner-review',triangles=report['geometry']['triangles'],meshCount=5,materialCount=1,primitiveCount=5,vertexCount=report['geometry']['vertices'],atlasSize=[512,512],glbBytes=len(gbytes),glbSha256=digest(O/'model.glb'),atlasSha256=digest(O/'atlas.png'),paletteColorCount=len(set(atlas.get_flattened_data())),paintRuleVersion='exact-source-owner-visibility-projection-with-semantic-cleanup-v2',surfaceOwnershipEvidence=str((A/'evidence/ownership.png').relative_to(ROOT)).replace('\\','/'),sharedClearance=shared[rev],comparisonMetrics=metrics)
 report['visualInspection']=[{'views':[0,180],'finding':'Coupe proportions, actual open wells and dark window frames retained. Sill and hood shade speckling remains; far-side mirror and wheel fragments alias at native scale.'},{'views':[45,135,225,315],'finding':'Swept cabin, nose and rear deck remain coherent. Internal glass reflections/frame and three deck slats are atlas paint visible in actual GLB; slats alias at intermediate headings.'},{'views':[90,270],'finding':'Front lamps, dark windshield aperture, rear window and rear light bar remain readable. Target direction-specific bright body ramps are only approximately preserved.'},{'headings':list(range(0,360,45)),'evidence':'inspection-mesh.png, eight actual mesh renders inspected at native pixels and 4x nearest'},{'headings':[i*22.5 for i in range(16)],'evidence':'inspection-study.png and inspection-engine.png, actual full-Chromium shared GLB rendering with no lights inspected'},{'wheelRollDegrees':list(range(0,360,45)),'evidence':'inspection-roll.png, fixed body paint stable while wheel assembly turns; full neutral-roll cylinder proof retained separately'}]
 if rev=='v5':report['visualInspection'].append({'budgetFinding':'Preferred fidelity option: cleaner continuous side-glass band and finer hubs than mid; no silhouette/wheel-well blocking artifact observed.'})
 elif rev=='budget-mid':report['visualInspection'].append({'budgetFinding':'Credible economy option: thicker lower side-glass frame, chunkier hubs and slightly coarser nose than v5. Readability remains good at native scale.'})
 else:report['visualInspection'].append({'budgetFinding':'Minimum-budget comparison: broad dark side-glass wedge and coarse hubs visibly lose fidelity. Not preferred over mid; 1,332-triangle predecessor remains rejected.'})
 report['limitations']+=['About half the used UV texels lack an accepted projection sample; hidden/occluded and rejected boundary regions use explicit semantic fallback. See unknown/conflict masks.','QEM is not unconstrained one-click reduction: wheel radial envelope, buttress tip and open-pocket corrections plus component minima are necessary.','Source coachwork is 4.6 units long; mirrors/trim make actual exported total bounds slightly larger. Exact measured source-unit bounds are retained in clearance.json.','Family geometry, semantic patch coordinates and feature anchors are coupe-specific; no Beetle/bus/pickup validation.']
 report['validation'].update(actualKHRMaterialsUnlit=True,actualEmbeddedAtlasEqualsDeliveredAtlas=True,atlasOpaque=True,sourcePaletteOnly=True,fullChromiumNoLights=True,actualIndependentWheelRoll=True,actualNeutralRollBodyAndFloorClear=True,collidingBodyNegativeControlRejected=True,sharedHarnessUnmodified=True,renderThreads=4)
 nominal={'v5':2500,'budget-mid':1800,'budget-low-v4':1300}[rev]
 report['replayCommands']=[f'python scripts/vehicle-bake/a-reduced-projection/run.py --recipe art-source/vehicle-bake/a-reduced-projection/{rev}/input-recipe.json --revision NEW_REVISION --triangles {nominal} --capture']
 replay={'v5':'replay-high-check','budget-mid':'replay-mid-check'}.get(rev)
 if replay:
  assert digest(R/replay/'model.glb')==digest(O/'model.glb');assert (R/replay/'atlas.png').read_bytes()==(O/'atlas.png').read_bytes();assert all((R/replay/f'view-{i}.png').read_bytes()==(O/f'view-{i}.png').read_bytes() for i in range(8))
  report['validation']['retainedRecipeReplayExactGLBAtlasAndEightViews']=True
 (O/'report.json').write_text(json.dumps(report,indent=2)+'\n')
 ledger={'revision':rev,'reportSha256':digest(O/'report.json'),'publicFiles':{str(p.relative_to(O)).replace('\\','/'):digest(p) for p in O.rglob('*') if p.is_file()},'sourceFiles':{str(p.relative_to(A)).replace('\\','/'):digest(p) for p in A.rglob('*') if p.is_file() and p.name!='frozen.json'}}
 (A/'frozen.json').write_text(json.dumps(ledger,indent=2)+'\n');print('FROZEN',rev,report['triangles'],report['glbSha256'])
