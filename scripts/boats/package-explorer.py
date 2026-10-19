"""Retain native actual-GLB cardinal captures and register the exact pending boat art."""
from pathlib import Path
from PIL import Image
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art-source/vehicle-models/explorer-boat/v1'
review=ROOT/'public/demos/original-vehicles/explorer-boat-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert not (source/'receipt.json').exists(),'Frozen revision: create a new revision instead'
model=ROOT/'public/assets/models/vehicles/explorer-boat-v1.glb';model.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/'model.glb',model)
sheet=Image.new('RGBA',(192,224*4))
for row,i in enumerate([4,12,8,0]):
 im=Image.open(review/f'captures/engine-{i}.png').convert('RGBA');assert im.size==(128,128)
 b=im.getbbox();assert b and min(b)>0 and b[2]<128 and b[3]<128
 sheet.paste(im,(32,row*224+80))
sprite=ROOT/'public/assets/vehicles/explorer-boat-v1.png';sheet.save(sprite)
for name in ['atlas.png','recipe.json']:shutil.copy2(source/name,review/'inputs'/name)
files=[p for p in review.rglob('*') if p.is_file() and p.name!='review.json']
candidate={'id':'explorer-boat-v1','name':'Explorer motorboat','title':'Explorer motorboat · hollow hull and outboard v1','url':'demos/original-vehicles/explorer-boat-v1/','files':[{'url':p.relative_to(ROOT/'public').as_posix(),'sha256':sha(p)} for p in sorted(files)]}
(review/'review.json').write_text(json.dumps({'version':1,'candidates':[candidate]},indent=2)+'\n',encoding='utf8')
receipt={'version':1,'id':'explorer-boat-v1','artReviewStatus':'pending-human-review','gameplay':'Owner-authorized provisional gameplay; no appearance approval inferred','model':model.relative_to(ROOT).as_posix(),'modelSha256':sha(model),'sprite':sprite.relative_to(ROOT).as_posix(),'spriteSha256':sha(sprite),'frameSize':[192,224],'groundOrigin':[96,144],'cardinals':{'south':4,'north':12,'west':8,'east':0},'bodyClearance':'80px square conservative all-heading footprint; exact geometry qualification is in the boat asset test.','rig':{'wheels':0,'propeller':'Boat_Propeller','root':'Boat_Root','forward':'Blender -X'},'inputs':{p.relative_to(ROOT).as_posix():sha(p) for p in source.iterdir() if p.is_file()},'review':candidate,'replay':'Blender --background --python art-source/vehicle-models/explorer-boat/v1/build.py -- --output data/boat-152-replay'}
(source/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');print('Packed boat assets and pending exact review')
