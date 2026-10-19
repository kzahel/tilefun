"""Distinct ratite, parrot, turkey and peacock anatomy as editable mesh volumes."""
egg('bird rib cage',P['torso'],P['radii'],'B');egg('breast',(0,.35,P['torso'][2]-.06),(P['radii'][0]*.9,P['radii'][1]*.75,P['radii'][2]*.9),'B');egg('back feather plane',(0,-.15,P['torso'][2]+P['radii'][2]*.65),(P['radii'][0]*.8,P['radii'][1]*.8,.18),'H')
egg('skull',(0,0,0),P['skull'],P['headKey'],head,'head')
beak=P['beakLength'];w=P['beakWidth'];baseY=P['skull'][1]*.70;vs=[(-w,0,-.06),(w,0,-.06),(w,0,.08),(-w,0,.08),(0,beak,.015)];vs=[(x,y+baseY,z) for x,y,z in vs];poly('closed upper beak',vs,[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'E',head,'head');egg('lower beak',(0,baseY+beak*.42-.08,-.015),(w*.8,beak*.48,.035),'E',jaw,'jaw')
if SPECIES=='kakapo':egg('hooked beak tip',(0,baseY+beak*.83,-.05),(.06,.055,.10),'E',head,'head')
for side in [-1,1]:
 egg(f'eye {side}',(side*P['skull'][0]*.94,.08,.05),(.045,.055,.045),'N',head,'head')
 if SPECIES=='kakapo':egg(f'facial disc {side}',(side*.13,.13,-.01),(.16,.09,.20),'C',head,'head');egg(f'disc eye {side}',(side*.18,.21,.06),(.035,.03,.035),'N',head,'head')
 if SPECIES in ['cassowary','wild-turkey']:egg(f'red wattle {side}',(side*.09,.02,-.26),(.055,.07,.19),'R',head,'head')
 if SPECIES=='peacock':
  egg(f'white cheek {side}',(side*.17,.10,-.06),(.025,.12,.06),'C',head,'head')
if SPECIES=='cassowary':
 vs=[(-.10,-.12,.15),(.10,-.12,.15),(-.07,.13,.21),(.07,.13,.21),(-.04,-.07,.66),(.04,-.07,.66),(-.035,.11,.49),(.035,.11,.49)];poly('closed casque',vs,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],'E',head,'head')
if SPECIES=='peacock':
 for i in [-1,0,1]:
  egg(f'crest stalk {i}',(i*.065,-.05,.23+i*.02),(.015,.02,.16),'U',head,'head');egg(f'crest tip {i}',(i*.065,-.05,.38+i*.02),(.055,.04,.035),'U',head,'head')
if SPECIES in ['emu','cassowary']:
 for i in range(7):egg(f'shaggy coat {i}',((i%3-1)*.23,-.65+(i//3)*.3,P['torso'][2]+.40),(.21,.24,.23),'H' if i%3==0 else 'B')
wings=[]
for side in [-1,1]:
 wing=node(f'WING-{side}',body,(side*P['radii'][0]*.8,-.1,P['torso'][2]+.08));wings.append(wing)
 radii=P['wingRadii'];egg(f'folded wing {side}',(side*.045,-.16,-.05),radii,'C' if SPECIES=='ostrich' else 'H',wing,'wing')
 for i in range(3):egg(f'flight feather {side} {i}',(side*.05,-.35-i*.1,-.10-i*.05),(radii[0]*.85,radii[1]*.55,radii[2]*.65),'C' if SPECIES=='ostrich' else 'B',wing,'wing')
