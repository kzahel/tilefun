#!/usr/bin/env python3
"""Broad street hardware first pass: exact indexed crops or byte-identical originals.
No all-origin/absence search, atlas packing, edited artwork or runtime metadata.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import shutil

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PACKET = ROOT/'docs/tactical/053-semantic-tileset-map/packets/B03-street-hardware.json'
DIRECTORY = ROOT/'assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Singles_16x16'
MASTER = 'public/assets/tilesets/me-complete.png'
INDEX = 'public/data/me-atlas-index.json'
COPIES = 'public/assets/semantic-sources/broad/street-hardware'
PREFIX = 'ME_Singles_City_Props_16x16_'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalized(im):
    im = im.convert('RGBA')
    im.paste((0,0,0,0), mask=im.getchannel('A').point(lambda a:255 if a==0 else 0))
    return im.tobytes()


def natural(value):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', value)]


def representative_checks(capture_dir=None):
    """Challenge an obvious head overlay without granting a general join rule."""
    def original(name):
        return Image.open(DIRECTORY/(PREFIX+name+'.png')).convert('RGBA')
    base=original('Traffic_Lights_Off_Frontal_2')
    results=[]
    for color,number,expected_changes,expected_hash in [
        ('Green',2,7,'edbf4e40c735b5894b0d188b8beacb6dbe5c1539e297f8ed9d5996db5fa0e896'),
        ('Yellow',3,5,'2fcd28ab5d1fc6b3cefc2fe0f4ab366c40cc3e0984bbd272d24d1521005e0f86'),
        ('Red',4,7,'9bfe60d77f3494046bc603402d9d7663d34fdc21802e48ca97e48d972970e43b')]:
        out=base.copy();out.alpha_composite(original('Traffic_Lights_'+color+'_Mod_2'),(0,0))
        a,b=normalized(out),normalized(original('Traffic_Light_'+str(number)))
        changes=sum(a[i:i+4]!=b[i:i+4] for i in range(0,len(a),4))
        assert changes==expected_changes and sha(a)==expected_hash, 'Representative overlay evidence drift'
        results.append({'color':color,'offsetXY':[0,0],'operation':'native RGBA source-over','changedPixelsFromWholeExport':changes,'outputPixelSha256':sha(a),'disposition':'not exact counterpart reconstruction; no compatibility rule granted'})
        if capture_dir:
            capture_dir.mkdir(parents=True,exist_ok=True)
            out.save(capture_dir/('upright-overlay-'+color.lower()+'-native.png'))
    return results


def specification():
    """Visual card grouping; selectors preserve all original forms and designs."""
    cards = []
    def add(group, label, names, labels=None, kind='whole', use=None, uncertainty=None):
        if isinstance(names,str): names=[names]
        if labels is None:labels=['Original'] if len(names)==1 else ['Appearance '+str(i+1) for i in range(len(names))]
        assert len(names)==len(labels)
        cards.append(dict(group=group,label=label,names=names,labels=labels,kind=kind,use=use,uncertainty=uncertainty))
    def seq(prefix,indices):return [prefix+str(n) for n in indices]
    complete='Complete visual object; game collision, height and behavior are unknown.'
    signal='Original displayed lamp colors; no automatic signal cycle or traffic behavior is inferred.'
    head='Needs a suitable signal pole or support; attachment offsets and cross-design fitting are untested.'
    plate='Needs a suitable post, bracket or supporting surface; exact attachment offsets are untested.'
    add('signals','Upright signal with crossing plate',seq('Traffic_Light_',range(1,5)),['Unlit','Green','Amber','Red'],use=signal)
    add('signals','Upright signal · rear', 'Traffic_Light_5')
    add('signals','Twin signals on side arm',seq('Traffic_Light_',range(6,16)),['Both unlit','Green / green','Green / amber','Green / red','Amber / green','Amber / amber','Amber / red','Red / green','Red / amber','Red / red'],use=signal)
    add('signals','Twin signal support · rear','Traffic_Light_16')
    for n,description in [(1,'Short'),(2,'Tall')]:
        add('signals',description+' plain signal pole',[f'Traffic_Lights_{f}_{n}' for f in ['Off_Frontal','Left','Right','Back']],['Unlit front','Left side','Right side','Rear'])
        add('signal-pieces',description+' upright signal head',[f'Traffic_Lights_{f}_Mod_{n}' for f in ['Green','Yellow','Red','Colours']],['Green','Amber','Red','All colors shown'],kind='component',use=head,uncertainty='The all-colors export is a graphic state, not an inferred operating cycle.')
    arm_names=['Traffic_Light_New_Front_left_1','Traffic_Light_New_Front_Right_1','Traffic_Light_New_Front_Diagonal_Left_Down_1','Traffic_Light_New_Front_Diagonal_Left_Up_1','Traffic_Light_New_Front_Diagonal_Right_Down_1','Traffic_Light_New_Front_Diagonal_Right_Up_1']
    add('supports','Ornamental signal support',arm_names,['Arm right','Arm left','Diagonal arm right · descending','Diagonal arm right · rising','Diagonal arm left · descending','Diagonal arm left · rising'],use='Closed pole and arm body; hanging signal heads and signs are separate pieces. Specific attachment offsets remain untested.')
    for facing,prefix in [('Left-facing horizontal','Front_Left'),('Right-facing horizontal','Front_Right'),('Left-facing diagonal · descending','Front_Diagonal_Left_Down'),('Left-facing diagonal · rising','Front_Diagonal_left_Up'),('Right-facing diagonal · descending','Front_Diagonal_Right_Down'),('Right-facing diagonal · rising','Front_Diagonal_Right_Up')]:
        names=['Traffic_Light_New_'+prefix+'_'+color for color in ['Green','Orange','Red']]
        if prefix=='Front_Diagonal_left_Up':names[1]=names[1][:-6]+'orange'
        add('signal-pieces',facing+' signal head',names,['Green','Amber','Red'],kind='component',use=head)
    for facing,prefix in [('Front','Front'),('Left angled','Front_Diagonal_Left'),('Right angled','Front_Diagonal_Right')]:
        add('signal-pieces',facing+' hanging arrow plate',seq('Traffic_Light_New_'+prefix+'_Sign_',range(1,9)),['Blue design 1','Blue design 2','Blue design 3','Blue design 4','Red design 1','Red design 2','Red design 3','Red design 4'],kind='component',use=plate,uncertainty='Tiny arrow directions vary within this original sign bank; these are sign designs, not legal or game instructions.')
    add('signal-pieces','Rear hanging plate','Traffic_Light_New_Back_Sign_1',kind='component',use=plate)
    add('signal-pieces','Rear hanging bracket',['Traffic_Light_New_Back_Sign_2','Traffic_Light_New_Back_Sign_3'],['Left arm','Right arm'],kind='component',use=plate)
    for n in [1,2]:add('signal-pieces','Rear angled '+('plate' if n==1 else 'bracket'),[f'Traffic_Light_New_Back_Diagonal_{side}_Sign_{n}' for side in ['Left','Right']],['Left angle','Right angle'],kind='component',use=plate)
    add('signals','Ornamental signal pole · fitted',seq('Traffic_Light_New_Example_',range(1,9)),['Horizontal · green / red plate','Horizontal · amber / blue plate','Diagonal · green / blue plate','Diagonal · amber / blue plate','Diagonal · red / red plate','Diagonal · red / blue plate','Diagonal · rear','Horizontal · rear'],use='Original complete fitted exports; no animation, arbitrary head interchange or runtime behavior established.')
    old_labels=['Narrowing-road warning','Road widening warning','Lane warning','No-entry symbol','Diagonal direction arrow','Left arrow','Bend warning · right','Bend warning · left','Traffic-light warning','Turn arrow · right','Turn arrow · left','Junction warning','Crossing-road warning','Exclamation warning','Red-ring sign','Diagonal arrow · up-left','Right arrow','Crossing pictogram','Parking pictogram','Yellow notice','Roadwork warning','Rectangular sign · rear','Triangular sign · rear','Round sign · rear','Paired direction plates','Paired crossing plates','Direction plates on short post','Double warning plates · narrow road','Double warning plates · lane design','Double warning plates · broad road','Double warning plates · bend design','Double warning plates · exclamation','Double warning plates · junction design','Double warning plates · signal design','Double round direction plates · first view','Double round direction plates · second view','Double round direction plates · outward view','Three direction plates','Paired direction plates · rear support','Paired direction plates · crossing angle','Mixed direction plates','Stacked direction plates','Multi-arm signpost']
    for n,label in enumerate(old_labels,1):add('signs',label,'Traffic_Sign_'+str(n),uncertainty='Pictogram meaning is proposed from tiny pixels; no legal or game rule inferred.')
    for n in range(44,52):add('sign-pieces','Direction plate · '+('blue' if n<48 else 'green')+' '+['front','rear','angled left','angled right'][(n-44)%4],'Traffic_Sign_'+str(n),kind='component',use=plate)
    post_labels=['Post foot','Straight post section','Short post section','Post connector','Short post with mounting tabs','Long post with mounting tabs','Capped post foot','Crossbar bracket','Square plate · rear','Rounded blue plate','Rounded green plate','Green direction plate','Blue direction plate','Blue angled plate · left','Green angled plate · left','Green angled plate · right','Blue angled plate · right']
    for n,label in enumerate(post_labels,1):add('sign-pieces',label,'Traffic_Sign_Modular_'+str(n),kind='component',use=plate,uncertainty='Join geometry and allowed post lengths are untested; do not treat partial supports as complete signposts.')
    # The newer short-post bank has many pictograms. Keep original designs selectable
    # by visible shape/face rather than inventing matching semantic identities.
    banks=[('Sign backs',[1,2,3]),('Round signs · front',list(range(4,13))),('Square signs · front',list(range(13,17))),('Pale warning signs · front',list(range(17,30))),('Yellow warning signs · front',list(range(30,44))),('Round signs · left angle',list(range(44,53))),('Square signs · left angle',list(range(53,57))),('Pale warning signs · left angle',list(range(57,68))),('Yellow warning signs · left angle',list(range(68,79))),('Round signs · right angle',list(range(79,87))),('Square signs · right angle',list(range(87,91))),('Pale warning signs · right angle',list(range(91,102))),('Yellow warning signs · right angle',list(range(102,114))),('Yield-shaped signs',list(range(114,118)))]
    for label,indices in banks:
        add('short-signs',label,seq('Traffic_Sign_New_',indices),['Design '+str(i+1) for i in range(len(indices))],use='Original printed sign designs and image-plane views; no shared legal meaning or gameplay rule is implied.',uncertainty='Tiny symbols and cross-facing identity matches remain provisional. Each selected design preserves its own native pixels.')
    add('lamps','Curved street lamp',seq('Street_Lamp_',[1,2]),['Lamp right','Lamp left'])
    add('lamps','Straight-arm street lamp',seq('Street_Lamp_',[3,4]),['Arm right','Arm left'])
    add('lamps','Globe street lamp','Street_Lamp_5')
    add('supports','Utility pole · insulators',seq('Electric_Pole_',[1,2,3]),['Paired upright fittings','Crossbar fittings','Side fittings'],uncertainty='Electrical function is plausible; wire connections and materials are unknown.')
    add('supports','Utility pole with cut-off wires','Electric_Pole_6',kind='unknown',use='Wires continue beyond both source edges; neighboring wires and exact joins are unknown.',uncertainty='Standalone pole body is complete but the wire network is cropped; whole-network eligibility is unresolved.')
    add('supports','Capped short post','Pole_1')
    add('utilities','Street utility cabinet',seq('Electric_Box_',[1,2]),['Narrow','Wider'],uncertainty='Electrical cabinet versus vending/service box remains uncertain; no operation or inventory inferred.')
    add('utilities','Charging kiosk',seq('EV_Charging_Station_',[1,2]),['Plain','Side sockets'],uncertainty='Charging interpretation follows display/socket silhouette and source naming; game use is unknown.')
    add('utilities','Hydrant',seq('Hydrant_',[1,2,3]),['Red','Tan','Blue'])
    add('signs','Red service marker','Hydrant_Sign_1',uncertainty='Hydrant/service location marker is plausible; exact pictogram and legal use unknown.')
    add('utilities','Parking meter','Parking_Meter_1')
    add('utilities','Drinking fountain',seq('Drinking_Fountain_',[1,2]),['Upper fitting','Flat basin'],uncertainty='Fountain/basin interpretation plausible; water behavior unknown.')
    add('utilities','Public telephone booth',seq('Phone_Booth_',[1,2]),['Telephone emblem','Plain roof'])
    add('utilities','Public telephone booth · exposed phone',seq('Phone_Booth_',[3,4]),['Telephone emblem','Plain roof'],uncertainty='Trailing cord is part of the original drawing; game interaction and occlusion unknown.')
    add('utilities','Street mailbox','Mailbox_1',uncertainty='Mail/service box interpretation plausible; material and interaction unknown.')
    add('utilities','Round utility cover',seq('Manhole_',[1,2,3]),['Dark rings','Light rings','Dotted design'])
    add('utilities','Square utility cover',seq('Manhole_',[4,5]),['Wide slots','Narrow slots'])
    add('utilities','Angled utility cover',seq('Manhole_',[6,7,8]),['Dark rings','Light rings','Dotted design'])
    for i,(a,b) in enumerate([(1,4),(2,5),(3,6)],1):add('utilities',['Thin drain grille','Short drain grille','Deep drain grille'][i-1],seq('Grate_',[a,b]),['Narrow','Wide'])
    add('barriers','Road cone',seq('Cone_',[3,6]),['Orange','Red'])
    add('barriers','Fallen road cone',seq('Cone_',[4,5,7,8]),['Orange · right','Orange · left','Red · right','Red · left'])
    add('barriers','Stacked road cones',seq('Cone_',[9,10]),['Orange','Red'])
    add('barriers','Short bollard',seq('Pedestrian_Barrier_Post_',[1,2]),['Dark','Pale'])
    add('barriers','Striped bollard',seq('Pedestrian_Barrier_Post_',range(3,7)),['Red band','Blue band','Pale band','Yellow band'])
    add('barriers','Low pedestrian rail',seq('Pedestrian_Barrier_Post_',[7,8]),['Dark','Pale'])
    add('barriers','Thin road marker',seq('Pedestrian_Barrier_Post_',[9,10]),['Plain','Red bands'])
    add('barriers','Short road stake',['Grey_Stake','Yellow_Stake'],['Gray','Yellow'])
    for side in ['Left','Middle','Right']:
        add('barrier-pieces',side.lower()+' pedestrian rail section',[f'Pedestrian_Barrier_Post_Modular_{n}_{side}' for n in [1,2]],['Dark','Pale'],kind='component',use='Needs matching rail neighbors '+('on both sides.' if side=='Middle' else 'to the '+('right.' if side=='Left' else 'left.')),uncertainty='Only original end/middle roles are proposed; attachment heights and arbitrary lengths are untested.')
    for label,ids in [('Front',[1,2,3]),('Left angled',[4,5,6]),('Right angled',[7,8,9])]:
        add('barriers',label+' road barrier',seq('Traffic_Barrier_',ids),['Plain stripes','Small no-entry plate','Large no-entry plate'])
    add('barriers','Vehicle gate arm',['Stop_Barrier_Front','Stop_Barrier_Back','Stop_Barrier_Up_Front','Stop_Barrier_Up_Back'],['Lowered · front','Lowered · rear','Raised · front','Raised · rear'],use='Raised/lowered original drawings; no automatic motion or collision behavior inferred.')
    for n in range(1,5):add('barriers',['Short red-striped barrier','Angled red-striped barrier · left','Angled red-striped barrier · right','Wide red-striped barrier'][n-1],'Danger_Sign_'+str(n))
    for label,ids in [('Skull plate',[5,6]),('Radiation-style plate',[7,8]),('Hazard plate',[9,10])]:add('sign-pieces',label,seq('Danger_Sign_',ids),['Left angle','Right angle'],kind='component',use=plate,uncertainty='Hazard pictogram identification is provisional; no harmful effect or legal rule inferred.')
    add('sign-pieces','Loose triangular warning plate','Danger_Sign_11',kind='component',use=plate)
    add('sign-pieces','Loose notice plate',seq('Danger_Sign_',[12,13]),['Small block','Narrow block'],kind='component',use=plate,uncertainty='Tiny lettering or symbol is unreadable.')
    add('signs','Short hazard marker',seq('Danger_Sign_',[14,15,16]),['Skull-like','Radiation-like','Hazard symbol'],uncertainty='Symbols are first-pass readings, not legal meanings.')
    add('signs','Small information stand','Info_Sign_1')
    add('signs','Tall notice stand',seq('Info_Sign_',[2,3]),['Dark frame','Pale frame'])
    add('signs','Sale notice stand','Info_Sign_4')
    add('sign-pieces','Loose lettering or notice fragments',seq('Info_Sign_',[5,6]),['Scattered letters','Block letters'],kind='unknown',use='Backing, attachment and standalone use are unresolved.',uncertainty='May be disassembled sign letters or another small graphic prop; no post or backing is visible.')
    return cards


def build(check=False, capture_dir=None):
    master=Image.open(ROOT/MASTER).convert('RGBA')
    index=json.loads((ROOT/INDEX).read_text())['themes']['ME_Singles_City_Props']
    pins={'me-complete':{'sheetId':'me-complete','path':MASTER,'sha256':sha((ROOT/MASTER).read_bytes())}}
    records=[];cards=[];copies=[];images={};seen=set()
    for number,spec in enumerate(specification(),1):
        record_ids=[]
        for appearance_index,name in enumerate(spec['names']):
            assert name not in seen, name
            seen.add(name);original=DIRECTORY/(PREFIX+name+'.png');im=Image.open(original).convert('RGBA');pixels=sha(normalized(im));rect=index.get(name)
            source={'frameSize':list(im.size),'offsetXY':[0,0],'pixelSha256':pixels,'originalPath':str(original.relative_to(ROOT))}
            if rect and normalized(master.crop((rect[0],rect[1],rect[0]+rect[2],rect[1]+rect[3])))==normalized(im):
                source.update(sheetId='me-complete',rect=rect,legacyTheme='ME_Singles_City_Props',legacyKey=name)
            else:
                sheet_id='street-source-'+re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')
                path=COPIES+'/'+sheet_id+'.png';target=ROOT/path
                if check:
                    assert target.exists() and target.read_bytes()==original.read_bytes(), 'Original copy differs: '+name
                else:
                    target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original,target)
                source.update(sheetId=sheet_id,rect=[0,0,*im.size])
                pins[sheet_id]={'sheetId':sheet_id,'path':path,'sha256':sha(original.read_bytes())}
                copies.append(name)
            kind=spec['kind'];uid='B03-'+str(len(records)+1).zfill(3)
            record={'id':uid,'label':spec['label']+(' · '+spec['labels'][appearance_index] if len(spec['names'])>1 else ''),'kind':kind,'source':source,
                'topology':{'standalone':{'whole':'allowed','component':'forbidden','unknown':'unknown'}[kind],
                            'requiredNeighbors':[spec['use']] if kind=='component' else [],
                            'limits':'Visual first-pass proposal only; game geometry, legal interpretation and behavior unknown.'},
                'uncertainty':spec['uncertainty']}
            records.append(record);record_ids.append(uid);images[uid]=im
        facts=[{'label':'Use','value':spec['use'] or 'Complete visual object; game collision, height and behavior are unknown.'}]
        if spec['uncertainty']:facts.append({'label':'Unknown','value':spec['uncertainty']})
        card={'id':'street-'+str(number).zfill(3),'groupId':spec['group'],'label':spec['label'],'kind':spec['kind'],'facts':facts,
              'variants':[{'id':'appearance-'+str(i+1),'label':label,'recordId':uid} for i,(uid,label) in enumerate(zip(record_ids,spec['labels']))]}
        if len(record_ids)>1:card['variantLabel']='Sign design' if spec['group']=='short-signs' else 'Appearance'
        cards.append(card)
    group_names=[('signals','Traffic signals'),('lamps','Street lamps'),('supports','Poles and supports'),('signs','Signposts and notices'),('short-signs','Short-post sign designs'),('utilities','Street services and utility covers'),('barriers','Bollards, cones and barriers'),('signal-pieces','Signal heads and hanging pieces'),('sign-pieces','Sign plates and post pieces'),('barrier-pieces','Rail pieces to combine')]
    packet={'schemaVersion':1,'packetId':'B03','familyId':'street-hardware','title':'Street lights, poles and hardware',
        'description':'Traffic signals, lamps, utility poles, road signs, roadside services and separate hardware pieces.',
        'sourcePins':sorted(pins.values(),key=lambda p:p['sheetId']),
        'sourceIndexPins':[{'path':INDEX,'sha256':sha((ROOT/INDEX).read_bytes())}],
        'scope':{'included':['All 95 City Props traffic-signal/support/head exports','All 68 older traffic signs and modular parts','All 117 newer short-post road sign designs','101 City Props lamps, utility hardware, sign notices, bollards, cones and barriers'],
                 'excluded':['Buildings and the giant ice-cream kiosk despite its cone filename','Beach/station/military/house lighting and unrelated thematic signs','Unsearched master/alias occurrences and cross-design compatibility','Unmatched selected legacy coordinates use exact native copies: '+', '.join(copies)],
                 'method':'Visual first pass over every selected named-export contact sheet and relevant master context; selected exact legacy-index crops checked against native exports; missing index entries copied byte-identically. No exhaustive origin, alias or absence search.'},
        'facts':[{'label':'Use','value':'Whole props, pieces needing supports and unresolved forms are distinguished.'},
                 {'label':'Signals','value':'Original colors and raised/lowered drawings are selectable; game behavior and animation are unknown.'},
                 {'label':'Signs','value':'Small pictograms and matching across angles are provisional. Original designs stay selectable.'},
                 {'label':'Joins','value':'Head, sign, rail and post attachments are mostly untested; no arbitrary assembly rule.'},
                 {'label':'Gameplay','value':'Collision, height, interaction, wire networks and legal traffic rules are unknown.'}],
        'groups':[{'id':key,'title':title} for key,title in group_names], 'records':records,'cards':cards}
    coverage=Counter(v['recordId'] for card in cards for v in card['variants'])
    assert coverage==Counter(r['id'] for r in records) and len(records)==381
    encoded=(json.dumps(packet,indent=2,ensure_ascii=True)+'\n').encode()
    if check:assert PACKET.read_bytes()==encoded, 'Broad street packet is stale'
    else:PACKET.write_bytes(encoded)
    if capture_dir:
        capture_dir.mkdir(parents=True,exist_ok=True)
        for start in range(0,len(cards),40):
            subset=cards[start:start+40];out=Image.new('RGB',(1760,((len(subset)+7)//8)*250),'#cad9bf');draw=ImageDraw.Draw(out)
            for i,card in enumerate(subset):
                x=i%8*220;y=i//8*250;draw.text((x+2,y+3),card['label'][:33],fill='black');draw.text((x+2,y+17),str(len(card['variants']))+' original design(s)',fill='black');im=images[card['variants'][0]['recordId']];backing=Image.new('RGBA',im.size,'#cad9bf');backing.alpha_composite(im);out.paste(backing.resize((im.width*2,im.height*2),Image.Resampling.NEAREST).convert('RGB'),(x+3,y+40))
            out.save(capture_dir/('cards-'+str(start//40)+'.png'))
        for label,box in [('early-lamps-signals',[0,256,208,352]),('signal-bank',[1504,3968,208,160]),('new-signals',[1376,5632,704,416]),('utility-poles',[896,1888,160,96]),('service-cabinets',[1280,3136,112,160])]:
            x,y,w,h=box;crop=master.crop((x,y,x+w,y+h));backing=Image.new('RGBA',crop.size,'#cad9bf');backing.alpha_composite(crop);backing.resize((w*3,h*3),Image.Resampling.NEAREST).convert('RGB').save(capture_dir/(label+'.png'))
    print(('Verified' if check else 'Generated')+f' B03: {len(cards)} cards, {len(records)} native records, {len(records)-len(copies)} indexed master crops, {len(copies)} byte-identical copies; proposed only.')
    print('Representative head overlays: '+json.dumps(representative_checks(capture_dir),separators=(',',':')))
    return packet


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');parser.add_argument('--capture-dir',type=Path);args=parser.parse_args()
    build(args.check,args.capture_dir)


if __name__=='__main__':main()
