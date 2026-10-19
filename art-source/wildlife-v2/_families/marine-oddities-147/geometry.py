"""Closed original marine body plans and independently attached appendages."""
def fin_leaf(n,parent,at,side,size=.25):
 pivot=node(n,parent,at);fins.append(pivot)
 poly(n+' closed blade',[(0,-.025,0),(side*size,-.025,size*.30),(side*size*.65,-.025,size),(0,-.025,size*.55),(0,.025,0),(side*size,.025,size*.30),(side*size*.65,.025,size),(0,.025,size*.55)],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'H',pivot,'body')
 return pivot
if SPECIES=='cuttlefish':
 egg('closed broad mantle',(0,-.25,0),(.48,1.0,.35),'B');egg('head',(0,0,0),(.32,.30,.25),'C',head,'head')
 for side in [-1,1]:
  egg(f'eye {side}',(side*.29,.05,.08),(.07,.08,.07),'N',head,'head')
  for j in range(8):
   y=-.95+j*.20;x=side*.45*math.sqrt(max(.1,1-(y+.25)**2));pivot=node(f'ribbon-pivot-{side}-{j}',body,(x,y,0));fins.append(pivot)
   poly(f'closed ribbon panel {side} {j}',[(0,-.14,-.025),(side*.24,-.14,-.025),(side*.24,.14,-.025),(0,.14,-.025),(0,-.14,.025),(side*.24,-.14,.025),(side*.24,.14,.025),(0,.14,.025)],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'H',pivot,'body')
 for i in range(8):
  a=math.tau*i/8;chain(f'ARM-{i}',head,(.22*math.cos(a),.16,.13*math.sin(a)),[.30,.29,.26],.065,'arm',a)
 for side in [-1,1]:
  parts=chain(f'FEEDING-TENTACLE-{side}',head,(side*.12,.20,-.03),[.42,.42,.42,.32],.045,'tentacle',side*.5)
  egg(f'feeding club {side}',(0,0,0),(.10,.08,.18),'C',parts[-1],'body')
 egg('small beak',(0,.15,0),(.065,.09,.06),'M',jaw,'jaw')
elif SPECIES=='seahorse':
 egg('ringed upright trunk',(0,0,0),(.20,.28,.60),'B');egg('rounded brood belly',(0,.13,-.22),(.22,.24,.30),'C');egg('arched neck',(0,.12,.43),(.13,.20,.33),'B');egg('horse-shaped head',(0,0,0),(.18,.30,.18),'B',head,'head');egg('tubular snout',(0,.43,-.035),(.08,.28,.08),'C',head,'head')
 for j in range(7):egg(f'trunk ridge {j}',(0,0,-.48+j*.15),(.21,.285,.025),'H')
 for side in [-1,1]:
  egg(f'eye {side}',(side*.16,.12,.08),(.04,.05,.04),'N',head,'head');fin_leaf(f'pectoral-{side}',head,(side*.15,-.10,-.04),side,.15)
 for j in range(5):egg(f'coronet point {j}',((j-2)*.055,-.10,.20),(.025,.035,.10),'H',head,'head')
 fin_leaf('small dorsal fan',body,(0,-.24,.15),1,.30);chain('TAIL',body,(0,-.11,-.43),[.14]*8,.08,'curl')
elif SPECIES=='leafy-seadragon':
 egg('narrow elongated trunk',(0,-.08,0),(.22,.75,.22),'B');egg('arched rising neck',(0,.48,.20),(.13,.19,.36),'B');egg('small horse-shaped head',(0,0,0),(.15,.24,.15),'B',head,'head');egg('long narrow tube snout',(0,.39,-.015),(.065,.29,.065),'C',head,'head')
 for side in [-1,1]:
  egg(f'eye {side}',(side*.135,.10,.065),(.035,.045,.035),'N',head,'head')
  for j,y in enumerate([-.56,-.18,.20,.48]):fin_leaf(f'body-leaf-{side}-{j}',body,(side*.16,y,.03),side,.32 if j<3 else .23)
 parts=chain('TAIL',body,(0,-.68,0),[.18]*8,.09,'tail')
 for i in [1,3,5]:
  for side in [-1,1]:fin_leaf(f'tail-leaf-{side}-{i}',parts[i],(side*.05,0,0),side,.24)
 for j in range(6):egg(f'body band {j}',(0,-.55+j*.18,.19),(.20,.025,.035),'H')
elif SPECIES=='nautilus':
 egg('closed chambered shell',(0,0,0),(.55,.60,.65),'C');egg('hood',(0,.42,-.18),(.30,.32,.23),'B');egg('soft head',(0,0,0),(.22,.22,.19),'B',head,'head')
 for side in [-1,1]:
  egg(f'large pinhole eye {side}',(side*.20,.06,.03),(.055,.065,.055),'N',head,'head')
  points=[]
  for j in range(45):
   a=j/44*math.tau*1.45;r=.05+.076*a;points.append((side*(.55*math.sqrt(1-r*r)+.008),.60*r*math.cos(a),.65*r*math.sin(a)))
  for j,(a,b) in enumerate(zip(points,points[1:])):rod(f'closed shell spiral {side} {j}',a,b,.024,'M',body,'body')
  for j in range(4):
   a=.50+j*1.30
   rod(f'outer shell band {side} {j}',(side*.31,.48*math.cos(a),.52*math.sin(a)),(side*.26,.53*math.cos(a),.58*math.sin(a)),.045,'H',body,'body')
 # Each small linked chain is a stylized bundle of the animal's many tentacles.
 for i in range(12):
  a=math.tau*i/12;chain(f'TENTACLE-BUNDLE-{i}',head,(.15*math.cos(a),.10,.12*math.sin(a)),[.12,.12,.11],.027,'arm',a)
else:
 egg('closed central disc',(0,0,0),(.25,.25,.13),'B')
 for i in range(5):
  a=math.tau*i/5;parts=chain(f'RADIAL-ARM-{i}',body,(.08*math.cos(a),.08*math.sin(a),0),[.18,.18,.17,.15],.18,'radial',a)
  for j,o in enumerate(parts):
   egg(f'dorsal granule {i} {j}',(0,.18*(1-.65*j/3),0),(.045,.03,.04),'C',o,'body')
