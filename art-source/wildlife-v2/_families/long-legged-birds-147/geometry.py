"""Distinct long-legged birds in editable closed-volume geometry."""
egg('bird rib cage',P['torso'],P['radii'],'B');egg('breast',(0,.35,P['torso'][2]-.06),(P['radii'][0]*.9,P['radii'][1]*.75,P['radii'][2]*.9),'C' if SPECIES in ['marabou-stork','great-blue-heron'] else 'B');egg('back feather plane',(0,-.15,P['torso'][2]+P['radii'][2]*.65),(P['radii'][0]*.8,P['radii'][1]*.8,.18),'H')
egg('skull',(0,0,0),P['skull'],P['headKey'],head,'head')
beak=P['beakLength'];w=P['beakWidth'];baseY=P['skull'][1]*.70
if SPECIES=='shoebill':
 egg('broad clog bill',(0,.52,.015),(.255,.44,.19),'E',head,'head');egg('bill hook',(0,.90,-.065),(.085,.09,.13),'M',head,'head')
elif SPECIES=='flamingo':
 outline=[(.13,.06),(.39,.06),(.60,-.15),(.49,-.22),(.25,-.065),(.13,-.035)];vs=[(side*w,y,z) for side in [-1,1] for y,z in outline];n=len(outline);fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];poly('closed bent flamingo bill',vs,fs,'C',head,'head');egg('dark bent bill tip',(0,.51,-.14),(.12,.11,.105),'N',head,'head')
else:
 vs=[(-w,baseY,-.06),(w,baseY,-.06),(w,baseY,.08),(-w,baseY,.08),(0,baseY+beak,.015)];poly('closed upper beak',vs,[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'E',head,'head')
egg('lower beak',(0,baseY+beak*.42-.08,-.015),(w*.8,beak*.48,.035),'E',jaw,'jaw')
for side in [-1,1]:
 if SPECIES=='secretary-bird':egg(f'orange bare face {side}',(side*.205,.10,.01),(.055,.18,.15),'R',head,'head')
 if SPECIES=='great-blue-heron':
  egg(f'pale cheek {side}',(side*.17,.08,.01),(.055,.17,.17),'C',head,'head');stripe=egg(f'dark crown stripe {side}',(side*.17,-.03,.17),(.04,.26,.05),'N',head,'head');plume=egg(f'long crown plume {side}',(side*.10,-.29,.20),(.018,.27,.025),'N',head,'head')
 egg(f'eye ring {side}',(side*P['skull'][0]*.95,.10,.07),(.045,.055,.045),'E',head,'head');egg(f'eye {side}',(side*(P['skull'][0]+.018),.12,.07),(.023,.027,.028),'N',head,'head')
 if SPECIES=='secretary-bird':egg(f'black thigh feather mass {side}',(side*P['legHip'][0],.01,P['legHip'][2]+.04),(.15,.23,.34),'N')
if SPECIES=='secretary-bird':
 for j in range(7):
  o=egg(f'back-swept crest quill {j}',((j-3)*.035,-.17,.20+.04*(3-abs(j-3))),(.022,.035,.24),'N',head,'head');o.rotation_euler.x=.75
if SPECIES=='marabou-stork':egg('hanging throat pouch',(0,.10,-.35),(.12,.15,.35),'R',head,'head')
if SPECIES=='shoebill':
 for j in range(3):egg(f'short shaggy crest {j}',((j-1)*.10,-.20,.28),(.055,.12,.12),'H',head,'head')
wings=[]
for side in [-1,1]:
 wing=node(f'WING-{side}',body,(side*P['radii'][0]*.8,-.1,P['torso'][2]+.08));wings.append(wing);r=P['wingRadii'];key='N' if SPECIES=='secretary-bird' else 'H'
 egg(f'folded wing {side}',(side*.045,-.16,-.05),r,key,wing,'wing')
 for i in range(3):egg(f'flight feather {side} {i}',(side*.05,-.35-i*.1,-.10-i*.05),(r[0]*.85,r[1]*.55,r[2]*.65),'N' if SPECIES in ['flamingo','secretary-bird'] else 'B',wing,'wing')
