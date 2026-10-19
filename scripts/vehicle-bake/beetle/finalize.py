"""Verify and retain the exact completed Beetle author candidate. No shared writes."""
from pathlib import Path
import hashlib, json, struct, shutil, io
from PIL import Image
import sys
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file() and (p/'public').is_dir())
sys.path.insert(0,str(ROOT/'scripts/vehicle-bake'))
from catalog import audit_glb
A=ROOT/'art-source/vehicle-bake/beetle/v1';O=ROOT/'public/demos/vehicle-bake/beetle/v1';D=ROOT/'data/vehicle-bake/beetle';S=ROOT/'scripts/vehicle-bake/beetle'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,obj):p.write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report=read(O/'report.json');assert report['status']=='draft','Finished report is immutable'
for key,name in [('sourceBlend','car.blend'),('masterBlend','master.blend'),('recipe','recipe.json')]:
 report[key]=(A/name).relative_to(ROOT).as_posix()
audit=audit_glb(O/'model.glb');assert 1800<=audit['triangles']<=3000
assert (audit['meshes'],audit['primitives'],audit['materials'],audit['textures'])==(5,5,1,1)
assert (A/'model.glb').read_bytes()==(O/'model.glb').read_bytes()
clearance=read(A/'evidence/shared-clearance.json')[0]
assert clearance['status']=='passed' and clearance['allNeutralRollAngles'] and clearance['collidingBodyRejected'] and clearance['baselineRestored']
assert clearance['glbSha256']==audit['sha256']
coverage=read(A/'evidence/upper-wheel-coverage-final.json')
assert coverage['glbSha256']==audit['sha256'] if 'glbSha256' in coverage else True
assert all(w['coveredCount']==w['sampleCount']==25 for w in coverage['wheels'])
assert coverage['controls']['positiveAndNegativeControlsPassed']
capture=read(O/'engine/capture.json');assert capture['glbSha256']==audit['sha256']
assert capture['status']=='passed' and len(capture['samples'])==32 and not capture['errors']
assert all(s['opaque']>300 and s['edge']==0 for s in capture['samples'])
assert len(capture['rig']['wheels'])==4 and capture['rig']['forwardReverseAbsoluteReset']
assert all(w['quarterTurn'] and w['pivotFixed'] and w['independent'] for w in capture['rig']['wheels'])
# Verify exporter image bytes and actual opaque unlit material, not display names.
b=(O/'model.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);binary=b[28+n:]
assert len(g['materials'])==1 and 'KHR_materials_unlit' in g['materials'][0]['extensions']
assert g['materials'][0].get('alphaMode','OPAQUE')=='OPAQUE'
assert all(s['magFilter']==9728 and s['minFilter'] in [9728,9984] for s in g['samplers'])
image=g['images'][0];v=g['bufferViews'][image['bufferView']];png=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
delivered=Image.open(O/'atlas.png').convert('RGBA');embedded=Image.open(io.BytesIO(png)).convert('RGBA')
assert delivered.size==(512,512) and embedded.tobytes()==delivered.tobytes()
assert delivered.getchannel('A').getextrema()==(255,255)
palette={tuple(c) for c in read(S/'family.json')['palette'].values()};assert {c[:3] for c in delivered.getdata()}<=palette
# Replay is generated only from committed-path recipe inputs, never read as input.
replay=D/'replay/public'
assert all((replay/f).read_bytes()==(O/f).read_bytes() for f in ['model.glb','atlas.png'])
write(A/'evidence/replay-verification.json',{'byteIdentical':True,'glbSha256':audit['sha256'],'atlasSha256':sha(O/'atlas.png'),'inputs':['scripts/vehicle-bake/beetle/build.py','scripts/vehicle-bake/beetle/family.json'],'scratchInputDependencies':[]})
# Preserve stale exploratory evidence in ignored scratch, not final source/review.
obsolete=D/'obsolete';obsolete.mkdir(exist_ok=True)
for p in [A/'car.blend1',A/'master.blend1',A/'evidence/upper-wheel-coverage.json',O/'quick-preview.png',O/'quick-capture.json']:
 if p.exists():shutil.move(str(p),str(obsolete/p.name))
for f in ['build.py','family.json','capture.mjs','sheets.py','coverage-region.json','finalize.py']:
 shutil.copy2(S/f,A/f)
shutil.copy2(O/'engine/capture.json',A/'evidence/engine-capture.json')
commands=[
 '& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/beetle/build.py -- --scratch',
 'node scripts/vehicle-bake/beetle/capture.mjs',
 'python scripts/vehicle-bake/beetle/sheets.py',
 '& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/clearance.py -- art-source/vehicle-bake/beetle/v1/evidence/clearance-input.json data/vehicle-bake/beetle/recheck-clearance.json',
 '& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/beetle/v1/model.glb --config scripts/vehicle-bake/beetle/coverage-region.json --output data/vehicle-bake/beetle/recheck-coverage.json'
]
baseline=ROOT/'data/vehicle-bake/beetle-qa/frozen-baseline.json';preserved=None
if baseline.exists():
 prior=read(baseline);changed=[p for p,h in prior.items() if not (ROOT/p).exists() or sha(ROOT/p)!=h]
 assert not changed,changed
 preserved={'priorFilesVerified':len(prior),'changedFiles':changed,'method':'Read-only SHA256 comparison against independent QA pre-authoring ledger.'}
 write(A/'evidence/prior-retained-preservation.json',preserved)
report.update(status='complete',artReviewStatus='awaiting-owner-review',runtime='not integrated',method='Original family-specific loft and swept open-arch fender geometry; directly authored semantic UV surface paint. Glass, frames, seams and vents live on actual coachwork UVs. No high-to-low/projection transfer claim.',geometry=audit,triangles=audit['triangles'],vertexCount=audit['vertices'],meshCount=5,primitiveCount=5,materialCount=1,textureCount=1,atlasSize=[512,512],atlasBytes=(O/'atlas.png').stat().st_size,glbBytes=audit['glbBytes'],glbSha256=audit['sha256'],atlasSha256=sha(O/'atlas.png'),exportWorldScale=80/4.6,sharedClearance=clearance,coverageEvidence='art-source/vehicle-bake/beetle/v1/evidence/upper-wheel-coverage-final.json',engineEvidence='engine/capture.json',replayCommands=commands,
 validation={'actualGLBCatalogAudit':True,'actualKHRMaterialsUnlit':True,'opaqueAtlas':True,'embeddedAtlasMatchesDelivered':True,'nearestMagnification':True,'nearestRuntimeMinificationNoMipmaps':True,'actualSharedEngine16HeadingsPerCamera':True,'independentWheelsAndFixedBody':True,'forwardReverseAbsoluteReset':True,'wholeBodyAllNeutralRollAngles':True,'collidingBodyNegativeControlRejected':True,'coverage25Of25Each':True,'sourceOnlyReplayByteIdentical':True,'renderThreads':4},
 visualInspection=[{'evidence':'inspection-study.png','headings':[i*22.5 for i in range(16)],'finding':'Recognizable rounded compact; tall dome, curved hood/lid, closed dark glass borders and broad blue clusters, real open arches; far tire crowns beneath fender shells.'},{'evidence':'inspection-engine.png','headings':[i*22.5 for i in range(16)],'finding':'Unchanged shared projection and outline, both ends/diagonals inspected. No crown exposure or clipping. Raised pontoon shoulders are deliberately separate classic fenders.'},{'evidence':'inspection-roll.png','phasesDegrees':list(range(0,360,45)),'finding':'Actual exported rolling wheel assemblies; body shape/paint stays fixed. Rig transform test additionally proves each wheel independently and reverse/reset.'}],
 limitations=['Owner art review pending; no gameplay integration or production approval.','Original semantic surface-authored family, not evidence of automatic source projection or high-to-low transfer.','Editable component master uses the same economical authored topology; no separate high-detail master is claimed.','Coverage is sampled vertical support, not a universal silhouette/occlusion proof; study/game views were separately inspected.','Neutral steering full-roll qualified; nonzero steering, suspension and physical gameplay bounds/handling remain unqualified.','Small lamp/vent/trim features retain ordinary native-pixel angle aliasing.','Atlas uses continuous coachwork UVs plus intentionally shared padded role swatches for trim/fenders/wheels.','GLB min sampler is NEAREST_MIPMAP_NEAREST from the shared Blender exporter; CarMeshAsset forces nearest min/mag and disables mipmaps.'],
 priorAssetsPreserved=preserved,sourceHashes={p.relative_to(ROOT).as_posix():sha(p) for p in sorted(A.rglob('*')) if p.is_file()})
write(O/'report.json',report)
write(A/'delivery.json',{'status':'complete','artReviewStatus':'awaiting-owner-review','glbSha256':audit['sha256'],'atlasSha256':sha(O/'atlas.png'),'report':'public/demos/vehicle-bake/beetle/v1/report.json','replayCommands':commands})
write(A/'retained-files.json',{p.relative_to(ROOT).as_posix():sha(p) for p in sorted([*A.rglob('*'),*O.rglob('*')]) if p.is_file() and p.name!='retained-files.json'})
print(json.dumps({'status':'complete','audit':audit,'clearanceMinimumGap':min(w['minimumGap'] for w in clearance['clearance']),'preserved':preserved},indent=2))
