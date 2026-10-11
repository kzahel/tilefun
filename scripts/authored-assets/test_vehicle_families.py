"""Check family classification against the established transfer gate and traps."""
from contextlib import redirect_stdout
import io
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from audit_vehicle_families import ROOT, audit, best_overlap, palette_pattern, palette_transfer
from pipeline import vehicle_spec
from transfer_variant import correspondences


def pixels(values):
    image = Image.new("RGBA", (len(values), 1))
    image.putdata(values)
    return image


RED = (200, 30, 30, 255)
BLUE = (30, 30, 200, 255)
GRAY = (80, 80, 80, 255)


class VehicleFamilyTests(unittest.TestCase):
    def test_palette_consistency_spans_views(self):
        before = [pixels([RED])] * 4
        after = [pixels([BLUE])] * 3 + [pixels([GRAY])]
        result = palette_transfer(before, after)
        self.assertFalse(result["consistent"])
        self.assertEqual(result["conflictingPixels"], 1)
        self.assertNotEqual(palette_pattern(before), palette_pattern(after))

    def test_merging_colors_is_directional(self):
        before, after = [pixels([RED, BLUE])] * 4, [pixels([GRAY, GRAY])] * 4
        self.assertTrue(palette_transfer(before, after)["consistent"])
        self.assertFalse(palette_transfer(after, before)["consistent"])
        self.assertNotEqual(palette_pattern(before), palette_pattern(after))

    def test_best_map_counts_minimum_exceptions_not_first_pixel(self):
        before = [pixels([RED] * 10)] * 4
        after = [pixels([GRAY] + [BLUE] * 9)] * 4
        result = palette_transfer(before, after)
        self.assertEqual(result["conflictingPixels"], 4)
        self.assertEqual(result["map"][0]["to"], list(BLUE))

    def test_alpha_difference_cannot_be_a_recolor(self):
        before = [pixels([RED])] * 4
        for alpha in (0, 56):
            after = [pixels([(*RED[:3], alpha)])] * 4
            self.assertFalse(palette_transfer(before, after)["consistent"])

    def test_transparent_rgb_does_not_define_a_material(self):
        before = [pixels([RED, (255, 0, 0, 0)])] * 4
        after = [pixels([BLUE, (0, 255, 0, 0)])] * 4
        self.assertTrue(palette_transfer(before, after)["consistent"])
        self.assertEqual(palette_pattern(before), palette_pattern(after))

    def test_translation_does_not_hide_an_extra_contour_pixel(self):
        a = Image.new("RGBA", (5, 5))
        b = Image.new("RGBA", (5, 5))
        for y in range(2, 5):
            for x in range(2, 5):
                a.putpixel((x, y), RED)
                b.putpixel((x - 1, y), BLUE)
        a.putpixel((2, 1), RED)
        result = best_overlap(a, b)
        self.assertEqual(result["translationB"], [1, 0])
        self.assertEqual(result["differentPixels"], 1)
        self.assertLess(result["iou"], 1)

    def test_every_ordered_bank_pair_agrees_with_existing_transfer_gate(self):
        with tempfile.TemporaryDirectory() as directory, redirect_stdout(io.StringIO()):
            report = audit(Path(directory) / "audit")
        ids = [v["id"] for v in report["vehicles"]]
        expected = {}
        for pair in report["exactAlphaPairs"]:
            expected[pair["a"], pair["b"]] = pair["strictTransferAToB"]
            expected[pair["b"], pair["a"]] = pair["strictTransferBToA"]
        source = Image.open(ROOT / report["source"]["path"]).convert("RGBA")
        specs = {identifier: vehicle_spec(identifier) for identifier in ids}
        passing = 0
        for a in ids:
            for b in ids:
                if a == b:
                    continue
                try:
                    correspondences(specs[a], specs[b], source)
                    actual = True
                except ValueError:
                    actual = False
                self.assertEqual(actual, expected.get((a, b), False), f"{a} -> {b}")
                passing += actual
        self.assertEqual(len(ids), 45)
        self.assertEqual(passing, 46)


if __name__ == "__main__":
    unittest.main()
