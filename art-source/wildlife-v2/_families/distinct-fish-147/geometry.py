"""Four distinct closed-volume fish anatomies and attached fin pivots."""
cx,cy,cz=P['bodyCenter'];rx,ry,rz=P['bodyRadii']
rib=egg('distinct fish body',P['bodyCenter'],P['bodyRadii'],'B');rib['surfacePaint']=True
for key in ['W','H']:rib.data.materials.append(mats[key])
for face in rib.data.polygons:face.material_index=1 if face.center.z<-rz*.24 else 2 if face.center.z>rz*.55 else 0
egg('skull',(0,0,0),P['headRadii'],'B',head)
hr=P['headRadii']
egg('lower jaw',(0,hr[1]*.35,-hr[2]*.42),(hr[0]*.82,hr[1]*.78,hr[2]*.25),'W',jaw)
egg('mouth lining',(0,hr[1]*.56,-.01),(hr[0]*.68,hr[1]*.64,.025),'M',jaw)
for side in [-1,1]:
 egg(f'eye {side}',(side*hr[0]*.89,hr[1]*.40,hr[2]*.22),(.07,.07,.07),'E',head)
 egg(f'eye pupil {side}',(side*hr[0]*.99,hr[1]*.43,hr[2]*.22),(.035,.045,.045),'K',head)
 egg(f'gill cover {side}',(side*rx*.94,ry*.42,cz),(.045,ry*.22,rz*.58),'H')

def cone(n,base,tip,radius,key,parent):
 axis=(Vector(tip)-Vector(base)).normalized();x=Vector((1,0,0))
 if abs(axis.dot(x))>.9:x=Vector((0,1,0))
 x=(x-axis*x.dot(axis)).normalized();y=axis.cross(x)
 vs=[tuple(Vector(base)+radius*(x*math.cos(i*math.tau/8)+y*math.sin(i*math.tau/8))) for i in range(8)]+[tip]
 return poly(n,vs,[tuple(reversed(range(8)))]+[(i,(i+1)%8,8) for i in range(8)],key,parent)

fins=[]
def pivot(n,loc,side,outline,thickness=.06,key='H',axis='x'):
 o=node(n,body,loc);o['side']=side;fins.append(o);P['finPivots'].append([side,*loc]);f=fin(n+' closed blade',outline,thickness,key,o,axis=axis);f['surfacePaint']=True

if SPECIES=='ocean-sunfish':
 egg('small pursed mouth',(0,.35,-.06),(.13,.10,.15),'W',head)
 pivot('dorsal paddle',(0,-.25,cz+rz*.78),1,[(0,.38,0),(0,.16,.92),(0,-.12,1.04),(0,-.34,.72),(0,-.40,0)])
 pivot('anal paddle',(0,-.26,cz-rz*.78),-1,[(0,.36,0),(0,.14,-.82),(0,-.11,-.90),(0,-.34,-.62),(0,-.40,0)])
 for side in [-1,1]:pivot(f'pectoral paddle {side}',(side*.30,.66,cz),side,[(0,.13,0),(side*.45,-.24,-.10),(side*.40,-.42,-.12),(0,-.12,0)],axis='z')
elif SPECIES=='swordfish':
 cone('long tapered sword bill',(0,.30,.02),(0,2.60,.02),.15,'H',head)
 fin('high curved dorsal',[(0,.7,cz+rz*.67),(0,.32,cz+1.33),(0,.05,cz+1.46),(0,-.18,cz+.72),(0,-1.05,cz+.47)],.07,'B',body)['surfacePaint']=True
 for side in [-1,1]:pivot(f'swept pectoral {side}',(side*.46,.64,cz-.19),side,[(0,.15,0),(side*.95,-.71,-.06),(side*.74,-.94,-.10),(0,-.23,0)],axis='z')
 fin('anal keel',[(0,-.45,cz-rz*.65),(0,-1.0,cz-.95),(0,-1.16,cz-.82),(0,-1.25,cz-rz*.5)],.05,'B',body)['surfacePaint']=True
elif SPECIES=='pufferfish':
 egg('small beak',(0,.34,-.09),(.13,.12,.11),'W',head)
 for i in range(7):
  a=math.pi*(i+.5)/7
  for j in range(8):
   b=j*math.tau/8;n=Vector((math.sin(a)*math.cos(b),math.cos(a),math.sin(a)*math.sin(b)))
   base=Vector((rx*n.x,ry*n.y,cz+rz*n.z));tip=base+n*.18
   cone(f'closed puffer spine {i} {j}',tuple(base),tuple(tip),.035,'W',body)
 for side in [-1,1]:pivot(f'round pectoral {side}',(side*.60,.27,cz),side,[(0,.13,0),(side*.37,.12,-.05),(side*.44,-.10,-.05),(side*.30,-.32,-.02),(0,-.15,0)],axis='z')
 pivot('small dorsal',(0,-.52,cz+.49),1,[(0,.16,0),(0,.10,.27),(0,-.15,.30),(0,-.22,0)])
else:
 for i in range(9):
  a=i*math.pi/8
  x=math.cos(a)*hr[0]*.80;y=math.sin(a)*hr[1]*.77
  cone(f'lower fang {i}',(x,y,-.005),(x*.90,y*.92,.18),.026,'T',jaw)
 for i,(y,z) in enumerate([(.05,.55),(.16,.85),(.36,1.10),(.62,1.19),(.83,1.07),(.91,.88)]):
  egg(f'lure stalk {i}',(0,y,z+.30),(.05,.13,.17),'H',head)
 egg('pale lure bulb',(0,.98,1.08),(.16,.16,.18),'T',head)
 for side in [-1,1]:pivot(f'broad pectoral {side}',(side*.61,-.02,cz-.20),side,[(0,.17,0),(side*.54,-.05,-.12),(side*.53,-.39,-.15),(side*.15,-.47,-.02),(0,-.14,0)],axis='z')
 pivot('soft dorsal',(0,-.40,cz+.47),1,[(0,.35,0),(0,.12,.38),(0,-.38,.35),(0,-.55,0)])
