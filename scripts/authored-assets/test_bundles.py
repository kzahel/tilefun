"""Prevent missing retained dependencies and verify exact finished GLB content."""
from pathlib import Path
import tempfile
import unittest

from pipeline import HERE, ROOT, digest, read, write
from transfer_variant import transfer
from verify_bundles import glb_content, verify


class RetainedBundleTests(unittest.TestCase):
    def test_all_final_assets_and_source_dependencies_are_self_contained(self):
        self.assertEqual([(r['assetId'], r['revision']) for r in verify()],
                         [('compact-1','v7'),('compact-2','v7'),('compact-4','v1'),('ambulance','v1'),('ambulance','v2'),
                          ('police-car','v1'),('fire-truck-ladder-1','v1'),('fire-truck-ladder-1','v2'),
                          ('garbage-truck-green','v1'),('compact-3','v1'),('compact-5','v1'),('compact-6','v1')] +
                         [(f'unindexed-sedan-{color}', 'v1') for color in ['red','beige','cyan','orange','silver','olive','dark']] +
                         [(f'bus-{number}', 'v1') for number in range(1,7)])

    def test_tandem_axle_cannot_disappear_from_the_declared_wheel_set(self):
        source=ROOT/'art-source/vehicle-models/garbage-truck-green/v1'
        rig=read(source/'rig.json')
        rig['wheels']=[wheel for wheel in rig['wheels'] if not wheel['id'].startswith('M')]
        with self.assertRaisesRegex(ValueError,'Exported wheel set differs'):
            glb_content(ROOT/'public/assets/models/vehicles/garbage-truck-green-v1.glb',
                        source/'car-atlas.png',read(source/'geometry-audit.json'),rig)

    def test_middle_axle_cannot_be_mislabeled_as_steerable(self):
        source=ROOT/'art-source/vehicle-models/garbage-truck-green/v1'
        rig=read(source/'rig.json')
        next(wheel for wheel in rig['wheels'] if wheel['id']=='ML')['steering']=True
        with self.assertRaisesRegex(ValueError,'Wheel steering contract changed'):
            glb_content(ROOT/'public/assets/models/vehicles/garbage-truck-green-v1.glb',
                        source/'car-atlas.png',read(source/'geometry-audit.json'),rig)

    def test_amber_warning_semantics_must_survive_export(self):
        source=ROOT/'art-source/vehicle-models/garbage-truck-green/v1'
        lights=read(source/'lights.json');lights['lenses'][0]['signal']='emergency'
        with self.assertRaisesRegex(ValueError,'light lens tags changed'):
            glb_content(ROOT/'public/assets/models/vehicles/garbage-truck-green-v1.glb',
                        source/'car-atlas.png',read(source/'geometry-audit.json'),read(source/'rig.json'),lights)

    def test_exported_light_phase_must_match_its_retained_contract(self):
        source = ROOT / 'art-source/vehicle-models/ambulance/v2'
        lights = read(source / 'lights.json')
        lights['lenses'][0]['phase'] = .123
        with self.assertRaisesRegex(ValueError, 'light lens tags changed'):
            glb_content(ROOT / 'public/assets/models/vehicles/ambulance-v2.glb', source / 'car-atlas.png',
                        read(source / 'geometry-audit.json'), read(source / 'rig.json'), lights)

    def test_ambulance_cannot_pass_with_compact_geometry_expectations(self):
        source = ROOT / 'art-source/vehicle-models/ambulance/v1'
        with self.assertRaisesRegex(ValueError, 'recorded audit'):
            glb_content(ROOT / 'public/assets/models/vehicles/ambulance-v1.glb', source / 'car-atlas.png')

    def test_fire_ladder_must_remain_a_separate_hinge_with_its_declared_axis(self):
        source = ROOT / 'art-source/vehicle-models/fire-truck-ladder-1/v1'
        rig = read(source / 'rig.json')
        rig['equipmentNodes'][0]['extras']['hinge_axis_gltf'] = [1, 0, 0]
        with self.assertRaisesRegex(ValueError, 'Equipment tags changed'):
            glb_content(ROOT / 'public/assets/models/vehicles/fire-truck-ladder-1-v1.glb',
                        source / 'car-atlas.png', read(source / 'geometry-audit.json'), rig)

    def test_default_replay_inputs_produce_the_retained_red_atlas(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'variant'
            transfer('compact-4', HERE / 'compact-variant-template.json', out)
            self.assertEqual(digest(out / 'atlas.png'),
                             digest(ROOT / 'art-source/vehicle-models/compact-4/v1/car-atlas.png'))

    def test_changed_rig_is_rejected_before_creating_a_workspace(self):
        with tempfile.TemporaryDirectory() as tmp:
            out, config_path = Path(tmp) / 'variant', Path(tmp) / 'config.json'
            config = read(HERE / 'compact-variant-template.json')
            config['rigSha256'] = '0' * 64
            write(config_path, config)
            with self.assertRaisesRegex(ValueError, 'Template bytes changed: rig.json'):
                transfer('compact-4', config_path, out)
            self.assertFalse(out.exists())


if __name__ == '__main__':
    unittest.main()
