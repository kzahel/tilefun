"""Validate frozen outputs and attach a hash-bound, genuine visual inspection.

Run after viewing the outputs and recording data/.../inspection.json. Replays of
pack.py intentionally return to awaiting-visual-inspection until this is run.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[3]
DATA=ROOT/"data/vehicle-style-study/01-detailed-shaded"
OUT=ROOT/"public/demos/vehicle-style-study/01-detailed-shaded"
report=json.loads((OUT/"report.json").read_text())
inspection=json.loads((DATA/"inspection.json").read_text())
scene=json.loads((DATA/"scene-validation.json").read_text())
assert scene["passed"]
for name,digest in inspection["outputHashes"].items():
    assert hashlib.sha256((OUT/name).read_bytes()).hexdigest()==digest, name
assert inspection['outputHashes']==report['outputHashes']
palette={tuple(bytes.fromhex(c[1:])) for c in report['palette']}
sheet=Image.open(OUT/'sheet.png').convert('RGBA')
assert sheet.size==(1024,128)
gif=Image.open(OUT/'turntable.gif')
assert gif.n_frames==8
for i in range(8):
    raw=Image.open(OUT/f'raw-{i}.png').convert('RGBA')
    im=Image.open(OUT/f'view-{i}.png').convert('RGBA')
    assert raw.size==(512,512) and im.size==(128,128)
    assert set(im.getchannel('A').get_flattened_data())=={0,255}
    assert {p[:3] for p in im.get_flattened_data() if p[3]}<=palette
    assert sheet.crop((i*128,0,i*128+128,128)).tobytes()==im.tobytes()
    b=im.getbbox(); assert b[0]>0 and b[1]>0 and b[2]<128 and b[3]<128
    gif.seek(i)
    # Lossless agreement of displayed GIF and checker-composited nearest sprite.
    bg=Image.new('RGB',(512,512),(28,32,41))
    for y in range(512):
        for x in range(512):
            if (x//16+y//16)%2: bg.putpixel((x,y),(37,42,53))
    enlarged=im.resize((512,512),Image.Resampling.NEAREST)
    bg.paste(enlarged,(0,0),enlarged)
    assert ImageChops.difference(bg,gif.convert('RGB')).getbbox() is None
report['status']='complete'
report['visualInspection']=inspection['observations']
report['inspectionRecord']='data/vehicle-style-study/01-detailed-shaded/inspection.json'
report['sceneValidation']='data/vehicle-style-study/01-detailed-shaded/scene-validation.json'
report['validation'].update({'sceneContractPassed':True,'allFourTiresContactZ0':True,
                             'visualLength':scene['visualLength'],
                             'encodedSheetMatchesViews':True,'allDecodedGifFramesMatchViews':True,
                             'allRequiredOutputsInspected':True,'frozenPixels':True})
report['iterations']=[{'name':'Initial brighter softbox pass',
                      'path':'data/vehicle-style-study/01-detailed-shaded/pass-1-bright-reflections',
                      'finding':'Unrestricted nearest palette mapping made broad clearcoat highlights gray. Preserved raw and packed comparison.'},
                     {'name':'Final reduced reflection intensity',
                      'finding':'Lower fixed light powers, moderate clearcoat, higher contrast and lower exposure retain red. Same geometry route and no feature redraw. Uniform model normalization gives exact 4.6-unit visual length.'}]
report['commands'].append('& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background data/vehicle-style-study/01-detailed-shaded/sports-coupe.blend --threads 4 --python-exit-code 1 --python scripts/vehicle-style-study/01-detailed-shaded/validate_scene.py')
report['commands'].append('python scripts/vehicle-style-study/01-detailed-shaded/finalize.py')
report['sourcePaths']=[report['sourcePath'],report['packerPath'],
                       'scripts/vehicle-style-study/01-detailed-shaded/validate_scene.py',
                       'scripts/vehicle-style-study/01-detailed-shaded/finalize.py']
report['sourceHashes']={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in report['sourcePaths']+[report['blendPath']]}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('COMPLETE: all 8 raw views, final views, encoded sheet and decoded GIF verified; inspected image hashes frozen.')
