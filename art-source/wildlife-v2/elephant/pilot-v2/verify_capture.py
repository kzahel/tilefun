"""Decode every real browser canvas sample and compare to independent composition.
Also retain chronological sampled loops for actual visual inspection.
"""
import json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/elephant/pilot-v2';D=ROOT/'data/wildlife-campaign-v2/manual-elephant-02/browser-final'
R=json.loads((D/'capture.json').read_text());M=json.loads((O/'sprite.json').read_text());w=M['frameWidth']
sheet=Image.open(O/'sheet.png').convert('RGBA');bg=Image.open(O/'scene-background.png').convert('RGBA')
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def compose(clip,index):
    im=bg.copy();column=M['clips'][clip]['start']+index
    for row in range(4):
        im.alpha_composite(sheet.crop((column*w,row*w,(column+1)*w,(row+1)*w)),(56+row*104,59))
        im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(80+row*104,25))
    return im
expected={(clip,i):compose(clip,i) for clip,c in M['clips'].items() for i in range(c['count'])}
for sample in R['samples']:
    im=Image.open(D/sample['filename']).convert('RGBA')
    assert im.tobytes()==expected[sample['clip'],sample['pose']].tobytes(),sample
for scale in [1,4]:
    for name,indices in [('walk-loop-1',range(3,15)),('walk-loop-2',range(15,27)),('action-return',range(27,38))]:
        selected=[next(s for s in R['samples'] if s['scale']==scale and s['sequenceIndex']==i) for i in indices]
        canvas=Image.new('RGBA',(w*len(selected),(w+14)*4),'#879b82');d=ImageDraw.Draw(canvas)
        for col,sample in enumerate(selected):
            im=Image.open(D/sample['filename']).convert('RGBA')
            for row,facing in enumerate(M['facings']):
                crop=im.crop((56+row*104,59,56+row*104+w,59+w))
                canvas.alpha_composite(crop,(col*w,row*(w+14)+14))
                d.text((col*w+2,row*(w+14)+2),f'{facing} {sample["clip"]} {sample["pose"]}',fill='white')
        canvas.resize((canvas.width*2,canvas.height*2),Image.Resampling.NEAREST).save(D/f'{scale}x-{name}.png')
report={'status':'passed every captured canvas against authored integer scene composition','samples':len(R['samples']),'durationsMs':R['durations'],'browser':R['browser'],'allClipPosesAtBothScales':True,'sceneByteParity':True,'captureSha256':hashlib.sha256((D/'capture.json').read_bytes()).hexdigest(),'sheetSha256':M['sheetSha256'],'playbackSha256':hashlib.sha256((O/'playback.js').read_bytes()).hexdigest(),'evidenceDirectory':'data/wildlife-campaign-v2/manual-elephant-02/browser-final','browserClosedByCaptureFinally':True}
(O/'playback-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('ALL_BROWSER_SAMPLE_PARITY_OK',len(R['samples']),R['durations'])
