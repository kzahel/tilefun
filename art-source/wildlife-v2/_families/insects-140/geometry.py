"""Six-legged bodies, closed wing panels, articulated covers, antennae and mandibles."""
z=P['bodyZ'];core=egg('thorax core',(0,0,z),P['coreRadii'],'B')
egg('thorax highlight',(0,.04,z+P['coreRadii'][2]*.6),(P['coreRadii'][0]*.8,P['coreRadii'][1]*.6,.055),'H')
if SPECIES!='dragonfly':
 abdomen=egg('abdomen',(0,-.24,z),P['abdomenRadii'],'B')
 if SPECIES=='bee':
  abdomen['surfacePaint']=True;abdomen.data.materials.append(mats['K'])
  for face in abdomen.data.polygons:face.material_index=int(math.floor((face.center.y+.6)*13)%3==0)
egg('head',(0,0,0),P['headRadii'],'K' if SPECIES in ['bee','ladybug','stag-beetle'] else 'B',head)
egg('lower mouth',(0,.09,-.035),(.07,.09,.035),'M',jaw)
for side in [-1,1]:
 egg(f'compound eye {side}',(side*P['headRadii'][0]*.9,.045,.025),(.06 if SPECIES=='dragonfly' else .035,.06,.045),'E',head)
 egg(f'eye glint {side}',(side*P['headRadii'][0]*1.02,.075,.045),(.018,.018,.018),'W',head)
wings=[];panels=[]
for side in [-1,1]:
 for i in range(P['wingPairs']):
  root_pos=(side*.06,.06-i*.20,z+.06);pivot=node(f'WING-{side}-{i}',body,root_pos);pivot['side']=side;pivot['pair']=i;L=P['wingLength']*(.72 if i else 1)
  outline=[(0,0,0),(side*L*.28,.14,0),(side*L,.15 if SPECIES!='dragonfly' else .08,0),(side*L*1.05,-.035,0),(side*L*.28,-.10,0)]
  panel=fin(f'closed flight panel {side} {i}',outline,.006,'W',pivot,axis='z');wings.append((pivot,L,root_pos));panels.append(panel)
  fin(f'wing vein {side} {i}',[(side*.08,-.008,.006),(side*L*.90,.04,.006),(side*.08,.008,.006)],.003,'G',pivot,axis='z')
covers=[]
if SPECIES in ['ladybug','stag-beetle']:
 for side in [-1,1]:
  pivot=node(f'ELYTRON-{side}',body,(side*.025,-.08,z+.035));pivot['side']=side;covers.append(pivot)
  shell=egg(f'rigid wing cover {side}',(side*.095,-.06,.045),(.155,.33,.16),'B',pivot)
  if SPECIES=='ladybug':
   for i,y in enumerate([-.24,-.06,.13]):egg(f'black spot {side} {i}',(side*.12,y,.18),(.045,.045,.03),'K',pivot)
 egg('closed cover seam',(0,-.13,z+.215),(.014,.29,.013),'K')
mandibles=[]
if SPECIES=='stag-beetle':
 for side in [-1,1]:
  pivot=node(f'MANDIBLE-{side}',head,(side*.075,.11,-.015));pivot['side']=side;mandibles.append(pivot)
  points=[(0,0,0),(side*.14,.23,0),(side*.12,.43,.025),(side*.025,.49,.02)]
  for i,(a,b) in enumerate(zip(points,points[1:])):
   a,b=Vector(a),Vector(b);v=b-a;q=v.to_track_quat('Z','Y');vs=[]
   for t,r in [(0,.04-i*.008),(1,.032-i*.008)]:
    for j in range(6):vs.append(tuple(a+v*t+q@Vector((r*math.cos(j*math.tau/6),r*math.sin(j*math.tau/6),0))))
   fs=[tuple(reversed(range(6))),tuple(range(6,12))]+[(j,(j+1)%6,(j+1)%6+6,j+6) for j in range(6)];poly(f'mandible branch {side} {i}',vs,fs,'K',pivot)
