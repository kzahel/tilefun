"""Fresh bird bodies, bills, closed wing panels and flight feathers."""
egg('thorax core',(0,0,P['bodyZ']),P['coreRadii'],'B');egg('breast',(0,.16,P['bodyZ']-.02),(.21,.24,.25),'C');egg('neck',(0,.24,.82),(.14,.18,.20),'M');egg('skull',(0,0,0),P['headRadii'],'M',head)
for side in [-1,1]:
 egg(f'eye ring {side}',(side*.175,.08,.055),(.045,.06,.05),'H',head);egg(f'eye {side}',(side*.20,.095,.06),(.03,.035,.035),'N',head)
# Closed flattened cone or bill ellipsoid volumes, never painted screen rectangles.
if SPECIES in ['pigeon','dove','sparrow']:
 fin('pointed bill',[(0,.18,-.03),(-.06,.20,.025),(0,.40,-.06),(.06,.20,.025)],.07,'T' if SPECIES=='dove' else 'N',head,axis='z')
elif SPECIES=='parrot':
 egg('hooked upper bill',(0,.22,-.015),(.10,.16,.14),'T',head);egg('bill hook',(0,.32,-.10),(.045,.07,.11),'N',head)
else:
 egg('large bill',(0,.40,-.005),(.13,.42,.14),'T',head);egg('black bill tip',(0,.73,-.015),(.095,.13,.10),'N',head)
 if SPECIES=='great-hornbill':egg('casque',(0,.32,.17),(.12,.32,.10),'T',head)
for j in range(5):
 x=(j-2)*.055;fin(f'closed tail feather {j}',[(x-.035,-.23,.59),(x+.035,-.23,.59),(x+.05,-.78,.56),(x-.05,-.78,.56)],.025,'B' if SPECIES not in ['toucan','great-hornbill'] else 'C',body,axis='z')
wings=[];covers=[];mandibles=[]
for side in [-1,1]:
 rest=Vector((side*.13,.02,.73));shoulder=node(f'WING-{side}-shoulder',body,rest);shoulder['side']=side;shoulder['pair']=0;L=.35
 fin(f'closed flight panel upper {side}',[(0,.10,0),(side*L,.08,0),(side*L,-.24,0),(0,-.29,0)],.05,'B',shoulder,axis='z');wings.append((shoulder,L,rest))
 rest=Vector((side*L,0,0));elbow=node(f'WING-{side}-elbow',shoulder,rest);elbow['side']=side;elbow['pair']=1;L=P['wingLength'];wings.append((elbow,L,rest))
 fin(f'closed flight panel fore {side}',[(0,.08,0),(side*L,.01,0),(side*L*.93,-.20,0),(0,-.28,0)],.035,'B',elbow,axis='z')
 for j in range(7):
  x=side*L*(.10+j*.13);length=.28+.13*math.sin(j*math.pi/6);fin(f'flight feather {side} {j}',[(x-side*.055,-.10,0),(x+side*.055,-.10,0),(x+side*.06,-.10-length,0),(x-side*.04,-.10-length,0)],.022,'H' if SPECIES in ['dove','pigeon','sparrow'] else 'C' if SPECIES in ['toucan','great-hornbill'] else 'B',elbow,axis='z')
if SPECIES=='pigeon':egg('iridescent neck',(0,.24,.80),(.155,.16,.13),'C')
if SPECIES=='sparrow':
 egg('brown crown',(0,-.015,.16),(.17,.20,.07),'B',head);egg('dark throat',(0,.18,-.12),(.10,.08,.09),'N',head)
if SPECIES=='parrot':egg('red forehead',(0,.12,.13),(.12,.13,.08),'R',head)
