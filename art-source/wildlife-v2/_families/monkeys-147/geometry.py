"""Distinct primate anatomy in editable fixed-volume parts."""
SC=P['skull'][0]/.36

def e(n,loc,radii,key,parent=head,group='head'):
 return egg(n,[v*SC for v in loc],[v*SC for v in radii],key,parent,group)

rib=egg('compact rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B')
e('back fur plane',(0,-.05,1.78),(.42,.70,.16),'H',body,'body')
e('pale belly',(0,.03,1.22),(.38,.68,.36),'C',body,'body')
e('hind haunch',(0,-.54,1.32),(.43,.39,.48),'B',body,'body')
e('neck',(0,.63,1.62),(.31,.29,.39),'B',body,'body')
e('skull',(0,0,0),(.36,.35,.38),'B')
e('bare face',(0,.29,-.02),(.30,.11,.29),'C' if SPECIES=='capuchin-monkey' else 'M')
e('lower jaw',(0,.09,-.08),(.23,.22,.11),'M',jaw,'jaw')
for side in [-1,1]:
 e(f'ear {side}',(side*.35,-.03,.02),(.12,.075,.15),'M')
 e(f'ear center {side}',(side*.36,.03,.02),(.07,.025,.095),'E')
 e(f'eye {side}',(side*.17,.39,.075),(.035,.025,.035),'N')
if SPECIES=='capuchin-monkey':
 e('dark cap',(0,-.02,.30),(.32,.30,.14),'M')
 e('short muzzle',(0,.36,-.14),(.16,.14,.11),'C')
 for side in [-1,1]:e(f'nostril {side}',(side*.045,.48,-.11),(.018,.025,.02),'N')
elif SPECIES=='ring-tailed-lemur':
 e('pointed muzzle',(0,.40,-.09),(.15,.27,.13),'C')
 e('black nose',(0,.63,-.08),(.07,.065,.065),'N')
 for side in [-1,1]:
  e(f'white cheek {side}',(side*.27,.20,-.10),(.17,.15,.21),'C')
  e(f'dark eye mask {side}',(side*.18,.32,.09),(.13,.10,.14),'K')
  e(f'amber eye {side}',(side*.18,.414,.105),(.045,.025,.045),'E')
  e(f'eye pupil {side}',(side*.18,.438,.105),(.019,.015,.029),'N')
elif SPECIES=='mandrill':
 e('long muzzle',(0,.35,-.14),(.23,.31,.26),'M')
 for side in [-1,1]:
  for j in range(3):e(f'blue facial ridge {side} {j}',(side*(.13+j*.045),.40+j*.02,-.08),(.035,.14,.23),'E')
 e('red nasal bridge',(0,.56,-.05),(.075,.10,.25),'T')
 e('golden beard',(0,.30,-.40),(.25,.23,.14),'C')
 e('red rump',(0,-.77,1.33),(.24,.12,.25),'T',body,'body')
elif SPECIES=='proboscis-monkey':
 e('long pendulous nose',(0,.49,-.16),(.15,.20,.33),'E')
 e('nose tip',(0,.54,-.39),(.18,.15,.13),'M')
 e('crown',(0,-.03,.32),(.30,.28,.13),'H')
elif SPECIES=='japanese-macaque':
 for side in [-1,1]:
  e(f'shaggy cheek {side}',(side*.29,.12,-.03),(.18,.25,.29),'H')
 e('pink bare face',(0,.33,.02),(.25,.11,.24),'M')
 e('pink muzzle',(0,.42,-.13),(.16,.12,.12),'E')
 for side in [-1,1]:e(f'eye upper {side}',(side*.14,.45,.095),(.036,.024,.035),'N')
