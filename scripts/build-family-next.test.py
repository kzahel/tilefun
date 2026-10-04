#!/usr/bin/env python3
"""Bounded exact-render and mutation tests for the E04/I02/E05 adapters."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

from PIL import Image


def import_script(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name+'.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


a = import_script('build-family-sheets')
n = import_script('build-family-next')


class NextFamilyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sheets = {row['id']:row for row in a.load(a.ROOT/'public/data/art-catalog.json')['sheets']}
        cls.images = {key:Image.open(a.ROOT/'public'/cls.sheets[key]['image']).convert('RGBA')
                      for key in ('me-complete','modern-interiors')}
        cls.packets = [a.load(a.PACKETS/name) for name in n.PACKET_NAMES]
        cls.families = n.build_next(a,cls.images,cls.sheets)

    def test_complete_card_and_record_coverage(self):
        self.assertEqual([f['id'] for f in self.families], ['plants-planters','bedroom','fences-gates'])
        cards = [[member for group in f['groups'] for member in group['members']] for f in self.families]
        self.assertEqual([len(c) for c in cards],[7,6,25])
        self.assertEqual([sum(len(v['recordIds']) for m in c for v in m['variants']) for c in cards],[19,18,27])
        for f in self.families:
            self.assertEqual(f['revision'],a.revision(f))
            self.assertEqual(f['status'],'proposed')
            self.assertEqual(len(f['sourcePins']),1)

    def test_plants_reconstruct_padding_and_keep_default_member_variants(self):
        f = self.families[0]
        self.assertTrue(all(c['kind']=='whole' for c in f['groups'][0]['members']))
        self.assertEqual([c['variants'][0]['recordIds'][0] for c in f['groups'][0]['members']],
                         [g['defaultMemberId'] for g in self.packets[0]['variantGroups']])
        values = {v['recordIds'][0]:v['sprite'] for c in f['groups'][0]['members'] for v in c['variants']}
        rows = {r['id']:r for r in self.packets[0]['candidates']}
        for key,size,offset in [('E04-03',[32,64],[0,11]),('E04-04',[32,64],[0,11]),('E04-15',[16,16],[1,2])]:
            image=values[key]
            self.assertEqual(image['size'],size)
            self.assertEqual(image['layers'][0]['at'],offset)
            self.assertNotIn('blend',image['layers'][0])
            a.check_pixels(image,rows[key]['normalizedRgbaSHA256'],self.images,key)
            wrong=copy.deepcopy(image)
            wrong['layers'][0]['at']=[0,0]
            self.assertNotEqual(a.normalized_bytes(a.render(image,self.images)),a.normalized_bytes(a.render(wrong,self.images)))
        upright=f['groups'][0]['members'][5]
        self.assertEqual([v['label'] for v in upright['variants']],['Red-brown pot','Tan pot with shorter leaves'])
        self.assertTrue(any('leaves' in fact['value'] for fact in upright['facts']))

    def test_bedroom_shadow_counterparts_components_and_bounded_source_over(self):
        f=self.families[1]
        self.assertEqual([v['id'] for v in f['variants']],[v for v,_ in n.SHADOWS])
        self.assertEqual([len(g['members']) for g in f['groups']],[4,2])
        for group in f['groups']:
            for card in group['members']:
                self.assertEqual([v['id'] for v in card['variants']],[v for v,_ in n.SHADOWS])
                self.assertEqual(card['kind'],'whole' if group['id']=='beds' else 'component')
        self.assertEqual([e['id'] for e in f['examples']],['bed-1-blue-blanket','bed-2-blue-blanket','bed-63-blue-blanket','bed-64-blue-blanket'])
        for e in f['examples']:
            self.assertEqual([v['id'] for v in e['variants']],[v for v,_ in n.SHADOWS])
            for v in e['variants']:
                image=v['sprite']
                self.assertEqual(image['size'],[48,48])
                self.assertEqual([layer['at'] for layer in image['layers']],[[0,0],[0,16]])
                self.assertTrue(all(layer['blend']=='over' for layer in image['layers']))
                wrong=copy.deepcopy(image)
                del wrong['layers'][1]['blend']
                self.assertNotEqual(a.normalized_bytes(a.render(image,self.images)),a.normalized_bytes(a.render(wrong,self.images)))
        row=self.packets[1]['candidates'][6]
        self.assertEqual(row['logicalNormalVendorIndex'],1)
        self.assertEqual(row['actualVendorIndex'],424)
        self.assertIn('black-shadow/bedroom/bedroom-black-shadow-singles-424',row['committedRendering']['packedKey'])
        covers=f['groups'][1]['members']
        for cover in covers:
            images=[a.normalized_bytes(a.render(v['sprite'],self.images)) for v in cover['variants']]
            self.assertEqual(len(set(images)),1)
            self.assertTrue(any('Cannot stand alone' in fact['value'] for fact in cover['facts']))

    def test_fence_unknown_gates_duplicate_exports_and_open_sections(self):
        f=self.families[2]
        self.assertEqual([len(g['members']) for g in f['groups']],[22,2,1])
        self.assertTrue(all(m['kind']=='component' for m in f['groups'][0]['members']))
        for gate in f['groups'][1]['members']:
            self.assertEqual(gate['kind'],'unknown')
            self.assertEqual([v['id'] for v in gate['variants']],['cool','warm'])
            self.assertTrue(any('stand alone is unknown' in fact['value'] for fact in gate['facts']))
        self.assertEqual(f['groups'][2]['members'][0]['kind'],'whole')
        self.assertEqual([e['id'] for e in f['examples']],[key for key,_ in n.FENCE_EXAMPLES])
        self.assertEqual([e.get('groupLabel') for e in f['examples']],[None]*7+['Open fence sections'])
        self.assertFalse(any('hedge-extension' in e['id'] for e in f['examples']))
        values={m['id']:m['variants'][0]['sprite'] for m in f['groups'][0]['members']}
        for left,right in [('E05-01','E05-11'),('E05-03','E05-12'),('E05-06','E05-13'),('E05-08','E05-14')]:
            self.assertEqual(a.normalized_bytes(a.render(values[left],self.images)),a.normalized_bytes(a.render(values[right],self.images)))
        for e in f['examples'][3:7]:
            self.assertEqual(e['variants'][0]['sprite']['size'],[16,32])
            self.assertEqual([layer['at'] for layer in e['variants'][0]['sprite']['layers']],[[0,0],[0,16]])

    def test_no_ignored_original_reads_or_research_helper_execution(self):
        read_bytes,read_text=Path.read_bytes,Path.read_text
        paths=[]
        def guard(method):
            def checked(path,*args,**kwargs):
                paths.append(path.resolve())
                self.assertFalse(path.resolve().is_relative_to((a.ROOT/'assets').resolve()))
                return method(path,*args,**kwargs)
            return checked
        with patch.object(Path,'read_bytes',guard(read_bytes)),patch.object(Path,'read_text',guard(read_text)):
            self.assertEqual(n.build_next(a,self.images,self.sheets),self.families)
        self.assertTrue(paths)

    def test_changed_review_and_helper_pins_rejected(self):
        for name in ['E04-plants-planters-review.md','I02-bedroom-review.md','E05-fences-gates-review.md']:
            pins=dict(n.PINS);pins[name]='0'*64
            with self.subTest(name=name),patch.object(n,'PINS',pins),self.assertRaisesRegex(ValueError,'proposal/review changed'):
                n.build_next(a,self.images,self.sheets)
        packet=copy.deepcopy(self.packets[1]);packet['pins']['helper']['sha256']='0'*64
        original=a.load
        def altered(path):
            return packet if path.name=='I02-bedroom.json' else original(path)
        with patch.object(a,'load',altered),self.assertRaisesRegex(ValueError,'input pin changed'):
            n.build_next(a,self.images,self.sheets)

    def test_plant_padding_lineage_and_unknown_geometry_mutation_guards(self):
        for mutate,message in [
            (lambda p:p['candidates'][2]['committedRendering'].update(offsetXY=[0,0]),'transparent-frame restoration changed'),
            (lambda p:p['candidates'][2]['committedRendering'].update(operation='direct-crop'),'full-frame lineage changed'),
            (lambda p:p['candidates'][0]['geometry'].update(collision=[1,1]),'unknown gameplay geometry changed'),
            (lambda p:p['candidates'][0]['topology'].update(standaloneEligibility='forbidden'),'whole-object role changed'),
            (lambda p:p['candidates'][0]['alphaVisibleRect'].__setitem__(0,1),'alpha bounds changed'),
        ]:
            packet=copy.deepcopy(self.packets[0]);mutate(packet)
            with self.subTest(message=message),self.assertRaisesRegex(ValueError,message):
                n.build_plants(a,packet,self.images,self.sheets)

    def test_bedroom_required_underlay_offset_counterpart_and_alias_mutation_guards(self):
        for mutate,message in [
            (lambda p:p['candidates'][4]['topology'].update(requiredNeighbors=[]),'required underlay changed'),
            (lambda p:p['presentation']['cards'][4].update(section='Complete beds'),'card whole/component role changed'),
            (lambda p:p['candidates'][4]['topology'].update(compatibleMembers=['I02-03']),'required underlay changed'),
            (lambda p:p['assemblyExperiments'][0]['placements'][1].update(targetOffset=[0,12]),'overlay offset/order changed'),
            (lambda p:p['candidates'][6].update(actualVendorIndex=1),'actual counterpart identity changed'),
            (lambda p:p['candidates'][0]['committedRendering']['rect'].__setitem__(0,p['candidates'][0]['committedRendering']['rect'][0]+1),'packed alias lineage changed'),
        ]:
            packet=copy.deepcopy(self.packets[1]);mutate(packet)
            with self.subTest(message=message),self.assertRaisesRegex(ValueError,message):
                n.build_bedroom(a,packet,self.images,self.sheets)

    def test_fence_standalone_recipe_and_unsupported_example_mutation_guards(self):
        for mutate,message in [
            (lambda p:p['candidates'][0]['topology'].update(standaloneEligibility='allowed'),'standalone rule changed'),
            (lambda p:p['presentationProposal']['cards'][0].update(kind='whole'),'card whole/component role changed'),
            (lambda p:p['candidates'][22]['topology'].update(standaloneEligibility='allowed'),'standalone rule changed'),
            (lambda p:p['experiments']['assemblies'][0]['portEvaluation']['unmatchedPorts'].append({'edge':'top'}),'unaccounted open cuts'),
            (lambda p:p['experiments']['assemblies'][0]['renderRecipe']['placements'][0].update(at=[1,0]),'recipe hash changed'),
            (lambda p:p['presentationProposal']['positiveExampleIds'].append('garden-gate-hedge-extension'),'bounded example list changed'),
        ]:
            packet=copy.deepcopy(self.packets[2]);mutate(packet)
            with self.subTest(message=message),self.assertRaisesRegex(ValueError,message):
                n.build_fences(a,packet,self.images,self.sheets)

    def test_changed_public_source_pixels_and_normalization(self):
        image=Image.new('RGBA',(2,1),(123,45,67,0));image.putpixel((1,0),(5,6,7,100))
        self.assertEqual(n.normalized_data(image),a.normalized_bytes(image))
        images=dict(self.images);images['modern-interiors']=images['modern-interiors'].copy()
        images['modern-interiors'].putpixel((0,0),(255,0,0,255))
        with self.assertRaisesRegex(ValueError,'source pixels changed'):
            n.build_bedroom(a,self.packets[1],images,self.sheets)


if __name__=='__main__':
    unittest.main()
