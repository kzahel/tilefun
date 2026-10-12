import { expect, test } from "@playwright/test";
import type { GeometryCanvas } from "../src/workshop/WorldGeometryPage.js";

test.use({ channel: "chromium" });
const diagnostics = (canvas: GeometryCanvas) => canvas.__presentationDiagnostics?.();

test("blue train exact review opens its 4×2 and both retained motion comparisons", async ({
  page,
}) => {
  await page.goto("/tilefun/assets/models/trains/review/blue-v3/");
  for (const name of [
    "Four original train compositions",
    "Native train beside authored train",
    "Existing service stops and reverses",
  ]) {
    const image = page.getByRole("img", { name: new RegExp(name) });
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
      .toBe(true);
  }
  const review = await page.request.get("/tilefun/assets/models/trains/review/blue-v3/review.json");
  const capture = await review.json();
  expect(capture.candidateId).toBe("projection:authored-blue-train-v3");
  await page.goto("/tilefun/workshop.html#/review/projection%3Aauthored-blue-train-v3?show=all");
  await expect(
    page.getByRole("heading", { name: "Blue train · three authored carriages v3", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open comparison" }).click();
  await expect(page).toHaveURL(/assets\/models\/trains\/review\/blue-v3\/$/);
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const renderer of ["canvas", "gpu&meshes"]) {
  test(`native train remains the default (${renderer})`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/models/trains/")) requests.push(r.url());
    });
    await page.goto(
      `/tilefun/workshop.html?geometry=train-loop&renderer=${renderer}#/tool/world-geometry`,
    );
    const canvas = page.getByLabel("World geometry scene");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(canvas).toHaveAttribute("data-train-art", "native-sprites");
    expect(await canvas.evaluate(diagnostics)).toMatchObject({ meshEligibleVehicleTypes: [] });
    expect(requests).toEqual([]);
  });
}

for (const fixture of ["loop", "city"]) {
  test(`explicit blue inspection loads three own carriages in shared ${fixture} service`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=train-authored-${fixture}&renderer=gpu&meshes#/tool/world-geometry`,
    );
    const canvas = page.getByLabel("World geometry scene");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(canvas).toHaveAttribute("data-train-art", "authored-prototype");
    await page.getByLabel("Train camera").selectOption("follow");
    await expect
      .poll(() =>
        canvas.evaluate((c) => {
          const d = (c as GeometryCanvas).__presentationDiagnostics?.();
          const gpu = d?.terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string }> };
          };
          return ["rear", "middle", "front"].map(
            (p) => gpu?.gpu?.vehicleAssets?.[`train-blue-${p}-authored-v3`]?.state,
          );
        }),
      )
      .toEqual(["ready", "ready", "ready"]);
    await expect
      .poll(() =>
        canvas.evaluate((c) => (c as GeometryCanvas).__presentationDiagnostics?.().meshDraws ?? 0),
      )
      .toBeGreaterThan(0);
    await expect(canvas).toHaveAttribute("data-carriage-count", "3");
    const before = Number(await canvas.getAttribute("data-train-x"));
    await expect
      .poll(async () => Math.abs(Number(await canvas.getAttribute("data-train-x")) - before), {
        timeout: 14000,
      })
      .toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });
}

test("failed front-carriage fetch retains its native crop and the complete service", async ({
  page,
}) => {
  await page.route("**/assets/models/trains/blue-front-v3.glb", (r) => r.abort());
  await page.goto(
    "/tilefun/workshop.html?geometry=train-authored-loop&renderer=gpu&meshes#/tool/world-geometry",
  );
  const canvas = page.getByLabel("World geometry scene");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await page.getByLabel("Train camera").selectOption("follow");
  await expect
    .poll(() =>
      canvas.evaluate((c) => {
        const d = (c as GeometryCanvas).__presentationDiagnostics?.();
        const gpu = d?.terrain as unknown as {
          gpu?: { vehicleAssets?: Record<string, { state: string }> };
        };
        return gpu?.gpu?.vehicleAssets?.["train-blue-front-authored-v3"]?.state;
      }),
    )
    .toBe("failed");
  await expect(canvas).toHaveAttribute("data-carriage-count", "3");
  await expect(canvas).toHaveAttribute("data-carriage-sources", /Exterior_Train_Blue_Right/);
  await expect(canvas).toHaveAttribute("data-ready", "true");
});
