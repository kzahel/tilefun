"""Closed barrel bodies, downturned herbivorous muzzles and rounded paired flippers."""
cx,cy,cz=P['bodyCenter'];rx,ry,rz=P['bodyRadii'];rib=egg('barrel rib cage',P['bodyCenter'],P['bodyRadii'],'B');rib['surfacePaint']=True
for k in ['W','H']:rib.data.materials.append(mats[k])
for face in rib.data.polygons:face.material_index=1 if face.center.z<-.20 else 2 if face.center.z>rz*.55 else 0
egg('thick neck',(0,.95,1.15),(.53,.60,.50),'B');egg('rounded skull',(0,0,0),P['headRadii'],'B',head)
for side in [-1,1]:
 egg(f'small eye {side}',(side*P['headRadii'][0]*.96,.19,.07),(.045,.055,.045),'E',head)
 egg(f'nostril {side}',(side*.11,.37,.23),(.045,.065,.025),'M',head)
 if SPECIES=='manatee':egg(f'parted upper lip {side}',(side*.17,.44,-.13),(.22,.25,.20),'H',head)
 else:egg(f'downturned snout lobe {side}',(side*.13,.40,-.19),(.16,.25,.22),'H',head)
egg('soft lower lip',(0,.30,-.07),(.27,.25,.12),'W',jaw)
if SPECIES=='dugong':
 for side in [-1,1]:egg(f'small tusk {side}',(side*.20,.44,-.28),(.035,.05,.13),'T',head)
fins=[]
for i,(side,x,y,z) in enumerate(P['finPivots']):
 pivot=node(f'FIN-{i}',body,(x,y,z));pivot['side']=side;fins.append(pivot);o=egg(f'rounded flipper {i}',(side*.29,-.16,-.09),(.36,.19,.08),'B',pivot);o.rotation_euler.z=-side*.4
 if SPECIES=='manatee':
  for j in range(3):egg(f'flipper nail {i} {j}',(side*(.47+j*.045),-.26-j*.025,-.08),(.035,.045,.025),'W',pivot)
