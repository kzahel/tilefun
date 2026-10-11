"""Build a new ambulance family scene from frozen sprites; never overwrite a run.

Host Python/Pillow prepares source-owned UV paint and explicit inferred surfaces.
Blender authors actual mesh topology and rigid wheel parents in a fresh process.
"""
import argparse
from collections import deque
import math
from pathlib import Path
import subprocess

from PIL import Image

from pipeline import HERE, ROOT, digest, initialize, read, vehicle_spec, write
from projection_math import project

MATERIAL = 'Ambulance palette · cleaned UV atlas'
INK = (58, 58, 80, 255)


def prepare(output, config_path):
    config = read(config_path)
    if config['schema'] != 'tilefun-ambulance-family-v1':
        raise ValueError('Select an ambulance family configuration.')
    recipe = initialize(vehicle_spec('ambulance'), output, {'cameras': config['cameras']})
    refs = {}
    for view in recipe['views']:
        image = Image.new('RGBA', tuple(recipe['canvas']))
        image.alpha_composite(Image.open(output / view['source']).convert('RGBA'), tuple(view['offset']))
        # Unseen extrapolation is an authored fill, not recovered source coverage.
        queue = deque()
        for y in range(image.height):
            for x in range(image.width):
                if image.getpixel((x, y))[3] > 200:
                    queue.append((x, y))
        filled = image.copy()
        while queue:
            x, y = queue.popleft()
            for nx, ny in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)]:
                if 0 <= nx < image.width and 0 <= ny < image.height and filled.getpixel((nx, ny))[3] == 0:
                    filled.putpixel((nx, ny), filled.getpixel((x, y)))
                    queue.append((nx, ny))
        refs[view['id']] = filled

    atlas = Image.new('RGBA', (1024, 1024), INK)
    objects, regions = [], []
    owners = {}

    def allocate(name, owner):
        slot = len(regions)
        if slot >= 64:
            raise ValueError('Ambulance atlas is full; extend its island layout explicitly.')
        x0, y0 = (slot % 8)*128, (slot // 8)*128
        if owner:
            atlas.paste(refs[owner], (x0, y0))
        regions.append({'region': name, 'rect': [x0, y0, x0+128, y0+128], 'owner': owner,
                        'outsideSource': 'nearest opaque source edge is explicitly inferred fill'})
        owners[name] = [owner] if owner else []
        return x0, y0

    def uv_at(tile, pixel):
        return [(tile[0]+pixel[0])/1024, 1-(tile[1]+pixel[1])/1024]

    def surface(name, verts, owner=None, color=None, parent='Body'):
        tile = allocate(name, owner)
        if color:
            atlas.paste(tuple(color), (tile[0], tile[1], tile[0]+128, tile[1]+128))
            pixels = [[12,112],[112,112],[112,12],[12,12]]
        else:
            pixels = [project(v, config['cameras'][owner]) for v in verts]
        objects.append({'name': name, 'region': name, 'vertices': verts,
                        'faces': [list(range(len(verts)))],
                        'uvs': [[uv_at(tile, p) for p in pixels]], 'parent': parent})

    def box(name, xa, xb, width, za, zb, colors=None):
        faces = [
            ('top', [[xa,-width,zb],[xb,-width,zb],[xb,width,zb],[xa,width,zb]], 'north'),
            ('east', [[xa,width,za],[xb,width,za],[xb,width,zb],[xa,width,zb]], 'east'),
            ('west', [[xb,-width,za],[xa,-width,za],[xa,-width,zb],[xb,-width,zb]], 'west'),
            ('front', [[xa,-width,za],[xa,width,za],[xa,width,zb],[xa,-width,zb]], 'south'),
            ('rear', [[xb,width,za],[xb,-width,za],[xb,-width,zb],[xb,width,zb]], 'north')]
        for k, (part, verts, owner) in enumerate(faces):
            surface(f'{name}-{part}', verts, owner if not colors else None,
                    colors[k] if colors else None)
            if name.startswith('Blue-bar') and part in ['top','front','rear']:
                # Rectify the observed segmented blue strip; keep one coherent
                # paint pattern instead of switching textures with the view.
                tile=regions[-1]['rect']
                strip=refs['north'].crop((47,9,81,12)).resize((101,101),Image.Resampling.NEAREST)
                atlas.paste(strip,(tile[0]+12,tile[1]+12))
                coord=[]
                for x,y,z in verts:
                    u=(y/width+1)/2
                    v=(x-xa)/(xb-xa) if part=='top' else (zb-z)/(zb-za)
                    coord.append(uv_at(tile,[12+100*u,12+100*v]))
                objects[-1]['uvs']=[coord]
                regions[-1]['paintSource']='Frozen north light-bar strip [7,9,34,3], rectified to this face; inferred transfer'

    b, c, w = config['box'], config['cab'], config['wheels']
    for side, owner in [(1, 'east'), (-1, 'west')]:
        # Concave side polygons have actual semicircular arch openings.
        for name, xa, xb, top, axle in [
            ('Box', b['front'], b['rear'], [(b['front'], b['roof']), (b['rear'], b['roof'])], w['rearAxle']),
            ('Cab', c['nose'], b['front'], [(c['nose'],c['noseHeight']),
             (c['screenBottom'],c['screenBottomHeight']), (c['roofFront'],c['roofFrontHeight']),
             (c['roofRear'],c['roofRearHeight'])], w['frontAxle'])]:
            outline = [(xa,b['base'])]+top+[(xb,b['base']), (axle+w['archRadius'],b['base'])]
            outline += [(axle+w['archRadius']*math.cos(k*math.pi/16),
                         w['radius']+w['archRadius']*math.sin(k*math.pi/16)) for k in range(17)]
            outline.append((xa,b['base']))
            width = b['halfWidth'] if name == 'Box' else c['halfWidth']
            surface(f'{name}-{owner}', [[x,side*width,z] for x,z in outline[:-1]], owner)
        # Thin raised fender lips stay on the body, never under the rotating wheel.
        for prefix, axle in [('F',w['frontAxle']),('R',w['rearAxle'])]:
            verts = []
            for radius in [w['archRadius']-.15,w['fenderOuterRadius']]:
                verts.extend([[axle+radius*math.cos(k*math.pi/16), side*(b['halfWidth']+.15),
                               w['radius']+radius*math.sin(k*math.pi/16)] for k in range(17)])
            tile = allocate(f'Fender-{prefix}-{owner}', owner)
            faces = [[k,k+1,k+18,k+17] for k in range(16)]
            objects.append({'name': f'Fender-{prefix}-{owner}', 'region': f'Fender-{prefix}-{owner}',
                            'vertices': verts, 'faces': faces,
                            'uvs': [[uv_at(tile,project(verts[i],config['cameras'][owner])) for i in face] for face in faces],
                            'parent': 'Body'})

    bw,cw=b['halfWidth'],c['halfWidth']
    surface('Box-roof', [[b['front'],-bw,b['roof']],[b['rear'],-bw,b['roof']],
                        [b['rear'],bw,b['roof']],[b['front'],bw,b['roof']]], 'north')
    surface('Rear-doors', [[b['rear'],bw,4],[b['rear'],-bw,4],
                          [b['rear'],-bw,b['roof']],[b['rear'],bw,b['roof']]], 'north')
    surface('Box-front-wall', [[b['front'],-bw,b['base']],[b['front'],bw,b['base']],
                              [b['front'],bw,b['roof']],[b['front'],-bw,b['roof']]], 'south')
    surface('Cab-roof', [[c['roofRear'],cw,c['roofRearHeight']],[c['roofRear'],-cw,c['roofRearHeight']],
                        [c['roofFront'],-cw+1,c['roofFrontHeight']],[c['roofFront'],cw-1,c['roofFrontHeight']]], 'south')
    surface('Windshield-and-frame', [[c['roofFront'],cw-1,c['roofFrontHeight']],
            [c['roofFront'],-cw+1,c['roofFrontHeight']],[c['screenBottom'],-cw,c['screenBottomHeight']],
            [c['screenBottom'],cw,c['screenBottomHeight']]], 'south')
    surface('Hood', [[c['screenBottom'],cw,c['screenBottomHeight']],
                    [c['screenBottom'],-cw,c['screenBottomHeight']],
                    [c['nose'],-c['noseHalfWidth'],c['noseHeight']],
                    [c['nose'],c['noseHalfWidth'],c['noseHeight']]], 'south')
    surface('Front-fascia', [[c['nose'],c['noseHalfWidth'],b['base']],
                            [c['nose'],-c['noseHalfWidth'],b['base']],
                            [c['nose'],-c['noseHalfWidth'],c['noseHeight']],
                            [c['nose'],c['noseHalfWidth'],c['noseHeight']]], 'south')
    surface('Underfloor', [[c['nose'],-cw,b['base']],[b['rear'],-bw,b['base']],
                          [b['rear'],bw,b['base']],[c['nose'],cw,b['base']]], color=INK)
    surface('Rear-step', [[50,-20,4],[54,-20,4],[54,20,4],[50,20,4]], 'north')
    surface('Rear-step-face', [[54,20,2],[54,-20,2],[54,-20,4],[54,20,4]], 'north')
    for side,owner in [(1,'east'),(-1,'west')]:
        surface(f'Rear-rail-{owner}', [[52,side*18.5,6],[55,side*18.5,6],
                                      [55,side*18.5,12],[52,side*18.5,12]], owner)
        surface(f'Rear-rail-back-{owner}', [[54,side*18,4],[54,side*21,4],
                                           [54,side*21,12],[54,side*18,12]], 'north')
    for k,(xa,xb) in enumerate([(-14,-2),(28,40)]):
        box(f'Roof-panel-{k}',xa,xb,17.9,46,48)
    for k,(xa,xb) in enumerate([(-21,-17),(45,49)]):
        box(f'Blue-bar-{k}',xa,xb,18,46,52,
            [(80,167,232,255),(73,149,227,255),(61,86,210,255),(61,86,210,255),(73,149,227,255)])
    for side in [-1,1]:
        y = side*21.5
        # Mirrors use explicit source-palette inferred paint on otherwise unseen faces.
        surface(f'Mirror-{side}', [[-43,y,16],[-46,y,16],[-46,y,18],[-43,y,18]], color=(178,174,203,255))
        surface(f'Mirror-arm-{side}', [[-44,side*17,17],[-44,y,17],[-44,y,18],[-44,side*17,18]], color=INK)

    wheels = []
    for prefix,axle in [('F',w['frontAxle']),('R',w['rearAxle'])]:
        for side,suffix,owner in [(-1,'L','west'),(1,'R','east')]:
            ident = prefix+suffix
            center = [axle,side*w['halfWidthCenter'],w['radius']]
            wheels.append({'id':ident,'center':center,'radius':w['radius'],'steering':prefix=='F',
                           'steer':f'Wheel_{ident}_Steer','roll':f'Wheel_{ident}_Roll'})
            for part,radius,halfdepth in [('Tire',w['radius'],w['tireWidth']/2),('Hub',w['hubRadius'],.25)]:
                offset = 0 if part=='Tire' else side*(w['tireWidth']/2+.3)
                verts = [[radius*math.cos(k*math.tau/24),offset+depth,
                          radius*math.sin(k*math.tau/24)] for depth in [-halfdepth,halfdepth] for k in range(24)]
                tile = allocate(f'{part}-{ident}',owner)
                faces,uvs = [],[]
                for k in range(24):
                    faces.append([k,(k+1)%24,(k+1)%24+24,k+24])
                    x,y= (k % 16)*7,112+(k//16)*7
                    color = (70,70,94,255) if part=='Tire' else (108,110,133,255)
                    atlas.paste(color,(tile[0]+x,tile[1]+y,tile[0]+x+6,tile[1]+y+6))
                    uvs.append([uv_at(tile,p) for p in [[x,y],[x+5,y],[x+5,y+5],[x,y+5]]])
                for end in [0,24]:
                    face=list(range(end,end+24))
                    faces.append(face)
                    if (end==24)==(side==1):
                        uvs.append([uv_at(tile,project([verts[i][k]+center[k] for k in range(3)],config['cameras'][owner])) for i in face])
                    else:
                        atlas.paste(INK,(tile[0]+114,tile[1]+112,tile[0]+128,tile[1]+128))
                        uvs.append([uv_at(tile,[121+5*math.cos(k*math.tau/24),120+5*math.sin(k*math.tau/24)]) for k in range(24)])
                objects.append({'name':f'{part}_{ident}','region':f'{part}-{ident}','vertices':verts,'faces':faces,'uvs':uvs,
                                'parent':f'Wheel_{ident}_Roll'})

    atlas.save(output/'car-atlas.png')
    write(output/'mesh-spec.json',{'schema':'tilefun-authored-mesh-v1','material':MATERIAL,
          'objects':objects,'wheels':wheels,'units':'world pixels','up':[0,0,1],'forward':[-1,0,0]})
    write(output/'paint-ownership.json',{'regions':regions,
          'note':'Owned source-image affine UVs on fitted surfaces; nearest-edge fill and colored hidden faces are inferred. Raw ray-visible projection and coverage are retained separately.'})
    write(output/'family-config.json',config)
    recipe.update({'workingBlend':'car.blend','projection':{'atlasSize':1024,'material':MATERIAL,
                   'textureNode':'Clean atlas','sourceViews':owners},
                   'pixelStyle':{'outline':'inner','outlineColor':list(INK[:3]),'logicalPixelWidth':1}})
    write(output/'recipe.json',recipe)
    write(output/'rig.json',{'root':'CarRoot','body':'Body','units':'world pixels','forward':[-1,0,0],
          'up':[0,0,1],'rollAxisBlender':[0,1,0],'rollAxisGltf':[0,0,-1],
          'drivingRule':'angle=-signedForwardDistance/radius; signedForwardDistance positive along -X',
          'wheels':wheels,'steeringClearance':'not yet qualified'})
    return recipe


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--blender',type=Path,required=True)
    parser.add_argument('--config',type=Path,default=HERE/'ambulance-family.json')
    args=parser.parse_args()
    output=args.out.resolve()
    prepare(output,args.config.resolve())
    with (output/'build.log').open('w',encoding='utf-8') as log:
        subprocess.run([str(args.blender.resolve()),'--background','--factory-startup',
                        '--python-exit-code','1','--python',str(HERE/'build_ambulance.py'),
                        '--',str(output)],check=True,stdout=log,stderr=subprocess.STDOUT,cwd=ROOT)
    recipe=read(output/'recipe.json')
    recipe['template']={'path':str((output/'car.blend').relative_to(ROOT)),
                        'sha256':digest(output/'car.blend')}
    write(output/'recipe.json',recipe)
    print(f'Authored ambulance scene, owned UV atlas and rigid wheel metadata: {output}')
