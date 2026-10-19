"""Original crab, horseshoe crab, lobster and shrimp anatomy."""
z=P['torso'][2];L=P['radii'][1]
egg('compact rib cage',P['torso'],P['radii'],'B');egg('head capsule',(0,0,0),P['skull'],'B',head,'head')
def fixed_rod(n,a,b,r,key,parent=body,group='body'):
 a,b=Vector(a),Vector(b);o=egg(n,(a+b)/2,(r,r,(b-a).length/2),key,parent,group);o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');return o
if SPECIES=='coconut-crab':
 egg('broad closed carapace',(0,0,z+.10),(.68,.75,.36),'B');egg('folded soft abdomen',(0,-.61,z-.05),(.42,.35,.28),'C')
 for side in [-1,1]:
  for j in range(4):egg(f'carapace ridge {side} {j}',(side*.28,-.35+j*.20,z+.43),(.20,.035,.025),'H')
elif SPECIES=='horseshoe-crab':
 egg('closed horseshoe shield',(0,.10,z+.06),(.74,.78,.24),'B');egg('posterior plate',(0,-.54,z+.02),(.48,.39,.17),'H')
 for side in [-1,1]:
  egg(f'lateral compound eye {side}',(side*.48,.29,z+.25),(.05,.06,.035),'N')
  for j in range(4):fixed_rod(f'closed abdominal spine {side} {j}',(side*.38,-.37-j*.13,z+.01),(side*(.57-j*.025),-.43-j*.13,z+.01),.027,'H')
  egg(f'chelicera {side}',(side*.06,.36,z-.12),(.035,.13,.035),'M')
else:
 for j in range(5 if SPECIES=='lobster' else 7):
  y=-.48+j*.14;egg(f'closed shell band {j}',(0,y,z+.09),(P['radii'][0]*1.05,.11,.23),'B' if j%2 else 'H')
 if SPECIES=='shrimp':
  # Narrow pointed rostrum and two compound stalked eyes.
  fixed_rod('long rostrum',(0,.05,.11),(0,.62,.14),.035,'C',head,'head')
 if SPECIES=='mantis-shrimp':
  egg('orange thoracic saddle',(0,.34,z+.13),(.29,.24,.16),'H')
  for side in [-1,1]:
   for j in range(3):egg(f'maxilliped {side} {j}',(side*.16,.43+j*.07,z-.09),(.035,.11,.035),'C')
if SPECIES!='horseshoe-crab':
 for side in [-1,1]:
  fixed_rod(f'eye stalk {side}',(side*.14,.15,.10),(side*.21,.18,.26),.025,'C',head,'head');egg(f'compound eye {side}',(side*.21,.18,.27),(.06,.07,.055),'N' if SPECIES!='mantis-shrimp' else 'M',head,'head')
  points=[Vector((side*.10,.18,.10)),Vector((side*.27,.48,.16)),Vector((side*.48,.88,.15))]
  for j,(a,b) in enumerate(zip(points,points[1:])):fixed_rod(f'closed antenna {side} {j}',a,b,.018,'M',head,'head')
  egg(f'mouth appendage {side}',(side*.06,.15,.06),(.04,.12,.035),'M',jaw,'jaw')

def decorate_legs(legs):pass

def decorate_tail(parts,lengths):
 if SPECIES in ['lobster','shrimp','mantis-shrimp']:
  for i,o in enumerate(parts):egg(f'segmented abdominal plate {i}',(0,0,0),(.18-i*.018,.16-i*.015,lengths[i]*.55),'H' if i%2 else 'B',o,'tail')
  for side in [-1,1]:
   egg(f'closed tail fan {side}',(side*.20,0,lengths[-1]/2+.10),(.25,.045,.20),'M' if SPECIES=='mantis-shrimp' else 'C',parts[-1],'tail')
  egg('middle telson',(0,0,lengths[-1]/2+.15),(.12,.04,.22),'H',parts[-1],'tail')

def decorate_feeding_arm(side,parent,L,finger_pivots):
 big=1.35 if SPECIES=='coconut-crab' and side==-1 else 1
 if P['armKind']=='club':
  egg(f'closed striking club {side}',(0,0,L/2+.12),(.14,.14,.21),'H',parent,'limb');egg(f'club highlight {side}',(0,.13,L/2+.14),(.10,.025,.14),'C',parent,'limb')
 else:
  egg(f'chela palm {side}',(0,0,L/2+.09),(.14*big,.12*big,.17*big),'H',parent,'limb')
  fixed_rod(f'fixed pincer {side}',(-.10*big,0,L/2+.14),(-.08*big,0,L/2+.40*big),.055*big,'B',parent,'limb')
  pivot=node(f'movable-finger-{side}',parent,(.10*big,0,L/2+.13));finger_pivots.append((side,pivot));fixed_rod(f'movable pincer {side}',(0,0,0),(-.04*big,0,.25*big),.05*big,'C',pivot,'limb')
