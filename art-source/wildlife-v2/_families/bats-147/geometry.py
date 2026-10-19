"""Furred bat with long finger bones and closed scalloped membrane panels."""
egg('body core',(0,0,P['bodyZ']),P['coreRadii'],'B');egg('breast',(0,.10,P['bodyZ']-.02),P['breastRadii'],'C');egg('neck',(0,.18,.76),P['neckRadii'],'B');egg('skull',(0,0,0),P['headRadii'],'B',head)
for side in [-1,1]:
 egg(f'large ear {side}',(side*.15,-.035,.23),(.10,.075,.23),'B',head);egg(f'ear interior {side}',(side*.15,.025,.25),(.055,.025,.16),'R',head);egg(f'eye {side}',(side*.15,.13,.045),(.035,.035,.035),'N',head);egg(f'muzzle lobe {side}',(side*.065,.19,-.04),(.07,.07,.06),'H',head)
egg('nose',(0,.245,-.015),(.045,.035,.04),'N',head);egg('lower jaw',(0,.11,0),(.09,.10,.035),'C',jaw)
wings=[];covers=[];mandibles=[]
for side in [-1,1]:
 rest=Vector((side*.115,.02,P['bodyZ']+.08));shoulder=node(f'WING-{side}-shoulder',body,rest);shoulder['side']=side;shoulder['pair']=0;L=P['wingUpper'];wings.append((shoulder,L,rest))
 fin(f'closed membrane upper {side}',[(0,.035,0),(side*L,0,0),(side*L,-.22,0),(0,-.30,0)],.025,'M',shoulder,axis='z')
 arm=egg(f'upper wing arm {side}',(side*L/2,0,0),(L/2,.035,.035),'H',shoulder)
 rest=Vector((side*L,0,0));elbow=node(f'WING-{side}-elbow',shoulder,rest);elbow['side']=side;elbow['pair']=1;wings.append((elbow,P['wingLength'],rest));tips=[Vector((side*x,y,0)) for x,y in [(.9,.02),(.76,-.43),(.47,-.67),(.10,-.65)]]
 for j,tip in enumerate(tips):
  finger=egg(f'finger bone {side} {j}',tuple(tip/2),(.025,.025,tip.length/2),'H',elbow);finger.rotation_euler=tip.to_track_quat('Z','Y').to_euler()
 for j in range(3):
  mid=(tips[j]+tips[j+1])*.38
  fin(f'closed membrane {side} {j} a',[(0,0,0),tuple(tips[j]),tuple(mid)],.018,'M',elbow,axis='z')
  fin(f'closed membrane {side} {j} b',[(0,0,0),tuple(mid),tuple(tips[j+1])],.018,'M',elbow,axis='z')
