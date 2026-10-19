"""Original seabird/hummingbird volumes; no previous animal pixels are read."""
egg('body core',(0,0,P['bodyZ']),P['coreRadii'],'B')
egg('breast',(0,.16,P['bodyZ']-.02),P['breastRadii'],'C')
egg('neck',(0,P['headY']*.65,(P['headZ']+P['bodyZ'])/2),P['neckRadii'],'B')
egg('skull',(0,0,0),P['headRadii'],P['headKey'],head)
for side in [-1,1]:
 x=P['headRadii'][0]*.92
 egg(f'eye ring {side}',(side*x,.08,.055),(.037,.045,.037),'E',head)
 egg(f'eye {side}',(side*(x+.018),.10,.06),(.022,.025,.025),'N',head)
L=P['beakLength']
if SPECIES=='pelican':
 fin('long pelican upper bill',[(-.07,.16,.025),(.07,.16,.025),(.035,.20+L,-.025),(-.035,.20+L,-.025)],.08,'T',head,axis='z')
 egg('closed gular pouch',(0,.70,-.16),(.13,.55,.18),'R',jaw)
 egg('small bill hook',(0,.20+L,-.04),(.04,.045,.07),'M',head)
elif SPECIES=='ruby-throated-hummingbird':
 fin('slender hummingbird bill',[(-.025,.12,.015),(.025,.12,.015),(0,.14+L,0)],.035,'N',head,axis='z')
 egg('ruby gorget',(0,.14,-.13),(.115,.13,.105),'R',head)
else:
 key='R' if SPECIES=='blue-footed-booby' else 'H'
 fin('pointed upper bill',[(-.065,.17,.025),(.065,.17,.025),(0,.20+L,-.025),(0,.20,.08)],.07,key,head,axis='z')
 fin('lower bill',[(-.05,.15,-.05),(.05,.15,-.05),(0,.17+L,-.025)],.045,key,jaw,axis='z')
 if SPECIES=='great-frigatebird':
  egg('hooked bill tip',(0,.20+L,-.06),(.04,.04,.075),'N',head)
  egg('male red throat pouch',(0,.24,P['bodyZ']+.06),(.18,.27,.23),'R')
for j in range(7):
 x=(j-3)*min(.05,P['coreRadii'][0]*.16)
 length=P['tailLength']*(.43+.19*abs(j-3) if SPECIES=='great-frigatebird' else 1-.06*abs(j-3))
 tipX=x+(j-3)*.09 if SPECIES=='great-frigatebird' else x
 y=-P['coreRadii'][1]*.65;z=P['bodyZ']+.02
 fin(f'closed tail feather {j}',[(x-.03,y,z),(x+.03,y,z),(tipX+.04,y-length,z-.12),(tipX-.035,y-length,z-.12)],.025,P['tailKey'],body,axis='z')
wings=[];covers=[];mandibles=[]
for side in [-1,1]:
 rest=Vector((side*P['coreRadii'][0]*.5,.02,P['bodyZ']+.08));shoulder=node(f'WING-{side}-shoulder',body,rest);shoulder['side']=side;shoulder['pair']=0;L=P['wingUpper']
 fin(f'closed flight panel upper {side}',[(0,.10,0),(side*L,.08,0),(side*L,-.24,0),(0,-.29,0)],.05,P['wingKey'],shoulder,axis='z');wings.append((shoulder,L,rest))
 rest=Vector((side*L,0,0));elbow=node(f'WING-{side}-elbow',shoulder,rest);elbow['side']=side;elbow['pair']=1;L=P['wingLength'];wings.append((elbow,L,rest))
 fin(f'closed flight panel fore {side}',[(0,.08,0),(side*L,.01,0),(side*L*.93,-.20,0),(0,-.28,0)],.035,P['wingKey'],elbow,axis='z')
 for j in range(7):
  x=side*L*(.10+j*.13);length=(.25+.16*math.sin(j*math.pi/6))*(.7 if SPECIES=='ruby-throated-hummingbird' else 1.2 if SPECIES=='pelican' else 1)
  fin(f'flight feather {side} {j}',[(x-side*.055,-.10,0),(x+side*.055,-.10,0),(x+side*.06,-.10-length,0),(x-side*.04,-.10-length,0)],.022,'H',elbow,axis='z')
