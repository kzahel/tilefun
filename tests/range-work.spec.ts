import { readFileSync } from "node:fs";
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
  test(`grazing, canopy browsing and staged branch building animate through the Worker (${renderer})`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const kind of ["horse", "giraffe", "beaver"] as const) {
      const meta = JSON.parse(
        readFileSync(`public/demos/wildlife-v2/${kind}/behavior-v1/sprite.json`, "utf8"),
      );
      const action = meta.clips[
        kind === "horse" ? "graze" : kind === "giraffe" ? "browse" : "build"
      ] as { start: number; count: number };
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-behavior-${kind}&renderer=${renderer}#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await canvas.scrollIntoViewIfNeeded();
      const poses = async (): Promise<Pose[]> =>
        JSON.parse((await canvas.getAttribute("data-work-actors")) ?? "[]");
      const subject = (all: Pose[]) =>
        all.find((a) => a.type === `wildlife-${kind}-provisional-v1`);
      const color =
        kind === "horse" ? [199, 137, 73] : kind === "giraffe" ? [196, 154, 92] : [118, 88, 61];
      const active = (p?: Pose) =>
        p?.visible && p.column >= action.start && p.column < action.start + action.count;
      await expect
        .poll(
          async () => {
            const all = await poses(),
              a = subject(all);
            return (
              !!active(a) && (kind !== "beaver" || all.some((e) => e.parent === a?.id && e.visible))
            );
          },
          { timeout: 45000, intervals: [30] },
        )
        .toBe(true);
      const samples = new Map<string, Set<string>>();
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
                .filter((e) => e !== a && e.parent !== a.id)
                .map((e) => [e.type, e.x, e.y, e.z, e.column]),
            ])
          : undefined;
      };
      await expect
        .poll(
          async () => {
            const before = key(await poses());
            if (!before) return false;
            const png = PNG.sync.read(await canvas.screenshot()),
              all = await poses(),
              a = subject(all);
            if (!a || key(all) !== before) return false;
            const crop = spritePixels(png, a, color);
            if (crop.painted <= 10) return false;
            const group = samples.get(before) ?? new Set<string>();
            group.add(crop.pixels);
            samples.set(before, group);
            return group.size >= 2;
          },
          { timeout: 25000, intervals: [50] },
        )
        .toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const before = await poses(),
        a = subject(before);
      expect(a).toBeDefined();
      const png = PNG.sync.read(
        await canvas.screenshot({ path: `data/wildlife-168-${kind}-${renderer}.png` }),
      );
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
      const type =
        kind === "horse" ? "spring-pool" : kind === "giraffe" ? "canopy-leaves" : "lodge";
      const column = kind === "horse" ? 54 : kind === "giraffe" ? 62 : 65;
      await expect
        .poll(
          async () =>
            (await poses()).some((e) => e.type.includes(type) && e.column === column && e.visible),
          { timeout: 35000, intervals: [30] },
        )
        .toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const resource = (await poses()).find((e) => e.type.includes(type) && e.column === column);
      expect(resource).toBeDefined();
      const outcome = PNG.sync.read(
        await canvas.screenshot({ path: `data/wildlife-168-${kind}-outcome-${renderer}.png` }),
      );
      const resourceColor =
        kind === "horse" ? [69, 110, 138] : kind === "giraffe" ? [115, 147, 74] : [161, 129, 82];
      expect(
        resource ? spritePixels(outcome, resource, resourceColor).painted : 0,
        `${kind} resource outcome must draw actual staged pixels`,
      ).toBeGreaterThan(3);
    }
    expect(errors).toEqual([]);
  });
}
