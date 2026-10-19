"""Original corvid/puffin volumes; bills and markings attach to source anatomy."""
egg('thorax core',(0,0,P['bodyZ']),P['coreRadii'],'B')
egg('breast',(0,.16,P['bodyZ']-.02),P['breastRadii'],'C')
egg('neck',(0,.24,.82),P['neckRadii'],'M')
egg('skull',(0,0,0),P['headRadii'],'M',head)
for side in [-1,1]:
 if SPECIES=='atlantic-puffin':
  egg(f'white cheek {side}',(side*.17,.045,.015),(.09,.20,.20),'C',head)
  fin(f'red eye accent {side}',[(side*.235,.04,.085),(side*.24,.115,.015),(side*.235,.10,-.09)],.018,'R',head)
 eyeX=P['headRadii'][0]*.92
 egg(f'eye ring {side}',(side*eyeX,.08,.055),(.040,.05,.043),'H',head)
 egg(f'eye {side}',(side*(eyeX+.022),.095,.06),(.023,.027,.028),'N',head)
if SPECIES=='atlantic-puffin':
 # Tall flattened triangular bill with separate closed color bands.
 fin('orange triangular bill',[(0,.18,.15),(0,.59,-.02),(0,.23,-.18)],.16,'T',head)
 fin('red bill tip',[(0,.43,.045),(0,.60,-.02),(0,.43,-.09)],.165,'R',head)
 fin('pale bill base',[(0,.18,.13),(0,.26,.12),(0,.28,-.14),(0,.21,-.17)],.17,'H',head)
 fin('lower bill',[(0,.21,-.08),(0,.55,-.02),(0,.24,-.16)],.12,'T',jaw)
else:
 L=P['beakLength']
 fin('heavy tapered upper bill',[(-.07,.17,.035),(.07,.17,.035),(0,.21+L,-.025),(0,.22,.09)],.08,'N',head,axis='z')
 fin('lower bill',[(-.055,.18,-.05),(.055,.18,-.05),(0,.18+L,-.025)],.05,'T',jaw,axis='z')
 if SPECIES=='raven':
  for j in range(5):
   x=(j-2)*.05
   fin(f'shaggy throat feather {j}',[(x-.035,.17,-.13),(x+.035,.17,-.13),(x,.21,-.34)],.035,'C',head)
for j in range(7):
 x=(j-3)*.05
 length=P['tailLength']*(1-.14*abs(j-3) if SPECIES=='raven' else 1-.035*abs(j-3))
 fin(f'closed tail feather {j}',[(x-.035,-.23,.59),(x+.035,-.23,.59),(x+.045,-.23-length,.56),(x-.045,-.23-length,.56)],.025,'B',body,axis='z')
wings=[];covers=[];mandibles=[]
for side in [-1,1]:
 rest=Vector((side*.13,.02,.73));shoulder=node(f'WING-{side}-shoulder',body,rest);shoulder['side']=side;shoulder['pair']=0;L=.35
 fin(f'closed flight panel upper {side}',[(0,.10,0),(side*L,.08,0),(side*L,-.24,0),(0,-.29,0)],.05,'B',shoulder,axis='z');wings.append((shoulder,L,rest))
 rest=Vector((side*L,0,0));elbow=node(f'WING-{side}-elbow',shoulder,rest);elbow['side']=side;elbow['pair']=1;L=P['wingLength'];wings.append((elbow,L,rest))
 fin(f'closed flight panel fore {side}',[(0,.08,0),(side*L,.01,0),(side*L*.93,-.20,0),(0,-.28,0)],.035,'B',elbow,axis='z')
 for j in range(7):
  x=side*L*(.10+j*.13);length=(.28+.13*math.sin(j*math.pi/6))*(.75 if SPECIES=='atlantic-puffin' else 1)
  fin(f'flight feather {side} {j}',[(x-side*.055,-.10,0),(x+side*.055,-.10,0),(x+side*.06,-.10-length,0),(x-side*.04,-.10-length,0)],.022,'H' if SPECIES!='atlantic-puffin' else 'B',elbow,axis='z')
