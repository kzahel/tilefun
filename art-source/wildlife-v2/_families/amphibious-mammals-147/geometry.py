"""Distinct closed otter, platypus and pinniped anatomy."""
egg('compact rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B');egg('belly',(0,-.03,P['torso'][2]-.12),(P['radii'][0]*.8,P['radii'][1]*.85,P['radii'][2]*.65),'C');egg('neck',(0,P['head'][1]-.22,P['head'][2]-.13),(.24,.34,.32) if SPECIES!='walrus' else (.37,.40,.34),'B');egg('skull',(0,0,0),P['skull'],'B',head,'head')
for side in [-1,1]:
 egg(f'eye {side}',(side*P['skull'][0]*.91,.13,.055),(.035,.045,.04),'N',head,'head')
 if SPECIES=='river-otter':egg(f'small round ear {side}',(side*.23,-.12,.17),(.065,.055,.07),'B',head,'head')
 if SPECIES=='sea-lion':egg(f'ear flap {side}',(side*.24,-.17,.02),(.04,.065,.09),'H',head,'head')
if SPECIES=='platypus':
 egg('broad flattened upper bill',(0,.32,-.035),(.28,.36,.055),'M',head,'head');egg('lower bill',(0,.17,.11),(.26,.32,.035),'M',jaw,'jaw')
 for side in [-1,1]:egg(f'bill nostril {side}',(side*.12,.58,.025),(.025,.035,.018),'N',head,'head')
else:
 for side in [-1,1]:
  egg(f'muzzle lobe {side}',(side*(.17 if SPECIES=='walrus' else .08),.35 if SPECIES=='walrus' else .27,-.06),(.23,.19,.18) if SPECIES=='walrus' else (.13,.15,.11),'C',head,'head')
  for j in range(4):egg(f'whisker {side} {j}',(side*(.34 if SPECIES=='walrus' else .23),.35,-.03+j*.035),(.18,.016,.015),'T',head,'head')
 egg('dark nose',(0,.48 if SPECIES=='walrus' else .39,.015),(.11,.065,.07) if SPECIES=='walrus' else (.075,.05,.05),'N',head,'head');egg('lower lip',(0,.13,.08),(.22,.22,.07) if SPECIES=='walrus' else (.12,.16,.05),'M',jaw,'jaw')
if SPECIES=='walrus':
 for side in [-1,1]:
  base=Vector((side*.22,.34,-.15));tip=Vector((side*.24,.39,-.85));q=(tip-base).to_track_quat('Z','Y');vs=[]
  for point,r in [(base,.065),(tip,.018)]:
   for j in range(10):vs.append(tuple(point+q@Vector((r*math.cos(j*math.tau/10),r*math.sin(j*math.tau/10),0))))
  fs=[tuple(reversed(range(10))),tuple(range(10,20))]+[(j,(j+1)%10,(j+1)%10+10,j+10) for j in range(10)];poly(f'closed tusk {side}',vs,fs,'T',head,'head')
  for j in range(8):egg(f'moustache pore {side} {j}',(side*(.08+.06*(j%3)),.51,-.09+(j//3)*.055),(.02,.025,.02),'M',head,'head')
def decorate_tail(parts,lengths):pass
