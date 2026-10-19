"""Upright macropod anatomy with tucked connected forearms."""
egg('body core',(0,0,P['bodyZ']),P['coreRadii'],'B');egg('large haunches',(0,-.10,.72),(.35,.34,.42),'B');egg('pale breast',(0,.15,P['bodyZ']+.08),P['breastRadii'],'C');egg('rufous neck',(0,.20,1.63),P['neckRadii'],'H');egg('skull',(0,0,0),P['headRadii'],'B',head);egg('long muzzle',(0,.27,-.06),(.14,.25,.12),'H',head);egg('dark nose',(0,.48,-.025),(.07,.045,.055),'N',head)
for side in [-1,1]:
 egg(f'eye {side}',(side*.18,.12,.055),(.035,.045,.04),'N',head);egg(f'pale cheek {side}',(side*.19,.19,-.06),(.035,.17,.07),'C',head);ear=egg(f'large ear {side}',(side*.16,-.07,.36),(.085,.07,.30),'B',head);ear.rotation_euler.y=side*.18;egg(f'ear interior {side}',(side*.17,-.015,.39),(.045,.025,.23),'R',head)
egg('lower jaw',(0,.13,0),(.13,.19,.05),'C',jaw)
forearms=[]
for side in [-1,1]:
 shoulder=node(f'fore shoulder {side}',body,(side*.22,.12,1.35));shoulder.rotation_euler.x=.65;egg(f'forearm bone upper {side}',(0,0,-.15),(.06,.06,.15),'B',shoulder);elbow=node(f'fore elbow {side}',shoulder,(0,0,-.30));elbow.rotation_euler.x=-.8;forearms.append(elbow);egg(f'forearm bone lower {side}',(0,0,-.11),(.045,.045,.11),'B',elbow);egg(f'small forepaw {side}',(0,.025,-.24),(.065,.06,.055),'M',elbow)
 for j in range(5):egg(f'finger {side} {j}',((j-2)*.023,.06,-.25),(.014,.065,.018),'N',elbow)
wings=[];covers=[];mandibles=[]
