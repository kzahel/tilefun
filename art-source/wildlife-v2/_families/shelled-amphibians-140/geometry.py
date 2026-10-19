"""Fresh closed shell, gill, frill and smooth-skinned animal anatomy."""
egg('compact rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B');egg('belly',(0,-.05,.30),(P['radii'][0]*.9,.55,.14),'C')
egg('skull',(0,0,0),P['skull'],'B',head,'head');egg('muzzle',(0,.16,-.025),P['muzzleRadii'],'B',head,'head');egg('lower jaw',(0,.12,-.08),(.18,.22,.04),'C',jaw,'jaw')
for side in [-1,1]:
 egg(f'raised eye {side}',(side*(.31 if SPECIES=='axolotl' else .21),.08,.09),(.065,.07,.06),'H',head,'head');egg(f'pupil {side}',(side*(.35 if SPECIES=='axolotl' else .25),.115,.10),(.03,.035,.035),'N',head,'head')
def cone(n,base,tip,r,key,parent=body,group='body'):
 base=Vector(base);tip=Vector(tip);q=(tip-base).to_track_quat('Z','Y');vs=[tuple(base+q@Vector((r*math.cos(i*math.tau/6),r*math.sin(i*math.tau/6),0))) for i in range(6)]+[tuple(tip)];fs=[tuple(reversed(range(6)))]+[(i,(i+1)%6,6) for i in range(6)];return poly(n,vs,fs,key,parent,group)
if SPECIES in ['land-tortoise','pond-turtle']:
 egg('domed shell',(0,-.08,.46),(.47,.64,.32),'M');egg('plastron',(0,-.08,.29),(.42,.57,.10),'C')
 for j,(x,y) in enumerate([(0,y) for y in [-.48,-.22,.04,.30]]+[(side*.23,y) for side in [-1,1] for y in [-.42,-.16,.10,.36]]):
  z=.46+.32*math.sqrt(max(0,1-(x/.49)**2-((y+.08)/.67)**2));vs=[(x+.13*math.cos(k*math.tau/6),y+.15*math.sin(k*math.tau/6),z+h) for h in [-.015,.035] for k in range(6)];fs=[tuple(reversed(range(6))),tuple(range(6,12))]+[(k,(k+1)%6,(k+1)%6+6,k+6) for k in range(6)];o=poly(f'shell scute {j}',vs,fs,'M',body,'body');o['surfacePaint']=True;o.data.materials.append(mats['H' if SPECIES=='land-tortoise' else 'B']);o.data.polygons[1].material_index=1
 if SPECIES=='pond-turtle':
  for side in [-1,1]:egg(f'head stripe {side}',(side*.23,.07,-.005),(.025,.18,.035),'H',head,'head')
if SPECIES=='salamander':
 for j in range(14):
  x=(-1 if j%2 else 1)*(.12 if j%3 else .20);y=-.50+(j//2)*.16;z=.42+.23*math.sqrt(max(0,1-(x/.32)**2-((y+.05)/.68)**2));egg(f'yellow skin spot {j}',(x,y,z),(.055,.07,.025),'H')
if SPECIES=='newt':
 for j in range(9):
  y=-.50+j*.13;cone(f'dorsal crest {j}',(0,y,.61),(0,y-.03,.74),.045,'H')
 for side in [-1,1]:
  for j in range(6):egg(f'flank spot {side} {j}',(side*.29,-.45+j*.17,.44),(.03,.035,.04),'M')
if SPECIES=='axolotl':
 for side in [-1,1]:
  for j in range(3):
   base=Vector((side*.17,-.13+j*.10,.045));tip=base+Vector((side*(.50+j*.035),-.10,.12+j*.05));cone(f'gill branch {side} {j}',base,tip,.055,'M',head,'head')
   for k in range(3):
    a=base.lerp(tip,.30+k*.22);cone(f'gill branch fringe {side} {j} {k}',a,a+Vector((side*.11,.06,.08)),.028,'M',head,'head')
if SPECIES=='frilled-neck-lizard':
 for j in range(12):
  a=j*math.tau/12;b=(j+1)*math.tau/12;inner=.19;outer=.63;vs=[]
  for y in [-.12,-.10]:
   for r,k in [(inner,a),(outer,a),(outer,b),(inner,b)]:vs.append((r*math.cos(k),y,r*math.sin(k)*.62))
  fs=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)];poly(f'frill panel {j}',vs,fs,'H' if j%2 else 'M',head,'head')
