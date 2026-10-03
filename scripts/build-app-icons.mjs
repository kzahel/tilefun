import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

// Repackage the existing pixel-art favicon for app launchers. Integer scaling
// preserves its pixels; an opaque background also works for Apple touch icons.
const source = PNG.sync.read(await readFile(new URL("../public/favicon.png", import.meta.url)));
const output = new URL("../public/icons/", import.meta.url);
await mkdir(output, { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const icon = new PNG({ width: size, height: size });
  const scale = Math.floor(size / Math.max(source.width, source.height));
  const left = Math.floor((size - source.width * scale) / 2);
  const top = Math.floor((size - source.height * scale) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const sx = Math.floor((x - left) / scale);
      const sy = Math.floor((y - top) / scale);
      const inside = sx >= 0 && sx < source.width && sy >= 0 && sy < source.height;
      const sourceOffset = (sy * source.width + sx) * 4;
      const alpha = inside ? source.data[sourceOffset + 3] / 255 : 0;
      for (const [channel, background] of [26, 26, 46].entries()) {
        icon.data[offset + channel] = Math.round(
          (inside ? source.data[sourceOffset + channel] * alpha : 0) + background * (1 - alpha),
        );
      }
      icon.data[offset + 3] = 255;
    }
  }
  await writeFile(new URL(name, output), PNG.sync.write(icon));
}
console.log("Built app icons from public/favicon.png.");
