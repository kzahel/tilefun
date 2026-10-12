"""Exact train bundle and actual exported wheel-contract regression checks."""
import json
from pathlib import Path
import shutil
import struct
import tempfile
import unittest

from pipeline import ROOT, digest, read, write
from verify_train_bundles import verify


class TrainBundleTests(unittest.TestCase):
    def test_retained_three_carriages_have_embedded_atlases_and_connected_eight_wheel_bogies(self):
        results=[r for r in verify(ROOT) if r['assetId'] in ['train-blue-rear','train-blue-middle','train-blue-front']]
        results=results[-3:]
        self.assertEqual([r['assetId'] for r in results],['train-blue-rear','train-blue-middle','train-blue-front'])
        self.assertEqual(sum(r['wheels'] for r in results),24)

    def test_exported_radius_change_is_rejected_even_with_reconciled_file_hash(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);catalog=read(ROOT/'art-source/train-models/catalog.json')
            catalog['bundles']=catalog['bundles'][:1]
            files=catalog['dependencies']+catalog['sharedFiles']+catalog['bundles'][0]['files']
            for entry in files:
                target=root/entry['path'];target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(ROOT/entry['path'],target)
            bundle=catalog['bundles'][0];glb=root/bundle['glb'];raw=glb.read_bytes()
            length=struct.unpack_from('<I',raw,12)[0];model=json.loads(raw[20:20+length])
            roll=next(n for n in model['nodes'] if n.get('name')=='Wheel_FL_Roll')
            roll['extras']['wheel_radius']=6
            data=json.dumps(model,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
            binary=raw[20+length:]
            glb.write_bytes(struct.pack('<III',0x46546C67,2,20+len(data)+len(binary))+struct.pack('<II',len(data),0x4E4F534A)+data+binary)
            for entry in bundle['files']:
                if entry['path']==bundle['glb']:entry['sha256']=digest(glb)
            write(root/'art-source/train-models/catalog.json',catalog)
            with self.assertRaisesRegex(ValueError,'axis/radius changed'):verify(root)


if __name__=='__main__':unittest.main()
