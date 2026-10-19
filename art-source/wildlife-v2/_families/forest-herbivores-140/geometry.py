"""Fresh herbivore anatomy and source face paint."""
rib=egg('compact rib cage',P['torso'],P['radii'],'B');chest=egg('chest',P['chest'],P['chestRadii'],'B');egg('back highlight',(0,-.10,P['torso'][2]+P['radii'][2]*.72),(P['radii'][0]*.82,P['radii'][1]*.85,.075),'H');egg('belly',(0,-.05,P['torso'][2]-.11),(P['radii'][0]*.80,P['radii'][1]*.8,.15),'C');haunch=egg('hind haunch',(0,P['hindHip'][1],P['hindHip'][2]+.06),(P['radii'][0]*.9,.28,P['radii'][2]*.85),'B')
egg('skull',(0,0,0),P['skull'],'B',head,'head');egg('blunt muzzle',(0,P['muzzleY'],-.06),P['muzzleRadii'],'H' if SPECIES in ['capybara','wombat','malayan-tapir'] else 'C',head,'head');egg('nose',(0,P['muzzleY']+P['muzzleRadii'][1]*.85,-.02),(.15,.07,.15) if SPECIES=='koala' else (.075,.06,.055),'N',head,'head');egg('lower jaw',(0,.07,-.01),(P['muzzleRadii'][0]*.8,P['muzzleRadii'][1]*.75,.055),'C',jaw,'jaw')
for side in [-1,1]:
 x=side*P['skull'][0]*.86
 egg(f'eye {side}',(x,.11,.075),(.04,.045,.04),'N',head,'head')
 egg(f'ear {side}',(side*P['earX'],-.06,P['earZ']),P['earRadii'],'B' if SPECIES!='koala' else 'H',head,'head');egg(f'ear interior {side}',(side*P['earX'],.005,P['earZ']),(P['earRadii'][0]*.62,.018,P['earRadii'][2]*.65),'C' if SPECIES in ['koala','malayan-tapir'] else 'M',head,'head')
 if SPECIES=='beaver':egg(f'incisor {side}',(side*.045,.36,-.12),(.035,.055,.09),'T',head,'head')
 if SPECIES=='capybara':egg(f'raised nostril {side}',(side*.11,P['muzzleY']+P['muzzleRadii'][1]*.75,.075),(.035,.045,.03),'M',head,'head')
 if SPECIES=='koala':egg(f'ear ruff {side}',(side*(P['earX']+.06),-.05,P['earZ']-.04),(.18,.12,.17),'C',head,'head')
if SPECIES=='malayan-tapir':
 for o in [rib,chest,haunch]:
  o['surfacePaint']=True;o.data.materials.append(mats['C'])
  for face in o.data.polygons:
   y=o.location.y+face.center.y;face.material_index=int(-.80<y<.45)
 egg('short proboscis',(0,.52,-.03),(.18,.28,.17),'B',head,'head')
