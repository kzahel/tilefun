import unittest
from PIL import Image
from pixel_style import ink
from silhouette_report import measure


class PixelStyleTest(unittest.TestCase):
    def test_inner_ink_cannot_inflate_silhouette_or_brighten_existing_ink(self):
        image = Image.new("RGBA", (7, 7))
        for y in range(1, 6):
            for x in range(1, 6):
                image.putpixel((x, y), (80, 167, 232, 255))
        image.putpixel((1, 2), (20, 25, 30, 255))
        image.putpixel((4, 1), (80, 167, 232, 180))
        rendered = ink(image)
        self.assertEqual(rendered.getchannel("A").tobytes(), image.getchannel("A").tobytes())
        self.assertEqual(rendered.getpixel((1, 2)), (20, 25, 30, 255))
        self.assertEqual(rendered.getpixel((1, 1)), (58, 58, 80, 255))
        self.assertEqual(rendered.getpixel((3, 3)), image.getpixel((3, 3)))

    def test_outer_ink_changes_occupancy_and_boundary_metrics_expose_shift(self):
        image = Image.new("RGBA", (7, 7))
        image.putpixel((3, 3), (80, 167, 232, 255))
        outer = ink(image, mode="outer")
        stats = measure(image, outer)
        self.assertEqual(stats["renderOnly"], 4)
        self.assertEqual(stats["iou"], .2)
        shifted = Image.new("RGBA", image.size)
        shifted.putpixel((5, 3), (80, 167, 232, 255))
        self.assertEqual(measure(image, shifted)["meanBoundaryDistancePixels"], 2)

    def test_canvas_mismatch_and_invalid_outline_fail(self):
        with self.assertRaises(ValueError):
            measure(Image.new("RGBA", (4, 4)), Image.new("RGBA", (5, 5)))
        with self.assertRaises(ValueError):
            ink(Image.new("RGBA", (4, 4)), mode="blur")
