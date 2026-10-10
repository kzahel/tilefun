"""Tests for fitting, measurement semantics and source/overwrite protection."""
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from pipeline import calibrate, compare, digest, initialize, project, reference, vehicle_spec


class AuthoringPipelineTest(unittest.TestCase):
    def test_calibration_recovers_camera_and_original_crop_coordinates(self):
        expected = {"azimuth": -90, "elevation": 42, "horizontalScale": 1.04,
                    "verticalStretch": 1.21, "origin": [30.5, 51.5]}
        marks = []
        for world in [(-3, 7.5, 20.2), (13, 7.5, 20.2), (-3, -7.5, 20.2),
                      (13, -7.5, 20.2), (-17, -11.75, 0), (17, -11.75, 0)]:
            pixel = project(world, expected)
            marks.append({"world": world, "pixel": [pixel[0]-16, pixel[1]]})
        camera, residual = calibrate({"id": "east", "camera": {"azimuth": -90}, "offset": [16, 0], "landmarks": marks})
        for key in ["elevation", "horizontalScale", "verticalStretch"]:
            self.assertAlmostEqual(camera[key], expected[key], places=9)
        self.assertLess(residual["maxPixels"], 1e-9)

    def test_unconstrained_height_is_rejected(self):
        view = {"id": "east", "camera": {"azimuth": -90}, "offset": [0, 0],
                "landmarks": [{"world": [x, y, 0], "pixel": [x+32, y+40]} for x, y in [(0, 0), (2, 0), (0, 2), (2, 2)]]}
        with self.assertRaisesRegex(ValueError, "do not constrain"):
            calibrate(view)

    def test_wrong_facing_is_rejected(self):
        view = {"id": "east", "camera": {"azimuth": -90}, "offset": [0, 0],
                "landmarks": [{"world": [x, y, z], "pixel": [32-x, 40-y-z]} for x, y, z in [(0, 0, 0), (2, 0, 0), (0, 2, 0), (0, 0, 2)]]}
        with self.assertRaisesRegex(ValueError, "inconsistent facing"):
            calibrate(view)

    def test_color_measure_does_not_hide_missing_silhouette(self):
        a = Image.new("RGBA", (3, 1))
        b = Image.new("RGBA", (3, 1))
        a.putpixel((0, 0), (10, 20, 30, 255))
        a.putpixel((1, 0), (10, 20, 30, 255))
        b.putpixel((0, 0), (10, 20, 30, 255))
        b.putpixel((2, 0), (10, 20, 30, 255))
        stats, diff = compare(a, b)
        self.assertEqual(stats["silhouetteIoU"], 1/3)
        self.assertEqual(stats["rgbMAEOnIntersection"], 0)
        self.assertEqual(stats["sourceOnlyPixels"], 1)
        self.assertEqual(stats["renderOnlyPixels"], 1)
        self.assertEqual(diff.getpixel((1, 0)), (238, 91, 110))
        stats, _ = compare(a, b, Image.new("L", a.size, 255))
        self.assertIsNone(stats["silhouetteIoU"])
        self.assertIsNone(stats["rgbMAEOnIntersection"])

    def test_no_opaque_overlap_has_no_color_score(self):
        a = Image.new("RGBA", (2, 2), (10, 20, 30, 255))
        stats, _ = compare(a, Image.new("RGBA", a.size))
        self.assertEqual(stats["silhouetteIoU"], 0)
        self.assertIsNone(stats["rgbMAEOnIntersection"])

    def test_exact_source_freeze_detects_tampering_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = root / "source.png"
            Image.new("RGBA", (16, 12), (12, 34, 56, 255)).save(image)
            spec = {"assetId": "table", "source": {"image": str(image), "sha256": digest(image)},
                    "views": [{"id": "front", "rect": [2, 3, 8, 6], "anchor": [4, 5]}]}
            out = root / "workspace"
            recipe = initialize(spec, out)
            with Image.open(out / "refs/front.png") as frozen:
                self.assertEqual(frozen.size, (8, 6))
            self.assertEqual(reference(out / "recipe.json", recipe["views"][0], (8, 6)).getpixel((0, 0)), (12, 34, 56, 255))
            with self.assertRaises(FileExistsError):
                initialize(spec, out)
            Image.new("RGBA", (8, 6), (255, 0, 0, 255)).save(out / "refs/front.png")
            with self.assertRaisesRegex(ValueError, "Frozen reference changed"):
                reference(out / "recipe.json", recipe["views"][0], (8, 6))
            spec["source"]["sha256"] = "0"*64
            with self.assertRaisesRegex(ValueError, "atlas hash differs"):
                initialize(spec, root / "bad")
            self.assertFalse((root / "bad").exists())

    def test_bad_crop_creates_no_partial_workspace(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = root / "source.png"
            Image.new("RGBA", (8, 8)).save(image)
            spec = {"assetId": "table", "source": {"image": str(image), "sha256": digest(image)},
                    "views": [{"id": "front", "rect": [0, 0, 9, 8]}]}
            with self.assertRaisesRegex(ValueError, "outside the atlas"):
                initialize(spec, root / "bad")
            self.assertFalse((root / "bad").exists())

    def test_unknown_vehicle_fails_instead_of_using_another_sprite(self):
        with self.assertRaisesRegex(ValueError, "Unknown vehicle"):
            vehicle_spec("unknown")


if __name__ == "__main__":
    unittest.main()
