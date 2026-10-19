"""Closed crocodilian and monitor anatomy, no mammal ears or fur."""
rib=egg('compact rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B');egg('belly',(0,-.05,P['torso'][2]-.17),(P['radii'][0]*.88,P['radii'][1]*.90,.23),'C')
egg('tapered muscular neck',(0,P['head'][1]-.36,P['head'][2]),(.34,.60,.29),'B')
egg('skull',(0,0,0),P['skull'],'B',head,'head')
def cone(n,base,tip,r,key,parent=body,group='body'):
 base=Vector(base);tip=Vector(tip);q=(tip-base).to_track_quat('Z','Y');vs=[tuple(base+q@Vector((r*math.cos(i*math.tau/6),r*math.sin(i*math.tau/6),0))) for i in range(6)]+[tuple(tip)];fs=[tuple(reversed(range(6)))]+[(i,(i+1)%6,6) for i in range(6)];return poly(n,vs,fs,key,parent,group)
isK=SPECIES=='komodo-dragon';length=.66 if isK else 1.14;width=.23 if isK else .42 if SPECIES=='alligator' else .30
# A tapered eight-corner closed upper jaw gives the crocodile its V planform.
if SPECIES=='crocodile':
 vs=[(-.36,.12,-.10),(.36,.12,-.10),(.17,1.20,-.10),(-.17,1.20,-.10),(-.36,.12,.11),(.36,.12,.11),(.17,1.20,.04),(-.17,1.20,.04)];fs=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)];poly('tapered V upper snout',vs,fs,'H',head,'head')
else:egg('broad U snout' if not isK else 'long monitor snout',(0,length*.52,-.01),(width,length*.62,.15),'H',head,'head')
egg('closed lower jaw',(0,length*.48-.16,-.035),(width*.92,length*.63,.075),'C',jaw,'jaw')
for side in [-1,1]:
 egg(f'raised eye brow {side}',(side*.31,-.04,.22),(.11,.16,.11),'M',head,'head');egg(f'eye {side}',(side*.375,.04,.23),(.045,.06,.045),'E',head,'head');egg(f'vertical pupil {side}',(side*.405,.065,.235),(.018,.025,.035),'N',head,'head')
 egg(f'nostril {side}',(side*width*.6,length*.97,.095),(.035,.05,.025),'N',head,'head')
 for j in range(8 if not isK else 5):
  y=.18+j*length/(8 if not isK else 5);x=side*width*(.95-.38*y/length if SPECIES=='crocodile' else .90)
  cone(f'upper tooth {side} {j}',(x,y,-.09),(x,y,-.19),.03,'C',head,'head')
if isK:
 for side in [-1,1]:
  for j in range(7):egg(f'flank pale scale {side} {j}',(side*.51,-.65+j*.22,1.05),(.045,.06,.06),'H')
 tongue=egg('fork tongue stem',(0,.62,.03),(.028,.30,.024),'M',jaw,'jaw')
 for side in [-1,1]:egg(f'fork tongue tip {side}',(side*.07,.91,.03),(.025,.12,.02),'M',jaw,'jaw')
else:
 for row in range(8):
  y=-1.10+row*.29;factor=math.sqrt(max(.12,1-((y-P['torso'][1])/P['radii'][1])**2))
  for col in [-1,0,1]:
   x=col*.29*factor;z=P['torso'][2]+P['radii'][2]*factor*math.sqrt(max(.1,1-(x/P['radii'][0])**2));cone(f'dorsal scute {row} {col}',(x,y,z-.025),(x,y-.04,z+.15),.11,'M' if row%2 else 'H')
def decorate_tail(parts,lengths):
 if isK:return
 for i,(o,L) in enumerate(zip(parts,lengths)):
  r=P['tailRadius']*(1-i*.18)
  for j in range(4):
   # Local Y is approximately dorsal for the consistently aligned tail links.
   egg(f'tail armored ridge {i} {j}',(0,r*.8,-L/2+(j+.5)*L/4),(.10,.14,L*.13),'M',o,'tail')
