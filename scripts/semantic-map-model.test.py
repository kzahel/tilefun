#!/usr/bin/env python3
"""Adversarial regression checks for immutable pilot adaptation and verification."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

SCRIPT = Path(__file__).with_name('semantic-map-model.py')
SPEC = importlib.util.spec_from_file_location('semantic_model', SCRIPT)
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


class SemanticModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = M.build_model()
        cls.full_report = M.validate_model(cls.model)
        cls.topology = next(r['topology'] for r in cls.model['relationships'] if r['kind'] == 'assembly-topology')

    def mutated(self, edit):
        model = copy.deepcopy(self.model)
        edit(model)
        model['revision'] = M.revision({k: v for k, v in model.items() if k != 'revision'})
        return model

    def test_exact_accounting_composition_and_unknown_geometry(self):
        report = self.full_report
        self.assertEqual((report['sourceRecords'], report['proposalUnits']), (112, 94))
        self.assertEqual(report['lineage'], {'direct': 83, 'composed': 9, 'derived': 18, 'original-only': 2})
        self.assertEqual(len(report['compositionsComparedToPinnedTargets']), 9)
        self.assertEqual(report['compositionsUnavailable'], [])
        self.assertEqual(report['variantDeltasVerified'], 27)
        self.assertTrue(report['counterpartCorpusRechecked'])
        self.assertTrue(all(p['gameplayGeometry'] == M.GEOMETRY for p in self.model['proposals']))
        self.assertEqual(report['humanApprovedProposalUnits'], 0)

    def test_deterministic_read_only_check(self):
        before = M.OUTPUT.read_bytes(), M.OUTPUT.stat().st_mtime_ns
        results = [subprocess.run([sys.executable, str(SCRIPT), '--check'], capture_output=True, text=True) for _ in range(2)]
        for result in results:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue(json.loads(result.stdout)['ok'])
        self.assertEqual(results[0].stdout, results[1].stdout)
        self.assertEqual(before, (M.OUTPUT.read_bytes(), M.OUTPUT.stat().st_mtime_ns))

    def test_topology_rejects_standalone_incomplete_reversed_and_mixed(self):
        rid = lambda n, v='normal': f'P03-{n}-{v}'
        for variant in ('normal', 'black-shadow', 'shadowless'):
            for sequence in ([41], [42], [43], [44], [42, 43], [44, 42, 41], [41, 42], [42, 44], [41, 44, 42, 44]):
                with self.subTest(sequence=sequence, variant=variant):
                    self.assertFalse(M.check_topology(self.topology, [rid(n, variant) for n in sequence])['valid'])
            for sequence in ([41, 44], [41, 42, 44], [41, 43, 44], [41, 42, 43, 42, 44]):
                self.assertTrue(M.check_topology(self.topology, [rid(n, variant) for n in sequence])['valid'])
        self.assertFalse(M.check_topology(self.topology, [rid(41), rid(44, 'shadowless')])['valid'])
        self.assertFalse(M.check_topology(self.topology, ['P03-C41', 'P03-C44'])['valid'])
        self.assertFalse(M.check_topology(self.topology, [])['valid'])

    def test_review_hash_and_membership_change_do_not_inherit_review(self):
        review = self.model['reviews'][0]
        self.assertTrue(M.review_applicability(review, review['proposalSha256'], review['memberRecords']))
        self.assertFalse(M.review_applicability(review, '0' * 64, review['memberRecords']))
        self.assertFalse(M.review_applicability(review, review['proposalSha256'], review['memberRecords'][:-1]))
        self.assertTrue(all('initial' in r['originalText'].lower() and 'brief' in r['originalText'].lower() for r in self.model['reviews']))
        self.assertEqual(sum(len(r['proposalDispositions']) for r in self.model['reviews']), 94)

    def test_aliases_offgrid_occurrences_and_exceptions_preserved(self):
        records = {r['id']: r for r in self.model['sourceRecords']}
        self.assertEqual(sum(len(r['references']) for r in records.values() if r['packetId'] == 'P02'), 58)
        self.assertEqual(records['P02-19']['occurrences'][0]['bounds']['value'][1], 3165)
        self.assertEqual(records['P02-20']['occurrences'][0]['bounds']['value'][1], 3164)
        recipe = next(r['recipe'] for r in self.model['relationships'] if r.get('recipe', {}).get('targetRecord') == 'P03-38-normal')
        self.assertEqual(len(recipe['layers'][0]['supportOccurrences']), 3)
        for n, count in [(38, 32), (40, 16), (42, 32)]:
            self.assertEqual(records[f'P03-{n}-normal']['originalEvidence']['deltaFromShadowlessSameIndex']['onReferenceBodyPixels'], count)
        p09 = next(p for p in self.model['proposals'] if p['id'] == 'P02-09')
        self.assertIn('short ladder-like frame', p09['alternatives'])

    def test_source_hash_drift_fails_even_with_valid_model_revision(self):
        model = self.mutated(lambda m: next(s for s in m['sourceFiles'] if s['path'] == M.EXTERIORS).update(sha256='0' * 64))
        with self.assertRaisesRegex(ValueError, 'Source hash drift'):
            M.validate_model(model)

    def test_missing_source_reference_and_wrong_coordinate_space_fail(self):
        model = self.mutated(lambda m: m['sourceRecords'][0]['references'][0].update(sourceFile='assets/absent.png'))
        with self.assertRaisesRegex(ValueError, 'Missing source pin'):
            M.validate_model(model)
        model = self.mutated(lambda m: m['sourceRecords'][0]['references'][0]['bounds'].update(coordinateSpace='packed-atlas-pixels'))
        with self.assertRaisesRegex(ValueError, 'Wrong source coordinate space'):
            M.validate_model(model)

    def test_out_of_bounds_and_geometry_approval_tampering_fail(self):
        model = self.mutated(lambda m: m['sourceRecords'][0]['bounds'][0].update(value=[0, 0, 65, 64]))
        with self.assertRaisesRegex(ValueError, 'Bounds outside'):
            M.validate_model(model)
        model = self.mutated(lambda m: m['proposals'][0].update(humanApproval='approved'))
        with self.assertRaisesRegex(ValueError, 'approval/promotion'):
            M.validate_model(model)

    def test_composition_offset_and_variant_delta_tampering_fail(self):
        def offset(m):
            recipe = next(r['recipe'] for r in m['relationships'] if 'recipe' in r)
            recipe['layers'][1]['at'] = [0, 47]
        with self.assertRaisesRegex(ValueError, 'Composition hash differs'):
            M.validate_model(self.mutated(offset))
        def delta(m):
            r = next(r for r in m['relationships'] if r['kind'] == 'counterpart-correspondence')
            r['deltaFromShadowless']['differentPixels'] += 1
        with self.assertRaisesRegex(ValueError, 'Raw variant delta differs'):
            M.validate_model(self.mutated(delta))

    def test_committed_only_has_visible_limits_and_same_model(self):
        with tempfile.TemporaryDirectory(prefix='tilefun-semantic-model-') as temporary:
            root = Path(temporary)
            paths = set(self.model['inputPins']) | {s['path'] for s in self.model['sourceFiles'] if s['required']}
            for path in paths:
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(M.ROOT / path, target)
            self.assertEqual(M.build_model(root), self.model)
            report = M.validate_model(self.model, root, committed_only=True)
            self.assertFalse(report['counterpartCorpusRechecked'])
            self.assertEqual(len(report['compositionsReplayOnly']), 8)
            self.assertEqual(report['compositionsUnavailable'], ['P03-38-normal'])
            self.assertGreater(len(report['sourceFilesUnavailable']), 0)
            self.assertEqual(report['humanApprovedProposalUnits'], 0)
            self.assertEqual(report['originalOnlyRecordIds'], ['E01-05', 'E01-06'])
            self.assertEqual(report['E01VariantDeltasVerified'], 18)
            self.assertEqual(report['E01VariantDeltasUnavailable'], [])
            self.assertEqual(report['E01PartialComparisonsVerified'], 2)
            self.assertTrue({'E01-05', 'E01-06'}.isdisjoint(report['recordPixelsUnavailable']))
            with self.assertRaisesRegex(ValueError, 'Missing source reference'):
                M.validate_model(self.model, root)
            # A present original that drifts is never excused as unavailable.
            original = next(s for s in self.model['sourceFiles'] if not s['required'])
            bad = root / original['path']
            bad.parent.mkdir(parents=True, exist_ok=True)
            bad.write_bytes(b'not the pinned PNG')
            with self.assertRaisesRegex(ValueError, 'Source hash drift'):
                M.validate_model(self.model, root, committed_only=True)

    def test_model_revision_and_path_escape_rejected(self):
        model = copy.deepcopy(self.model)
        model['proposals'][0]['identity']['value'] = 'tampered'
        with self.assertRaisesRegex(ValueError, 'Model revision drift'):
            M.validate_model(model)
        for path in ('../outside.png', '/tmp/outside.png'):
            with self.assertRaises(ValueError):
                M.repo_path(M.ROOT, path)

    def test_recomputed_revision_cannot_bypass_review_or_topology_contract(self):
        def offset(m):
            topology = next(r['topology'] for r in m['relationships'] if r['kind'] == 'assembly-topology')
            topology['assemblyTopology']['nextMemberOffset'] = [15, 1]
        def identity(m):
            m['proposals'][0]['identity']['value'] = 'approved oak in winter'
        def derived_occurrence(m):
            r = next(r for r in m['sourceRecords'] if r['id'] == 'P03-37-black-shadow')
            r['occurrences'].append(copy.deepcopy(r['references'][0]))
        for edit in (offset, lambda m: m.update(reviews=[]), lambda m: m['reviews'][0].update(sourcePins=[]), identity, derived_occurrence):
            with self.subTest(edit=edit), self.assertRaisesRegex(ValueError, 'Canonical packet adapter contract drift'):
                M.validate_model(self.mutated(edit))

    def test_versioned_extension_preserves_pilot_accounting_and_original_only_sources(self):
        report = self.full_report
        self.assertEqual(report['pilotAccounting'], {'sourceRecords': 85, 'proposalUnits': 67,
                         'lineage': {'direct': 58, 'composed': 9, 'derived': 18}})
        self.assertEqual(report['extensionAccounting']['E01'], {'sourceRecords': 27, 'proposalUnits': 27,
                         'lineage': {'direct': 25, 'original-only': 2}})
        self.assertEqual(report['E01VariantDeltasVerified'], 18)
        self.assertEqual(report['E01PartialComparisonsVerified'], 2)
        records = [r for r in self.model['sourceRecords'] if r['packetId'] == 'E01']
        self.assertEqual(sum(len(r['references']) for r in records), 54)
        self.assertEqual(sum(len(r['occurrences']) for r in records), 50)
        review = next(r for r in self.model['reviews'] if r['packetId'] == 'E01')
        scope = {pin['path'] for pin in review['sourcePins']}
        self.assertEqual(len(scope), 82)  # All 80 packet sources plus two exact integration aliases.
        packet = M.load(M.ROOT / M.PLAN / 'packets/E01-outdoor-seating.json')
        self.assertTrue({source['path'] for source in packet['sources']}.issubset(scope))
        for record in records:
            if record['primaryLineage'] == 'original-only':
                self.assertEqual(record['occurrences'], [])
                self.assertEqual(record['sourceIdentity'], 'exact-pinned-whole-export')
                self.assertEqual(len(record['references']), 2)
                self.assertEqual(len(record['integrationAliases']), 1)
                self.assertEqual(record['committedRendering']['status'], 'requires exact original single; no committed whole crop')
                self.assertEqual(next(p for p in self.model['proposals'] if p['id'] == record['id'])['humanApproval'], 'unregistered')
        def fabricate(m):
            r = next(r for r in m['sourceRecords'] if r['id'] == 'E01-05')
            r['occurrences'].append(copy.deepcopy(r['references'][0]))
        with self.assertRaisesRegex(ValueError, 'Original-only lineage'):
            M.validate_model(self.mutated(fabricate))
        def alter_delta(m):
            e = next(r for r in m['relationships'] if r['id'] == 'E01:experiments')
            e['originalEvidence']['variantDeltas'][0]['rgbaChangedPixels'] += 1
        with self.assertRaisesRegex(ValueError, 'E01 variant delta differs'):
            M.validate_model(self.mutated(alter_delta))

    def test_normalization_does_not_erase_translucent_color(self):
        im = Image.new('RGBA', (2, 1))
        im.putpixel((0, 0), (250, 80, 30, 0))
        im.putpixel((1, 0), (10, 20, 30, 100))
        self.assertEqual(M.normalized(im).getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(M.normalized(im).getpixel((1, 0)), (10, 20, 30, 100))


if __name__ == '__main__':
    unittest.main()
