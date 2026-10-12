"""Source-owned blue train carriage prototypes; never changes live train physics.

Each physical carriage owns a rigid body, two bogies, eight independent wheels,
and static coupler/bellows components. Native source camera differences are
explicit diagnostic fits, never gameplay lenses.
"""
import argparse
from collections import deque
import math
from pathlib import Path
import subprocess

from PIL import Image

from author_emergency_vehicle import Author, INK
from pipeline import HERE, ROOT, digest, initialize, read, write
from projection_math import project


class TrainAuthor(Author):
    def __init__(self, part, output, config):
        self.out, self.config = output, config
        bank = read(ROOT / 'src/railway/RailwaySource.json')
        views = []
        for direction, name in config['sources'].items():
            source = bank['sprites'][name]
            x, y, _, _ = source['rect']
            l, t, r, b = source['bounds']
            views.append({'id': direction, 'rect': [x+l, y+t, r-l, b-t],
                          'sourceName': name, 'anchor': [(r-l)/2, b-t-15]})
        self.recipe = initialize({'assetId': 'train-blue-'+part, 'family': 'blue-local-train',
            'source': {'image': 'public/'+bank['image'], 'sha256': bank['sha256']},
            'views': views}, output, {'cameras': config['cameras']})
        self.cell, self.size = 192, 192*8
        self.atlas = Image.new('RGBA', (self.size, self.size), INK)
        self.objects, self.regions, self.owners, self.wheels, self.nodes, self.lenses = [], [], {}, [], [], []
        self.positions, self.refs = {'Body': [0, 0, 0]}, {}
        for view in self.recipe['views']:
            im = Image.new('RGBA', tuple(self.recipe['canvas']))
            im.alpha_composite(Image.open(output / view['source']).convert('RGBA'), tuple(view['offset']))
            queue = deque((x, y) for y in range(im.height) for x in range(im.width) if im.getpixel((x,y))[3] > 200)
            filled = im.copy()
            while queue:
                x, y = queue.popleft()
                for nx, ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                    if 0 <= nx < im.width and 0 <= ny < im.height and filled.getpixel((nx,ny))[3] == 0:
                        filled.putpixel((nx,ny),filled.getpixel((x,y)));queue.append((nx,ny))
            self.refs[view['id']] = filled


def geometry(a):
    c = a.config
    xa, xb, cab = -c['length']/2, c['length']/2, c['cabSign']
    connector = c['connectorLength']
    body_a, body_b = xa, xb-connector
    width, roof_width, roof = 20.5, 18.5, 40
    nose_a, nose_b = body_a+(5 if cab == -1 else 0), body_b-(5 if cab == 1 else 0)
    # Eight radius-five wheels are hidden by the original skirt, not painted
    # onto the body. The high chassis and outboard skirts clear their cylinders.
    for owner, sign in c['sideOwners'].items():
        a.face('Skirt-'+owner, [[body_a,sign*width,3],[body_b,sign*width,3],
            [nose_b,sign*width,38],[nose_a,sign*width,38]], owner)
        a.face('Roof-shoulder-'+owner, [[nose_a,sign*width,38],[nose_b,sign*width,38],
            [nose_b,sign*roof_width,roof],[nose_a,sign*roof_width,roof]], owner)
    roof_owner = 'south' if cab == -1 else 'north'
    if not cab:roof_owner='south'
    a.face('Roof',[[nose_a,-roof_width,roof],[nose_b,-roof_width,roof],
                   [nose_b,roof_width,roof],[nose_a,roof_width,roof]],roof_owner)
    a.face('Chassis',[[body_a,-width,12],[body_b,-width,12],
                      [body_b,width,12],[body_a,width,12]],color=INK)
    for name,x,nose,owner in [('Negative-end',body_a,nose_a,'south'),('Positive-end',body_b,nose_b,'north')]:
        a.face(name+'-lower',[[x,-width,3],[x,width,3],[x,width,23],[x,-width,23]],owner)
        if (x < 0 and cab == -1) or (x > 0 and cab == 1):
            a.glass(name+'-windscreen',[[nose,-roof_width,38],[nose,roof_width,38],
                    [x,width,23],[x,-width,23]],owner)
            a.face(name+'-roof',[[nose,-roof_width,38],[nose,roof_width,38],
                    [nose,roof_width,40],[nose,-roof_width,40]],owner)
        else:
            a.face(name+'-upper',[[x,-width,23],[x,width,23],[nose,roof_width,40],[nose,-roof_width,40]],owner)
        for sign in [-1,1]:
            a.face(name+'-corner-'+str(sign),[[x,sign*width,3],[nose,sign*width,38],
                [nose,sign*roof_width,40],[x,sign*width,23]],owner)
    if connector:
        a.nodes.append({'name':'Bellows','parent':'Body','location':[0,0,0],
                        'extras':{'tilefun_role':'train-bellows','articulation':'rest-only'}})
        a.positions['Bellows']=[0,0,0]
        a.box('Bellows-body',body_b,xb,-17,17,4,37,owner_top=roof_owner,parent='Bellows')
    for end,x in [('negative',xa),('positive',xb)]:
        a.nodes.append({'name':'Coupler_'+end,'parent':'Body','location':[x,0,15],
                        'extras':{'tilefun_role':'train-coupler','articulation':'rest-only'}})
        a.positions['Coupler_'+end]=[x,0,15]
        a.box('Coupler-head-'+end,x-2,x+2,-4,4,14,16,color=INK,parent='Coupler_'+end)
    for bogie,bx in [('F',-c['length']*.28),('R',c['length']*.28)]:
        a.nodes.append({'name':'Bogie_'+bogie,'parent':'Body','location':[bx,0,11],
                        'extras':{'tilefun_role':'train-bogie','yawClearance':'rest-only'}})
        a.positions['Bogie_'+bogie]=[bx,0,11]
        a.box('Bogie-frame-'+bogie,bx-12,bx+12,-17.5,17.5,11,12,color=INK,parent='Bogie_'+bogie)
        for axle,dx in [('1',-8),('2',8)]:
            for sign,side in [(-1,'L'),(1,'R')]:
                ident=bogie+side if axle=='1' else bogie+'2'+side
                center=[bx+dx,sign*16,5];roll='Wheel_'+ident+'_Roll'
                a.positions[roll]=center
                a.wheels.append({'id':ident,'center':center,'radius':5,'steering':False,
                    'steer':'Wheel_'+ident+'_Steer','roll':roll,'bogie':'Bogie_'+bogie})
                for name,radius,depth,offset,color in [('Tire',5,1.3,0,INK),('Hub',2.6,.2,sign*1.55,(100,100,120,255))]:
                    vertices=[[center[0]+radius*math.cos(k*math.tau/24),center[1]+offset+d,
                              center[2]+radius*math.sin(k*math.tau/24)] for d in [-depth,depth] for k in range(24)]
                    faces=[[k,(k+1)%24,(k+1)%24+24,k+24] for k in range(24)]+[list(range(24)),list(range(24,48))]
                    a.mesh(name+'_'+ident,vertices,faces,color=color,parent=roll)


def author(part, config, output, blender):
    if output.exists():raise FileExistsError('Choose a fresh prototype workspace')
    a=TrainAuthor(part,output,config);geometry(a);a.finish()
    rig=read(output/'rig.json');rig.update({'root':'TrainRoot','steeringClearance':'No train steering; bogie yaw remains at rest',
        'bodyLength':config['length'],'carriageRole':part,'wheelObservation':'Wheels inferred under original opaque skirt; not visible source landmarks'})
    write(output/'rig.json',rig)
    with (output/'build.log').open('w',encoding='utf-8') as log:
        subprocess.run([str(blender),'--background','--factory-startup','--python-exit-code','1',
            '--python',str(HERE/'build_blue_train.py'),'--',str(output)],check=True,stdout=log,stderr=subprocess.STDOUT,cwd=ROOT)
    recipe=read(output/'recipe.json');recipe['template']={'path':str(output/'car.blend'),'sha256':digest(output/'car.blend')}
    write(output/'recipe.json',recipe)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--part',choices=['rear','middle','front'],required=True)
    for key in ['out','config','blender']:parser.add_argument('--'+key,type=Path,required=True)
    args=parser.parse_args();author(args.part,read(args.config)[args.part],args.out.resolve(),args.blender.resolve())
