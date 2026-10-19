"""Retain the polished exact bus candidate after actual-export evidence; no shared writes."""
from pathlib import Path
import hashlib,json,struct,shutil,sys,io
from PIL import Image
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').is_file())
sys.path.insert(0,str(ROOT/'scripts/vehicle-bake'))
from catalog import audit_glb
S=ROOT/'scripts/vehicle-bake/school-bus';A=ROOT/'art-source/vehicle-bake/school-bus/v1';O=ROOT/'public/demos/vehicle-bake/school-bus/v1';D=ROOT/'data/vehicle-bake/school-bus'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report=read(O/'report.json');assert report['status']=='draft','Completed revision immutable'
audit=audit_glb(O/'model.glb');assert audit['sha256']=='4b71cb259c5226af9657fe624585354ad66c41b3b66c5a2a2cf25ba61d3df42f'
assert 2500<=audit['triangles']<=3500 and (audit['meshes'],audit['primitives'],audit['materials'],audit['textures'])==(5,5,1,1)
assert (A/'model.glb').read_bytes()==(O/'model.glb').read_bytes()
clear=read(D/'clearance-final.json')[0]
assert clear['glbSha256']==audit['sha256'] and clear['status']=='passed'
assert clear['allNeutralRollAngles'] and clear['collidingBodyRejected'] and clear['baselineRestored']
coverage=read(D/'coverage-draft.json');assert coverage['inputSha256']==audit['sha256'] and coverage['inputBytesUnchanged']
assert all(w['coveredCount']==w['sampleCount']==25 for w in coverage['wheels']) and coverage['controls']['positiveAndNegativeControlsPassed']
capture=read(D/'author-view/captures/capture.json')
assert capture['glbSha256']==audit['sha256'] and capture['status']=='passed' and not capture['errors']
assert len(capture['views'])==32 and all(v['edgePixels']==0 and v['opaque']>300 for v in capture['views'])
assert capture['nativeSize']==224 and len(capture['phases'])==8
assert capture['rig']['forwardReverseAbsoluteReset'] and len(capture['rig']['wheels'])==4
assert all(w['quarterTurn'] and w['pivotFixed'] and w['independent'] and w['reverseQuarterTurn'] and w['absoluteReset'] for w in capture['rig']['wheels'])
source=read(D/'packed-source-audit.json');assert source['status']=='passed'
for n in ['master.blend','car.blend']:assert source['results'][n]['sha256']==sha(A/n)
# Actual glTF material/embedded pixels, not names.
b=(O/'model.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);binary=b[28+n:]
assert len(g['materials'])==1 and 'KHR_materials_unlit' in g['materials'][0]['extensions']
assert g['materials'][0].get('alphaMode','OPAQUE')=='OPAQUE'
assert all(s['magFilter']==9728 and s['minFilter'] in [9728,9984] for s in g['samplers'])
v=g['bufferViews'][g['images'][0]['bufferView']];png=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
im=Image.open(O/'atlas.png').convert('RGBA');embedded=Image.open(io.BytesIO(png)).convert('RGBA')
assert im.size==(512,512) and im.tobytes()==embedded.tobytes() and im.getchannel('A').getextrema()==(255,255)
assert {p[:3] for p in im.getdata()}<={tuple(c) for c in read(S/'family.json')['palette'].values()}
# Replay was run from retained source; verify both inputs and exact exported bytes.
for f in ['build.py','family.json','coverage-region.json','review.json']:
 assert (S/f).read_bytes()==(A/f).read_bytes()==(D/'replay/source'/f).read_bytes()
for f in ['model.glb','atlas.png']:assert (O/f).read_bytes()==(D/'replay/public'/f).read_bytes()
replay={'status':'passed','byteIdentical':True,'glbSha256':audit['sha256'],'atlasSha256':sha(O/'atlas.png'),'invokedBuilder':'art-source/vehicle-bake/school-bus/v1/build.py','inputHashes':{(A/f).relative_to(ROOT).as_posix():sha(A/f) for f in ['build.py','family.json','coverage-region.json','review.json']},'scratchInputDependencies':[],'sharedDependencies':['Blender 5.2 glTF exporter','scripts/vehicle-bake/catalog.py:audit_glb']}
# Remove backups from retained paths; they remain available only as ignored history.
(D/'obsolete').mkdir(exist_ok=True)
for p in A.glob('*.blend1'):shutil.move(str(p),str(D/'obsolete'/p.name))
for f in ['build.py','family.json','review.json','coverage-region.json','capture.mjs','sheets.py','audit-source.py','finalize.py']:shutil.copyfile(S/f,A/f)
for src,dst in [('clearance-final.json','shared-clearance.json'),('packed-source-audit.json','packed-source-audit.json'),('clearance-input.json','clearance-input.json')]:shutil.copyfile(D/src,A/'evidence'/dst)
# Normalize only the receipt's source path for portable retention; all sampled evidence stays unchanged.
coverage['input']=(O/'model.glb').relative_to(ROOT).as_posix();write(A/'evidence/upper-wheel-coverage.json',coverage)
write(A/'evidence/replay-verification.json',replay)
shutil.copyfile(D/'author-view/captures/capture.json',A/'evidence/engine-capture.json')
shutil.copyfile(D/'author-qa/browser-qa.json',A/'evidence/author-browser-qa.json')
(O/'engine').mkdir(exist_ok=True)
for p in (D/'author-view/captures').glob('*.png'):
 if p.name.startswith(('study-','engine-','roll-','game-roll-','wire-','inspection-')):shutil.copyfile(p,O/'engine'/p.name)
shutil.copyfile(D/'author-view/captures/capture.json',O/'engine/capture.json')
# Independent QA captured the previous frozen-asset ledger before this work began.
baseline=ROOT/'data/vehicle-bake/school-bus-qa/frozen-baseline.json'
assert baseline.exists();prior=read(baseline);changed=[p for p,h in prior.items() if not (ROOT/p).is_file() or sha(ROOT/p)!=h];assert not changed,changed
preserved={'priorFilesVerified':len(prior),'changedFiles':changed,'method':'SHA-256 comparison with independent QA pre-authoring frozen-asset ledger.'};write(A/'evidence/prior-retained-preservation.json',preserved)
limitations=['Owner visual approval pending; no bus gameplay/catalog activation.','Original semantic UV surface paint; no automatic projection or high-to-low transfer demonstrated.','Editable component master uses economical runtime topology, not a separate high-poly source.','Coverage is the declared finite bus crown/support region, not universal occlusion or silhouette proof. Both fixed camera sets were separately inspected.','Neutral steering full-roll qualified only; nonzero steering, suspension and physical gameplay handling unqualified.','Small markers, lamps, grille slats and wheel highlights have ordinary native-pixel angle aliasing. No animated door, flashing lamps or stop-plate motion.','GLB nearest min sampler uses exporter NEAREST_MIPMAP_NEAREST; shared CarMeshAsset forces nearest min/mag and disables mipmaps.']
commands=["& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python art-source/vehicle-bake/school-bus/v1/build.py -- --scratch",'node scripts/vehicle-bake/school-bus/capture.mjs','python scripts/vehicle-bake/school-bus/sheets.py',"& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/clearance.py -- art-source/vehicle-bake/school-bus/v1/evidence/clearance-input.json data/vehicle-bake/school-bus/recheck-clearance.json","& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/school-bus/v1/model.glb --config scripts/vehicle-bake/school-bus/coverage-region.json --output data/vehicle-bake/school-bus/recheck-coverage.json"]
report.update(status='complete',artReviewStatus='awaiting-owner-review',runtime='not integrated',geometry=audit,triangles=audit['triangles'],vertexCount=audit['vertices'],meshCount=5,primitiveCount=5,materialCount=1,textureCount=1,atlasBytes=(O/'atlas.png').stat().st_size,glbBytes=audit['glbBytes'],glbSha256=audit['sha256'],atlasSha256=sha(O/'atlas.png'),sharedClearance=clear,coverageEvidence=(A/'evidence/upper-wheel-coverage.json').relative_to(ROOT).as_posix(),engineEvidence='engine/capture.json',actualBounds=source['results']['actualGLBBounds'],replayCommands=commands,
 validation={'actualGLBAudit':True,'actualKHRMaterialsUnlit':True,'oneOpaque512Atlas':True,'embeddedAtlasPixelsMatch':True,'actualSharedEngine32HeadingViews':True,'eightSignedPhasesPerCamera':True,'independentWheelsFixedBodyReverseAbsoluteReset':True,'allNeutralRollWholeBodyClearance':True,'collidingBodyRejectedAndBaselineRestored':True,'crown25of25EachWithControls':True,'retainedSourceOnlyReplayByteIdentical':True,'packedSourcesVerified':True,'priorFrozenAssetsPreserved':True,'projectWideValidation':'Coordinator-owned after final review registration.'},
 visualInspection=[{'evidence':'engine/inspection-study.png','headingCount':16,'finding':'Rounded long roof and short projecting hood read as conventional school bus. Blue side and windshield clusters retain continuous frames. Opposite side owns folding door; driver side has driver pane and static red stop plate. Repeated window spacing and rub rails coherent. Open arch seating; no exposed far crown or floating cap.'},{'evidence':'engine/inspection-engine.png','headingCount':16,'finding':'Unchanged game projection and density, with larger transparent viewport only. Door/window asymmetry preserved; front and rear marker/bumper separation visible. Wheel crowns under body/fenders; no clipping or blocking paint issue.'},{'evidence':'engine/inspection-phases.png','phasesDegrees':[0,45,90,135,-180,-135,-90,-45],'finding':'Both camera phase sets visually inspected; body/paint stays fixed and tires remain seated. Independent motion, reverse quarter turn and reset additionally proven by actual GLB rig audit.'}],limitations=limitations,priorAssetsPreserved=preserved,
 sourceHashes={p.relative_to(ROOT).as_posix():sha(p) for p in sorted(A.rglob('*')) if p.is_file() and p.name not in ['delivery.json','retained-files.json']})
write(O/'report.json',report)
write(A/'delivery.json',{'status':'complete','artReviewStatus':'awaiting-owner-review','runtime':'not integrated','glbSha256':audit['sha256'],'atlasSha256':sha(O/'atlas.png'),'report':(O/'report.json').relative_to(ROOT).as_posix(),'replayCommands':commands})
write(A/'retained-files.json',{p.relative_to(ROOT).as_posix():sha(p) for p in sorted([*A.rglob('*'),*O.rglob('*')]) if p.is_file() and p.name!='retained-files.json'})
print(json.dumps({'status':'complete','glbSha256':audit['sha256'],'audit':audit,'priorAssetsPreserved':preserved},indent=2))
