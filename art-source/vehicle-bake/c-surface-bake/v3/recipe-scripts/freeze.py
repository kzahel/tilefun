"""Package inspected v3 evidence and freeze exact output bytes. Run once."""
import json,hashlib,shutil
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').exists() and (p/'package.json').exists());REV='v3'
OUT=ROOT/'public/demos/vehicle-bake/c-surface-bake'/REV;ART=ROOT/'art-source/vehicle-bake/c-surface-bake'/REV;DATA=ROOT/'data/vehicle-bake/c-surface-bake'/REV;SCRIPTS=ROOT/'scripts/vehicle-bake/c-surface-bake'
assert not (ART/'FROZEN.json').exists(),'Immutable finished candidate'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
replay=ROOT/'public/demos/vehicle-bake/c-surface-bake/replay-v3'
assert sha(OUT/'model.glb')==sha(replay/'model.glb');assert sha(OUT/'atlas.png')==sha(replay/'atlas.png')
shared=json.loads((DATA.parent/'v3-shared-clearance.json').read_text());assert shared[0]['status']=='passed';assert shared[0]['glbSha256']==sha(OUT/'model.glb')
shutil.copy2(DATA.parent/'v3-shared-clearance.json',ART/'shared-clearance.json')
# Copy corrected descriptive metadata from the byte-identical replay.
shutil.copy2(ROOT/'art-source/vehicle-bake/c-surface-bake/replay-v3/source-paint.json',ART/'source-paint.json')
E=ART/'evidence';E.mkdir(exist_ok=True)
for p in sorted(DATA.glob('*.png')):shutil.copy2(p,E/p.name)
for p in sorted(SCRIPTS.glob('*.py')):shutil.copy2(p,ART/'recipe-scripts'/p.name)
shutil.copy2(SCRIPTS/'capture.mjs',ART/'recipe-scripts/capture.mjs')
transfer=json.loads((ART/'transfer.json').read_text());palette={tuple(c) for c in transfer['palette'].values()}
im=Image.open(OUT/'atlas.png').convert('RGBA');assert im.getchannel('A').getextrema()==(255,255);assert {c[:3] for c in im.getdata()}<=palette
def native(path):
 im=Image.open(path).convert('RGBA').resize((128,128),Image.Resampling.NEAREST);o=Image.new('RGBA',(128,128));o.paste(im,(0,28));return o
BG=(27,30,40);sheet=Image.new('RGB',(2048,1152),BG);d=ImageDraw.Draw(sheet);font=ImageFont.load_default(size=17)
for i in range(8):
 x=(i%4)*512;y=(i//4)*576;d.text((x+12,y+8),f'{i*45:03d}: authored high surface | baked low GLB',font=font,fill=(238,235,226))
 for row,path in enumerate((E/f'painted-high-{i}-512.png',DATA/f'gltf-frames-{i}-512.png')):
  image=native(path).resize((256,256),Image.Resampling.NEAREST);sheet.paste(image,(x+128,y+36+row*264),image)
sheet.save(OUT/'high-to-low.png')
proof=Image.new('RGB',(2048,560),BG);pd=ImageDraw.Draw(proof)
for i,(filename,label) in enumerate((('raw-surface-transfer.png','Raw surface transfer'),('paint-ownership.png','High triangle owner (hashed object ID)'),('uncertainty.png','Green ray / orange nearest / purple opposing'),('atlas.png','Exact palette + four UV padding rounds'))):
 image=Image.open(ART/filename).convert('RGBA');proof.paste(image,(i*512,40),image);pd.text((i*512+8,12),label,font=font,fill=(238,235,226))
proof.save(OUT/'transfer-evidence.png')
replay_record={'retainedGlbHash':sha(OUT/'model.glb'),'replayGlbHash':sha(replay/'model.glb'),'retainedAtlasHash':sha(OUT/'atlas.png'),'replayAtlasHash':sha(replay/'atlas.png'),'byteIdentical':True,'command':'blender --background --factory-startup --threads 4 --python-exit-code 1 --python art-source/vehicle-bake/c-surface-bake/v3/recipe-scripts/build.py -- --revision replay-v3','input':'Only retained 141 source blend and this route recipe; no ignored data read','sourceHighTrianglesAfterSimpleSubdivision':356414,'lowMeshTriangles':2597}
(ART/'replay-verification.json').write_text(json.dumps(replay_record,indent=2)+'\n')
report=json.loads((OUT/'report.json').read_text());assert report['unlit'] and report['embeddedImages'] and report['triangles']==2597
report['status']='complete';report['approvalStatus']='unreviewed';report['frozen']=True;report['glbSha256']=sha(OUT/'model.glb');report['atlasSha256']=sha(OUT/'atlas.png')
report['genuineSurfaceBake']={'rasterization':'Every covered low-UV texel interpolates actual low position/triangle normal.','transfer':'Two owner-restricted normal rays (+/-0.13 source units); closest actual high triangle hit wins; 0.20-unit nearest fallback only on ray miss.','sampling':'Barycentric linear color of retained high SourceSemanticPaint point attribute, then sRGB encoding.','authoredHighPaint':'Original semantic roles, source-space red ramps, glass aperture borders/bands, source curve anchored hood/door ink, three louver anchors. Dense simple subdivision of source shell improves paint sampling without smoothing shape.','authoredLowCleanup':'Nearest exact 17-color palette; no dither; four atlas-space padding rounds; trailing rear-buttress low vertices below z=0.71 raised for shared wheel-cylinder clearance.','screenOperations':'Nearest 512->128; constant (0,+28); binary alpha and alpha-only 1px inward exterior outline. Zero interior drawing patches.','sourcePaintIsTargetProjection':False,'sourcePbrShadingBaked':False}
report['coverageInterpretation']={'coveredTexels':148860,'normalRayHitTexels':148711,'nearestFallbackTexels':149,'opposingSurfaceAmbiguityTexels':14344,'unknownTexels':0,'quantizationChangedTexels':22100,'occupiedAtlasFraction':transfer['coveredFraction'],'ambiguityDefinition':'Opposing rays hit distinct high triangle indices with distance difference >0.025 source units; conservative geometric flag, not measured disagreement between target drawings. Closest hit remains selected.','notObservedTargetCoverage':'High semantic paint is authored, including hidden/underside surfaces. Ray hit rate proves high-to-low geometric coverage, not automatic recovery or approval of target sprite pixels.','conflicts':'No target-view projection fusion is attempted. No target-view color conflicts are hidden or claimed resolved. Opposing geometric choices remain explicit in uncertainty.png.','rejectedSourceOwners':'Each low part admits only its retained high semantic owner(s); unrelated source geometry is excluded before BVH intersection.','unusedTexels':'113284 atlas texels are outside rasterized low surfaces; final opaque atlas fills them with ink and UV padding.'}
report['validation']['sharedCylinderClearance']=shared[0];report['validation']['replay']=replay_record;report['validation']['opaqueAtlasExactPalette']=True
report['validation']['coordinatorIndependentEvidence']='Coordinator reports 16 authoring + 16 game-heading actual GLB captures and independent unchanged cylinder proof with collision rejection. This agent additionally rendered and inspected own 8 fixed headings, 4 intermediate headings and 4 wheel-roll states.'
report['visualInspection']=[{'view':i,'yaw':45*i,'checked':'Actual exported GLB and own Blender low render compared with target at native and 4x; silhouette, dark window boundaries, body seams, lamps, three slats, wheel centers and obvious UV artifacts inspected.'} for i in range(8)]
report['visualInspection'].append({'intermediateYaw':[22.5,67.5,112.5,157.5],'wheelRoll':[0,90,180,270],'checked':'Actual GLB intermediate/roll sheet inspected. Paint remains mesh-owned; slat/edge aliasing changes with sampling but no view switch or displaced texture.'})
report['limitations']=['The chosen target has view-relative glass strips and richer red clusters. Source-owned fixed paint approximates those decisions; this C route is less close to the target than coordinator comparison route A.','Thin slats and hood lines still show native raster aliasing at intermediate headings. The high source has three continuous slats; some low pixels merge or alternate.','149 nearest-surface fallback texels and 14344 opposing-surface ambiguity flags remain explicitly recorded. Zero unknowns means every low texel found authored source paint, not that hidden paint was observed in target drawings.','6425 exported vertices for 2597 triangles reflect UV and flat-normal splits; this is a triangle-budget prototype, not optimized vertex bandwidth.','Two low rear buttress ends were raised by at most approximately 0.083 source units for conservative cylinder clearance, while immutable high geometry remains unchanged.','Neutral wheel roll is proven; steering remains neutral and unqualified.','No production art approval, registration, runtime activation or other vehicles.']
report['replayCommands'].extend(['blender --background --factory-startup --threads 4 --python scripts/vehicle-bake/c-surface-bake/inspect_source.py -- NEW_REV','blender --background --factory-startup --threads 4 --python scripts/vehicle-bake/clearance.py -- OWN_MANIFEST OWN_RESULT'])
recipe=json.loads((ART/'recipe.json').read_text());recipe['frozenRevision']='v3';recipe['sourcePaintConfiguration']='source-paint.json';recipe['rawTransfer']='raw-surface-transfer.png';recipe['sourceOwnersAndCoverage']='transfer.json';recipe['uncertainty']='uncertainty.png';recipe['sourceSnapshots']='recipe-scripts/';recipe['glbUnlitPatch']='Embedded emissive atlas transferred to baseColorTexture; white base factor; emissive texture/factor removed; KHR_materials_unlit declared.';recipe['lowClearanceCorrection']='Only Rear buttress low trim vertices with x>1.05 and z<0.71 are raised to z=0.71 before UV unwrap and bake.'
(ART/'recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
report['files']={p.name:sha(p) for p in sorted(OUT.iterdir()) if p.is_file() and p.name!='report.json'}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n');shutil.copy2(OUT/'report.json',ART/'report.json')
frozen={'revision':'v3','status':'complete','humanApproval':'unreviewed','glbSha256':sha(OUT/'model.glb'),'atlasSha256':sha(OUT/'atlas.png'),'publicFiles':report['files'],'sourceFiles':{str(p.relative_to(ART)).replace('\\','/'):sha(p) for p in sorted(ART.rglob('*')) if p.is_file() and p.name!='FROZEN.json'}}
(ART/'FROZEN.json').write_text(json.dumps(frozen,indent=2)+'\n')
print(json.dumps({'status':'complete','glb':report['glbSha256'],'atlas':report['atlasSha256'],'sharedClearance':'passed','byteIdenticalReplay':True},indent=2))
