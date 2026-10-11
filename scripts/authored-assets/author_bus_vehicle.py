"""Independent long bus body with asymmetric owned doors and rigid wheels."""
import argparse
from pathlib import Path
import subprocess

from author_emergency_vehicle import Author, INK
from author_garbage_truck import floor, wheels
from author_passenger_vehicle import registered_config
from pipeline import HERE, ROOT, digest, read, write


def geometry(a):
    b = a.config['body']
    xa, xb, width, ew = b['front'], b['rear'], b['halfWidth'], b['endHalfWidth']
    front, rear, roof, rw = xa+4, xb-4, b['roof'], b['roofHalfWidth']
    a.config['wheels'] = {'radius':a.config['axles'][0]['radius']}
    a.side('Bus-body', front, rear, [(front,b['sideTop']),(rear,b['sideTop'])],width,
           [axle['x'] for axle in a.config['axles']])
    a.face('Roof',[[front,-rw,roof],[rear,-rw,roof],[rear,rw,roof],[front,rw,roof]],'north')
    for owner,sign in a.config['sideOwners'].items():
        a.face('Roof-shoulder-'+owner,[[front,sign*rw,roof],[rear,sign*rw,roof],
               [rear,sign*width,b['sideTop']],[front,sign*width,b['sideTop']]],color=a.refs['north'].getpixel((56,40)))
        a.face('Front-roof-corner-'+owner,[[front,sign*width,b['sideTop']],[front,sign*rw,roof],[xa,sign*ew,36]],owner)
        a.face('Rear-roof-corner-'+owner,[[rear,sign*width,b['sideTop']],[rear,sign*rw,roof],[xb-2,sign*ew,43],[xb,sign*ew,31]],owner)
    a.glass('Windshield',[[front,-rw,roof],[front,rw,roof],[xa,ew,36],[xa,-ew,36]],'south')
    a.face('Rear-roof-edge',[[rear,-rw,roof],[rear,rw,roof],[xb-2,ew,43],[xb-2,-ew,43]],'north')
    a.glass('Rear-window',[[xb-2,ew,43],[xb-2,-ew,43],[xb,-ew,31],[xb,ew,31]],'north')
    for name,x,deck,side_x,owner in [('Front',xa,36,front,'south'),('Rear',xb,31,rear,'north')]:
        a.face(name+'-fascia',[[x,-ew,b['endBase']],[x,ew,b['endBase']],[x,ew,deck],[x,-ew,deck]],owner)
        for side_owner,sign in a.config['sideOwners'].items():
            a.face(f'{name}-corner-{side_owner}',[[x,sign*ew,b['endBase']],
                   [side_x,sign*width,b['base']],[side_x,sign*width,b['sideTop']],
                   [x,sign*ew,deck]],side_owner)
    b['front'],b['rear']=front,rear
    floor(a)
    b['front'],b['rear']=xa,xb
    a.face('Underfloor-front-bevel',[[xa,-ew,b['endBase']],[front,-width,b['base']],
           [front,width,b['base']],[xa,ew,b['endBase']]],color=INK)
    a.face('Underfloor-rear-bevel',[[rear,-width,b['base']],[xb,-ew,b['endBase']],
           [xb,ew,b['endBase']],[rear,width,b['base']]],color=INK)
    defaults=a.config['mirrors']
    for sign in [-1,1]:
        m={**defaults,**defaults.get('bySide',{}).get('L' if sign<0 else 'R',{})}
        a.box(f'Mirror-arm-{sign}',m['x']-.5,m['x']+.5,min(sign*width,sign*m['halfWidth']),
              max(sign*width,sign*m['halfWidth']),m['z']+1,m['z']+2,color=INK)
        a.box(f'Mirror-{sign}',m['x']-m['width']/2,m['x']+m['width']/2,
              sign*m['halfWidth']-.6,sign*m['halfWidth']+.6,m['z'],m['z']+m['height'],color=INK)


def author(vehicle, config_path, output, blender):
    if output.exists():raise FileExistsError('Choose a fresh workspace')
    config=read(config_path)
    if vehicle not in config['vehicles']:raise ValueError('Vehicle outside declared bus family')
    a=Author(vehicle,output,registered_config(vehicle,config))
    geometry(a);fit=wheels(a)
    fit['extraFloorMeshes']=['Underfloor-front-bevel','Underfloor-rear-bevel']
    a.finish()
    rig=read(output/'rig.json');rig['wheelWellFit']=fit
    write(output/'rig.json',rig);write(output/'wheel-alignment.json',fit)
    with (output/'build.log').open('w',encoding='utf-8') as log:
        subprocess.run([str(blender),'--background','--factory-startup','--python-exit-code','1',
                        '--python',str(HERE/'build_emergency_vehicle.py'),'--',str(output)],
                       check=True,stdout=log,stderr=subprocess.STDOUT,cwd=ROOT)
    recipe=read(output/'recipe.json');recipe['template']={'path':str(output/'car.blend'),'sha256':digest(output/'car.blend')}
    write(output/'recipe.json',recipe)
    print('Authored independent bus:',vehicle,output)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ['config','out','blender']:parser.add_argument('--'+key,type=Path,required=True)
    parser.add_argument('--vehicle',required=True);args=parser.parse_args()
    author(args.vehicle,args.config.resolve(),args.out.resolve(),args.blender.resolve())
