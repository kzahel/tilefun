import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

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
for (const renderer of ["canvas", "gpu"]) {
  test(`garden action pixels, pollen-marked blooms and saved poses use the real Worker (${renderer})`, async ({
    page,
  }) => {
    test.setTimeout(150000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const kind of ["chicken", "bee", "hummingbird"] as const) {
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-behavior-${kind}&renderer=${renderer}#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await canvas.scrollIntoViewIfNeeded();
      const poses = async (): Promise<Pose[]> =>
        JSON.parse((await canvas.getAttribute("data-work-actors")) ?? "[]");
      const species = kind === "hummingbird" ? "ruby-throated-hummingbird" : kind;
      const subject = (all: Pose[]) =>
        all.find((a) => a.type === `wildlife-${species}-provisional-v1`);
      const color =
        kind === "chicken" ? [196, 154, 90] : kind === "bee" ? [179, 138, 56] : [67, 123, 88];
      await expect
        .poll(
          async () => {
            const all = await poses(),
              a = subject(all);
            return (
              a?.visible &&
              a.clip >= 4 &&
              (kind !== "chicken" || all.some((e) => e.parent === a.id && e.visible))
            );
          },
          { timeout: 35000, intervals: [30] },
        )
        .toBe(true);
      if (kind !== "chicken") {
        // Different atlas pixels while authority, camera and resource stages stay still.
        const samples = new Map<string, Set<string>>();
        const sipKey = (all: Pose[]) => {
          const p = subject(all);
          return p?.visible && p.clip === 4
            ? JSON.stringify([
                p.x,
                p.y,
                p.z,
                p.row,
                p.screen,
                all.filter((e) => e !== p).map((e) => [e.id, e.x, e.y, e.z, e.column]),
              ])
            : undefined;
        };
        await expect
          .poll(
            async () => {
              const key = sipKey(await poses());
              if (!key) return false;
              const png = PNG.sync.read(await canvas.screenshot()),
                all = await poses(),
                p = subject(all);
              if (!p || sipKey(all) !== key) return false;
              const crop = spritePixels(png, p, color);
              if (crop.painted <= 10) return false;
              const group = samples.get(key) ?? new Set<string>();
              group.add(crop.pixels);
              samples.set(key, group);
              return group.size >= 2;
            },
            { timeout: 20000, intervals: [50] },
          )
          .toBe(true);
      }
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const before = await poses(),
        a = subject(before);
      expect(a).toBeDefined();
      const shot = PNG.sync.read(
        await canvas.screenshot({ path: `data/wildlife-166-${kind}-${renderer}.png` }),
      );
      // An authoritative pose alone does not prove the new atlas drew any pixels.
      const r = a?.screen;
      expect(r).toBeDefined();
      expect(
        a ? spritePixels(shot, a, color).painted : 0,
        `${kind} native coat pixels must be present in its projected sprite rectangle`,
      ).toBeGreaterThan(10);
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-reload-count", "1");
      const stable = (all: Pose[]) =>
        all
          .filter((e) => e.type === a?.type || e.parent === subject(all)?.id)
          .map(({ type, x, y, z, clip, column, row }) => ({ type, x, y, z, clip, column, row }))
          .sort((x, y) => x.type.localeCompare(y.type));
      expect(stable(await poses())).toEqual(stable(before));
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await expect
        .poll(
          async () => {
            const all = await poses(),
              p = subject(all);
            if (!p?.visible) return false;
            return kind === "chicken"
              ? p.clip === 6 && all.some((e) => e.parent === p.id && e.visible)
              : kind === "bee"
                ? all.some(
                    (e) =>
                      e.type.includes("nectar-flower") &&
                      e.column >= 47 &&
                      e.column <= 50 &&
                      e.visible,
                  )
                : p.clip === 5;
          },
          { timeout: 45000, intervals: [30] },
        )
        .toBe(true);
      if (kind === "bee") {
        await page.getByRole("button", { name: "Pause", exact: true }).click();
        await expect(canvas).toHaveAttribute("data-authority-running", "false");
        const flower = (await poses()).find(
          (e) => e.type.includes("nectar-flower") && e.column >= 47 && e.column <= 50,
        );
        expect(flower).toBeDefined();
        const pixels = PNG.sync.read(await canvas.screenshot());
        const rect = flower?.screen;
        let pollen = 0;
        if (rect)
          for (
            let y = Math.max(0, Math.floor(rect.top));
            y < Math.min(pixels.height, Math.ceil(rect.top + rect.height));
            y++
          )
            for (
              let x = Math.max(0, Math.floor(rect.left));
              x < Math.min(pixels.width, Math.ceil(rect.left + rect.width));
              x++
            ) {
              const i = (y * pixels.width + x) * 4;
              if ([237, 211, 125].every((v, c) => Math.abs((pixels.data[i + c] ?? 0) - v) <= 3))
                pollen++;
            }
        expect(
          pollen,
          "pollination must draw golden bloom pixels, not merely a server frame number",
        ).toBeGreaterThan(3);
      }
      if (kind === "hummingbird") {
        await page.getByRole("button", { name: "Place visiting hummingbird", exact: true }).click();
        await expect
          .poll(async () => (await poses()).filter((e) => e.type === a?.type).length)
          .toBe(2);
      }
      await canvas.screenshot({ path: `data/wildlife-166-${kind}-outcome-${renderer}.png` });
    }
    expect(errors).toEqual([]);
  });
}
