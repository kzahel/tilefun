"""Paint safety controls use actual retained GLBs and deliberately bad inputs."""
import importlib.util
import unittest
from pathlib import Path

from PIL import Image

SPEC = importlib.util.spec_from_file_location("paint", Path(__file__).with_name("paint-variants.py"))
paint = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(paint)


class PaintSafety(unittest.TestCase):
    def test_unknown_color_is_rejected(self):
        with self.assertRaisesRegex(AssertionError, "Unknown source role"):
            paint.role_mask(Image.new("RGBA", (1, 1), (1, 2, 3, 255)),
                            {"paintColors": [[4, 5, 6]], "protectedColors": [[7, 8, 9]]})

    def test_ambiguous_role_is_rejected(self):
        with self.assertRaises(AssertionError):
            paint.role_mask(Image.new("RGBA", (1, 1), (1, 2, 3, 255)),
                            {"paintColors": [[1, 2, 3]], "protectedColors": [[1, 2, 3]]})

    def test_secondary_does_not_recolor_protected_pixels(self):
        image = Image.new("RGBA", (3, 1), (58, 58, 80, 255))
        roles = Image.new("L", (3, 1))
        roles.putpixel((0, 0), 1)
        roles.putpixel((1, 0), 1)
        zones = Image.new("L", (3, 1), 1)
        zones.putpixel((0, 0), 0)
        result, counts = paint.recolor(image, roles, [[200, 40, 50]], zones, [[240, 220, 180]])
        self.assertEqual(list(result.get_flattened_data()), [(200, 40, 50, 255), (240, 220, 180, 255), (58, 58, 80, 255)])
        self.assertEqual(counts, {"primary": 1, "secondary": 1, "protected": 1})

    def test_atlas_replacement_preserves_actual_three_family_geometry(self):
        config = paint.read(paint.CONFIG)
        for family in config["families"].values():
            data = (paint.ROOT / family["glb"]).read_bytes()
            gltf, binary = paint.decode(data)
            replacement = paint.replace_atlas(data, paint.embedded(gltf, binary))
            self.assertTrue(paint.prove_geometry(data, replacement)["originalBinaryPrefixExact"])

    def test_modified_original_buffer_is_rejected(self):
        family = paint.read(paint.CONFIG)["families"]["beetle"]
        data = (paint.ROOT / family["glb"]).read_bytes()
        gltf, binary = paint.decode(data)
        replacement = bytearray(paint.replace_atlas(data, paint.embedded(gltf, binary)))
        json_size = int.from_bytes(replacement[12:16], "little")
        replacement[28 + json_size] ^= 1
        with self.assertRaisesRegex(AssertionError, "Original binary data changed"):
            paint.prove_geometry(data, bytes(replacement))

    def test_palette_ramps_remain_ordered_and_ink_is_separate(self):
        def linear(v):
            v /= 255
            return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
        ink = sum(linear(v) for v in [58, 58, 80])
        for ramp in paint.read(paint.CONFIG)["ramps"].values():
            lightness = [sum(a * b for a, b in zip(c, [.2126, .7152, .0722])) for c in ramp]
            self.assertTrue(all(b > a + 5 for a, b in zip(lightness, lightness[1:])))
            self.assertNotIn([58, 58, 80], ramp)
            self.assertTrue(all(sum(linear(v) for v in color) > ink + .01 for color in ramp),
                            "Paint must leave the shared outline shader's ink threshold intact")


if __name__ == "__main__":
    unittest.main()
