"""Author a six-wheel garbage truck with open rear loader and warning beacon."""
import argparse
import math
from pathlib import Path
import subprocess

from author_emergency_vehicle import Author, INK
from pipeline import HERE, ROOT, digest, read, write
from projection_math import project


def wheels(a):
    owners = {sign: view for view, sign in a.config['sideOwners'].items()}
    observations = []
    for axle in a.config['axles']:
        for sign, suffix in [(-1, 'L'), (1, 'R')]:
            ident = axle['id']+suffix
            center = [axle['x'], sign*axle['trackHalfWidth'], axle['radius']]
            roll = f'Wheel_{ident}_Roll'
            a.positions[roll] = center
            a.wheels.append({'id': ident, 'center': center, 'radius': axle['radius'], 'steering': axle['steering'],
                             'steer': f'Wheel_{ident}_Steer', 'roll': roll})
            owner = owners[sign]
            offset = next(v['offset'] for v in a.recipe['views'] if v['id'] == owner)
            source = [axle['centers'][owner][k]+offset[k] for k in range(2)]
            outer = [center[0], center[1]+sign*axle['tireWidth']/2, center[2]]
            camera = a.config['cameras'][owner]
            error = math.dist(project(outer, camera), source)
            if error > a.config['maxCenterErrorPixels']:
                raise ValueError(f'{ident}: wheel misses measured source center by {error}')
            observations.append({'wheel': ident, 'view': owner, 'camera': camera,
                                 'sourceCenter': source, 'errorPixels': error})
            for part, radius, depth in [('Tire', axle['radius'], axle['tireWidth']/2), ('Hub', axle['hubRadius'], .2)]:
                outward = 0 if part == 'Tire' else sign*(axle['tireWidth']/2+.25)
                verts = [[center[0]+radius*math.cos(k*math.tau/24), center[1]+outward+d,
                          center[2]+radius*math.sin(k*math.tau/24)] for d in [-depth, depth] for k in range(24)]
                faces = [[k, (k+1)%24, (k+1)%24+24, k+24] for k in range(24)]+[list(range(24)), list(range(24,48))]
                a.mesh(f'{part}_{ident}', verts, faces, owner, parent=roll)
                obj, region = a.objects[-1], a.regions[-1]
                tile = region['rect'][:2]
                fill = INK if part == 'Tire' else (108,110,133,255)
                a.atlas.paste(fill, (tile[0]+132,tile[1]+132,tile[0]+156,tile[1]+156))
                rx, ry = axle['paintRadii'] if part == 'Tire' else [axle['hubRadius'], axle['hubRadius']*.58]
                paint = [source[0],source[1]+(1 if part == 'Hub' else 0)]
                obj['uvs'] = [[a.uv(tile,[paint[0]+obj['vertices'][i][0]/radius*rx,
                                         paint[1]-obj['vertices'][i][2]/radius*ry]) for i in face]
                              if len(face)==24 and (face[0]>=24)==(sign==1)
                              else [a.uv(tile,[144,144]) for i in face] for face in faces]
                region['cleanup'] = {'capSourceCenter': paint, 'capPaintRadii': [rx,ry],
                                     'treadAndHiddenCap': 'Explicit palette fill; no body/fender sampling'}
    return {'schema':'tilefun-wheel-well-fit-v1','observations':observations,'floorMesh':'Underfloor',
            'maxCenterErrorPixels':a.config['maxCenterErrorPixels'],
            'status':'Measured rest/roll centers; steering and loader clearance unqualified'}


def floor(a):
    b=a.config['body'];margin=a.config['floorMargin']
    cuts=sorted({b['front'],b['rear']}|{axle['x']+sign*(axle['radius']+margin) for axle in a.config['axles'] for sign in [-1,1]})
    inner=min(axle['trackHalfWidth']-axle['tireWidth']/2-margin for axle in a.config['axles'])
    vertices,faces=[],[]
    for xa,xb in zip(cuts,cuts[1:]):
        for ya,yb in [(-b['halfWidth'],-inner),(-inner,inner),(inner,b['halfWidth'])]:
            if abs((ya+yb)/2)>inner and any(abs((xa+xb)/2-axle['x'])<axle['radius']+margin for axle in a.config['axles']):
                continue
            start=len(vertices)
            vertices += [[xa,ya,b['base']],[xb,ya,b['base']],[xb,yb,b['base']],[xa,yb,b['base']]]
            faces.append(list(range(start,start+4)))
    a.mesh('Underfloor',vertices,faces,color=INK)


def beam(a,name,start,end,owner,parent):
    dx,dz=end[0]-start[0],end[2]-start[2]
    length=math.hypot(dx,dz);ox,oz=-dz/length*.9,dx/length*.9
    a.mesh(name,[[p[0]+s*ox,p[1]+d,p[2]+s*oz] for p in [start,end] for d in [-.7,.7] for s in [-1,1]],
           [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]],owner,parent=parent)


def geometry(a):
    b,c,box,loader=[a.config[key] for key in ['body','cab','container','loader']]
    axle=a.config['axles'][0]
    a.config['wheels']={'radius':axle['radius']}
    a.side('Cab',b['front'],c['rear'],[(b['front'],c['screenTop']),(c['rear'],c['screenTop'])],c['halfWidth'],[axle['x']])
    cw=c['halfWidth']
    a.face('Cab-roof',[[c['front'],-cw,c['roof']],[c['rear'],-cw,c['roof']],
                       [c['rear'],cw,c['roof']],[c['front'],cw,c['roof']]],'north')
    # The drawn cab roof occupies a much shorter strip in the rear-facing source.
    # Rectify its observed paint instead of importing container/bumper pixels.
    obj,region=a.objects[-1],a.regions[-1];tile=region['rect'][:2]
    a.atlas.paste((232,227,240,255),(tile[0]+47,tile[1]+10,tile[0]+82,tile[1]+22))
    obj['uvs']=[[a.uv(tile,[64+v[1]*.85,10+(v[0]-c['front'])/(c['rear']-c['front'])*11]) for v in obj['vertices']]]
    region['cleanup']='Observed pale roof rectified to cabin; painted beacon footprint removed, hardware owns its paint.'
    a.glass('Windshield',[[c['front'],-cw,c['screenTop']],[c['front'],cw,c['screenTop']],
                          [b['front'],cw,c['screenBottom']],[b['front'],-cw,c['screenBottom']]],'south')
    a.face('Front-fascia',[[b['front'],-cw,6],[b['front'],cw,6],[b['front'],cw,c['screenBottom']],[b['front'],-cw,c['screenBottom']]],'south')
    for owner,sign in a.config['sideOwners'].items():
        a.face(f'Container-{owner}',[[box['front'],sign*box['halfWidth'],box['base']],
                                   [box['rear'],sign*box['halfWidth'],box['base']],
                                   [box['rear'],sign*box['halfWidth'],box['sideTop']],
                                   [box['front'],sign*box['halfWidth'],box['sideTop']]],owner)
        a.face(f'Container-shoulder-{owner}',[[box['front'],sign*box['halfWidth'],box['sideTop']],
                                            [box['rear'],sign*box['halfWidth'],box['sideTop']],
                                            [box['rear'],sign*box['roofHalfWidth'],box['roof']],
                                            [box['front'],sign*box['roofHalfWidth'],box['roof']]],owner)
    rw=box['roofHalfWidth']
    a.face('Container-roof',[[box['front'],-rw,box['roof']],[box['rear'],-rw,box['roof']],
                             [box['rear'],rw,box['roof']],[box['front'],rw,box['roof']]],'north')
    obj,region=a.objects[-1],a.regions[-1];tile=region['rect'][:2]
    obj['uvs']=[[a.uv(tile,[64+v[1],28+(v[0]-box['front'])/(box['rear']-box['front'])*52]) for v in obj['vertices']]]
    region['cleanup']='Roof panel strip rectified to observed north rows 28..80; roof projection differs from side-art depth.'
    a.face('Container-front',[[box['front'],-box['halfWidth'],box['base']],
                             [box['front'],box['halfWidth'],box['base']],
                             [box['front'],rw,box['roof']],[box['front'],-rw,box['roof']]],color=(49,111,118,255))
    a.box('Chassis-coupling',c['rear'],box['front'],-18,18,8,c['roof'])
    pivot=loader['pivot'];parent='Loader_Hinge';a.positions[parent]=pivot
    a.nodes.append({'name':parent,'parent':'Body','location':pivot,
                    'extras':{'tilefun_component':'rear-loader','hinge_axis_blender':[0,1,0],
                              'hinge_axis_gltf':[0,0,-1],'clearance_status':'unqualified'}})
    for owner,sign in a.config['sideOwners'].items():
        a.face(f'Loader-side-{owner}',[[loader['front'],sign*19,14],[loader['rear'],sign*19,10],
                                       [loader['rear'],sign*19,loader['rearTop']],
                                       [loader['front'],sign*19,loader['roof']]],owner,parent=parent)
        beam(a,f'Loader-brace-{owner}',[58,sign*19.3,12],[37,sign*19.3,47],owner,parent)
    a.face('Loader-roof',[[35,-17,76],[59,-17,61],[59,17,61],[35,17,76]],'north',parent=parent)
    obj,region=a.objects[-1],a.regions[-1];tile=region['rect'][:2]
    obj['uvs']=[[a.uv(tile,[64+(v[1]+pivot[1]),80+(v[0]+pivot[0]-35)/24*17]) for v in obj['vertices']]]
    region['cleanup']='Rear roof uses only observed green roof rows 80..97; mouth paint belongs to recessed geometry.'
    # Rear opening is bounded geometry, with a recessed back and real mouth walls.
    x,inside=loader['rear'],loader['rear']-6
    low,high,mw=loader['mouthBottom'],loader['mouthTop'],loader['mouthHalfWidth']
    a.face('Loader-rear-upper',[[x,-19,high],[x,19,high],[x,17,61],[x,-17,61]],'north',parent=parent)
    for sign in [-1,1]:
        ya,yb=sorted([sign*19,sign*mw])
        a.face(f'Loader-rear-frame-{sign}',[[x,ya,10],[x,yb,10],[x,yb,high],[x,ya,high]],'north',parent=parent)
        a.face(f'Loader-mouth-wall-{sign}',[[x,sign*mw,low],[inside,sign*mw,low],
                                          [inside,sign*mw,high],[x,sign*mw,high]],color=INK,parent=parent)
    a.face('Loader-mouth-sill',[[x,-mw,low],[x,mw,low],[inside,mw,low],[inside,-mw,low]],'north',parent=parent)
    a.face('Loader-mouth-ceiling',[[x,-mw,high],[inside,-mw,high],[inside,mw,high],[x,mw,high]],color=INK,parent=parent)
    a.face('Loader-mouth-back',[[inside,-mw,low],[inside,mw,low],[inside,mw,high],[inside,-mw,high]],'north',parent=parent)
    obj,region=a.objects[-1],a.regions[-1];tile=region['rect'][:2]
    obj['uvs']=[[a.uv(tile,[64+v[1]+pivot[1],119-(v[2]+pivot[2]-low)/(high-low)*14]) for v in obj['vertices']]]
    region['cleanup']='Mouth back owns observed loading opening; recession depth is inferred.'
    for sign in [-1,1]:
        a.box(f'Mirror-{sign}',-56,-51,sign*20-1,sign*20+1,33,36,color=(116,118,143,255))
    a.box('Roof-vent-base',-35,-28,-5,5,c['roof'],c['roof']+.6,color=INK)
    a.box('Roof-vent',-34,-29,-4,4,c['roof']+.6,c['roof']+1,color=(151,155,180,255))
    floor(a)
    light=a.config['beacon']
    a.light('Warning-amber',light['center'],light['radius'],light['height'],(247,166,57,255),0)
    a.objects[-1]['extras']['tilefun_signal']='warning'
    obj,region=a.objects[-1],a.regions[-1];tile=region['rect'][:2]
    colors=[(156,92,57,255),(236,148,48,255),(251,195,70,255),(255,226,141,255)]
    for row,color in enumerate(colors):
        a.atlas.paste(color,(tile[0]+8,tile[1]+8+row*4,tile[0]+24,tile[1]+12+row*4))
    obj['uvs']=[[a.uv(tile,[12+(i%12)/12*8,10+(v[2]-light['center'][2])/light['height']*12]) for i,v in [(i,obj['vertices'][i]) for i in face]] for face in obj['faces']]
    region['cleanup']='Observed amber/yellow palette gradient on physical lens; base remains separate and untagged.'


def author(out,blender,config_path):
    config=read(config_path)
    if config['schema']!='tilefun-garbage-truck-family-v1':raise ValueError('Unknown family configuration')
    a=Author(config['vehicle'],out,config)
    for view in a.recipe['views']:
        view['landmarks']=config.get('landmarks',{}).get(view['id'],[])
    geometry(a);fit=wheels(a);a.finish()
    lights=read(out/'lights.json');lights['signal']='warning'
    for lens in lights['lenses']:lens['signal']='warning'
    write(out/'lights.json',lights)
    rig=read(out/'rig.json');rig['wheelWellFit']=fit;write(out/'rig.json',rig)
    write(out/'wheel-alignment.json',fit)
    with (out/'build.log').open('w',encoding='utf-8') as log:
        subprocess.run([str(blender),'--background','--factory-startup','--python-exit-code','1',
                        '--python',str(HERE/'build_emergency_vehicle.py'),'--',str(out)],
                       check=True,stdout=log,stderr=subprocess.STDOUT,cwd=ROOT)
    recipe=read(out/'recipe.json');recipe['template']={'path':(out/'car.blend').relative_to(ROOT).as_posix(),'sha256':digest(out/'car.blend')}
    write(out/'recipe.json',recipe)
    print('Authored six-wheel garbage truck:',out)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,required=True);parser.add_argument('--blender',type=Path,required=True)
    parser.add_argument('--config',type=Path,default=HERE/'garbage-truck-family.json')
    args=parser.parse_args();author(args.out.resolve(),args.blender.resolve(),args.config.resolve())
