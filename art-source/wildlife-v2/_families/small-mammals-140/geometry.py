"""Species anatomy inserted into the shared fixed-link mechanics scene."""
egg('compact rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B');egg('back highlight',(0,-.10,P['torso'][2]+P['radii'][2]*.72),(P['radii'][0]*.82,P['radii'][1]*.85,.075),'H');egg('belly',(0,-.05,P['torso'][2]-.11),(P['radii'][0]*.80,P['radii'][1]*.8,.15),'C');egg('hind haunch',(0,P['hindHip'][1],P['hindHip'][2]+.06),(P['radii'][0]*.9,.28,P['radii'][2]*.85),'B')
egg('skull',(0,0,0),P['skull'],'B',head,'head');egg('muzzle',(0,P['muzzleY'],-.06),P['muzzleRadii'],'C',head,'head');egg('nose',(0,P['muzzleY']+P['muzzleRadii'][1]*.85,-.02),(.055,.045,.045),'N',head,'head');egg('lower jaw',(0,.07,-.01),(P['muzzleRadii'][0]*.8,P['muzzleRadii'][1]*.75,.04),'C',jaw,'jaw')
for side in [-1,1]:
 x=side*P['skull'][0]*.86
 egg(f'eye {side}',(x,.11,.055),(.035,.045,.035),'N',head,'head')
 egg(f'ear {side}',(side*P['earX'],-.06,P['earZ']),P['earRadii'],'B',head,'head');egg(f'ear interior {side}',(side*P['earX'],.005,P['earZ']),(P['earRadii'][0]*.62,.018,P['earRadii'][2]*.65),'M',head,'head')
 if SPECIES in ['mouse','rat','hamster','chinchilla']:
  for j in [-1,1]:poly(f'whisker {side} {j}',[(side*.08,.24,-.05),(side*.33,.28,j*.04-.04),(side*.10,.25,-.03)],[(0,1,2)],'C',head,'head')
 if SPECIES in ['raccoon','red-panda']:
  egg(f'cheek mask {side}',(side*P['skull'][0]*.93,.16,-.015),(.035,.15,.115),'M' if SPECIES=='raccoon' else 'C',head,'head');egg(f'mask eye {side}',(side*P['skull'][0]*1.02,.19,.055),(.025,.035,.025),'N',head,'head')
if SPECIES=='guinea-pig':
 egg('white face blaze',(0,.20,.11),(.09,.18,.11),'C',head,'head');egg('brown flank patch',(.31,-.20,.64),(.12,.33,.27),'M')
if SPECIES=='hamster':
 for side in [-1,1]:egg(f'full cheek pouch {side}',(side*.21,.14,-.07),(.14,.17,.13),'C',head,'head')
if SPECIES=='skunk':
 for side in [-1,1]:
  for j in range(5):egg(f'white back stripe {side} {j}',(side*.14,-.62+j*.27,P['torso'][2]+P['radii'][2]*.94),(.065,.17,.055),'C')
 egg('white head blaze',(0,-.02,.20),(.07,.24,.06),'C',head,'head')
if SPECIES in ['hedgehog','porcupine']:
 for j in range(55 if SPECIES=='porcupine' else 40):
  a=(j%10)*math.tau/10;y=-.62+(j//10)*.25;r=P['radii'];z=P['torso'][2]+r[2]*math.sin(a)*.85;x=r[0]*math.cos(a)*.85
  if z<P['torso'][2]-.10:continue
  v=Vector((x,y,z));direction=Vector((math.cos(a)*.5,-.42,math.sin(a))).normalized();tip=v+direction*(.55 if SPECIES=='porcupine' else .20);basis=direction.to_track_quat('Z','Y');vs=[tuple(v+basis@Vector((.035*math.cos(k*math.tau/6),.035*math.sin(k*math.tau/6),0))) for k in range(6)]+[tuple(tip)];fs=[tuple(reversed(range(6)))]+[(k,(k+1)%6,6) for k in range(6)];poly(f'quill {j}',vs,fs,'C' if j%3==0 else 'M',body,'body')
