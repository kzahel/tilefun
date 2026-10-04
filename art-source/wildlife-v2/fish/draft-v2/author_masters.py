"""Fresh goldfish letter masters, deliberately broad ochre/gold clusters."""
import json
from pathlib import Path
S=Path(__file__).parent
P={'o':'#514a35','g':'#bd842f','h':'#d7a850','l':'#e5bf68','e':'#c98331','c':'#985f31','w':'#dac388','k':'#22352f','f':'#b27530','t':'#775936'}
bodies={
 'left':{'offset':[-4,-3],'pixels':['..ohhho..','.ohllggo.','ohlggeego','ogggeccco','ogceccco.','.ocwwwco.','..owwwo..']},
 'down':{'offset':[-3,-4],'pixels':['..ohh..','.ohllo.','ohlggeo','ogggeco','oggecco','occecco','.cwwwc.','.owwwo.','..ooo..']},
 'up':{'offset':[-3,-4],'pixels':['..ohh..','.ohllo.','ohlggeo','ogglgco','oggecco','oggecco','.cwwcc.','.occco.','..ooo..']}
}
bodies['right']={'offset':[-4,-3],'pixels':[r[::-1] for r in bodies['left']['pixels']]}
heads={
 'left':{'offset':[-2,-2],'pixels':['.hhho','ohggo','okcgo','owcgo','.owo.']},
 'down':{'offset':[-2,-2],'pixels':['.hhho','ohggo','okgko','owgwo','.owo.']},
 'up':{'offset':[-2,-2],'pixels':['.hhho','ohggo','ogggo','occco','.oco.']}
}
heads['right']={'offset':[-2,-2],'pixels':[r[::-1] for r in heads['left']['pixels']]}
M={'identity':'fish-draft-v2-drawing-01','species':'Single-tailed common goldfish, Carassius auratus','canvas':[48,48],'palette':P,'bodies':bodies,'heads':heads,'stylization':'Species-specific short stable head, dark eyes, gill shadow and ochre/gold mantle with cream belly. Broad authored letter clusters; posterior and fin drawings follow real fixed-volume axial guides. Rear hides eyes/mouth. Fork is drawn from actual concave fin contour, not its convex hull. Opposite profile lighting deliberately mirrors.'}
(S/'masters.json').write_text(json.dumps(M,indent=2)+'\n');print('FISH_MASTERS_AUTHORED')
