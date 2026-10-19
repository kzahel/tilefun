"""Original arachnid, insect, isopod and myriapod closed anatomy."""
z=P['torso'][2];L=P['radii'][1]
egg('compact rib cage',P['torso'],P['radii'],'B');egg('head capsule',(0,0,0),P['skull'],'B',head,'head')
for side in [-1,1]:
 egg(f'eye {side}',(side*.18,.15,.08),(.035,.055,.04),'N',head,'head')
 egg(f'mandible {side}',(side*.09,.18,.08),(.06,.13,.05),'M',jaw,'jaw')
if SPECIES=='spider':
 egg('large patterned abdomen',(0,-.55,z+.03),(.49,.65,.35),'H')
 for j in range(5):egg(f'abdomen chevron {j}',(0,-.92+j*.16,z+.35),(.27-j*.025,.055,.045),'M')
 for side in [-1,1]:
  for j in range(3):egg(f'simple eye {side} {j}',(side*(.05+.065*j),.20,.13),(.025,.035,.025),'N',head,'head')
elif SPECIES=='praying-mantis':
 egg('elongated pronotum',(0,.35,z+.04),(.17,.62,.17),'C')
 poly('triangular head',[(-.32,.10,-.08),(.32,.10,-.08),(0,.40,-.08),(-.32,.10,.13),(.32,.10,.13),(0,.40,.13)],[(2,1,0),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'C',head,'head')
 for side in [-1,1]:egg(f'large compound eye {side}',(side*.27,.12,.13),(.085,.08,.09),'H',head,'head')
 for side in [-1,1]:egg(f'folded wing cover {side}',(side*.14,-.32,z+.24),(.17,.65,.055),'B')
elif SPECIES=='leaf-insect':
 egg('broad leaf-shaped abdomen',(0,-.21,z+.03),(.58,.75,.12),'C')
 egg('leaf central vein',(0,-.20,z+.16),(.025,.68,.025),'H')
 for j in range(5):
  for side in [-1,1]:egg(f'leaf vein {side} {j}',(side*.22,-.67+j*.22,z+.15),(.24,.028,.024),'B')
elif SPECIES=='scorpion':
 for j in range(7):egg(f'dorsal armor plate {j}',(0,-.49+j*.16,z+.19),(.37,.13,.12),'H')
 for side in [-1,1]:
  egg(f'pedipalp arm {side}',(side*.55,.58,z),(.30,.09,.09),'H')
  egg(f'chela palm {side}',(side*.75,.86,z),(.19,.25,.13),'H')
  egg(f'fixed pincer {side}',(side*.85,1.08,z),(.065,.22,.075),'B')
  egg(f'moving pincer {side}',(side*.58,.88,.16),(.07,.22,.075),'H',jaw,'jaw')
elif SPECIES in ['roly-poly','centipede','millipede']:
 count=7 if SPECIES=='roly-poly' else 15 if SPECIES=='centipede' else 12
 for j in range(count):
  y=-L*.9+2*L*.9*j/(count-1)
  egg(f'closed dorsal segment {j}',(0,y,z+.07),(P['radii'][0]*1.08,L/count*1.5,.25),'H' if j%2==0 else 'B')
 if SPECIES=='roly-poly':
  for j in range(7):egg(f'segmental dorsal highlight {j}',(0,-.58+j*.19,z+.32),(.26,.027,.022),'C')
elif SPECIES=='earwig':
 for j in range(7):egg(f'abdomen segment {j}',(0,-.60+j*.13,z+.17),(.24,.09,.10),'H' if j%2 else 'M')
 for side in [-1,1]:egg(f'short elytron {side}',(side*.14,.12,z+.24),(.13,.24,.05),'M')
if SPECIES not in ['spider','scorpion']:
 for side in [-1,1]:
  short=SPECIES=='roly-poly';points=[Vector((side*.12,.15,.07)),Vector((side*(.22 if short else .27),.30 if short else .43,.11)),Vector((side*(.30 if short else .46),.46 if short else .75,.09))]
  for j,(a,b) in enumerate(zip(points,points[1:])):
   o=egg(f'closed outward antenna {side} {j}',(a+b)/2,(.018,.018,(b-a).length/2),'M',head,'head');o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')

def decorate_legs(legs):
 if SPECIES=='leaf-insect':
  for n,l in legs.items():egg(f'leaf leg lobe {n}',(0,0,0),(.12,.04,l['lengths'][0]*.35),'C',l['links'][0],'limb')
 if SPECIES=='praying-mantis':
  for n,l in legs.items():
   if l['end']!='fore':continue
   egg(f'raptorial femur {n}',(0,0,0),(.10,.08,l['lengths'][0]*.5),'C',l['links'][0],'limb')
   for j in range(5):egg(f'raptorial spine {n} {j}',(.09,0,-.16+j*.075),(.07,.02,.02),'H',l['links'][0],'limb')

def decorate_tail(parts,lengths):
 if SPECIES=='scorpion':
  egg('telson venom bulb',(0,0,lengths[-1]/2),(.13,.11,.15),'H',parts[-1],'tail')
  egg('curved pointed stinger',(0,.08,lengths[-1]/2+.15),(.04,.06,.16),'M',parts[-1],'tail')
 if SPECIES=='earwig':
  for side in [-1,1]:
   egg(f'forceps base {side}',(side*.18,0,lengths[-1]/2+.10),(.045,.045,.22),'M',parts[-1],'tail')
   egg(f'forceps curved tip {side}',(side*.12,0,lengths[-1]/2+.30),(.08,.04,.06),'M',parts[-1],'tail')
