"""Distinct editable forest mammal anatomy and closed spines."""
rib=egg('compact rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B');egg('belly',(0,-.03,P['torso'][2]-.13),(P['radii'][0]*.76,P['radii'][1]*.80,.26),'C');egg('haunch',(0,P['hindHip'][1],P['hindHip'][2]+.12),(P['radii'][0]*.9,.30,P['radii'][2]*.9),'B');egg('neck',(0,P['head'][1]-.20,P['head'][2]-.08),(.23,.30,.28),'B');egg('skull',(0,0,0),P['skull'],'C' if SPECIES=='sloth' else 'B',head,'head')
for side in [-1,1]:
 egg(f'eye {side}',(side*P['skull'][0]*.85,.14,.05),(.045,.055,.045),'N',head,'head')
 if SPECIES not in ['sloth','echidna']:
  size=.20 if SPECIES=='aye-aye' else .13 if SPECIES=='opossum' else .10
  egg(f'round ear {side}',(side*P['skull'][0]*.9,-.07,P['skull'][2]*.8),(size,.07,size),'T' if SPECIES in ['opossum','aye-aye','tasmanian-devil'] else 'H',head,'head')
if SPECIES=='sloth':
 egg('pale flat face',(0,.19,0),(.24,.11,.22),'C',head,'head')
 for side in [-1,1]:
  patch=egg(f'dark eye stripe {side}',(side*.14,.285,.035),(.13,.025,.065),'M',head,'head');patch.rotation_euler.y=side*.3
  egg(f'eye glint {side}',(side*.15,.31,.04),(.025,.025,.025),'N',head,'head')
 egg('short nose',(0,.32,-.035),(.065,.045,.055),'N',head,'head')
 for side in [-1,1]:
  egg(f'side eye mask {side}',(side*.255,.12,.035),(.055,.16,.085),'M',head,'head');egg(f'side eye glint {side}',(side*.29,.18,.04),(.025,.04,.035),'N',head,'head')
elif SPECIES=='binturong':
 egg('pale muzzle',(0,.24,-.03),(.20,.22,.14),'H',head,'head');egg('black nose',(0,.43,-.01),(.08,.055,.065),'N',head,'head')
 for side in [-1,1]:
  for j in range(3):egg(f'ear tuft {side} {j}',(side*(.27+j*.02),-.07,.28+j*.06),(.035,.05,.11),'M',head,'head')
  for j in range(6):egg(f'shaggy flank {side} {j}',(side*.40,-.62+j*.23,1.15),(.12,.11,.22),'H' if j%3==0 else 'B')
  for j in range(3):egg(f'whisker {side} {j}',(side*.27,.36,-.02+j*.035),(.18,.015,.015),'C',head,'head')
elif SPECIES=='aye-aye':
 egg('pale muzzle',(0,.22,-.05),(.16,.17,.12),'C',head,'head');egg('nose',(0,.38,-.02),(.06,.045,.045),'T',head,'head')
 for side in [-1,1]:
  egg(f'large orange eye {side}',(side*.19,.16,.06),(.085,.075,.085),'E',head,'head');egg(f'dark eye center {side}',(side*.22,.20,.07),(.04,.035,.05),'N',head,'head')
  for j in range(4):egg(f'rough flank tuft {side} {j}',(side*.25,-.38+j*.20,1.13),(.08,.13,.15),'H' if j%2 else 'B')
elif SPECIES=='kinkajou':
 egg('golden muzzle',(0,.24,-.06),(.18,.18,.14),'C',head,'head');egg('brown nose',(0,.39,-.025),(.07,.05,.055),'M',head,'head')
 for side in [-1,1]:egg(f'eye mask {side}',(side*.21,.14,.045),(.065,.10,.08),'M',head,'head');egg(f'eye pupil {side}',(side*.24,.19,.05),(.025,.035,.03),'N',head,'head')
elif SPECIES=='opossum':
 egg('white pointed face',(0,.17,-.025),(.22,.29,.18),'C',head,'head');egg('tapered white snout',(0,.40,-.045),(.10,.18,.095),'C',head,'head');egg('pink nose',(0,.565,-.03),(.06,.035,.045),'T',head,'head')
 for side in [-1,1]:egg(f'black eye {side}',(side*.20,.24,.04),(.035,.05,.045),'N',head,'head')
elif SPECIES=='echidna':
 egg('long slender beak',(0,.40,-.035),(.075,.34,.07),'H',head,'head');egg('small nostril',(0,.72,-.01),(.03,.035,.025),'N',head,'head')
 for row in range(7):
  y=-.56+row*.18
  for col in range(7):
   a=.14+col*(math.pi-.28)/6;f=math.sqrt(max(.18,1-((y+.05)/P['radii'][1])**2));base=Vector((P['radii'][0]*f*math.cos(a),y,P['torso'][2]+P['radii'][2]*f*math.sin(a)));tip=base+Vector((math.cos(a)*.26,-.10,math.sin(a)*.30));q=(tip-base).to_track_quat('Z','Y');vs=[tuple(base+q@Vector((.045*math.cos(i*math.tau/6),.045*math.sin(i*math.tau/6),0))) for i in range(6)]+[tuple(tip)];fs=[tuple(reversed(range(6)))]+[(i,(i+1)%6,6) for i in range(6)];poly(f'quill {row} {col}',vs,fs,'C' if (row+col)%3 else 'M',body,'body')
elif SPECIES=='tasmanian-devil':
 egg('broad short muzzle',(0,.30,-.09),(.24,.23,.16),'M',head,'head');egg('large dark nose',(0,.50,-.045),(.10,.06,.08),'N',head,'head');egg('opening jaw',(0,.10,.02),(.22,.23,.10),'B',jaw,'jaw')
 for side in [-1,1]:
  egg(f'white chest crescent {side}',(side*.25,.52,1.10),(.18,.08,.12),'C');egg(f'white rump patch {side}',(side*.33,-.53,1.17),(.11,.12,.09),'C')
  for j in range(3):egg(f'tooth {side} {j}',(side*.16,.20+j*.07,-.13),(.025,.035,.06),'C',head,'head')
def decorate_tail(parts,lengths):
 if SPECIES!='opossum':return
 for o in [*parts,*tailbulbs]:
  o.data.materials.clear();o.data.materials.append(mats['T'])
