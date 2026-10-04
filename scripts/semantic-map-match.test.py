"""Regression checks for occurrence coverage and visually exact comparisons."""

import importlib.util
from pathlib import Path
import unittest

from PIL import Image

spec = importlib.util.spec_from_file_location(
    "semantic_map_match", Path(__file__).with_name("semantic-map-match.py")
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
Matcher = module.Matcher


class MatchTests(unittest.TestCase):
    def test_every_occurrence_and_full_rectangle_verification(self):
        sprite = Image.new("RGBA", (32, 32), (120, 40, 20, 255))
        sprite.putpixel((20, 20), (1, 2, 3, 200))
        master = Image.new("RGBA", (96, 64))
        master.paste(sprite, (0, 0))
        master.paste(sprite, (64, 32))
        master.paste(sprite, (32, 0))
        master.putpixel((52, 20), (1, 2, 3, 201))
        self.assertEqual(Matcher(master).find(sprite), [[0, 0, 32, 32], [64, 32, 32, 32]])

    def test_hidden_rgb_ignored_but_translucent_pixels_preserved(self):
        sprite = Image.new("RGBA", (16, 16), (255, 0, 0, 0))
        sprite.putpixel((8, 8), (10, 20, 30, 128))
        master = Image.new("RGBA", (16, 16), (0, 255, 0, 0))
        master.putpixel((8, 8), (10, 20, 30, 128))
        self.assertEqual(Matcher(master).find(sprite), [[0, 0, 16, 16]])
        master.putpixel((8, 8), (11, 20, 30, 128))
        self.assertEqual(Matcher(master).find(sprite), [])

    def test_small_and_non_multiple_dimensions(self):
        for size in [(8, 7), (19, 23)]:
            sprite = Image.new("RGBA", size, (30, 50, 70, 255))
            master = Image.new("RGBA", (48, 48))
            master.paste(sprite, (16, 16))
            self.assertEqual(Matcher(master).find(sprite), [[16, 16, *size]])

    def test_off_grid_is_explicitly_outside_default_search(self):
        sprite = Image.new("RGBA", (8, 8), (30, 50, 70, 255))
        master = Image.new("RGBA", (32, 32))
        master.paste(sprite, (3, 5))
        self.assertEqual(Matcher(master).find(sprite), [])
        self.assertEqual(Matcher(master, grid=1).find(sprite), [[3, 5, 8, 8]])

    def test_empty_candidate_rejected(self):
        with self.assertRaisesRegex(ValueError, "transparent"):
            Matcher(Image.new("RGBA", (32, 32))).find(Image.new("RGBA", (16, 16)))


if __name__ == "__main__":
    unittest.main()
