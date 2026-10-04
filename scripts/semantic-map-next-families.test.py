#!/usr/bin/env python3
"""Focused E04/I02/E05 normalized-model regressions; no absence searches.

One shared fixture omits ignored originals. Small finite-probe checks reuse its
64 rendered native frames; canonical metadata mutations use the real validator.
This supplements model.test.py rather than repeating its full-original replay.
"""
import copy
import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest

from PIL import Image

SPEC = importlib.util.spec_from_file_location('semantic_model', Path(__file__).with_name('semantic-map-model.py'))
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)
N = M.NEXT


class NextFamilyModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = M.build_model()
        cls.records = {r['id']: r for r in cls.model['sourceRecords']}
        cls.probes = {r['id']: r for r in cls.model['relationships'] if r['kind'] == 'bounded-next-family-probe'}
        cls.temporary = tempfile.TemporaryDirectory(prefix='tilefun-next-model-')
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.root = Path(cls.temporary.name)
        paths = set(cls.model['inputPins']) | {s['path'] for s in cls.model['sourceFiles'] if s['required']}
        for path in paths:
            target = cls.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(M.ROOT / path, target)
        cls.report = M.validate_model(cls.model, cls.root, committed_only=True)
        cls.images = {}
        cls.rendered = {}
        for uid, record in cls.records.items():
            if record['packetId'] not in N.CONTRACTS:
                continue
            ref = next(ref for ref in record['references'] if ref['sourceFile'].startswith('public/'))
            value = M.crop(cls.image(ref['sourceFile']), ref['bounds'])
            if 'transparentFrame' in ref:
                frame = ref['transparentFrame']
                out = Image.new('RGBA', tuple(frame['frameSize']))
                out.paste(value, tuple(frame['offsetXY']))
                value = out
            if list(value.size) != record['frameDimensions'] or M.pixel_hash(value) != record['normalizedPixelSha256']:
                raise AssertionError('Committed fixture native-frame drift: ' + uid)
            cls.rendered[uid] = value
        cls.api = {'rect': M.rect, 'crop': M.crop, 'pixel_hash': M.pixel_hash,
                   'delta': M.seating_delta, 'check_bounds': M.check_bounds, 'pixels': M.pixels}

    @classmethod
    def image(cls, path):
        if path.startswith('assets/'):
            return None
        if path not in cls.images:
            with Image.open(cls.root / path) as raw:
                cls.images[path] = M.normalized(raw)
        return cls.images[path]

    def mutated(self, edit):
        model = copy.deepcopy(self.model)
        edit(model)
        model['revision'] = M.revision({k: v for k, v in model.items() if k != 'revision'})
        return model

    def reject(self, edit, message):
        with self.assertRaisesRegex(ValueError, message):
            M.validate_model(self.mutated(edit), self.root, committed_only=True)

    @staticmethod
    def record(model, uid):
        return next(r for r in model['sourceRecords'] if r['id'] == uid)

    def replay_probe(self, probe, records=None):
        return N.validate({'sourceFiles': self.model['sourceFiles'], 'relationships': [probe]},
                          records or self.records, self.rendered, self.image, self.api)

    def test_missing_originals_replay_all_native_frames_and_finite_probes(self):
        report, next_report = self.report, self.report['nextFamilyValidation']
        self.assertEqual((report['sourceRecords'], report['proposalUnits']), (255, 216))
        self.assertEqual(next_report['recordPixelsVerified'], {'E04': 19, 'I02': 18, 'E05': 27})
        self.assertEqual(len(self.rendered), 64)
        self.assertEqual(next_report['finiteProbeRastersVerified'], {'I02': 17, 'E05': 14})
        self.assertEqual(next_report['originalNativeFramesVerified'], {})
        self.assertEqual(set(next_report['originalNativeFramesUnavailable']), set(self.rendered))
        self.assertFalse(next_report['I02CounterpartCorpusRechecked'])
        self.assertEqual(next_report['I02FilenameRefutationsVerified'], 0)
        self.assertEqual(next_report['I02FilenameRefutationsUnavailable'], [1, 2, 63, 64, 57, 119])
        self.assertEqual(next_report['I02MasterDifferencesUnavailable'], ['I02-01', 'I02-03'])
        self.assertGreater(len(next_report['originalCorrespondencesUnavailable']), 0)
        self.assertTrue(all(path.startswith('assets/') for path in report['sourceFilesUnavailable']))
        self.assertTrue(any('original native frames are absent' in limit for limit in report['limitations']))
        self.assertEqual(report['humanApprovedProposalUnits'], 0)
        self.assertEqual(report['runtimePromotedProposalUnits'], 0)
        self.assertEqual(M.build_model(self.root), self.model)

    def test_previous_eight_packets_remain_byte_identical_in_order(self):
        expected = {
            'sourceRecords': (191, '9aec7e746d08567300bec3ce40c4689e8adc0a6861e043bb71c57e5b7e614a7e'),
            'proposals': (164, '2c1d6ea0f7ccb64a2b25164f812b884baa8bbe1b9c624e112d119d840961a13e'),
            'relationships': (156, 'a555a23d285694e3d24ba87a8717621fec280e3182a8f0656a174f92d6fdae85'),
            'reviews': (8, '7e1e8a9b7f8173a3a6763d5fe80b1fbb497faf5fa088b56ec66dc0020bc4d5ee'),
        }
        for key, (count, digest) in expected.items():
            with self.subTest(key=key):
                previous = [item for item in self.model[key] if item['packetId'] not in N.CONTRACTS]
                self.assertEqual(len(previous), count)
                self.assertEqual(M.revision(previous), digest)

    def test_e04_three_visible_crops_restore_native_transparent_padding(self):
        expected = {'E04-03': ([32, 64], [0, 11]), 'E04-04': ([32, 64], [0, 11]),
                    'E04-15': ([16, 16], [1, 2])}
        for uid, (size, offset) in expected.items():
            with self.subTest(uid=uid):
                record = self.records[uid]
                ref = next(r for r in record['references'] if 'transparentFrame' in r)
                self.assertEqual(record['primaryLineage'], 'alpha-visible-reconstruction')
                self.assertFalse(any(o['sourceFile'] == M.EXTERIORS for o in record['occurrences']))
                self.assertEqual(ref['transparentFrame']['frameSize'], size)
                self.assertEqual(ref['transparentFrame']['offsetXY'], offset)
                self.assertEqual(ref['transparentFrame']['operation'], 'crop-into-transparent-frame')
                self.assertTrue(all(r['bounds']['kind'] == 'alpha-visible-correspondence'
                                    for r in record['alphaVisibleCorrespondences']))
                self.assertNotEqual(M.pixel_hash(M.crop(self.image(ref['sourceFile']), ref['bounds'])),
                                    record['normalizedPixelSha256'])
        def move_padding(model):
            ref = next(r for r in self.record(model, 'E04-03')['references'] if 'transparentFrame' in r)
            ref['transparentFrame']['offsetXY'] = [0, 10]
        self.reject(move_padding, 'Transparent-frame reconstruction hash drift')
        def erase_padding(model):
            ref = next(r for r in self.record(model, 'E04-15')['references'] if 'transparentFrame' in r)
            ref['transparentFrame']['operation'] = 'direct-crop'
        self.reject(erase_padding, 'Direct committed crop frame drift')

    def test_e04_visible_correspondence_cannot_become_whole_master_credit(self):
        self.reject(lambda model: self.record(model, 'E04-03').update(primaryLineage='direct'),
                    'Lineage accounting drift: E04')
        def mistype(model):
            self.record(model, 'E04-03')['alphaVisibleCorrespondences'][0]['bounds']['kind'] = 'exported-frame'
        self.reject(mistype, 'Canonical packet adapter contract drift')

    def test_i02_black_exports_use_reordered_actual_filenames(self):
        logical, actual = [1, 2, 63, 64, 57, 119], [424, 425, 486, 487, 480, 542]
        rows = [r for r in self.records.values() if r['packetId'] == 'I02' and r['variant'] == 'black-shadow']
        self.assertEqual([r['logicalNormalVendorIndex'] for r in rows], logical)
        self.assertEqual([r['vendorIndex'] for r in rows], actual)
        for row, index in zip(rows, actual):
            originals = [ref['sourceFile'] for ref in row['references'] if ref['sourceFile'].startswith('assets/')]
            self.assertTrue(any(path.endswith('_' + str(index) + '.png') for path in originals))
        self.reject(lambda model: self.record(model, rows[0]['id']).update(vendorIndex=1),
                    'Canonical packet adapter contract drift')

    def test_i02_only_matching_underlay_and_native_offset_are_valid(self):
        positives = [p for p in self.probes.values() if p['packetId'] == 'I02'
                     and p['originalEvidence']['topologyDisposition'] == 'proposed-valid']
        self.assertEqual(len(positives), 12)
        for probe in positives:
            recipe = probe['renderRecipe']
            self.assertTrue(N.bed_overlay(recipe, self.records))
            self.assertEqual(recipe['placements'][1]['targetOffset'], [0, 16])
        recipe = copy.deepcopy(positives[0]['renderRecipe'])
        for change in ('wrong-offset', 'wrong-facing', 'mixed-shadow', 'cover-alone', 'reverse-layers', 'trim'):
            wrong = copy.deepcopy(recipe)
            if change == 'wrong-offset': wrong['placements'][1]['targetOffset'] = [0, 15]
            elif change == 'wrong-facing': wrong['placements'][0]['memberId'] = 'I02-03'
            elif change == 'mixed-shadow': wrong['placements'][0]['memberId'] = 'I02-07'
            elif change == 'cover-alone': wrong['placements'] = wrong['placements'][1:]
            elif change == 'reverse-layers': wrong['placements'].reverse()
            else: wrong['placements'][1]['sourceRect'][2] -= 1
            with self.subTest(change=change):
                self.assertFalse(N.bed_overlay(wrong, self.records))
        wrong = copy.deepcopy(positives[0])
        wrong['renderRecipe']['placements'][1]['targetOffset'] = [0, 15]
        wrong['renderRecipeSha256'] = N.receipt(wrong['renderRecipe'])
        with self.assertRaisesRegex(ValueError, 'I02 finite underlay topology drift'):
            self.replay_probe(wrong)

    def test_i02_complete_beds_do_not_require_optional_blankets(self):
        beds = [r for r in self.records.values() if r['packetId'] == 'I02' and r['frameDimensions'] == [48, 48]]
        self.assertEqual(len(beds), 12)
        for bed in beds:
            self.assertTrue(M.standalone_policy(bed)['allowed'])
            self.assertEqual(bed['topology']['requiredNeighbors'], [])
        def require_blanket(model):
            self.record(model, 'I02-01')['topology']['requiredNeighbors'] = [{'relation': 'overlay', 'members': ['I02-05']}]
        self.reject(require_blanket, 'Canonical packet adapter contract drift')

    def test_i02_duplicate_cover_pixels_keep_six_source_identities(self):
        covers = [r for r in self.records.values() if r['packetId'] == 'I02' and r['frameDimensions'] == [48, 32]]
        self.assertEqual(len(covers), 6)
        self.assertEqual(len({r['id'] for r in covers}), 6)
        for logical in (57, 119):
            rows = [r for r in covers if r['logicalNormalVendorIndex'] == logical]
            self.assertEqual(len(rows), 3)
            self.assertEqual(len({r['normalizedPixelSha256'] for r in rows}), 1)
            self.assertEqual({r['variant'] for r in rows}, {'normal', 'black-shadow', 'shadowless'})
            self.assertTrue(all(r['sourceId'] == r['id'] for r in rows))
        self.reject(lambda model: model['sourceRecords'].remove(self.record(model, 'I02-17')),
                    'Packet record/proposal accounting drift: I02')

    def test_e05_gate_standalone_is_unknown_without_cross_kit_joins(self):
        for uid in ('E05-23', 'E05-24', 'E05-25', 'E05-26'):
            record = self.records[uid]
            self.assertEqual(M.standalone_policy(record)['state'], 'unknown')
            self.assertFalse(M.standalone_policy(record)['allowed'])
            self.assertEqual(record['topology']['openJoinEdges'], [])
            self.assertEqual(record['topology']['compatibleMembers'], [])
        for record in self.records.values():
            if record['packetId'] != 'E05': continue
            for neighbor in record['topology']['compatibleMembers']:
                self.assertEqual(record['topology']['requiredFamily'],
                                 self.records[neighbor['memberId']]['topology']['requiredFamily'])
        def allow_gate(model):
            self.record(model, 'E05-23')['topology']['standaloneEligibility'] = 'allowed as visual proposal only'
        self.reject(allow_gate, 'Canonical packet adapter contract drift')
        probe = copy.deepcopy(self.probes['E05:probe:closed-picket-48'])
        probe['renderRecipe']['placements'][0]['memberId'] = 'E05-23'
        probe['renderRecipeSha256'] = N.receipt(probe['renderRecipe'])
        probe['originalEvidence']['renderRecipeSHA256'] = probe['renderRecipeSha256']
        with self.assertRaisesRegex(ValueError, 'E05 finite port evidence drift'):
            self.replay_probe(probe)

    def test_e05_open_negative_and_unknown_probes_are_not_closed(self):
        closed = [p for p in self.probes.values() if p['packetId'] == 'E05'
                  and p['originalEvidence']['topologyDisposition'] == 'supported-bounded-closed']
        self.assertEqual(len(closed), 7)
        for probe in closed:
            self.assertEqual(N.fence_ports(probe['renderRecipe'], self.records)['unmatchedPorts'], [])
        for uid in ('open-upper-run', 'reversed-upper-corners', 'side-post-shift-one-pixel',
                    'diagonal-export-width-step', 'isolated-upper-left-corner'):
            probe = copy.deepcopy(self.probes['E05:probe:' + uid])
            self.assertTrue(N.fence_ports(probe['renderRecipe'], self.records)['unmatchedPorts'])
            probe['originalEvidence']['topologyDisposition'] = 'supported-bounded-closed'
            with self.subTest(probe=uid), self.assertRaisesRegex(ValueError, 'E05 closed/open disposition drift'):
                self.replay_probe(probe)
        for uid in ('garden-gate-hedge-extension', 'garden-gate-hedge-extension-low'):
            probe = self.probes['E05:probe:' + uid]
            self.assertNotIn('portEvaluation', probe['originalEvidence'])
            self.assertNotEqual(probe['originalEvidence']['topologyDisposition'], 'supported-bounded-closed')
        def promote_unknown(model):
            probe = next(r for r in model['relationships'] if r['id'] == 'E05:probe:garden-gate-hedge-extension')
            probe['originalEvidence']['topologyDisposition'] = 'supported-bounded-closed'
        self.reject(promote_unknown, 'Canonical packet adapter contract drift')

    def test_finite_recipe_receipts_cannot_hide_changed_rasters(self):
        probe = copy.deepcopy(self.probes['E05:probe:rising-diagonal-a'])
        probe['renderRecipe']['placements'][1]['at'] = [0, 15]
        with self.assertRaisesRegex(ValueError, 'Next-family recipe receipt drift'):
            self.replay_probe(probe)
        probe['renderRecipeSha256'] = N.receipt(probe['renderRecipe'])
        with self.assertRaisesRegex(ValueError, 'E05 frozen recipe receipt drift'):
            self.replay_probe(probe)


if __name__ == '__main__':
    unittest.main()
