import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { expect, it } from "vitest";
import { WATCHED_FAUNA, WATCHED_HUNTERS } from "../../tests-support/AnimalScenes.suite.js";
import { ANIMAL_BROWSER_ENTRIES } from "./AnimalBrowserData.js";

/** The animal browser previews draw these sheet cells (AnimalPreview: column
 * `clip.start + frame`, row = facing). Every animal's travel clip must paint and
 * animate in all four facings; the browser spec draws representatives. */
const sheets = new Map<string, PNG>();
const sheet = (path: string) => {
  const png = sheets.get(path) ?? PNG.sync.read(readFileSync(`public/${path}`));
  sheets.set(path, png);
  return png;
};
function cell(png: PNG, x0: number, y0: number, w: number, h: number) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    png.data.copy(
      out,
      y * w * 4,
      ((y0 + y) * png.width + x0) * 4,
      ((y0 + y) * png.width + x0 + w) * 4,
    );
  return out;
}
const painted = (pixels: Buffer) => pixels.some((v, i) => i % 4 === 3 && v > 0);

it.each(ANIMAL_BROWSER_ENTRIES)("$name travel preview paints and animates in every facing", (a) => {
  const clip = a.locomotion,
    { spriteWidth: w, spriteHeight: h } = a.sprite;
  expect(clip?.count, `${a.name} has an authored travel clip`).toBeGreaterThan(1);
  if (!clip) return;
  const png = sheet(a.image);
  for (const [facing, direction] of ["Front", "Back", "Left", "Right"].entries()) {
    const frames = Array.from({ length: clip.count }, (_, i) =>
      cell(png, (clip.start + i) * w, facing * h, w, h),
    );
    expect(painted(frames[0] ?? Buffer.alloc(0)), `${a.name} ${direction} paints`).toBe(true);
    expect(
      frames.some((f) => !f.equals(frames[0] ?? f)),
      `${a.name} ${direction} travel pixels advance`,
    ).toBe(true);
  }
});

it("gives each watched animal an animated action or hunter display preview", () => {
  const entry = (id: string) => ANIMAL_BROWSER_ENTRIES.find((e) => e.id === id);
  for (const animal of WATCHED_FAUNA.filter((a) => !a.hop))
    expect(entry(animal.species)?.action, animal.species).toMatchObject({
      name: "action",
      count: expect.any(Number),
    });
  for (const animal of WATCHED_HUNTERS)
    expect(entry(animal.species)?.action, animal.species).toMatchObject({ name: "display" });
  for (const animal of [...WATCHED_FAUNA.filter((a) => !a.hop), ...WATCHED_HUNTERS])
    expect(entry(animal.species)?.action?.count, animal.species).toBeGreaterThan(1);
});
