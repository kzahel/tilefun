"""Ensure family reuse refuses real shape/paint/physics disagreements."""
import copy
import unittest
from PIL import Image
from transfer_variant import correspondences


class TransferTests(unittest.TestCase):
    def fixture(self):
        image = Image.new('RGBA', (4, 2))
        a, b, red = (50, 100, 200, 255), (60, 120, 220, 255), (210, 50, 80, 255)
        image.putpixel((0, 0), a)
        image.putpixel((1, 0), b)
        image.putpixel((2, 0), red)
        image.putpixel((3, 0), (220, 80, 90, 255))
        metadata = {'anchor': [1, 2], 'footprint': [0, 0, 2, 2], 'colliders': [], 'depthOffset': 0}
        base = {'views': [{'id': 'east', 'rect': [0, 0, 2, 2], 'metadata': metadata}]}
        target = copy.deepcopy(base)
        target['views'][0]['rect'] = [2, 0, 2, 2]
        return image, base, target, a, red

    def test_palette_transfer_preserves_exact_correspondence(self):
        image, base, target, blue, red = self.fixture()
        mapping, checks = correspondences(base, target, image)
        self.assertEqual(mapping[blue], red)
        self.assertEqual(checks[0]['opaqueSourcePixels'], 2)

    def test_shape_change_requires_geometry_fit(self):
        image, base, target, _, _ = self.fixture()
        image.putpixel((2, 1), (210, 50, 80, 255))
        with self.assertRaisesRegex(ValueError, 'silhouette differs'):
            correspondences(base, target, image)

    def test_one_colour_cannot_change_semantics_across_pixels(self):
        image, base, target, blue, _ = self.fixture()
        image.putpixel((1, 0), blue)
        with self.assertRaisesRegex(ValueError, 'inconsistent palette'):
            correspondences(base, target, image)

    def test_physical_layout_change_requires_new_template(self):
        image, base, target, _, _ = self.fixture()
        target['views'][0]['metadata']['anchor'][0] += 1
        with self.assertRaisesRegex(ValueError, 'anchor differs'):
            correspondences(base, target, image)


if __name__ == '__main__':
    unittest.main()
