from pathlib import Path
import json
S=Path(__file__).parent
P={'.':[0,0,0,0],'k':[31,28,25,255],'b':[96,54,35,255],'o':[148,76,39,255],'h':[185,110,57,255],'d':[53,45,38,255],'g':[87,72,55,255],'l':[134,116,79,255]}
heads={'down':{'offset':[-1,-1],'pixels':['.h.','kok','boo']},'up':{'offset':[-1,-1],'pixels':['.d.','bdb','.b.']},'left':{'offset':[-2,-1],'pixels':['.hb.','okob','.bo.']}}
heads['right']={'offset':[-1,-1],'pixels':[r[::-1] for r in heads['left']['pixels']]}
thoraces={'down':{'offset':[-1,-2],'pixels':['.h.','bho','boo','.b.','.b.']},'up':{'offset':[-1,-2],'pixels':['.b.','bhb','boo','.o.','.b.']},'left':{'offset':[-2,-1],'pixels':['bhhoo','.bbbo']}}
thoraces['right']={'offset':[-2,-1],'pixels':[r[::-1] for r in thoraces['left']['pixels']]}
gasters={'down':{'offset':[-1,-2],'pixels':['.gg.','gldk','ddkk','.kk.']},'up':{'offset':[-1,-2],'pixels':['.lg.','gdkk','dkkk','.kk.']},'left':{'offset':[-2,-2],'pixels':['.ggg.','glddk','dddkk','.kkk.']}}
gasters['right']={'offset':[-2,-2],'pixels':[r[::-1] for r in gasters['left']['pixels']]}
M={'identity':'ant-draft-v2-drawing-03','species':'Formica rufa worker','canvas':[32,32],'palette':P,'heads':heads,'thoraces':thoraces,'gasters':gasters,'petiole':{'offset':[0,-1],'pixels':['o','b']},'stylization':'Fresh species-specific palette-letter bicoloured rounded head, rust mesosoma, single petiole and dark warm-brown gaster with broad muted upper highlight. Profile head uses4px width following projected skull width; profile gaster uses4 integer rows for its3.1px projected volume instead of losing the upper curve. No geometry or head volume changes. Full head/body patches stay fixed; opposite profiles deliberately mirror lighting. Actual independently projected fixed-length six-leg chains and elbowed antennae guide one-pixel integer clusters. Body surfaces hide rasterized joint overlap; near legs use charcoal, far legs brown to keep depth readable. Tiny rear head cap has no front eyes/mandibles. Eyes/waist/tarsal tips are native pixel abstractions, not anatomical measurements.'}
(S/'masters.json').write_text(json.dumps(M,indent=2)+'\n',encoding='utf-8')
