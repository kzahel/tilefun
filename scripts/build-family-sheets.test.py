#!/usr/bin/env python3
"""Regression checks for the committed-only family-sheet adapter."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

from PIL import Image

SCRIPT = Path(__file__).with_name('build-family-sheets.py')
SPEC = importlib.util.spec_from_file_location('family_sheets', SCRIPT)
ADAPTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ADAPTER)


class FamilySheetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = ADAPTER.build()

    def test_check_is_reproducible_and_does_not_write(self):
        before = ADAPTER.OUTPUT.read_bytes(), ADAPTER.OUTPUT.stat().st_mtime_ns
        result = subprocess.run([sys.executable, str(SCRIPT), '--check'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(before, (ADAPTER.OUTPUT.read_bytes(), ADAPTER.OUTPUT.stat().st_mtime_ns))

    def test_build_never_reads_ignored_originals(self):
        read_bytes, read_text = Path.read_bytes, Path.read_text

        def guard(method):
            def checked(path, *args, **kwargs):
                self.assertFalse(path.resolve().is_relative_to(ADAPTER.ROOT / 'assets'), str(path))
                return method(path, *args, **kwargs)
            return checked

        with patch.object(Path, 'read_bytes', guard(read_bytes)), patch.object(Path, 'read_text', guard(read_text)):
            self.assertEqual(ADAPTER.build(), self.catalog)

    def test_transparent_patch_replaces_prior_pixels(self):
        source = Image.new('RGBA', (2, 1))
        source.putpixel((0, 0), (255, 0, 0, 255))
        source.putpixel((1, 0), (0, 0, 0, 0))
        sprite = {'size': [1, 1], 'layers': [
            {'sheetId': 'test', 'rect': [0, 0, 1, 1], 'at': [0, 0]},
            {'sheetId': 'test', 'rect': [1, 0, 1, 1], 'at': [0, 0]},
        ]}
        self.assertEqual(ADAPTER.render(sprite, {'test': source}).getpixel((0, 0)), (0, 0, 0, 0))
        sprite['layers'][1]['at'] = [1, 0]
        with self.assertRaisesRegex(ValueError, 'Destination rectangle'):
            ADAPTER.render(sprite, {'test': source})

    def test_public_pixel_and_proposal_tampering_is_rejected(self):
        original = ADAPTER.sha
        exteriors = next(s for s in self.catalog['sources'] if s['id'] == 'me-complete')['fingerprint']
        for target, message in [(exteriors, 'Pinned public source'),
                                (ADAPTER.PINS['P01-trees.json'], 'Pinned proposal/review')]:
            with self.subTest(target=target):
                with patch.object(ADAPTER, 'sha', lambda raw: '0' * 64 if original(raw) == target else original(raw)):
                    with self.assertRaisesRegex(ValueError, message):
                        ADAPTER.build()
        with self.assertRaisesRegex(ValueError, 'Pixel hash mismatch'):
            ADAPTER.check_pixels(ADAPTER.sprite('test', [0, 0, 1, 1]), '0' * 64,
                                 {'test': Image.new('RGBA', (1, 1))}, 'test')

    def test_all_records_and_cabinet_partial_restrictions_survive(self):
        counts = {}
        for family in self.catalog['families']:
            records = [record for group in family['groups'] for member in group['members']
                       for variant in member['variants'] for record in variant['recordIds']]
            self.assertEqual(len(records), len(set(records)))
            counts[family['id']] = len(records)
            self.assertEqual(family['status'], 'proposed')
            self.assertEqual(family['revision'], ADAPTER.revision(family))
        self.assertEqual(counts, {'cabinets': 27, 'trees': 29, 'scrapyard': 29})
        cabinets = self.catalog['families'][0]
        parts = next(g['members'] for g in cabinets['groups'] if g['id'] == 'components')
        self.assertEqual([m['number'] for m in parts], [41, 42, 43, 44])
        for part in parts:
            self.assertEqual(part['kind'], 'component')
            self.assertEqual(len(part['variants']), 3)
            self.assertIn('Cannot stand alone in any shadow style.', [f['value'] for f in part['facts']])
        self.assertEqual(self.catalog['revision'], ADAPTER.revision(self.catalog))
        changed = copy.deepcopy(cabinets)
        changed['groups'][1]['members'][0]['facts'][0]['value'] = 'Standalone'
        self.assertNotEqual(changed['revision'], ADAPTER.revision(changed))

    def test_component_requirements_do_not_spread_to_uncertain_loose_pieces(self):
        families = {f['id']: f for f in self.catalog['families']}
        trees = families['trees']
        patches = next(g['members'] for g in trees['groups'] if g['id'] == 'patches')
        for part in patches:
            self.assertEqual(part['kind'], 'component')
            self.assertTrue(any('Cannot stand alone.' in f['value'] for f in part['facts']))
            self.assertEqual(len(part['variants']), 4)
        self.assertTrue(any('terrain compatibility is unknown' in f['value'] for f in trees['facts']))
        forest_groups = [g for g in trees['groups'] if g['id'].startswith('forest-')]
        self.assertEqual([g['title'] for g in forest_groups], ['Forest 1 pieces', 'Forest 2 pieces', 'Forest 3 pieces'])
        self.assertEqual([[m['id'] for m in g['members']] for g in forest_groups],
                         [['F01', 'F02', 'F03'], ['F04', 'F05', 'F06'], ['F07', 'F08', 'F09']])
        groups = {g['id']: g for g in families['scrapyard']['groups']}
        self.assertEqual([m['number'] for m in groups['components']['members']], [21, 22, 23])
        self.assertEqual([m['number'] for m in groups['loose']['members']], [24, 25, 26])
        for part in groups['loose']['members']:
            self.assertIn('Whether it can stand alone is unknown.', [f['value'] for f in part['facts']])
            self.assertFalse(any('Cannot stand alone' in f['value'] for f in part['facts']))
        example = families['scrapyard']['examples'][0]
        self.assertEqual([v['id'] for v in example['variants']], ['original'])
        self.assertEqual(example['variants'][0]['recordIds'], ['P02-21', 'P02-22', 'P02-22', 'P02-23'])

    def test_family_revisions_include_only_used_source_pins(self):
        sources = {source['id']: source for source in self.catalog['sources']}
        for family in self.catalog['families']:
            entries = [m for g in family['groups'] for m in g['members']] + family['examples']
            used = sorted({layer['sheetId'] for entry in entries for variant in entry['variants']
                           for layer in variant['sprite']['layers']})
            self.assertEqual(family['sourcePins'], [{field: sources[source_id][field]
                                                    for field in ('id', 'fingerprint', 'width', 'height')}
                                                   for source_id in used])
            changed = copy.deepcopy(family)
            changed['sourcePins'][0]['fingerprint'] = '0' * 64
            self.assertNotEqual(family['revision'], ADAPTER.revision(changed))
            changed['revision'] = ADAPTER.revision(changed)
            self.assertEqual(changed['revision'], ADAPTER.revision(changed))


if __name__ == '__main__':
    unittest.main()
