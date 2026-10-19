"""Original friendly upright elephant and giraffe companion anatomy."""
egg('compact rib cage',P['torso'],P['radii'],'B');egg('belly',(0,.28,P['torso'][2]-.06),(P['radii'][0]*.8,.16,P['radii'][2]*.80),'C');egg('skull',(0,0,0),P['skull'],'B',head,'head')
for side in [-1,1]:
 egg(f'friendly eye {side}',(side*P['skull'][0]*.86,P['skull'][1]*.60,.12),(.045,.055,.045),'N',head,'head');egg(f'eye highlight {side}',(side*P['skull'][0]*.87,P['skull'][1]*.64,.135),(.015,.018,.015),'T',head,'head')
if SPECIES=='elephant-upright':
 egg('forehead',(0,.15,.30),(.40,.33,.30),'C',head,'head');egg('lower mouth',(0,.17,.05),(.30,.25,.11),'M',jaw,'jaw')
 for side in [-1,1]:
  egg(f'cheek {side}',(side*.35,.25,-.08),(.20,.23,.26),'B',head,'head')
  # Short ivory tusks are real closed curved volumes.
  a=Vector((side*.24,.33,-.14));b=Vector((side*.29,.60,-.19));o=egg(f'tusk base {side}',(a+b)/2,(.06,.06,(b-a).length/2),'T',head,'head');o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');a=b;b=Vector((side*.27,.75,-.06));o=egg(f'tusk tip {side}',(a+b)/2,(.045,.045,(b-a).length/2),'T',head,'head');o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
else:
 egg('long muzzle',(0,.34,-.08),(.22,.31,.16),'C',head,'head');egg('lower lip',(0,.27,.01),(.19,.24,.055),'M',jaw,'jaw')
 for side in [-1,1]:
  egg(f'nostril {side}',(side*.12,.61,-.03),(.03,.03,.022),'N',head,'head');egg(f'ossicone {side}',(side*.14,-.02,.33),(.045,.045,.22),'M',head,'head');egg(f'ossicone tip {side}',(side*.14,-.02,.53),(.07,.065,.07),'H',head,'head')
 for side in [-1,1]:
  for row in range(3):
   for col in [-1,1]:egg(f'closed coat patch {side} {row} {col}',(col*.22,side*.34,1.55+row*.38),(.12,.035,.14),'M')
 for side in [-1,1]:
  for row in range(3):egg(f'flank patch {side} {row}',(side*.44,0,1.55+row*.38),(.035,.14,.13),'H')

def create_ears(ear_pivots):
 for side in [-1,1]:
  pivot=node(f'ear-pivot-{side}',head,(side*(.42 if SPECIES=='elephant-upright' else .20),-.06,.03 if SPECIES=='elephant-upright' else .12));ear_pivots.append((side,pivot))
  egg(f'closed ear {side}',(side*(.22 if SPECIES=='elephant-upright' else .13),0,0),(.50,.08,.65) if SPECIES=='elephant-upright' else (.25,.07,.14),'B',pivot,'head');egg(f'ear interior {side}',(side*(.22 if SPECIES=='elephant-upright' else .13),.075,0),(.36,.025,.49) if SPECIES=='elephant-upright' else (.17,.025,.09),'H',pivot,'head')

def decorate_chains(neck,trunk):
 for i,o in enumerate(neck):
  for side in [-1,1]:
   for j in [-1,1]:egg(f'neck patch {i} {side} {j}',(side*.13,side*.07,j*.15),(.055,.055,.10),'M',o,'neck')
  egg(f'mane ridge {i}',(0,-.16,0),(.06,.05,P['neckLengths'][i]*.46),'M',o,'neck')
 if trunk:
  for side in [-1,1]:egg(f'trunk nostril {side}',(side*.045,.025,P['trunkLengths'][-1]/2),(.025,.025,.025),'N',trunk[-1],'head')

def decorate_tail(parts,lengths):
 egg('tail tuft',(0,0,lengths[-1]/2),(.10,.09,.13),'M',parts[-1],'tail')
