#!/usr/bin/env python3
"""Regression and adversarial checks for the three explicit expansion adapters."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

from PIL import Image


def import_script(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


a = import_script('build-family-sheets')
e = import_script('build-family-expansion')


class ExpansionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sheets = {row['id']: row for row in a.load(a.ROOT / 'public/data/art-catalog.json')['sheets']}
        cls.images = {key: Image.open(a.ROOT / 'public' / cls.sheets[key]['image']).convert('RGBA')
                      for key in ('modern-interiors', 'me-complete', 'interiors-door-1', 'interiors-door-1-locked')}
        cls.packets = [a.load(a.PACKETS / name) for name in
                       ('RB01-room-builder-path-arch.json', 'E03-playground-tubes.json', 'A01-animation.json')]
        cls.families = e.build_expansion(a, cls.images, cls.sheets)

    def test_exact_coverage_and_component_frame_roles(self):
        cards = [[member for group in family['groups'] for member in group['members']]
                 for family in self.families]
        self.assertEqual([len(members) for members in cards], [25, 19, 2])
        self.assertEqual([sum(len(value['recordIds']) for member in members for value in member['variants'])
                          for members in cards], [25, 25, 9])
        self.assertTrue(all(member['kind'] == 'component' for members in cards[:2] for member in members))
        self.assertTrue(all(member['kind'] == 'frame' and member['variantLabel'] == 'Frame' for member in cards[2]))
        self.assertEqual([len(group['members']) for group in self.families[0]['groups']], [17, 6, 2])

    def test_bounded_examples_and_open_sections(self):
        room = self.families[0]
        self.assertEqual([example['id'] for example in room['examples']], [key for key, _ in e.RB_EXAMPLES])
        self.assertEqual([example.get('groupLabel') for example in room['examples']],
                         [None] * 6 + ['Open path sections'] * 2)
        arch = next(example for example in room['examples'] if example['id'] == 'stone-arch-body-three-rows')
        shadow = next(example for example in room['examples'] if example['id'] == 'stone-arch-with-shadow')
        self.assertEqual(arch['variants'][0]['sprite']['size'], [32, 48])
        self.assertEqual(shadow['variants'][0]['sprite']['size'], [32, 56])
        self.assertEqual([member['variants'][0]['sprite']['size'] for member in room['groups'][2]['members']], [[16, 8]] * 2)
        self.assertEqual([example['id'] for example in self.families[1]['examples']], [key for key, _, _ in e.TUBE_EXAMPLES])

    def test_only_three_tube_cards_have_color_variants(self):
        cards = self.families[1]['groups'][0]['members']
        self.assertEqual([card['number'] for card in cards if len(card['variants']) > 1], [15, 16, 17])
        for card in cards:
            self.assertEqual([value['id'] for value in card['variants']],
                             ['ochre', 'blue', 'red'] if card['number'] in (15, 16, 17) else ['ochre'])
        self.assertEqual(a.normalized_bytes(a.render(cards[1]['variants'][0]['sprite'], self.images)),
                         a.normalized_bytes(a.render(cards[5]['variants'][0]['sprite'], self.images)))
        for left, right in ((3, 7), (8, 9)):
            self.assertNotEqual(a.normalized_bytes(a.render(cards[left]['variants'][0]['sprite'], self.images)),
                                a.normalized_bytes(a.render(cards[right]['variants'][0]['sprite'], self.images)))

    def test_tubes_require_source_over_and_keep_padding(self):
        for example in self.families[1]['examples']:
            sprite = example['variants'][0]['sprite']
            self.assertTrue(all(layer['blend'] == 'over' for layer in sprite['layers']))
        example = self.families[1]['examples'][2]
        sprite = example['variants'][0]['sprite']
        replacement = copy.deepcopy(sprite)
        for layer in replacement['layers']:
            del layer['blend']
        self.assertNotEqual(a.sha(a.normalized_bytes(a.render(sprite, self.images))),
                            a.sha(a.normalized_bytes(a.render(replacement, self.images))))
        sprite = self.families[1]['examples'][1]['variants'][0]['sprite']
        self.assertEqual(sprite['size'], [64, 64])
        self.assertEqual([layer['at'] for layer in sprite['layers']], [[0, 16], [16, 0], [32, 16]])

    def test_animation_preserves_source_frames_and_gif_evidence(self):
        family = self.families[2]
        self.assertEqual(family['variants'], [{'id': 'frame-1', 'label': 'Frame 1'}])
        for number, example in enumerate(family['examples']):
            self.assertEqual(example['animation'],
                             {'frameDurationsMs': [300, 100, 100, 100, 300] if number == 0 else [500, 100, 100, 100], 'loop': True})
            self.assertEqual([value['id'] for value in example['variants']],
                             [f'frame-{index + 1}' for index in range(5 if number == 0 else 4)])
            self.assertTrue(all(value['sprite']['size'] == [16, 32] for value in example['variants']))
        frames = [card['variants'][0]['sprite'] for card in family['groups'][0]['members']]
        self.assertEqual(a.normalized_bytes(a.render(frames[0], self.images)),
                         a.normalized_bytes(a.render(frames[1], self.images)))

    def test_rejects_changed_review_pin(self):
        pins = dict(e.PINS)
        pins['A01-animation-review.md'] = '0' * 64
        with patch.object(e, 'PINS', pins), self.assertRaisesRegex(ValueError, 'proposal/review changed'):
            e.build_expansion(a, self.images, self.sheets)

    def test_rejects_changed_packed_offset_and_unclosed_tube(self):
        packet = copy.deepcopy(self.packets[0])
        packet['candidates'][-1]['packedSheetOffsetAliases'][0]['rect'][0] += 1
        with self.assertRaisesRegex(ValueError, 'offset lineage changed'):
            e.build_room_builder(a, packet, self.images, self.sheets)
        packet = copy.deepcopy(self.packets[1])
        packet['experiments']['assemblies'][0]['portEvaluation']['unmatchedPorts'].append({'edge': 'left'})
        with self.assertRaisesRegex(ValueError, 'unmatched continuation cut'):
            e.build_tubes(a, packet, self.images, self.sheets)

    def test_rejects_changed_gif_order_duration_and_game_contract(self):
        for mutation, message in (
            (lambda packet: packet['sourceGifDemonstrations'][0]['frames'][0].update(exactSourceFrameIds=['A01-02']), 'correspondence changed'),
            (lambda packet: packet['sourceGifDemonstrations'][0]['frames'][0].update(durationMs=301), 'duration changed'),
            (lambda packet: packet['sequences'][0]['gameplayPlayback'].update(loop=True), 'game playback changed'),
        ):
            packet = copy.deepcopy(self.packets[2])
            mutation(packet)
            with self.assertRaisesRegex(ValueError, message):
                e.build_doors(a, packet, self.images, self.sheets)

    def test_rejects_changed_committed_source_pixels(self):
        images = dict(self.images)
        images['interiors-door-1'] = images['interiors-door-1'].copy()
        images['interiors-door-1'].putpixel((2, 12), (255, 0, 0, 255))
        with self.assertRaisesRegex(ValueError, 'source pixels changed'):
            e.build_doors(a, self.packets[2], images, self.sheets)

    def test_build_reads_no_ignored_original_sources_or_gifs(self):
        original_read = Path.read_bytes
        original_text = Path.read_text
        read_paths = []

        def track_read(method):
            def read(path, *args, **kwargs):
                read_paths.append(path.resolve())
                self.assertFalse(path.resolve().is_relative_to((a.ROOT / 'assets').resolve()))
                self.assertNotEqual(path.suffix.lower(), '.gif')
                return method(path, *args, **kwargs)
            return read

        with patch.object(Path, 'read_bytes', track_read(original_read)), patch.object(Path, 'read_text', track_read(original_text)):
            self.assertEqual(e.build_expansion(a, self.images, self.sheets), self.families)
        self.assertTrue(read_paths)


if __name__ == '__main__':
    unittest.main()
