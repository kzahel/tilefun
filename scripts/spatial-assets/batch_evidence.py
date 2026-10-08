"""Collect small portable batch evidence; heavy arrays/models stay in external bundle."""
import argparse
import html
import json
from pathlib import Path
import shutil
from PIL import Image
from reference import digest, name
from stage_sheet import read

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bundle', type=Path, required=True)
parser.add_argument('--batch', type=name, required=True)
parser.add_argument('--report', type=name, default='report')
parser.add_argument('--destination', type=Path, required=True)
args = parser.parse_args()
bundle = args.bundle.resolve()
report = bundle / 'batches' / args.batch / args.report
results = read(report/'results.json')
if not results['status'].startswith('completed'):
    raise RuntimeError('Collect after batch completion')
if digest(bundle/'inputs.json') != results['inputManifestSha256']:
    raise RuntimeError('Original manifest changed')
if digest(report/'overview.png') != results['overviewSha256']:
    raise RuntimeError('Overview changed')
output = args.destination.resolve()
output.mkdir(parents=True,exist_ok=False)
files = {}
def copy(source, target):
    destination = output / target
    destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,destination)
    files[target] = {'sha256':digest(destination),'originalSha256':digest(source),'operation':'exact copy'}
def preview(source,target,width):
    image=Image.open(source)
    image.thumbnail((width,10000),Image.Resampling.LANCZOS)
    destination=output/target; destination.parent.mkdir(parents=True,exist_ok=True)
    image.save(destination)
    files[target]={'sha256':digest(destination),'originalSha256':digest(source),'operation':f'LANCZOS display preview, max width {width}'}
copy(bundle/'inputs.json','inputs.json')
copy(bundle/'selection.json','selection.json')
copy(bundle/'actor.json','actor.json')
copy(bundle/'batches'/args.batch/'batch.json','batch.json')
copy(report/'results.json','results.json')
for source in (bundle/'inputs').glob('*.png'):
    copy(source,f'inputs/{source.name}')
for source in (bundle/'prompts').iterdir():
    if source.is_file(): copy(source,f'prompts/{source.name}')
preview(report/'overview.png','overview.png',1600)
cards=[]
for asset in results['assets']:
    stage = bundle/'stage-sheets'/asset['run']/'stages'
    filename=f"stages/{asset['asset']}.png"
    preview(stage/'sheet.png',filename,1600)
    copy(stage/'sheet.json',f"stages/{asset['asset']}.json")
    cards.append(f'<section><h2>{html.escape(asset["label"])}</h2><p>{html.escape(asset["agentObservation"])}</p><a href="{filename}"><img src="{filename}" alt="{html.escape(asset["label"])} stages"></a></section>')
for probe in (bundle/'mask-probes').glob('*/probe.json'):
    preview(probe.parent/'comparison.png',f'mask-probes/{probe.parent.name}.png',1600)
    copy(probe,f'mask-probes/{probe.parent.name}.json')
for file in ('artifact-validation.json','browser-validation.json'):
    if (report/file).exists(): copy(report/file,file)
page='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Current sprite workflow evidence</title><style>body{font:16px system-ui;max-width:1200px;margin:24px auto;padding:0 16px;background:#f1f4f7;color:#243142}section{padding:16px;background:white;margin:20px 0}img{width:100%;height:auto}p{line-height:1.5}</style><h1>Ten current sprite experiments</h1><p>Unreviewed local diagnostics. These are resized display previews; frozen original input pixels, settings and measurements are included. Full stage images, raw geometry, masks, depth arrays and orbit viewers remain in the external experiment bundle.</p><p><a href="results.json">Measurements and observations</a> | <a href="inputs.json">Frozen source manifest</a> | <a href="evidence.json">Copied/preview file hashes</a></p><a href="overview.png"><img src="overview.png" alt="Ten asset stage overview"></a>'
(output/'index.html').write_text(page+''.join(cards)+'</html>',encoding='utf8')
(output/'evidence.json').write_text(json.dumps({'batch':args.batch,'report':args.report,'implementationSha256':digest(__file__),'review':'Unreviewed diagnostic evidence; no promotions','files':files},indent=2)+'\n',encoding='utf8')
print(json.dumps({'destination':str(output),'files':len(files)}))
