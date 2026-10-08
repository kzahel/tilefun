"""Compare pre-mask RGB fidelity separately from learned-alpha losses."""
import argparse
import html
import json
import os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from reference import digest, name
from stage_sheet import read, font, image_panel

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--bundle',type=Path,required=True)
p.add_argument('--study',type=name,required=True)
p.add_argument('--id',type=name,default='report')
p.add_argument('--meshes',type=name,help='Optional matched direct-TRELLIS execution directory')
a=p.parse_args(); bundle=a.bundle.resolve(); study=bundle/'conditioning-studies'/a.study
plan=read(study/'plan.json'); manifest=read(bundle/'inputs.json')
if digest(bundle/'inputs.json')!=plan['inputManifestSha256']: raise RuntimeError('Original source manifest changed')
output=study/a.id; output.mkdir(exist_ok=False)
assets=list(dict.fromkeys(c['asset'] for c in plan['cases']))
canvas=Image.new('RGB',(2500,125+len(assets)*870),'#f1f4f7'); d=ImageDraw.Draw(canvas)
d.text((20,12),'SDXL fidelity ablation: identical source, prompt and seed',font=font(28),fill='#243142')
d.text((20,55),'Top row: RGB before masking. Bottom row: learned cutout. No new 3D run in this image-only matrix.',font=font(20),fill='#243142')
for col,label in enumerate(['Original input','Strength 0.35','Strength 0.55','Strength 0.65','Strength 0.8 baseline']):
 d.text((col*500+15,94),label,font=font(22),fill='#243142')
rows=[]; sections=[]
def link(path,label,image=False):
 url=html.escape(os.path.relpath(path,output),quote=True)
 return f'<a href="{url}"><img src="{url}" alt="{html.escape(label)}"></a>' if image else f'<a href="{url}">{html.escape(label)}</a>'
for row,asset in enumerate(assets):
 entry=next(e for e in manifest['inputs'] if e['id']==asset)
 assert digest(bundle/entry['input'])==entry['cropSha256']
 cases=[c for c in plan['cases'] if c['asset']==asset]
 baseline=bundle/'references'/next(c['reference'] for c in cases if c['strength']==.8)
 original=baseline/'provider-input.png'; alpha=np.array(Image.open(bundle/entry['enlarged']).convert('RGBA').resize((1024,1024),Image.Resampling.NEAREST))[:,:,3]>0
 top=125+row*870
 d.text((15,top+4),entry['label'],font=font(25),fill='#243142')
 image_panel(canvas,original,(15,top+45,470,370),True)
 image_panel(canvas,bundle/entry['input'],(15,top+445,470,370),True)
 section=f'<section><h2>{html.escape(entry["label"])}</h2><p>Pre-mask RGB and post-mask cutout are separate evidence.</p><div class="grid"><article><h3>Original input</h3>'+link(original,'Exact original RGB input',True)+link(bundle/entry['input'],'Original RGBA sprite',True)+'</article>'
 source=np.array(Image.open(original).convert('RGB')).astype(np.float32)
 baseline_record=read(baseline/'generation.json')
 for col,case in enumerate(cases,1):
  ref=bundle/'references'/case['reference']; record=read(ref/'generation.json') or {}
  present=(ref/'generated-rgb.png').exists() and (ref/'reference.png').exists()
  section+=f'<article><h3>Strength {case["strength"]}</h3>'
  result={'asset':asset,'reference':case['reference'],'strength':case['strength'],'status':record.get('status'),'reused':case['reused']}
  if present:
   assert record['prompt']==baseline_record['prompt'] and record['negativePrompt']==baseline_record['negativePrompt']
   assert record['sourceSha256']==entry['cropSha256'] and digest(ref/'provider-input.png')==digest(original)
   assert record['settings']['seed']==42 and record['settings']['steps']==50 and record['settings']['guidanceScale']==5
   assert record['settings']['strength']==case['strength']
   rgb=ref/'generated-rgb.png'; cutout=ref/'reference.png'; mask=ref/'mask.png'
   image_panel(canvas,rgb,(col*500+15,top+45,470,370)); image_panel(canvas,cutout,(col*500+15,top+445,470,370))
   pixels=np.array(Image.open(rgb).convert('RGB')).astype(np.float32); learned=np.array(Image.open(mask))>127
   result.update({'inputSha256':digest(original),'rgbSha256':digest(rgb),'cutoutSha256':digest(cutout),'maskSha256':digest(mask),
    'settings':record['settings'],'sourcePixelColorMae':float(abs(pixels-source)[alpha].mean()),
    'alphaPriorRecall':float((learned & alpha).sum()/alpha.sum()),'alphaPriorOutsidePixels':int((learned & ~alpha).sum()),
    'limits':'Color MAE measures change, not shape correctness; alpha prior includes original shadow and assumes unchanged image-space alignment.'})
   section+=link(rgb,'Actual pre-mask RGB',True)+link(cutout,'Actual learned cutout',True)+'<p>'+link(ref/'generation.json','Generation record')+' | '+link(mask,'Raw learned mask')+'</p>'
  else:
   for shift in (45,445): d.text((col*500+25,top+shift+160),'Not produced',font=font(24),fill='#435266')
   section+='<p>Stage failed or incomplete; retained logs identify the failure.</p>'
  section+='</article>'; rows.append(result)
 sections.append(section+'</div></section>')
canvas.save(output/'sheet.png')
mesh_records=[]
if a.meshes:
 execution=read(study/a.meshes/'execution.json')
 assert execution['inputManifestSha256']==plan['inputManifestSha256'] and execution['mode']=='direct' and execution['seed']==42
 mesh_canvas=Image.new('RGB',(2500,110+len(execution['cases'])*430),'#f1f4f7'); md=ImageDraw.Draw(mesh_canvas)
 md.text((20,15),'Matched direct TRELLIS: same image and mesh seeds; strength is the changed setting',font=font(23),fill='#243142')
 for col,label in enumerate(['Original sprite','Conditioning cutout','GLB front','GLB side','GLB oblique']): md.text((col*500+15,65),label,font=font(22),fill='#243142')
 section='<section><h2>Matched direct TRELLIS follow-through</h2><p>These runs use the saved cutouts directly: no MV-Adapter or second learned mask. Seed 42 and all TRELLIS settings are fixed. Compare novel views as well as the original silhouette; passing the coarse volume screen does not establish correct shape.</p>'
 for row,case in enumerate(execution['cases']):
  run=bundle/'runs'/case['run']; pipeline=read(bundle/'pipelines'/case['run']/'pipeline.json') or {}
  entry=next(e for e in manifest['inputs'] if e['id']==case['asset']); ref=bundle/'references'/case['reference']
  assert pipeline.get('reference')==case['reference']
  registration=read(ref/'reference.json'); assert digest(ref/'reference.png')==registration['sha256']
  item={**case,'volumeScreen':pipeline.get('volumeScreen'),'pipelineSha256':digest(bundle/'pipelines'/case['run']/'pipeline.json')}
  run_record=read(run/'run.json'); assert run_record['settings']['seed']==42 and run_record['settings']['steps']==12 and run_record['settings']['pipelineType']=='512'
  sheet_record=read(bundle/'stage-sheets'/case['run']/'stages/sheet.json')
  assert digest(bundle/'stage-sheets'/case['run']/'stages/sheet.png')==sheet_record['sheetSha256']
  for panel in sheet_record['panels']:
   if panel['available']: assert digest(bundle/panel['file'])==panel['sha256']
  export=read(run/'export/export.json')
  if export:
   assert digest(run/'export/candidate.glb')==export['sha256'] and digest(run/'raw.npz')==export['rawArraysSha256']; item['export']=export
  mesh_records.append(item)
  label=f'{entry["label"]}: strength {case["strength"]}'; top=110+row*430
  md.text((15,top+4),label,font=font(23),fill='#243142'); section+=f'<h3>{html.escape(label)}</h3><div class="grid">'
  panels=[(bundle/entry['input'],'Original sprite',True),(ref/'reference.png','Conditioning cutout',False)]
  panels += [(run/f'export/inspection/{view}.png',f'GLB {view}',False) for view in ['front','side','oblique']]
  for col,(path,label,nearest) in enumerate(panels):
   if path.exists():
    image_panel(mesh_canvas,path,(col*500+15,top+42,470,350),nearest); section+='<article>'+link(path,label,True)+'</article>'
   else:
    md.text((col*500+25,top+180),'Stage not produced',font=font(24),fill='#435266'); section+='<article>Stage not produced; inspect saved execution log.</article>'
  section+='</div><p>'+link(bundle/'stage-sheets'/case['run']/'stages/index.html','All stages and hashes')+' | '+link(run/'inspection/raw-geometry.png','Untouched raw geometry')+' | '+link(bundle/'pipelines'/case['run']/'pipeline.json','Pipeline record')
  if export: section+=' | '+link(run/'export/inspection/viewer.html','Interactive GLB viewer')+' | '+link(run/'export/candidate.glb','GLB download')
  section+='</p>'
 mesh_canvas.save(output/'mesh-sheet.png'); sections.append(section+'</section>')
record={'study':a.study,'inputManifestSha256':plan['inputManifestSha256'],'planSha256':digest(study/'plan.json'),
 'implementationSha256':digest(__file__),'sheetSha256':digest(output/'sheet.png'),'review':'Unreviewed source-fidelity diagnostics, not acceptance','cases':rows,'directMeshCases':mesh_records}
if a.meshes: record['meshSheetSha256']=digest(output/'mesh-sheet.png')
assessment=read(study/'assessment.json')
if assessment:
 record['agentAssessment']=assessment
 sections.insert(0,'<section><h2>Agent observations</h2><p>'+html.escape(assessment['summary'])+'</p><ul>'+''.join('<li>'+html.escape(x)+'</li>' for x in assessment['observations'])+'</ul><p>These are diagnostic observations, not human acceptance.</p></section>')
(output/'results.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SDXL fidelity ablation</title><style>body{font:16px system-ui;margin:24px;background:#f1f4f7;color:#243142}main{max-width:1500px;margin:auto}section{background:white;padding:16px;margin:20px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px}img{width:100%;object-fit:contain;background:repeating-conic-gradient(#c4cbd2 0% 25%,#d7dce1 0% 50%) 50%/24px 24px}p{line-height:1.5}</style></head><body><main><h1>SDXL fidelity ablation</h1><p>Same source/prompt/seed, strengths 0.35/0.55/0.65/0.8. Top image in each card is actual RGB before masking; bottom image is the learned cutout. Shape/design change and mask losses must be judged separately.</p><p><a href="sheet.png">Full comparison sheet</a> | <a href="results.json">Measurements and hashes</a></p>'
(output/'index.html').write_text(page+''.join(sections)+'</main></body></html>',encoding='utf8')
print(json.dumps({'report':str(output/'index.html'),'cases':len(rows)}))
