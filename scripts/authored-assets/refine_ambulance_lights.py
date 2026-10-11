"""Refine retained ambulance roof lights in a new workspace, preserving its body.

Builds separate tagged lenses and fixed housings; no baked rotation or game toggle.
"""
import argparse
from collections import deque
import math
from pathlib import Path
import shutil
import subprocess

from PIL import Image

from pipeline import HERE, ROOT, digest, read, write


def refine(source, output, config_path, blender):
    if output.exists():
        raise FileExistsError('Choose a fresh light-refinement workspace.')
    config = read(config_path)
    if config['schema'] != 'tilefun-ambulance-lights-v1':
        raise ValueError('Select an ambulance light configuration.')
    catalog = read(ROOT / 'art-source/vehicle-models/catalog.json')
    bundle = next(b for b in catalog['bundles'] if b['source'] == str(source.relative_to(ROOT)).replace('\\', '/'))
    for record in bundle['files']:
        if digest(ROOT / record['path']) != record['sha256']:
            raise ValueError(f"Retained input changed: {record['path']}")
    output.mkdir(parents=True)
    shutil.copytree(source / 'refs', output / 'refs')
    for name in ['family-config.json', 'rig.json']:
        shutil.copyfile(source / name, output / name)
    recipe = read(source / 'recipe.json')
    paint = read(source / 'paint-ownership.json')
    removed = [r for r in paint['regions'] if r['region'].startswith('Blue-bar-')]
    paint['regions'] = [r for r in paint['regions'] if not r['region'].startswith('Blue-bar-')]
    slots = [r['rect'] for r in removed]
    for slot in range(54, 64):
        x, y = slot % 8 * 128, slot // 8 * 128
        slots.append([x, y, x + 128, y + 128])
    atlas = Image.open(source / 'car-atlas.png').convert('RGBA')
    original = atlas.copy()
    east = Image.open(source / 'refs/east.png').convert('RGBA')
    north = Image.open(source / 'refs/north.png').convert('RGBA')
    icon = east.crop((88, 17, 91, 21))
    queue = deque()
    for y in range(icon.height):
        for x in range(icon.width):
            r, g, b, a = icon.getpixel((x, y))
            if a > 200 and b > 150 and g > 70:
                queue.append((x, y))
            else:
                icon.putpixel((x, y), (0, 0, 0, 0))
    while queue:
        x, y = queue.popleft()
        for nx, ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if 0 <= nx < icon.width and 0 <= ny < icon.height and icon.getpixel((nx,ny))[3] == 0:
                icon.putpixel((nx,ny), icon.getpixel((x,y)))
                queue.append((nx,ny))
    objects, lights, modified = [], [], []

    def mesh(name, vertices, faces, coords, image, light=None, provenance='Inferred fixed housing, original source palette'):
        tile = slots[len(objects)]
        atlas.paste(image.resize((128,128), Image.Resampling.NEAREST), tuple(tile[:2]))
        modified.append(tile)
        uvs = [[[(tile[0]+u)/1024, 1-(tile[1]+v)/1024] for u,v in face] for face in coords]
        objects.append({'name':name,'region':name,'vertices':vertices,'faces':faces,'uvs':uvs,'light':light})
        paint['regions'].append({'region':name,'rect':tile,'owner':None,'paintSource':provenance,
                                 'outsideSource':'Source-palette transfer onto inferred light geometry'})
        if light:
            lights.append({'node':name, **light})

    def cube(name, bounds, color):
        xa,xb,ya,yb,za,zb = bounds
        vertices = [[x,y,z] for z in [za,zb] for y in [ya,yb] for x in [xa,xb]]
        faces = [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]
        mesh(name,vertices,faces,[[[16,112],[112,112],[112,16],[16,16]]]*6,Image.new('RGBA',(1,1),color))

    for bar in config['bars']:
        x,y,z,h = bar['x'],bar['halfWidth'],bar['base'],bar['height']
        profile = [(-2,0),(-2,h*.35),(-1.5,h),(1.5,h),(2,h*.35),(2,0)]
        vertices = [[x+dx,side*y,z+dz] for side in [-1,1] for dx,dz in profile]
        faces = [[k,(k+1)%6,(k+1)%6+6,k+6] for k in range(6)] + [list(range(6)),list(range(6,12))]
        coords=[]
        for face in faces:
            cap = len(face) == 6
            coords.append([[12+100*((vertices[i][0]-x+2)/4 if cap else (vertices[i][1]/y+1)/2),
                            12+100*(1-(vertices[i][2]-z)/h)] for i in face])
        mesh(f"Lightbar-{bar['id']}-lens",vertices,faces,coords,north.crop((7,9,41,12)),
             {'group':bar['id'],'phase':bar['phase']},'Frozen north light-bar strip [7,9,34,3], rectified; inferred face transfer')
        cube(f"Lightbar-{bar['id']}-base",[x-2.1,x+2.1,-y,y,46.5,z],(178,174,203,255))

    for beacon in config['beacons']:
        x,y,z = beacon['center']
        profile = config['beaconProfile']
        n = config['segments']
        vertices = [[x+r*math.cos(k*math.tau/n),y+r*math.sin(k*math.tau/n),z+dz]
                    for dz,r in profile for k in range(n)]
        faces = [[j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k]
                 for j in range(len(profile)-1) for k in range(n)]
        faces += [list(range(n)),list(range((len(profile)-1)*n,len(profile)*n))]
        coords = [[[12+100*(vertices[i][0]-x+2)/4,12+100*(1-(vertices[i][2]-z)/profile[-1][0])]
                   for i in face] for face in faces]
        mesh(f"Beacon-{beacon['id']}-lens",vertices,faces,coords,icon,
             {'group':beacon['id'],'phase':beacon['phase']},'Frozen east beacon cluster [88,17,3,4]; non-lens pixels excluded, edge fill and transfer inferred')
        cube(f"Beacon-{beacon['id']}-base",[x-1.4,x+1.4,y-1.3,y+1.3,beacon['supportHeight'],z],(86,89,114,255))

    # Every non-light atlas region keeps its exact RGBA pixels.
    for region in paint['regions']:
        if not any(region['rect'] == tile for tile in modified):
            assert original.crop(region['rect']).tobytes() == atlas.crop(region['rect']).tobytes()
    atlas.save(output / 'car-atlas.png')
    write(output/'light-mesh-spec.json',{'source':str(source/'car.blend'),'removePrefix':'Blue-bar-',
                                       'objects':objects,'material':recipe['projection']['material']})
    write(output/'lights.json',{'schema':'tilefun-vehicle-lights-v1','channel':'emergencyLights','defaultEnabled':False,
          'periodSeconds':config['periodSeconds'],'pulseWindows':config['pulseWindows'],'peakGain':config['peakGain'],
          'tagPrefix':'tilefun_','lenses':lights,'housingPolicy':'Fixed and untagged',
          'stateOwner':'Future authoritative on/off state; shared presentation supplies time. No game control wired yet.'})
    write(output/'beacon-config.json',config)
    write(output/'paint-ownership.json',paint)
    recipe['projection']['sourceViews']={r['region']:[] if r['owner'] is None else [r['owner']] for r in paint['regions']}
    recipe['workingBlend']='car.blend'
    with (output/'refine.log').open('w',encoding='utf-8') as log:
        subprocess.run([str(blender),'--background','--factory-startup',str(source/'car.blend'),
                        '--python-exit-code','1','--python',str(HERE/'refine_ambulance_lights_blender.py'),
                        '--',str(output)],check=True,stdout=log,stderr=subprocess.STDOUT,cwd=ROOT)
    recipe['template']={'path':str((output/'car.blend').relative_to(ROOT)).replace('\\','/'),'sha256':digest(output/'car.blend')}
    write(output/'recipe.json',recipe)
    print(f'New roof-light refinement with immutable body/wheel/camera evidence: {output}')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=ROOT/'art-source/vehicle-models/ambulance/v1')
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--config',type=Path,default=HERE/'ambulance-lights.json')
    parser.add_argument('--blender',type=Path,required=True)
    args=parser.parse_args()
    refine(args.source.resolve(),args.out.resolve(),args.config.resolve(),args.blender.resolve())
