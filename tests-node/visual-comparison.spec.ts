import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
// @ts-expect-error pngjs has no bundled declarations
import pngjs from "pngjs";

const visualOptions = { threshold: 0.01, maxDiffPixels: 0 };

test("visual comparison tolerates color rounding but rejects missing geometry and size changes", () => {
  const { PNG } = pngjs;
  const image = PNG.sync.read(
    readFileSync(new URL("../tests/fixtures/interior-approved/profile-arch.png", import.meta.url)),
  );
  // A one-channel rounding difference is harmless, even under a zero-pixel budget.
  image.data[0] += 1;
  expect(PNG.sync.write(image)).toMatchSnapshot("profile-arch.png", visualOptions);
  // A large color change inside a flat region must still count as a mismatch.
  const offset = (10 * image.width + 10) * 4;
  const original = image.data[offset];
  image.data[offset] = 255;
  expect(PNG.sync.write(image)).not.toMatchSnapshot("profile-arch.png", visualOptions);
  image.data[offset] = original;
  // Removing the arch entirely must fail, without consuming a percentage budget.
  for (let y = 81; y < 136; y++)
    for (let x = 96; x < 128; x++) {
      const offset = (y * image.width + x) * 4;
      image.data[offset] = 23;
      image.data[offset + 1] = 30;
      image.data[offset + 2] = 42;
    }
  expect(PNG.sync.write(image)).not.toMatchSnapshot("profile-arch.png", visualOptions);
  const resized = new PNG({ width: image.width + 1, height: image.height });
  expect(PNG.sync.write(resized)).not.toMatchSnapshot("profile-arch.png", visualOptions);
});
