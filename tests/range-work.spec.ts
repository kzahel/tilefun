import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { required } from "../src/shared/required.js";

test.use({ channel: "chromium", deviceScaleFactor: 1 });
type Pose = {
  id: number;
  type: string;
  x: number;
  y: number;
  z: number;
  clip: number;
  column: number;
  row: number;
  parent: number;
  visible: boolean;
  screen: { left: number; top: number; width: number; height: number };
};
function spritePixels(png: PNG, pose: Pose, color: number[]) {
  const r = pose.screen,
    rows: Buffer[] = [];
  let painted = 0;
  for (
    let y = Math.max(0, Math.floor(r.top));
    y < Math.min(png.height, Math.ceil(r.top + r.height));
    y++
  ) {
    const left = Math.max(0, Math.floor(r.left)),
      right = Math.min(png.width, Math.ceil(r.left + r.width));
    rows.push(png.data.subarray((y * png.width + left) * 4, (y * png.width + right) * 4));
    for (let x = left; x < right; x++) {
      const i = (y * png.width + x) * 4;
      if (color.every((v, c) => Math.abs((png.data[i + c] ?? 0) - v) <= 3)) painted++;
    }
  }
  return { painted, pixels: Buffer.concat(rows).toString("base64") };
}
type Rect = Pose["screen"];
const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;
const isResource = (e: Pose) => e.type.startsWith("wildlife-resource-");
type Sheet = { png: PNG; frameWidth: number; frameHeight: number; anchor: [number, number] };
/** Screen box another animal can paint: its opaque atlas frame when it shares the
 * subject's sheet (else its whole sprite rectangle) plus its ground shadow. */
function paintBox(e: Pose, type: string, sheet: Sheet): Rect[] {
  const r = e.screen,
    scale = r.width / sheet.frameWidth,
    feetY = r.top + sheet.anchor[1] * scale;
  const shadow = { left: r.left, top: feetY - r.width / 5, width: r.width, height: r.width / 2.5 };
  if (e.type !== type) return [r, shadow];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let y = 0; y < sheet.frameHeight; y++)
    for (let x = 0; x < sheet.frameWidth; x++) {
      const sx = e.column * sheet.frameWidth + x,
        sy = e.row * sheet.frameHeight + y;
      if (!sheet.png.data[(sy * sheet.png.width + sx) * 4 + 3]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + 1);
      maxY = Math.max(maxY, y + 1);
    }
  if (minX > maxX) return [shadow];
  const body = {
    left: r.left + (minX - 1) * scale,
    top: r.top + (minY - 1) * scale,
    width: (maxX - minX + 2) * scale,
    height: (maxY - minY + 2) * scale,
  };
  return [body, shadow];
}
/** The subject's projected crop, with every pixel another animal could paint
 * masked (-1), so walking herd members neither split nor fake a frame change.
 * Staged resources stay visible; the sample key holds their state instead. */
function subjectCrop(png: PNG, a: Pose, all: Pose[], color: number[], sheet: Sheet) {
  const masks = all
    .filter((e) => e.id !== a.id && e.parent !== a.id && !isResource(e))
    .flatMap((e) => paintBox(e, a.type, sheet))
    .filter((r) => overlaps(r, a.screen));
  const pixels: number[] = [];
  let painted = 0;
  for (let y = Math.floor(a.screen.top); y < Math.ceil(a.screen.top + a.screen.height); y++)
    for (let x = Math.floor(a.screen.left); x < Math.ceil(a.screen.left + a.screen.width); x++) {
      const inside = x >= 0 && y >= 0 && x < png.width && y < png.height;
      if (!inside || masks.some((m) => overlaps(m, { left: x, top: y, width: 1, height: 1 }))) {
        pixels.push(-1);
        continue;
      }
      const i = (y * png.width + x) * 4;
      if (color.every((v, c) => Math.abs((png.data[i + c] ?? 0) - v) <= 3)) painted++;
      pixels.push(png.data.readUInt32BE(i));
    }
  return { painted, pixels };
}
const KINDS = [
  "horse",
  "giraffe",
  "beaver",
  "cow",
  "sheep",
  "donkey",
  "deer",
  "peacock",
  "raven",
  "hedgehog",
  "porcupine",
  "fox",
] as const;
// Species atlases are renderer-independent textures; Canvas draws every kind.
// GPU sprite drawing consumes the same scene and is compared with Canvas pixel
// for pixel in gpu-renderer.spec (renderer lab), so no per-species GPU variant.
for (const kind of KINDS)
  test(`${kind} range activity animates through the Worker`, async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await (async () => {
      const meta = JSON.parse(
        readFileSync(`public/demos/wildlife-v2/${kind}/behavior-v1/sprite.json`, "utf8"),
      );
      const sheet: Sheet = {
        ...meta,
        png: PNG.sync.read(
          readFileSync(`public/demos/wildlife-v2/${kind}/behavior-v1/${meta.image}`),
        ),
      };
      const action = meta.clips[
        kind === "hedgehog"
          ? "curled"
          : kind === "porcupine"
            ? "rattle"
            : kind === "fox"
              ? "eat"
              : kind === "deer"
                ? "browse"
                : kind === "peacock"
                  ? "display"
                  : kind === "raven"
                    ? "bury"
                    : kind === "horse"
                      ? "graze"
                      : kind === "giraffe"
                        ? "browse"
                        : kind === "cow"
                          ? "ruminate"
                          : kind === "sheep"
                            ? "bleat"
                            : kind === "donkey"
                              ? "roll"
                              : "build"
      ] as { start: number; count: number };
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-behavior-${kind}&renderer=canvas#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await canvas.scrollIntoViewIfNeeded();
      const poses = async (): Promise<Pose[]> =>
        JSON.parse((await canvas.getAttribute("data-work-actors")) ?? "[]");
      const subject = (all: Pose[]) =>
        all
          .filter(
            (a) =>
              a.type === (kind === "deer" ? "wildlife-deer-v1" : `wildlife-${kind}-provisional-v1`),
          )
          .sort((a, b) => a.id - b.id)[0];
      const color =
        kind === "hedgehog"
          ? [141, 116, 85]
          : kind === "porcupine"
            ? [105, 92, 79]
            : kind === "fox"
              ? [206, 115, 55]
              : kind === "deer"
                ? [173, 128, 80]
                : kind === "peacock"
                  ? [61, 108, 126]
                  : kind === "raven"
                    ? [38, 51, 61]
                    : kind === "horse"
                      ? [199, 137, 73]
                      : kind === "giraffe"
                        ? [196, 154, 92]
                        : kind === "cow"
                          ? [219, 222, 203]
                          : kind === "sheep"
                            ? [217, 221, 191]
                            : kind === "donkey"
                              ? [167, 170, 161]
                              : [118, 88, 61];
      const active = (p?: Pose) =>
        p?.visible && p.column >= action.start && p.column < action.start + action.count;
      await expect
        .poll(
          async () => {
            const all = await poses(),
              a = subject(all);
            return (
              !!active(a) &&
              (!["beaver", "raven"].includes(kind) ||
                all.some((e) => e.parent === a?.id && e.visible))
            );
          },
          { timeout: 45000, intervals: [30] },
        )
        .toBe(true);
      // Two atlas columns must draw different subject pixels while the Worker,
      // subject pose and camera stay still; only pixels unmasked in both count.
      const samples = new Map<string, { column: number; pixels: number[] }[]>();
      const key = (all: Pose[]) => {
        const a = subject(all);
        return active(a) && a
          ? JSON.stringify([
              a.x,
              a.y,
              a.z,
              a.row,
              a.screen,
              all
                .filter((e) => isResource(e) && overlaps(e.screen, a.screen))
                .map((e) => [e.type, e.x, e.y, e.z, e.column]),
            ])
          : undefined;
      };
      await expect
        .poll(
          async () => {
            // Fence the real Worker before each readback; the screenshot may take
            // longer than an animation frame on hosted CI. Dispatch the clicks:
            // pointer actionability waits for stable frames.
            await page.getByRole("button", { name: "Pause", exact: true }).dispatchEvent("click");
            await expect(canvas).toHaveAttribute("data-authority-running", "false");
            try {
              const all = await poses(),
                before = key(all),
                a = subject(all);
              if (!a || !before) return false;
              const png = PNG.sync.read(await canvas.screenshot());
              const after = await poses();
              expect(key(after)).toBe(before);
              const crop = subjectCrop(png, a, after, color, sheet);
              if (crop.painted <= 10) return false;
              const group = samples.get(before) ?? [];
              samples.set(before, group);
              const changed = group.some(
                (g) =>
                  g.column !== a.column &&
                  g.pixels.some(
                    (v, i) => v >= 0 && (crop.pixels[i] ?? -1) >= 0 && v !== crop.pixels[i],
                  ),
              );
              group.push({ column: a.column, pixels: crop.pixels });
              return changed;
            } finally {
              await page
                .getByRole("button", { name: "Resume", exact: true })
                .dispatchEvent("click");
            }
          },
          { timeout: 25000, intervals: [50] },
        )
        .toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const before = await poses(),
        a = subject(before);
      expect(a).toBeDefined();
      const png = PNG.sync.read(await canvas.screenshot({ path: `data/wildlife-174-${kind}.png` }));
      expect(a ? spritePixels(png, a, color).painted : 0).toBeGreaterThan(10);
      const stable = (all: Pose[]) =>
        all
          .map(({ type, x, y, z, clip, column, row, parent }) => ({
            type,
            x,
            y,
            z,
            clip,
            column,
            row,
            attached: parent === subject(all)?.id,
          }))
          .sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-reload-count", "1");
      expect(stable(await poses())).toEqual(stable(before));
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      if (kind === "hedgehog") {
        expect(before.some((e) => e.type.includes("wolf"))).toBe(true);
        expect(a?.column).toBeGreaterThanOrEqual(meta.clips.curled.start);
        return;
      }
      if (kind === "porcupine") {
        await expect
          .poll(async () => (await poses()).some((e) => e.type.includes("wolf") && e.x > 222), {
            timeout: 15000,
          })
          .toBe(true);
        return;
      }
      if (kind === "fox") {
        expect(before.some((e) => e.type === "wildlife-mouse-provisional-v1")).toBe(false);
        expect(a?.x).toBeGreaterThan(112);
        return;
      }
      if (kind === "sheep") {
        expect(a?.x).toBeGreaterThan(132);
        expect(
          Math.min(
            ...before
              .filter((e) => e.type === a?.type && e.id !== a?.id)
              .map((e) => Math.hypot(e.x - (a?.x ?? 0), e.y - (a?.y ?? 0))),
          ),
        ).toBeLessThanOrEqual(64);
        return;
      }
      if (kind === "peacock") {
        const pair = before.filter((e) => e.type === a?.type);
        expect(pair).toHaveLength(2);
        expect(
          Math.hypot(
            required(pair[0]).x - required(pair[1]).x,
            required(pair[0]).y - required(pair[1]).y,
          ),
        ).toBeLessThanOrEqual(42);
        await expect
          .poll(
            async () =>
              (await poses())
                .filter((e) => e.type === a?.type)
                .every((e) => e.column < meta.clips.open.start),
            { timeout: 15000 },
          )
          .toBe(true);
        return;
      }
      const type =
        kind === "deer"
          ? "browse-shrub"
          : kind === "raven"
            ? "hoard"
            : kind === "horse"
              ? "spring-pool"
              : kind === "giraffe"
                ? "canopy-leaves"
                : kind === "cow"
                  ? "growing-plant"
                  : kind === "donkey"
                    ? "dust"
                    : "lodge";
      const column =
        kind === "deer"
          ? 32
          : kind === "raven"
            ? 75
            : kind === "horse"
              ? 54
              : kind === "giraffe"
                ? 62
                : kind === "cow"
                  ? 16
                  : kind === "donkey"
                    ? 70
                    : 65;
      await expect
        .poll(
          async () =>
            (await poses()).some(
              (e) => e.type.includes(type) && e.column === column && e.visible,
            ) &&
            (kind !== "donkey" || (subject(await poses())?.column ?? 999) < meta.clips.lie.start),
          { timeout: 35000, intervals: [30] },
        )
        .toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const resource = (await poses()).find((e) => e.type.includes(type) && e.column === column);
      expect(resource).toBeDefined();
      const outcome = PNG.sync.read(
        await canvas.screenshot({ path: `data/wildlife-174-${kind}-outcome.png` }),
      );
      const resourceColor =
        kind === "deer"
          ? [97, 144, 77]
          : kind === "raven"
            ? [146, 121, 86]
            : kind === "horse"
              ? [69, 110, 138]
              : kind === "giraffe"
                ? [115, 147, 74]
                : kind === "cow"
                  ? [144, 175, 88]
                  : kind === "donkey"
                    ? [211, 186, 138]
                    : [161, 129, 82];
      expect(
        resource ? spritePixels(outcome, resource, resourceColor).painted : 0,
        `${kind} resource outcome must draw actual staged pixels`,
      ).toBeGreaterThan(3);
      if (kind === "deer") {
        await page.getByRole("button", { name: "Resume", exact: true }).click();
        await page.getByRole("button", { name: "Place tiger nearby", exact: true }).click();
        await expect
          .poll(
            async () => {
              const p = subject(await poses());
              return (
                !!p?.visible &&
                p.column >= meta.clips.stamp.start &&
                p.column < meta.clips.stamp.start + meta.clips.stamp.count
              );
            },
            { timeout: 15000, intervals: [30] },
          )
          .toBe(true);
        await page.getByRole("button", { name: "Pause", exact: true }).click();
        const stamping = subject(await poses());
        expect(stamping?.column).toBeGreaterThanOrEqual(meta.clips.stamp.start);
        const warning = PNG.sync.read(
          await canvas.screenshot({ path: `data/wildlife-172-deer-stamp.png` }),
        );
        expect(stamping ? spritePixels(warning, stamping, color).painted : 0).toBeGreaterThan(10);
      }
    })();
    expect(errors).toEqual([]);
  });
