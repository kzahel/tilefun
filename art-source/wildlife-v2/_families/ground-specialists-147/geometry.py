"""Distinct specialist mammal volumes and closed armor geometry."""
rib=egg('compact rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B')
egg('back plane',(0,P['torso'][1],P['torso'][2]+P['radii'][2]*.70),(P['radii'][0]*.78,P['radii'][1]*.88,.12),'H')
egg('belly',(0,-.03,P['torso'][2]-.13),(P['radii'][0]*.74,P['radii'][1]*.76,.25),'C')
egg('haunch',(0,P['hindHip'][1],P['hindHip'][2]+.10),(P['radii'][0]*.88,.31,P['radii'][2]*.9),'B')
egg('neck',(0,P['head'][1]-.24,P['head'][2]),(.24,.35,.30),'B')
egg('skull',(0,0,0),P['skull'],'B',head,'head')
for side in [-1,1]:
 egg(f'eye {side}',(side*P['skull'][0]*.89,.16,.07),(.035,.04,.035),'N',head,'head')
 if SPECIES!='aardvark':
  egg(f'ear {side}',(side*P['earX'],-.08,P['earZ']),P['earRadii'],'H',head,'head')
  egg(f'ear center {side}',(side*P['earX'],-.03,P['earZ']),(.05,.025,.07),'M',head,'head')
if SPECIES=='meerkat':
 for side in [-1,1]:
  egg(f'dark eye patch {side}',(side*.19,.14,.055),(.07,.15,.08),'M',head,'head')
  egg(f'eye glint {side}',(side*.225,.20,.07),(.025,.035,.025),'N',head,'head')
 egg('pointed face',(0,.25,-.04),(.12,.22,.11),'C',head,'head');egg('black nose',(0,.44,-.025),(.06,.05,.05),'N',head,'head')
 for j in range(5):egg(f'back bar {j}',(0,-.48+j*.20,1.43),(.23,.035,.045),'M')
elif SPECIES=='giant-anteater':
 egg('long tubular muzzle',(0,.78,-.12),(.10,.68,.12),'H',head,'head');egg('small nose',(0,1.4,-.10),(.075,.045,.065),'N',head,'head')
 egg('long thin jaw',(0,.62,0),(.065,.60,.045),'C',jaw,'jaw')
 rib['surfacePaint']=True;rib.data.materials.append(mats['M'])
 for f in rib.data.polygons:
  pt=f.center+rib.location;f.material_index=int(abs(pt.z-(.6*pt.y+1.3))<.18 and abs(pt.x)>.15)
 for side in [-1,1]:
  egg(f'cream shoulder patch {side}',(side*.40,.50,1.10),(.14,.18,.23),'C')
  mark=egg(f'dark shoulder slash {side}',(side*.51,.25,1.42),(.045,.62,.15),'M');mark.rotation_euler.x=.65
  edge=egg(f'pale slash edge {side}',(side*.515,.29,1.25),(.045,.55,.065),'C');edge.rotation_euler.x=.65
elif SPECIES=='aardvark':
 egg('elongated pig snout',(0,.50,-.07),(.20,.39,.18),'H',head,'head');egg('wide nose',(0,.83,-.055),(.15,.06,.11),'M',head,'head')
 for side in [-1,1]:
  egg(f'tall ear {side}',(side*.24,-.10,.65),(.11,.09,.45),'H',head,'head');egg(f'tall ear interior {side}',(side*.24,-.02,.67),(.065,.025,.34),'M',head,'head')
  egg(f'nostril {side}',(side*.06,.89,-.02),(.025,.02,.03),'N',head,'head')
elif SPECIES=='armadillo':
 egg('tapered snout',(0,.37,-.065),(.16,.33,.12),'H',head,'head');egg('nose',(0,.66,-.04),(.07,.05,.065),'N',head,'head')
 for row in range(8):
  y=-.65+row*.16;factor=math.sqrt(max(.20,1-((y-P['torso'][1])/P['radii'][1])**2));vs=[]
  for yy in [y-.065,y+.065]:
   for i in range(13):
    a=i*math.pi/12;vs.append((P['radii'][0]*factor*1.08*math.cos(a),yy,P['torso'][2]+P['radii'][2]*factor*1.14*math.sin(a)))
  N=13;fs=[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
  poly(f'armor band {row}',vs,fs,'H' if row%2==0 else 'M',body,'body')
 egg('armored brow',(0,-.03,.16),(.25,.34,.16),'H',head,'head')
else:
 egg('pointed narrow face',(0,.35,-.06),(.13,.32,.12),'H',head,'head');egg('nose',(0,.64,-.04),(.055,.04,.05),'N',head,'head')
 for row in range(7):
  y=-.70+row*.21
  for col in range(7):
   a=.12+col*(math.pi-.24)/6;factor=math.sqrt(max(.16,1-((y-P['torso'][1])/P['radii'][1])**2));normal=Vector((math.cos(a),0,math.sin(a)));side=Vector((-math.sin(a),0,math.cos(a)));centre=Vector((P['radii'][0]*factor*math.cos(a),y,P['torso'][2]+P['radii'][2]*factor*math.sin(a)))+normal*.035;vs=[]
   for h in [-.035,.035]:
    for x,yy in [(0,.16),(.15,0),(0,-.24),(-.15,0)]:vs.append(tuple(centre+side*x+Vector((0,yy,0))+normal*h))
   poly(f'scale {row} {col}',vs,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'H' if (row+col)%3 else 'M',body,'body')

def decorate_tail(parts,lengths):
 if SPECIES!='pangolin':return
 for i,(part,L) in enumerate(zip(parts,lengths)):
  r=P['tailRadius']*(1-i*.18)
  for j in range(3):
   z=-L/2+(j+.5)*L/3
   egg(f'tail scale {i} {j}',(0,r*.70,z),(r*1.04,r*.60,L*.22),'H' if j%2 else 'M',part,'tail')
