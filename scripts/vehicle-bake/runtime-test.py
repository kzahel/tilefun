"""Regression checks for larger fixed-pixel captures; does not author bus art."""
import importlib.util
from pathlib import Path
import unittest

from PIL import Image

spec = importlib.util.spec_from_file_location('runtime_export', Path(__file__).with_name('runtime-export.py'))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class NativePacking(unittest.TestCase):
    def test_viewport_size_does_not_change_pixels_or_ground_origin(self):
        expected = None
        # The same native artwork centered at a ground origin is independent of
        # transparent capture padding, including viewports wider than the sheet.
        for n in (128, 224, 256):
            with self.subTest(frame=n):
                frame = Image.new('RGBA', (n, n))
                pixels = Image.new('RGBA', (70, 56), (241, 211, 139, 255))
                pixels.putpixel((13, 27), (115, 140, 168, 255))
                frame.paste(pixels, (n // 2 - 35, n // 2 - 45))
                sheet = Image.new('RGBA', (192, 896))
                for row in range(4):
                    rect, _ = runtime.pack_frame(sheet, frame, row, [n, n], [n // 2, n // 2])
                    self.assertEqual(rect, [61, row * 224 + 99, 70, 56])
                if expected is None:
                    expected = sheet.tobytes()
                self.assertEqual(sheet.tobytes(), expected)

    def test_larger_capture_can_use_its_native_extent(self):
        frame = Image.new('RGBA', (256, 256))
        frame.paste((58, 58, 80, 255), (58, 20, 198, 192))
        sheet = Image.new('RGBA', (192, 896))
        rect, _ = runtime.pack_frame(sheet, frame, 2, [256, 256], [128, 128])
        self.assertEqual(rect, [26, 484, 140, 172])
        self.assertEqual(sheet.getchannel('A').getbbox(), (26, 484, 166, 656))

    def test_rejects_clipping_even_for_one_occupied_pixel(self):
        for point in ((0, 128), (20, 128), (235, 128), (128, 0), (128, 210)):
            with self.subTest(pixel=point):
                frame = Image.new('RGBA', (256, 256))
                frame.putpixel(point, (241, 211, 139, 1))
                with self.assertRaises(AssertionError):
                    runtime.pack_frame(Image.new('RGBA', (192, 896)), frame, 1, [256, 256], [128, 128])

    def test_rejects_wrong_size_and_ground_origin(self):
        frame = Image.new('RGBA', (128, 128), (255, 255, 255, 255))
        for size, origin in (([256, 256], [128, 128]), ([128, 128], [64, 92])):
            with self.assertRaises(AssertionError):
                runtime.pack_frame(Image.new('RGBA', (192, 896)), frame, 0, size, origin)


if __name__ == '__main__':
    unittest.main()
