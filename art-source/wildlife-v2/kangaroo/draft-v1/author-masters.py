"""Authored palette-letter male red kangaroo, independent projected guide fit."""
from pathlib import Path
import json
S=Path(__file__).parent
def rows(w,entries):
 out=[]
 for x,s in entries:assert x+len(s)<=w;out.append('.'*x+s+'.'*(w-x-len(s)))
 return out
down=rows(11,[(4,'hhh'),(3,'hhbhh'),(2,'ohbbbbo'),(2,'ohcccbo'),(1,'ohccccbbo'),(1,'ohccccbbo'),(1,'ohccccbbo'),(1,'ohccccbbo'),(1,'ohccccbbo'),(1,'ohccccbbo'),(1,'ohccccbbo'),(1,'ohccccbbo'),(1,'ohhcccbbo'),(1,'ohbbbbbbo'),(2,'ohbbbbo'),(3,'obbbbo'),(4,'oooo')])
up=rows(11,[(4,'hbo'),(4,'hbo'),(4,'hbo'),(3,'ohbbo'),(3,'ohbbo'),(2,'ohbbbbo'),(1,'ohhbbbbo'),(1,'ohhbbbbbo'),(1,'ohhbbbbbo'),(1,'ohbbbbboo'),(2,'ohbbbbo'),(2,'ohbbbbo'),(2,'ohbbbbo'),(1,'ohhbbbbbo'),(0,'ohhbbbbbbbo'),(0,'ohhbbbbbbbo'),(0,'ohhbbbbbbbo'),(0,'ohhbbbbbbbo'),(1,'ohbbbbbbbo'),(1,'ohbbbbbbbo'),(2,'ohbbbbbo'),(3,'obbbbbo'),(4,'oooo')])
left=rows(14,[(2,'hbo'),(2,'hcbo'),(2,'hcbbbo'),(2,'hccbbbbo'),(2,'hccbhbbbo'),(2,'hccbhhbbbo'),(2,'hccbbhbbbo'),(2,'hccbbhbbbbo'),(2,'hccbbhbbbbo'),(3,'hccbbhbbbbo'),(3,'hccbbbbbbbo'),(3,'hccbbbbbbbo'),(3,'hccbbbbbbbo'),(3,'hccbbbbbbo'),(3,'ohbbbbbbbo'),(4,'ohbbbbbbbo'),(4,'ohhbbbbbbo'),(5,'ohhbbbbbo'),(6,'obbbbbo'),(7,'oooo')])
frontHead=['..hh...','.ohhbo.','ohbbbbo','obebebo','obcccco','.bnnb..','.cccb..','..ooo..','.......']
rearHead=['.hhh.','ohbbo','ohbbo','ohbbo','.obbo','.obbo','..oo.']
profile=['......hh...','.....ohhbo.','....ohbbbbo','...obebbbbo','.bbnccbbbbo','oncccchbbo.','.ccccbboo..','..oooo.....']
M={'identity':'kangaroo-draft-v1-drawing-02','palette':{'o':'#513426','b':'#a7673c','h':'#c78e55','s':'#805138','c':'#e3d0a2','l':'#f0dfb7','n':'#403c30','e':'#252f28','i':'#ad7560'},
 'bodies':{'down':{'offset':[-5,-26],'pixels':down},'up':{'offset':[-5,-31],'pixels':up},'left':{'offset':[-7,-28],'pixels':left},'right':{'offset':[-6,-28],'pixels':[r[::-1] for r in left]}},
 'heads':{'down':{'offset':[-3,-3],'pixels':frontHead},'up':{'offset':[-2,-3],'pixels':rearHead},'left':{'offset':[-7,-3],'pixels':profile},'right':{'offset':[-3,-3],'pixels':[r[::-1] for r in profile]}},
 'hands':{'down':{'offset':[-1,0],'pixels':['hbb','bnn','.oo']},'up':{'offset':[-1,0],'pixels':['hbb','obb','.oo']},'left':{'offset':[-1,0],'pixels':['hb.','bbn','.oo']},'right':{'offset':[-1,0],'pixels':['.bh','nbb','oo.']}},
 'stylization':['Rigid full head, cheek stripe and torso markings held fixed for all hop frames. Art head is deliberately one pixel broader than skull guide for readable muzzle/eye; no geometry scaling.','Ears remain independently rotated fixed-volume guide silhouettes; head master does not morph to suggest listening. Rear head hides face/eyes/stripe.','Actual limb joints and foot/tail hulls determine broad integer composition, with stable relative head/body anchor rounding.','Tiny syndactylous toes/fingers compress to clusters. Rear-facing heels hide the forward claw tips. Right profile mirrors painted lighting.']}
for group in ['bodies','heads','hands']:
 for p in M[group].values():assert all(len(r)==len(p['pixels'][0]) for r in p['pixels'])
(S/'masters.json').write_text(json.dumps(M,indent=2)+'\n',encoding='utf-8');print('KANGAROO_MASTERS_AUTHORED')
