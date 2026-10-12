"""Verify exact train files, embedded atlas, eight wheels and connected bogie hierarchy."""
import argparse
from io import BytesIO
import json
from pathlib import Path
import struct

from PIL import Image

from pipeline import ROOT, digest, read
from verify_bundles import local


def verify(root):
    catalog=read(root/'art-source/train-models/catalog.json')
    for file in catalog['dependencies']+catalog['sharedFiles']:
        if digest(local(root,file['path']))!=file['sha256']:raise ValueError('Train dependency changed: '+file['path'])
    reports=[]
    for bundle in catalog['bundles']:
        for file in bundle['files']:
            if digest(local(root,file['path']))!=file['sha256']:raise ValueError('Retained train asset changed: '+file['path'])
        source=local(root,bundle['source']);recipe=read(source/'recipe.json');rig=read(source/'rig.json')
        if digest(local(root,recipe['source']['image']))!=recipe['source']['sha256']:raise ValueError('Source bank changed')
        if digest(local(root,recipe['template']['path']))!=recipe['template']['sha256']:raise ValueError('Retained train scene changed')
        for view in recipe['views']:
            if digest(local(source,view['source']))!=view['sourceSha256']:raise ValueError('Frozen train reference changed')
        raw=local(root,bundle['glb']).read_bytes();magic,version,size=struct.unpack_from('<III',raw)
        if (magic,version,size)!=(0x46546C67,2,len(raw)):raise ValueError('Invalid GLB')
        json_size,kind=struct.unpack_from('<II',raw,12)
        if kind!=0x4E4F534A:raise ValueError('GLB JSON missing')
        model=json.loads(raw[20:20+json_size]);offset=20+json_size
        binary_size,kind=struct.unpack_from('<II',raw,offset)
        if kind!=0x004E4942 or offset+8+binary_size!=len(raw):raise ValueError('GLB binary missing')
        if any('uri' in b for b in model['buffers']) or len(model['images'])!=1:raise ValueError('Train needs external resources')
        view=model['bufferViews'][model['images'][0]['bufferView']];start=view.get('byteOffset',0)
        embedded=Image.open(BytesIO(raw[offset+8+start:offset+8+start+view['byteLength']])).convert('RGBA')
        atlas=Image.open(source/'car-atlas.png').convert('RGBA')
        if embedded.size!=atlas.size or embedded.tobytes()!=atlas.tobytes():raise ValueError('Embedded train atlas changed')
        triangles=sum(model['accessors'][p['indices']]['count']//3 for m in model['meshes'] for p in m['primitives'])
        if {'meshObjects':len(model['meshes']),'triangles':triangles}!=bundle['geometry']:raise ValueError('Train geometry audit differs')
        names={n['name']:i for i,n in enumerate(model['nodes']) if 'name' in n}
        parents={child:i for i,n in enumerate(model['nodes']) for child in n.get('children',[])}
        if len(names)!=len(model['nodes']):raise ValueError('Missing/duplicate train node identities')
        if parents[names['Body']]!=names['TrainRoot']:raise ValueError('Detached train body')
        ids={w['id'] for w in rig['wheels']}
        actual={n[6:-5] for n in names if n.startswith('Wheel_') and n.endswith('_Roll')}
        if len(rig['wheels'])!=8 or ids!=actual:raise ValueError('Train wheel set changed')
        def world_translation(i):
            result=[0,0,0]
            while True:
                n=model['nodes'][i]
                if 'matrix' in n or 'rotation' in n or 'scale' in n:raise ValueError('Unexpected rest transform')
                result=[a+b for a,b in zip(result,n.get('translation',[0,0,0]))]
                if i not in parents:return result
                i=parents[i]
        for w in rig['wheels']:
            roll,steer,bogie=[names[w[k]] for k in ['roll','steer','bogie']]
            node=model['nodes'][roll]
            if parents[roll]!=steer or parents[steer]!=bogie or parents[bogie]!=names['Body'] or len(node.get('children',[]))!=2:raise ValueError('Wheel/bogie hierarchy changed')
            if node['extras']['wheel_radius']!=w['radius'] or node['extras']['roll_axis_gltf']!=rig['rollAxisGltf']:raise ValueError('Wheel axis/radius changed')
            x,y,z=w['center']
            if any(abs(a-b)>1e-5 for a,b in zip(world_translation(steer),[x,z,-y])):raise ValueError('Train axle center changed')
        proof=read(source/'body-wheel-clearance.json')
        if proof['glbSha256']!=digest(local(root,bundle['glb'])) or not proof['bodyTriangleIntoTireRejected']:raise ValueError('Clearance proof mismatch')
        reports.append({'assetId':bundle['assetId'],'meshes':len(model['meshes']),'triangles':triangles,'wheels':len(ids),'embeddedAtlas':True,'bogieParents':True})
    return reports


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=ROOT)
    args=p.parse_args();print(json.dumps(verify(args.root.resolve()),indent=2))
