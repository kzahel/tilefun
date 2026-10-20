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
for (const renderer of ["canvas", "gpu"]) {
  test(`new pasture action pixels, trunk/root attachments and saved poses use the real Worker (${renderer})`, async ({
    page,
  }) => {
    test.setTimeout(150000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const kind of ["goat", "pig", "elephant"] as const) {
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-behavior-${kind}&renderer=${renderer}#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await canvas.scrollIntoViewIfNeeded();
      const poses = async (): Promise<Pose[]> =>
        JSON.parse((await canvas.getAttribute("data-work-actors")) ?? "[]");
      const species = kind === "pig" ? "piglet" : kind;
      const subject = (all: Pose[]) =>
        all.find((a) => a.type === `wildlife-${species}-provisional-v1`);
      await expect
        .poll(
          async () => {
            const all = await poses(),
              a = subject(all);
            return (
              a?.visible &&
              a.clip === 5 &&
              (kind !== "elephant" || all.some((e) => e.parent === a.id && e.visible))
            );
          },
          { timeout: 35000, intervals: [30] },
        )
        .toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const before = await poses(),
        a = subject(before);
      expect(a).toBeDefined();
      const shot = PNG.sync.read(
        await canvas.screenshot({ path: `data/wildlife-163-${kind}-${renderer}.png` }),
      );
      // An authoritative pose alone does not prove the new atlas drew any pixels.
      const color =
        kind === "goat" ? [166, 122, 73] : kind === "pig" ? [218, 179, 157] : [130, 139, 133];
      const r = a?.screen;
      expect(r).toBeDefined();
      let painted = 0;
      if (r)
        for (
          let y = Math.max(0, Math.floor(r.top));
          y < Math.min(shot.height, Math.ceil(r.top + r.height));
          y++
        )
          for (
            let x = Math.max(0, Math.floor(r.left));
            x < Math.min(shot.width, Math.ceil(r.left + r.width));
            x++
          ) {
            const i = (y * shot.width + x) * 4;
            if (color.every((v, c) => Math.abs((shot.data[i + c] ?? 0) - v) <= 3)) painted++;
          }
      expect(
        painted,
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
            return kind === "goat"
              ? p.clip === 0 && p.z === 8
              : kind === "pig"
                ? p.clip === 7 && all.some((e) => e.parent === p.id && e.visible)
                : all.some(
                    (e) =>
                      e.type === "wildlife-resource-fruit-v1" &&
                      e.parent < 0 &&
                      e.z === 0 &&
                      e.visible,
                  );
          },
          { timeout: 45000, intervals: [30] },
        )
        .toBe(true);
      await canvas.screenshot({ path: `data/wildlife-163-${kind}-outcome-${renderer}.png` });
    }
    expect(errors).toEqual([]);
  });
}
