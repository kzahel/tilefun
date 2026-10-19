"""Distinct small ground hunter anatomy and source-painted coat marks."""
egg('compact rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B');egg('back highlight',(0,-.10,P['torso'][2]+P['radii'][2]*.72),(P['radii'][0]*.82,P['radii'][1]*.85,.075),'H');egg('belly',(0,-.05,P['torso'][2]-.11),(P['radii'][0]*.80,P['radii'][1]*.8,.15),'B');egg('hind haunch',(0,P['hindHip'][1],P['hindHip'][2]+.06),(P['radii'][0]*.9,.28,P['radii'][2]*.85),'B')
egg('skull',(0,0,0),P['skull'],'B',head,'head');egg('muzzle',(0,P['muzzleY'],-.06),P['muzzleRadii'],'C' if SPECIES=='white-nosed-coati' else 'H',head,'head');egg('nose',(0,P['muzzleY']+P['muzzleRadii'][1]*.85,-.02),(.055,.045,.045),'N',head,'head');egg('lower jaw',(0,.07,-.01),(P['muzzleRadii'][0]*.8,P['muzzleRadii'][1]*.75,.04),'C',jaw,'jaw')
for side in [-1,1]:
 x=side*P['skull'][0]*.86
 if SPECIES=='white-nosed-coati':egg(f'dark eye mask {side}',(side*P['skull'][0]*.93,.13,.05),(.04,.11,.085),'M',head,'head')
 egg(f'eye {side}',(x*1.04,.14,.065),(.035,.045,.035),'N',head,'head')
 egg(f'ear {side}',(side*P['earX'],-.06,P['earZ']),P['earRadii'],'B',head,'head');egg(f'ear interior {side}',(side*P['earX'],.005,P['earZ']),(P['earRadii'][0]*.62,.018,P['earRadii'][2]*.65),'C',head,'head')
 if SPECIES=='fossa':
  egg(f'cheek {side}',(side*.19,.15,-.08),(.08,.14,.08),'H',head,'head')
if SPECIES=='honey-badger':
 egg('silver back mantle',(0,-.08,P['torso'][2]+P['radii'][2]*.75),(P['radii'][0]*.94,P['radii'][1]*1.04,.16),'H');egg('silver head cap',(0,-.04,.20),(.25,.29,.10),'H',head,'head')
if SPECIES=='mongoose':
 for j in range(8):egg(f'coat fleck {j}',((j%2-.5)*.18,-.40+(j//2)*.22,P['torso'][2]+P['radii'][2]*.92),(.025,.06,.025),'H')
if SPECIES=='white-nosed-coati':egg('white snout blaze',(0,.21,.07),(.08,.24,.055),'C',head,'head')
