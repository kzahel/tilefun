#!/usr/bin/env python3
"""Contract tests for first-pass sheets; test source/placement safety, not guessed names."""
import copy
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from PIL import Image


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


A = module('family_helpers', 'build-family-sheets.py')
B = module('broad_adapter', 'build-family-broad.py')


class BroadContractTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        source = self.root / 'public/test.png'
        source.parent.mkdir()
        image = Image.new('RGBA', (2, 2), (200, 30, 20, 128))
        image.putpixel((0, 0), (0, 0, 0, 0))
        image.save(source)
        pin = A.sha(source.read_bytes())
        self.a = SimpleNamespace(**{**vars(A), 'ROOT': self.root})
        self.images = {'modern-interiors': image}
        self.sheets = {'modern-interiors': {'id': 'modern-interiors', 'image': 'test.png', 'width': 2, 'height': 2, 'fingerprint': pin}}
        index = self.root / 'public/data/modern-interiors-atlas.json'
        index.parent.mkdir()
        index.write_text(json.dumps({'entries': [
            {'key': 'right', 'rect': [0,0,2,2], 'sourceRect': [0,0,2,2], 'sourcePath': 'assets/right.png'},
            {'key': 'wrong-name', 'rect': [0,0,2,2], 'sourceRect': [0,0,2,2], 'sourcePath': 'assets/other.png'}]}))
        self.packet = {'schemaVersion':1,'packetId':'B01','familyId':'kitchens','title':'Test kitchen','description':'First-pass proposal.',
            'facts': [], 'scope': {}, 'groups':[{'id':'pieces','title':'Pieces'}],
            'sourcePins':[{'sheetId':'modern-interiors','path':'public/test.png','sha256':pin}],
            'sourceIndexPins':[{'path':'public/data/modern-interiors-atlas.json','sha256':A.sha(index.read_bytes())}],
            'records':[{'id':'B01-001','label':'Possible trim','kind':'component',
                'source':{'sheetId':'modern-interiors','rect':[0,0,2,2],'frameSize':[2,2],'offsetXY':[0,0],
                          'pixelSha256':A.sha(A.normalized_bytes(image)),'packedKey':'right','originalPath':'assets/right.png'},
                'topology':{'standalone':'forbidden','requiredNeighbors':['Needs its matching cabinet.'],'limits':'No game geometry.'},
                'uncertainty':'Could be a trim piece.'}],
            'cards':[{'id':'piece','groupId':'pieces','label':'Possible trim','kind':'component','facts':[],
                'variants':[{'id':'original','label':'Original','recordId':'B01-001'}]}]}

    def build(self, packet=None):
        return B.build_packet(self.a, packet or self.packet, self.images, self.sheets)

    def reject(self, change, match):
        packet = copy.deepcopy(self.packet)
        change(packet)
        with self.assertRaisesRegex(ValueError, match):
            self.build(packet)

    def test_uncertainty_and_required_joins_survive_into_the_sheet(self):
        member = self.build()['groups'][0]['members'][0]
        self.assertEqual(member['kind'], 'component')
        values = [f['value'] for f in member['facts']]
        self.assertIn('Cannot stand alone; combine with matching pieces.', values)
        self.assertIn('Needs its matching cabinet.', values)
        self.assertIn('Could be a trim piece.', values)

    def test_owner_correction_keeps_exact_source_and_membership(self):
        before = copy.deepcopy(self.packet)
        correction = {'recordId': 'B01-001', 'cardId': 'piece',
                      'recordChanges': {'label': 'Corrected component'},
                      'cardChanges': {'label': 'Corrected component'}}
        B.apply_correction(self.a, self.packet, correction)
        self.assertEqual(self.packet['records'][0]['source'], before['records'][0]['source'])
        self.assertEqual(self.packet['cards'][0]['variants'], before['cards'][0]['variants'])
        self.assertNotEqual(self.build()['revision'], self.build(before)['revision'])
        correction['recordChanges']['source'] = {}
        with self.assertRaisesRegex(ValueError, 'cannot replace artwork'):
            B.apply_correction(self.a, self.packet, correction)

    def test_named_alias_is_checked_even_if_pixels_are_identical(self):
        self.reject(lambda p:p['records'][0]['source'].update(packedKey='wrong-name'), 'source identity')

    def test_standalone_reclassification_and_hidden_records_are_rejected(self):
        self.reject(lambda p:p['cards'][0].update(kind='whole'), 'incompatible standalone')
        self.reject(lambda p:p['records'][0]['topology'].update(standalone='allowed'), 'standalone role')
        self.reject(lambda p:p['cards'].clear(), 'records missing')
        self.reject(lambda p:p['cards'].append({**p['cards'][0], 'id':'copy'}), 'records missing or duplicated')

    def test_pixels_padding_and_source_bytes_fail_closed(self):
        self.reject(lambda p:p['records'][0]['source'].update(pixelSha256='0'*64), 'Pixel hash')
        self.reject(lambda p:p['records'][0]['source'].update(offsetXY=[0,1]), 'Destination rectangle')
        self.reject(lambda p:p['sourcePins'][0].update(sha256='0'*64), 'source pin')

    def test_required_unknown_roles_are_not_silently_whole(self):
        self.packet['records'][0].update(kind='unknown')
        self.packet['records'][0]['topology'].update(standalone='unknown')
        self.packet['cards'][0].update(kind='unknown')
        self.assertIn('Standalone use is uncertain.', [f['value'] for f in self.build()['groups'][0]['members'][0]['facts']])

    def test_native_frame_replacement_does_not_square_translucent_alpha(self):
        sprite = self.build()['groups'][0]['members'][0]['variants'][0]['sprite']
        self.assertEqual(A.render(sprite,self.images).getpixel((1,1)), (200,30,20,128))

    def test_examples_replay_frozen_native_source_over_pixels(self):
        self.packet['examples']=[{'id':'pair','label':'Proposed pair','description':'Proposed pairing.', 'size':[4,2],
            'placements':[{'recordId':'B01-001','at':[0,0]},{'recordId':'B01-001','at':[2,0]}]}]
        out=Image.new('RGBA',(4,2));out.alpha_composite(self.images['modern-interiors'],(0,0));out.alpha_composite(self.images['modern-interiors'],(2,0))
        self.packet['examples'][0]['pixelSha256']=A.sha(A.normalized_bytes(out))
        self.assertEqual(len(self.build()['examples']),1)
        self.reject(lambda p:p['examples'][0].update(pixelSha256='0'*64),'Pixel hash')


if __name__ == '__main__':
    unittest.main()
