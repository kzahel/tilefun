"""Distinct viper, gastropod, annelid and eel meshes; no shared source animal."""
stalks=[]
if SPECIES=='gaboon-viper':
 poly('broad leaf-shaped triangular skull',[(-.28,-.12,-.10),(.28,-.12,-.10),(.14,.32,-.10),(-.14,.32,-.10),(-.28,-.12,.10),(.28,-.12,.10),(.14,.32,.10),(-.14,.32,.10)],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'C',head,'head')
 for side in [-1,1]:
  egg(f'eye {side}',(side*.235,.03,.11),(.04,.045,.035),'H',head,'head');egg(f'vertical pupil {side}',(side*.255,.05,.13),(.012,.025,.018),'N',head,'head');egg(f'nasal horn {side}',(side*.07,.29,.14),(.035,.045,.07),'H',head,'head')
 egg('broad lower jaw',(0,.08,0),(.23,.23,.045),'M',jaw,'jaw')
 for side in [-1,1]:rod(f'folded fang {side}',(side*.13,.13,-.01),(side*.13,.25,-.08),.02,'T',jaw,'jaw')
 for i,o in enumerate(parts):
  r=radii[i];L=Ls[i]
  poly(f'closed dorsal diamond {i}',[(-r*.75,r*.8,-L*.20),(0,r*.92,-L*.46),(r*.75,r*.8,-L*.20),(0,r*.92,L*.46),(-r*.75,r*.83,-L*.20),(0,r*.95,-L*.46),(r*.75,r*.83,-L*.20),(0,r*.95,L*.46)],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'M' if i%2 else 'C',o,'body')
elif SPECIES=='snail':
 egg('soft head',(0,.03,.01),(.15,.21,.12),'C',head,'head');egg('closed rounded shell',(0,-.40,.46),(.36,.40,.43),'H',body,'body')
 # Raised closed spiral ridge on both shell sides.
 for side in [-1,1]:
  ps=[]
  for i in range(49):
   a=i/48*math.tau*1.65;r=.025+.027*a;ps.append((side*.348,-.40+math.cos(a)*r,.46+math.sin(a)*r))
  for i in range(48):rod(f'shell spiral {side} {i}',ps[i],ps[i+1],.018,'M',body,'body')
 for i,(side,L,z) in enumerate([(-1,.34,.06),(1,.34,.06),(-1,.18,-.015),(1,.18,-.015)]):
  pivot=node(f'eyestalk-pivot-{i}',head,(side*.10,.14,z));stalks.append(pivot);rod(f'closed tentacle {i}',(0,0,0),(side*.08,L,.14 if i<2 else 0),.022,'C',pivot,'head')
  if i<2:egg(f'tentacle eye {i}',(side*.08,L,.14),(.038,.038,.038),'N',pivot,'head')
elif SPECIES=='worm':
 egg('rounded anterior',(0,.03,0),(.12,.16,.11),'B',head,'head')
 for i,o in enumerate(parts):
  egg(f'closed annular ridge {i}',(0,0,0),(radii[i]*1.10,radii[i]*1.10,.018),'C' if 4<=i<=6 else 'M',o,'body')
else:
 egg('elongated eel skull',(0,.06,0),(.18,.35,.14),'B',head,'head');egg('lower jaw',(0,.13,0),(.14,.27,.045),'C',jaw,'jaw')
 for side in [-1,1]:
  egg(f'eye {side}',(side*.165,.17,.075),(.032,.045,.03),'N',head,'head')
  if SPECIES=='moray-eel':
   for i in range(4):rod(f'closed tooth {side} {i}',(side*.10,.10+i*.06,.01),(side*.10,.10+i*.06,.08),.016,'T',jaw,'jaw')
 for i,o in enumerate(parts):
  r=radii[i]
  if SPECIES=='moray-eel':
   for j in range(3):egg(f'mottled spot {i} {j}',((j-1)*r*.50,r*.85,.02*(j-1)),(.035,.035,.04),'M',o,'body')
  else:egg(f'pale belly stripe {i}',(0,-r*.90,0),(r*.75,.025,Ls[i]*.50),'C',o,'body')
  if 2<i<len(parts)-3:egg(f'continuous dorsal fin {i}',(0,r*1.03,0),(.025,.07,Ls[i]*.55),'H',o,'body')
