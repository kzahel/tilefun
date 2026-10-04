"""Emperor-specific letter masters fitted to actual torso/head projections."""
from pathlib import Path
import json
S=Path(__file__).parent
M={'identity':'penguin-draft-v1-drawing-02','palette':{'o':'#1e302f','k':'#2b3939','d':'#475555','g':'#69706a','w':'#dedbd0','c':'#a6afa6','y':'#d7bb6b','a':'#ad8042','f':'#62584c','e':'#102528'},'heads':{},'standing':{},'swimming':{},'stylization':['Full unchanged head/eye/gold-cheek/bill templates in every clip, swim skull counter-pitches rigidly to preserve global orientation.','Different fixed standing/swimming torso projections follow rigid75-degree posture; no geometry or pixel resampling.','Broad black back/white belly, restrained slate highlights and emperor gold ear/chest; rear hides pupils/bill/white front.','Web foot tops are dark, rear heels have no front toe highlights; hull contacts retain projected depths.','Three-link flipper hulls integer-composed with actual near/far occlusion, enough articulation for coherent underwater strokes.']}
M['heads']['down']={'offset':[-3,-3],'pixels':['..ddd..','.dkkkd.','okkkkko','eokkkke','ykkokky','.ykoky.','..aok..','..yyy..']}
M['heads']['up']={'offset':[-3,-3],'pixels':['..ddd..','.dkkkd.','odkkkko','okkkkko','ykkkkky','.ykkky.','..ooo..']}
M['heads']['left']={'offset':[-5,-3],'pixels':['.....ddd..','....dkkkd.','...okkkkko','ooookkkkkk','.aaooekkkk','....kyykk.','.....yyko.','.....ok...']}
M['heads']['right']={'offset':[-4,-3],'pixels':[r[::-1] for r in M['heads']['left']['pixels']]}
front=['...kkkkk...','..kkdddkk..','.kkdyyydkk.','.kdwywywdk.','.kdwwwwwdk.','okdwwwwwdko','okdwwwwwdko','okdwwwwwdko','okdwwwwwdko','okdwwwwwdko','.kdwwwwwdk.','.kkcwwwckk.','..kkccckk..','...kkckk...','....ooo....']
# Explicit widths keep authored pixels inspectable rather than generated fills.
front[2]='.kkdyyydkk.'
M['standing']['down']={'offset':[-5,-7],'pixels':front}
M['standing']['up']={'offset':[-5,-7],'pixels':['...ddddd...','..dddddkd..','.ddddkkkdk.','.ddkkkkkkk.','.dkkkkkkkk.','odkkkkkkkko','odkkkkkkkko','odkkkkkkkko','okkkkkkkkko','okkkkkkkkko','.kkkkkkkkk.','.kkkkkkkkk.','..kksss kk..'.replace(' ',''),'...kkokk...','....ooo....']}
M['standing']['up']['pixels'][12]='..kkssskk..'
M['standing']['left']={'offset':[-4,-7],'pixels':['...ddd...','..ddddk..','.kwddkkk.','owwddkkko','owwdkkkko','owwdkkkko','owwdkkkko','owwdkkkko','owwdkkkko','owwdkkkko','ocwdkkkko','.cwkkkkk.','.ockkkko.','..ockko..','...ooo...']}
M['standing']['right']={'offset':[-4,-7],'pixels':[r[::-1] for r in M['standing']['left']['pixels']]}
M['swimming']['down']={'offset':[-5,-5],'pixels':['....ooo....','...kkkkk...','..kkdddkk..','.kkdwwwdkk.','okdwwwwwdko','okdwwwwwdko','okdwwwwwdko','.kdwwwwwdk.','.kkcwwwckk.','..kkccckk..','...kkckk...']}
M['swimming']['up']={'offset':[-5,-8],'pixels':['....ddd....','...ddddk...','..ddddkkk..','.ddddkkkkk.','.dddkkkkkk.','odddkkkkkko','oddkkkkkkko','odkkkkkkkko','odkkkkkkkko','odkkkkkkkko','okkkkkkkkko','okkkkkkkkko','.kkkkkkkkk.','.kkkkkkkkk.','..kksss kk..'.replace(' ',''),'...kkokk...','....ooo....']}
M['swimming']['up']['pixels'][14]='..kkssskk..'
M['swimming']['left']={'offset':[-9,-4],'pixels':['.....dddddddd......','...dddddddddkkk....','..dddddkkkkkkkkkk..','.ddkkkkkkkkkkkkkko.','odkkkkkkkkkkkkkkkko','okkkcccccccccccckko','.kkccwwwwwwwwcckk..','..kkccwwwwwcckk....','......ooooooo......']}
M['swimming']['right']={'offset':[-9,-4],'pixels':[r[::-1] for r in M['swimming']['left']['pixels']]}
M['palette']['s']='#394743'
for group in ['heads','standing','swimming']:
 for f,p in M[group].items():assert len(set(map(len,p['pixels'])))==1,(group,f,[len(r) for r in p['pixels']])
(S/'masters.json').write_text(json.dumps(M,indent=2)+'\n',encoding='utf-8');print('PENGUIN_MASTERS_OK')
