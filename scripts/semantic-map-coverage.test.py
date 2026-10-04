"""Source integrity, honest stage accounting and extensible registration checks."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('coverage', Path(__file__).with_name('semantic-map-coverage.py'))
coverage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(coverage)


class CoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = coverage.build()
        cls.temp = tempfile.TemporaryDirectory()
        cls.fixture = Path(cls.temp.name)
        for pin in cls.ledger['evidencePins']:
            destination = cls.fixture / pin['path']
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(coverage.REPO / pin['path'], destination)
        (cls.fixture / coverage.OUTPUT).write_bytes(coverage.encode(cls.ledger))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_portable_determinism_without_original_pngs(self):
        self.assertFalse((self.fixture / 'assets').exists())
        self.assertEqual(coverage.encode(coverage.build(self.fixture)), coverage.encode(self.ledger))
        self.assertEqual(self.ledger['accounting']['primaryMasterLineageRecords'],
                         {'exact-direct': 58, 'exact-composition': 9, 'counterpart-derived': 18})
        self.assertEqual(self.ledger['accounting']['surveyWindowsByMaster'],
                         {'exteriors': 95, 'interiors': 51, 'room-builder': 17})
        self.assertEqual(sum(g['sourceInventory']['pngCount'] for g in self.ledger['sourceGroups']), 29451)

    def test_check_no_write_and_stale_failure(self):
        output = self.fixture / coverage.OUTPUT
        before = output.read_bytes()
        command = [sys.executable, str(coverage.REPO / 'scripts/semantic-map-coverage.py'), '--check', '--repo', str(self.fixture)]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(output.read_bytes(), before)
        try:
            output.write_bytes(before + b' ')
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('stale', result.stderr)
            self.assertEqual(output.read_bytes(), before + b' ')
        finally:
            output.write_bytes(before)

    def assert_corruption_rejected(self, path):
        target = self.fixture / path
        before = target.read_bytes()
        try:
            target.write_bytes(before + b' ')
            with self.assertRaisesRegex(ValueError, 'Pin mismatch'):
                coverage.build(self.fixture)
        finally:
            target.write_bytes(before)

    def test_corrupt_inventory_and_frozen_proposal_rejected(self):
        self.assert_corruption_rejected(coverage.BASE + '/source-files.json')
        self.assert_corruption_rejected(coverage.BASE + '/packets/S02-exteriors-regions.json')

    def test_corrupt_committed_source_and_packed_alias_index_rejected(self):
        self.assert_corruption_rejected('public/assets/tilesets/me-complete.png')
        self.assert_corruption_rejected('public/data/modern-interiors-atlas.json')

    def test_review_applicability_not_inherited_from_filename(self):
        path = self.fixture / (coverage.BASE + '/packets/P01-trees-review.md')
        before = path.read_bytes()
        try:
            path.write_bytes(before.replace(coverage.FROZEN['P01-trees.json'].encode(), b'0' * 64))
            with self.assertRaisesRegex(ValueError, 'does not pin proposal'):
                coverage.build(self.fixture)
        finally:
            path.write_bytes(before)

    def test_corrected_themes_and_component_roles(self):
        regions = {r['id']: r for r in self.ledger['regions']}
        self.assertIn('tubes/tunnels', regions['S02-exteriors/E10']['currentInterpretation']['evidence'])
        self.assertIn('Ambulances', regions['S02-exteriors/E15']['currentInterpretation']['name'])
        self.assertIn('beds/stretchers', regions['S02-exteriors/E18']['currentInterpretation']['name'])
        self.assertNotIn('abandoned', regions['S02-exteriors/E45']['currentInterpretation']['name'])
        self.assertIn('refuted', regions['S02-F-wooden-cabinet-pilot']['currentInterpretation']['observedFamilies'])

    def test_no_region_completion_or_member_approval_inherited(self):
        for r in self.ledger['regions']:
            self.assertIn(r['stages']['investigated']['state'], ('partial', 'no-evidence'))
            self.assertEqual(r['stages']['independentlyReviewed']['scope'],
                             'survey window only; pilot record reviews remain separate')
        for record in self.ledger['pilotRecords']:
            self.assertEqual(record['stages']['accepted']['state'], 'no-evidence')
        accepted = self.ledger['acceptanceScopes']
        self.assertEqual(len(accepted), 1)
        self.assertEqual([m['recordId'] for m in accepted[0]['members']], ['P01/F02', 'P01/F05', 'P01/F08'])
        self.assertEqual(accepted[0]['recipe']['rowOffsets'], [0, 48, 16, 96, 32])
        self.assertEqual(len(self.ledger['gaps']['exteriorsResiduals']), 40)
        groups = {g['id']: g for g in self.ledger['sourceGroups']}
        self.assertEqual(groups['interiors-animations']['stages']['investigated']['state'], 'no-evidence')
        self.assertEqual(groups['exteriors-theme-singles']['pilotReferencedPNGPathCount'], 29)

    def test_coordinate_spaces_and_overlap_links_stay_distinct(self):
        records = {r['id']: r for r in self.ledger['pilotRecords']}
        r = records['P03-37-black-shadow']
        self.assertEqual(r['lineage']['kind'], 'counterpart-derived')
        self.assertNotEqual(r['packedAlias']['rect'], r['lineage']['rects'][0])
        self.assertTrue(all(link['relation'] == 'counterpart-lineage-context' for link in r['regionLinks']))
        self.assertFalse(coverage.intersects([0, 0, 16, 16], [16, 0, 16, 16]))
        with self.assertRaises(ValueError):
            coverage.check_rect([0, 0, 17, 16], [16, 16])
        # One record has several navigation links, but appears once in accounting.
        self.assertGreater(len(records['P01/F02']['regionLinks']), 1)
        self.assertEqual(len(records), 85)

    def test_registry_requires_normalization_and_stage_validation(self):
        registrations = {r['packetId']: r for r in self.ledger['registeredPackets']}
        self.assertTrue(registrations['E01-outdoor-seating']['coverageCredit'])
        self.assertEqual(registrations['E01-outdoor-seating']['normalization']['sourceRecords'], 27)
        self.assertFalse(registrations['I01-interior-sofas']['coverageCredit'])
        self.assertEqual(registrations['I01-interior-sofas']['assignmentState'], 'review-ready')
        target = self.fixture / coverage.REGISTRY
        before = target.read_bytes()
        try:
            data = json.loads(before)
            draft = copy.deepcopy(data['registrations'][0])
            draft.update(packetId='draft', assignmentState='investigating', proposal=None,
                         independentReview=None, memberRecords=[], sourceRefs=[])
            data['registrations'].append(draft)
            target.write_bytes(coverage.encode(data))
            result = coverage.build(self.fixture)
            self.assertFalse(result['registeredPackets'][-1]['coverageCredit'])
            self.assertEqual(result['registeredPackets'][-1]['stages']['independentlyReviewed']['state'], 'no-evidence')
            draft['assignmentState'] = 'reconciled'
            target.write_bytes(coverage.encode(data))
            with self.assertRaisesRegex(ValueError, 'requires pinned proposal'):
                coverage.build(self.fixture)
        finally:
            target.write_bytes(before)

    def test_expansion_primary_lineage_supplemental_aliases_and_gaps(self):
        counts = self.ledger['accounting']
        self.assertEqual(counts['pilotSourceRecords'], 85)
        self.assertEqual(counts['allNormalizedSourceRecords'], 112)
        self.assertEqual(counts['allNormalizedProposalUnits'], 94)
        self.assertEqual(counts['expansionPrimaryMasterLineageRecords'], {'exact-direct': 25, 'original-only': 2})
        self.assertEqual(counts['expansionNamedExportReferences'], 54)
        self.assertEqual(counts['expansionSupplementalExactOccurrences'], 25)
        self.assertEqual(counts['expansionCommittedIntegrationAliases'], 2)
        records = {r['id']: r for r in self.ledger['expandedRecords']}
        for rid in ['E01-05', 'E01-06']:
            self.assertEqual(records[rid]['lineage']['kind'], 'original-only')
            self.assertEqual(records[rid]['lineage']['rects'], [])
            self.assertEqual(records[rid]['regionLinks'], [])
            self.assertEqual(records[rid]['supplementalOccurrences'], [])
            self.assertEqual(len(records[rid]['integrationAliases']), 1)
        for record in records.values():
            self.assertEqual(record['stages']['accepted']['state'], 'no-evidence')
        sofa = next(r for r in self.ledger['readyBoundedPackets'] if r['key'] == 'interiors-sofa-contrast')
        self.assertEqual(sofa['state'], 'review-ready')
        self.assertIn('I01', sofa['supersededByRegistration'])
        self.assertNotIn('exteriors-theme-sheets', self.ledger['gaps']['supplementalUnassignedGroups'])
        self.assertIn('interiors-theme-normal', self.ledger['gaps']['supplementalUnassignedGroups'])
        groups = {g['id']: g for g in self.ledger['sourceGroups']}
        self.assertEqual(len(groups['exteriors-master']['expandedPrimaryMasterReferences']), 25)
        self.assertEqual(len(groups['exteriors-master']['expandedRecordIds']), 25)
        self.assertEqual(len(groups['committed-reference']['expandedRecordIds']), 25)
        self.assertEqual(counts['expansionPrimaryMasterLineageRecords']['exact-direct'], 25)
        registration = next(r for r in self.ledger['registeredPackets'] if r['packetId'] == 'E01-outdoor-seating')
        self.assertEqual(registration['stages']['independentlyReviewed']['state'], 'evidenced')
        self.assertNotIn('pending', registration['stages']['independentlyReviewed']['scope'])

    def test_expansion_pins_and_committed_original_only_copy_corruption(self):
        self.assert_corruption_rejected(coverage.MODEL)
        self.assert_corruption_rejected(coverage.BASE + '/packets/E01-outdoor-seating.json')
        self.assert_corruption_rejected('public/assets/semantic-sources/exteriors-bench-5.png')

    def test_extensible_registration_pins_members_and_review_without_credit(self):
        target = self.fixture / coverage.REGISTRY
        before = target.read_bytes()
        try:
            data = json.loads(before)
            proposal_path = coverage.BASE + '/packets/E-test.json'
            proposal = {'candidates': [{'id': 'future-1', 'meaning': 'unvalidated test hypothesis'}]}
            proposal_bytes = coverage.encode(proposal)
            (self.fixture / proposal_path).write_bytes(proposal_bytes)
            review_path = coverage.BASE + '/packets/E-test-review.md'
            review_bytes = ('Reviewed bounded proposal ' + coverage.sha(proposal_bytes)).encode()
            (self.fixture / review_path).write_bytes(review_bytes)
            reg = copy.deepcopy(data['registrations'][0])
            reg.update(packetId='future', assignmentState='review-ready',
                       proposal={'path': proposal_path, 'sha256': coverage.sha(proposal_bytes)},
                       independentReview={'path': review_path, 'sha256': coverage.sha(review_bytes)},
                       memberRecords=[{'id': 'future-1', 'jsonPointer': '/candidates/0'}])
            data['registrations'].append(reg)
            target.write_bytes(coverage.encode(data))
            result = coverage.build(self.fixture)
            self.assertFalse(result['registeredPackets'][-1]['coverageCredit'])
            self.assertEqual(result['accounting']['pilotSourceRecords'], 85)
            reg['memberRecords'][0]['id'] = 'invented-2'
            target.write_bytes(coverage.encode(data))
            with self.assertRaisesRegex(ValueError, 'ID/pointer mismatch'):
                coverage.build(self.fixture)
        finally:
            target.write_bytes(before)


if __name__ == '__main__':
    unittest.main()
