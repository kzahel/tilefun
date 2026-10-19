"""Distinct cetaceans, spotted whale shark and four-flipper sea turtle."""
cx,cy,cz=P['bodyCenter'];rx,ry,rz=P['bodyRadii'];turtle=SPECIES=='sea-turtle'
rib=egg('carapace' if turtle else 'fusiform rib cage',P['bodyCenter'],P['bodyRadii'],'B')
if not turtle:
 rib['surfacePaint']=True
 for key in ['W','H']:rib.data.materials.append(mats[key])
 for face in rib.data.polygons:
  face.material_index=1 if face.center.z<-.12 else 2 if face.center.z>rz*.50 else 0
  if SPECIES=='narwhal':
   q=[math.floor(v*73+1000.37) for v in face.center];pattern=(q[0]*73856093)^(q[1]*19349663)^(q[2]*83492791)
   if pattern%17<2 and face.center.z>-.20:face.material_index=2
 egg('back plane',(0,-.15,cz+rz*.68),(rx*.75,ry*.8,rz*.21),'H')
else:
 egg('pale plastron',(0,0,.60),(.53,.88,.15),'W')
 for row in range(3):
  for column in [-1,0,1]:
   y=(row-1)*.39;x=column*.29;z=cz+rz*math.sqrt(max(.1,1-(x/rx)**2-(y/ry)**2));r=.22 if column==0 else .18;vs=[(x+r*math.cos(j*math.tau/6),y+r*math.sin(j*math.tau/6),z-.04) for j in range(6)]+[(x+r*.9*math.cos(j*math.tau/6),y+r*.9*math.sin(j*math.tau/6),z+.025) for j in range(6)];fs=[tuple(reversed(range(6))),tuple(range(6,12))]+[(j,(j+1)%6,(j+1)%6+6,j+6) for j in range(6)];poly(f'closed shell scute {row} {column}',vs,fs,'H' if column==0 else 'G',body)
egg('skull',(0,.06,0),P['headRadii'],'B',head)
if SPECIES=='dolphin':
 egg('long rostrum',(0,.57,-.05),(.16,.43,.12),'B',head);egg('rostrum underside',(0,.54,-.12),(.14,.37,.04),'W',head)
elif SPECIES=='whale-shark':
 egg('broad flattened snout',(0,.45,-.06),(.77,.36,.22),'B',head);egg('wide filtering mouth',(0,.76,-.17),(.61,.045,.065),'M',head)
elif turtle:
 egg('neck',(0,-.21,-.02),(.15,.29,.15),'B',head);egg('small turtle beak',(0,.29,-.035),(.16,.14,.10),'G',head)
else:egg('rounded rostrum',(0,P['headRadii'][1]*.5,-.06),(P['headRadii'][0]*.88,P['headRadii'][1]*.70,P['headRadii'][2]*.65),'B',head)
egg('lower jaw',(0,P['headRadii'][1]*.45,-.035),(P['headRadii'][0]*.8,P['headRadii'][1]*.65,.09),'W',jaw)
egg('mouth lining',(0,P['headRadii'][1]*.55,.055),(P['headRadii'][0]*.65,P['headRadii'][1]*.40,.022),'M',jaw)
for side in [-1,1]:
 egg(f'eye {side}',(side*P['headRadii'][0]*.95,.24,.10),(.045,.06,.045),'E',head)
 if SPECIES=='whale-shark':
  for i in range(5):egg(f'gill slit {side} {i}',(side*rx*.97,.95-i*.12,cz),(.025,.035,.23),'M')
if SPECIES=='whale-shark':
 for i in range(8):
  y=-ry*.70+i*ry*.20;scale=math.sqrt(max(.1,1-(y/ry)**2))
  for j in range(8):
   a=.18+j*.39;egg(f'cream spot {i} {j}',(rx*scale*math.cos(a),y,cz+rz*scale*math.sin(a)),(.055,.07,.035),'W')
if SPECIES in ['humpback-whale','blue-whale']:
 for i in range(7):egg(f'ventral pleat {i}',((i-3)*.10,.75,cz-rz*.92),(.016,ry*.52,.024),'M')
if SPECIES=='humpback-whale':
 for i in range(9):
  a=i*math.tau/9;egg(f'head tubercle {i}',(P['headRadii'][0]*.85*math.cos(a),.34,P['headRadii'][2]*.85*math.sin(a)),(.065,.09,.065),'H',head)
if SPECIES=='narwhal':
 length=2.25;radius=.105;vs=[]
 for y,r in [(.44,radius),(.44+length,.004)]:
  for i in range(12):vs.append((r*math.cos(i*math.tau/12),y,-.04+r*math.sin(i*math.tau/12)))
 fs=[tuple(reversed(range(12))),tuple(range(12,24))]+[(i,(i+1)%12,(i+1)%12+12,i+12) for i in range(12)];poly('closed tapered tusk',vs,fs,'T',head)
 for i in range(21):
  a=i*.85;r=radius*(1-i/22);egg(f'tusk spiral ridge {i}',(r*math.cos(a),.48+i*.10,-.04+r*math.sin(a)),(.018,.055,.018),'G',head)
if not turtle and SPECIES!='narwhal':
 y=-ry*.48 if SPECIES in ['humpback-whale','blue-whale'] else -.15;h=.40 if SPECIES in ['humpback-whale','blue-whale'] else .85 if SPECIES=='dolphin' else 1.0;z=cz+rz*.65
 fin('dorsal fin',[(0,y+.30,z),(0,y-.40,z),(0,y-.54,z+.10),(0,y-.12,z+h),(0,y+.08,z+h*.65)],.08,'B',body)
fins=[]
for i,(side,x,y,z) in enumerate(P['finPivots']):
 pivot=node(f'FIN-{i}',body,(x,y,z));pivot['side']=side;fins.append(pivot);reach=P['finReach']*(.65 if turtle and i>=2 else 1)
 if turtle or SPECIES in ['humpback-whale','narwhal']:
  o=egg(f'rounded flipper {i}',(side*reach*.43,-reach*.22,-.05),(reach*.50,.20 if not turtle else .16,.07),'W' if SPECIES=='humpback-whale' else 'B',pivot);o.rotation_euler.z=-side*.35
 else:fin(f'pectoral flipper {i}',[(0,.12,.04),(side*reach,-reach*.7,-.16),(side*reach*.78,-reach*.95,-.19),(side*.18,-.32,-.08),(0,-.20,-.02)],.06,'B',pivot,axis='z')
