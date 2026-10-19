"""Raptor-specific closed bodies, hooked bills, talons and feathered wings."""
z=P['bodyZ']
egg('thorax core',(0,0,z),P['coreRadii'],'B');egg('breast',(0,.23,z-.02),(P['coreRadii'][0]*.88,.35,P['coreRadii'][2]*.88),'C');egg('neck',(0,.34,z+.30),(.22,.25,.30),'M');egg('skull',(0,0,0),P['headRadii'],'M',head)
if SPECIES=='owl':
 for side in [-1,1]:
  egg(f'facial disc {side}',(side*.19,.25,0),(.21,.10,.29),'R',head)
  egg(f'disc shade {side}',(side*.19,.30,.02),(.15,.045,.20),'H',head)
  egg(f'gold eye {side}',(side*.16,.34,.06),(.085,.040,.09),'E',head)
  egg(f'dark pupil {side}',(side*.16,.375,.065),(.045,.025,.055),'N',head)
 fin('small hooked bill',[(0,.32,-.035),(0,.46,-.06),(0,.38,-.20)],.09,'T',head)
 for side in [-1,1]:
  for j in range(4):
   egg(f'owl chest bar {side} {j}',(side*(.1+.045*(j%2)),.50,z-.15+j*.14),(.06,.022,.018),'B')
else:
 for side in [-1,1]:
  x=P['headRadii'][0]*.93
  egg(f'eye ring {side}',(side*x,.15,.06),(.045,.07,.06),'E',head)
  egg(f'eye {side}',(side*(x+.025),.17,.065),(.025,.035,.035),'N',head)
  egg(f'focused brow {side}',(side*x,.15,.14),(.055,.12,.035),'M',head)
 egg('upper hooked bill',(0,.36,-.02),(.12,.20,.11),'T',head)
 fin('hook tip',[(0,.48,.025),(0,.58,-.015),(0,.51,-.20)],.115,'T',head)
 fin('lower mandible',[(0,.29,-.11),(0,.53,-.08),(0,.35,-.17)],.10,'T',jaw)
 if SPECIES=='hawk':
  for side in [-1,1]:
   for j in range(5):egg(f'chest streak {side} {j}',(side*(.08+.055*(j%2)),.52,z-.21+j*.12),(.025,.022,.07),'B')
for j in range(7):
 x=(j-3)*.075;length=(.32 if SPECIES=='owl' else .72 if SPECIES=='eagle' else .58)-(abs(j-3)*.025)
 fin(f'closed tail feather {j}',[(x-.05,-.28,z-.05),(x+.05,-.28,z-.05),(x+.055,-.28-length,z-.10),(x-.055,-.28-length,z-.10)],.035,'R' if SPECIES in ['hawk','eagle'] else 'H',body,axis='z')
wings=[];covers=[];mandibles=[]
for side in [-1,1]:
 rest=Vector((side*.23,.03,z+.16));shoulder=node(f'WING-{side}-shoulder',body,rest);shoulder['side']=side;shoulder['pair']=0;L=.48
 fin(f'closed flight panel upper {side}',[(0,.12,0),(side*L,.10,0),(side*L,-.32,0),(0,-.35,0)],.07,'B',shoulder,axis='z');wings.append((shoulder,L,rest))
 rest=Vector((side*L,0,0));elbow=node(f'WING-{side}-elbow',shoulder,rest);elbow['side']=side;elbow['pair']=1;L=P['wingLength'];wings.append((elbow,L,rest))
 fin(f'closed flight panel fore {side}',[(0,.10,0),(side*L,.03,0),(side*L*.94,-.25,0),(0,-.36,0)],.045,'B',elbow,axis='z')
 for j in range(9):
  x=side*L*(.08+j*.10);length=.34+.25*math.sin(j*math.pi/8)
  fin(f'flight feather {side} {j}',[(x-side*.07,-.12,0),(x+side*.07,-.12,0),(x+side*.08,-.12-length,0),(x-side*.05,-.12-length,0)],.03,'H',elbow,axis='z')
