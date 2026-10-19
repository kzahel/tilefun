"""Fresh closed reptilian anatomy, independent of mammal family geometry."""
egg('compact rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B');egg('belly',(0,-.05,.30),(P['radii'][0]*.9,.60,.14),'C')
egg('skull',(0,0,0),P['skull'],'B',head,'head');egg('broad muzzle',(0,.19,-.025),P['muzzleRadii'],'H',head,'head');egg('lower jaw',(0,.12,-.09),(.18,.28,.045),'C',jaw,'jaw')
for side in [-1,1]:
 if SPECIES=='chameleon':
  egg(f'independent turret eye {side}',(side*.22,.015,.10),(.13,.14,.13),'H',head,'head');egg(f'eye pupil {side}',(side*.31,.065,.12),(.045,.045,.05),'N',head,'head')
 else:
  egg(f'eye rim {side}',(side*.205,.06,.10),(.06,.075,.06),'E',head,'head');egg(f'eye slit {side}',(side*.25,.08,.11),(.025,.025,.05),'N',head,'head')
 egg(f'nostril {side}',(side*.10,.355,.025),(.025,.025,.02),'N',head,'head')
# Closed tapered cones, with actual manifold side faces and base.
def cone(n,base,tip,r,key,parent=body,group='body'):
 base=Vector(base);tip=Vector(tip);q=(tip-base).to_track_quat('Z','Y');vs=[tuple(base+q@Vector((r*math.cos(i*math.tau/6),r*math.sin(i*math.tau/6),0))) for i in range(6)]+[tuple(tip)];fs=[tuple(reversed(range(6)))]+[(i,(i+1)%6,6) for i in range(6)];return poly(n,vs,fs,key,parent,group)
if SPECIES=='gecko':
 for j in range(18):
  y=-.52+(j//3)*.19;x=(j%3-1)*.15;z=P['torso'][2]+P['radii'][2]*math.sqrt(max(0,1-(x/P['radii'][0])**2-((y+.05)/.7)**2))
  egg(f'dorsal spot {j}',(x,y,z),(.045,.055,.025),'M')
if SPECIES=='iguana':
 for j in range(12):
  y=-.55+j*.12;cone(f'dorsal crest {j}',(0,y,.60),(0,y-.03,.79+.07*math.sin(j*math.pi/11)),.055,'H')
 egg('dewlap',(0,.12,-.23),(.045,.24,.18),'C',head,'head')
 for side in [-1,1]:egg(f'cheek scale {side}',(side*.22,-.04,-.02),(.045,.10,.08),'H',head,'head')
if SPECIES=='chameleon':
 cone('head casque',(0,-.12,.10),(0,-.10,.43),.16,'H',head,'head')
 for side in [-1,1]:
  for j in range(6):egg(f'flank bar {side} {j}',(side*.285,-.50+j*.19,.43),(.035,.045,.13),'M')
if SPECIES=='texas-horned-lizard':
 for side in [-1,1]:
  for j in range(3):cone(f'head horn {side} {j}',(side*(.13+j*.04),-.16+j*.035,.08),(side*(.23+j*.08),-.29+j*.035,.20),.055,'C',head,'head')
  for j in range(8):
   y=-.54+j*.15;cone(f'flank spine {side} {j}',(side*.33,y,.42),(side*.47,y-.04,.47),.04,'H')
 for j in range(16):
  x=(j%4-1.5)*.15;y=-.45+(j//4)*.27;cone(f'back spike {j}',(x,y,.57),(x,y,.69),.045,'M')
