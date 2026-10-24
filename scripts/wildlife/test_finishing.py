"""Narrow tests for the paint regressions; no Blender or browser required."""
import sys
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'art-source/wildlife-v2/finishing-v1'))
from painter import affine_paint, compose_surface, rgba_palette, shaded_edge, surface_paint


class FinishingTests(unittest.TestCase):
    palette = rgba_palette(dict(B='#92999b', H='#bec5c3', M='#727a7f', C='#deddd0', K='#272f34', N='#242c31', E='#d3b066'))

    def test_one_pixel_limb_stays_one_pixel_wide(self):
        record = dict(volumes=[dict(name='leg', key='B', depth=1, points=[[5, 2], [5, 10]])])
        image = compose_surface(16, record, self.palette)
        self.assertEqual(image.getbbox(), (5, 2, 6, 11))
        self.assertEqual(sum(bool(alpha) for alpha in image.getchannel('A').get_flattened_data()), 9)

    def test_coat_edge_keeps_the_source_silhouette(self):
        record = dict(volumes=[dict(name='body', key='B', depth=1, points=[[3, 3], [10, 3], [10, 9], [3, 9]])])
        raw = surface_paint(16, record['volumes'], self.palette)
        finished = compose_surface(16, record, self.palette)
        self.assertEqual(raw.getchannel('A').tobytes(), finished.getchannel('A').tobytes())
        self.assertNotEqual(finished.getpixel((3, 5)), raw.getpixel((3, 5)))
        self.assertNotEqual(finished.getpixel((3, 5)), self.palette['K'])
        self.assertEqual(finished.getpixel((6, 6)), raw.getpixel((6, 6)))

    def test_actual_dark_fur_nose_and_light_markings_are_preserved(self):
        image = Image.new('RGBA', (8, 8))
        for x, key in enumerate(['K', 'N', 'C', 'E'], start=1):
            image.putpixel((x, 3), self.palette[key])
        self.assertEqual(shaded_edge(image, self.palette).tobytes(), image.tobytes())

    def test_explicit_depth_and_tie_order_are_stable(self):
        volumes = [dict(name='coat', key='B', depth=2, points=[[2, 2], [8, 2], [8, 8], [2, 8]]),
                   dict(name='nose', key='N', depth=1, points=[[4, 4], [5, 4], [5, 5], [4, 5]])]
        a = surface_paint(12, volumes, self.palette)
        b = surface_paint(12, list(reversed(volumes)), self.palette)
        self.assertEqual(a.tobytes(), b.tobytes())
        self.assertEqual(a.getpixel((4, 4)), self.palette['N'])

    def test_identity_basis_retains_authored_paint_exactly(self):
        image = Image.new('RGBA', (16, 16))
        ImageDraw.Draw(image).rectangle((3, 4, 8, 9), fill=self.palette['B'])
        image.putpixel((5, 5), self.palette['C'])
        basis = [[10, 1], [0, -7]]
        painted = affine_paint(image, [6, 7], basis, [6, 7], basis)
        self.assertEqual(painted.tobytes(), image.tobytes())

    def test_moving_rigid_paint_keeps_its_marking(self):
        image = Image.new('RGBA', (16, 16))
        image.putpixel((5, 5), self.palette['C'])
        basis = [[10, 0], [0, -7]]
        painted = affine_paint(image, [5, 5], basis, [8, 7], basis)
        self.assertEqual(painted.getpixel((8, 7)), self.palette['C'])
        self.assertEqual(sum(bool(a) for a in painted.getchannel('A').get_flattened_data()), 1)

    def test_edge_on_part_requires_its_source_surface(self):
        self.assertIsNone(affine_paint(Image.new('RGBA', (16, 16)), [5, 5], [[10, 0], [0, -7]], [5, 5], [[10, 0], [0, 0]]))


if __name__ == '__main__':
    unittest.main()
