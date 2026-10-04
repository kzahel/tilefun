"""Robin-specific olive mantle, orange face/bib and cream belly pixel masters."""
from pathlib import Path
import json
S=Path(__file__).parent
P={'o':'#433e33','b':'#796f50','h':'#9b936c','s':'#5a5d48','l':'#b6b795','c':'#b86c36','a':'#d4934c','w':'#d3cbb0','k':'#252d2b','t':'#806444'}
bodies={
 'left':{'offset':[-3,-6],'pixels':['.bbbo.','bhlbbo','bhtsso','cbltso','ccwso.','.owwo.']},
 'down':{'offset':[-3,-6],'pixels':['..bbb..','.bhhbo.','bhlhlbo','obcccbo','.cwwco.','..ooo..']},
 'up':{'offset':[-3,-6],'pixels':['..bbb..','.bhhbo.','bhbbsbo','obsbsbo','.bssbo.','..ooo..']}
}
bodies['right']={'offset':[-2,-6],'pixels':[r[::-1] for r in bodies['left']['pixels']]}
heads={
 'left':{'offset':[-2,-2],'pixels':['.bbbo','ckcbo','occco','.occo']},
 'down':{'offset':[-2,-2],'pixels':['.bbbo','ckckc','occco','.oco.']},
 'up':{'offset':[-2,-2],'pixels':['.bbbo','obhbo','obbbo','.ooo.']}
}
heads['right']={'offset':[-2,-2],'pixels':[r[::-1] for r in heads['left']['pixels']]}
M={'identity':'robin-draft-v2-drawing-03','palette':P,'canvas':[32,32],'bodies':bodies,'heads':heads,'stylization':'Fresh robin-specific palette-letter round mantle, warm orange face/bib, cream belly and stable eye/cap patches. Face eye-row deliberately omits dark outer outline to separate black eye from orange face. Rear upper back deliberately uses olive highlights without a false pale collar. Opposite profile lighting deliberately mirrors. Actual projected toe/fan/tail geometry guides integer appendage clusters. Rear has no front facial features or chest recolor.'}
(S/'masters.json').write_text(json.dumps(M,indent=2)+'\n');print('ROBIN_MASTERS_AUTHORED')
