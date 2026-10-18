import { expect, test } from "@playwright/test";
import type { Entity } from "../src/entities/Entity.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import type { EntityMeshPose } from "../src/rendering/EntityMeshPose.js";
import type { RenderHost } from "../src/rendering/RenderHost.js";
import type { GeometryCanvas } from "../src/workshop/WorldGeometryPage.js";

test.use({ channel: "chromium" });
const diagnostics = (canvas: GeometryCanvas) => canvas.__presentationDiagnostics?.();

test("main-game default draws reviewed carriages and backend changes retain the service", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(createDescriptor("regional", 2026)))}`,
  );
  await page.getByPlaceholder("World name...").fill("Reviewed blue train gameplay");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  // The old world remains ready while the create/join requests are in flight.
  // Capture carriage identities only after the new realm has replaced it.
  await expect(page.getByTestId("world-menu")).toBeHidden();
  const canvas = page.locator("#game");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(canvas).toHaveAttribute("data-renderer", "gpu");
  const read = () =>
    canvas.evaluate((c) => {
      const game = (
        c as unknown as {
          __game: {
            stateView: { entities: Entity[] };
            sceneFrame: { meshPoses: EntityMeshPose };
            renderHost: RenderHost;
          };
        }
      ).__game;
      const cars = game.stateView.entities.filter((e) => e.type.startsWith("train-curve-proof-v1"));
      const d = game.renderHost.renderer.getDiagnostics() as unknown as {
        gpu?: {
          meshDraws: number;
          vehicleAssets: Record<string, { state: string; meshes: number }>;
        };
      };
      return {
        mode: game.renderHost.rendererControl?.mode,
        cars: cars.map((e) => ({
          id: e.id,
          asset: game.sceneFrame.meshPoses.assetFor(e),
          roof: e.collider?.physicalHeight,
        })),
        states: ["rear", "middle", "front"].map(
          (p) => d.gpu?.vehicleAssets[`train-blue-${p}-authored-v3`],
        ),
        meshDraws: d.gpu?.meshDraws ?? 0,
      };
    });
  const ready = async () => {
    // GPU asset diagnostics can survive a realm join before its first snapshot.
    await expect.poll(async () => (await read()).cars).toHaveLength(3);
    await expect.poll(read, { timeout: 20000 }).toMatchObject({
      mode: "gpu-mesh",
      states: [
        { state: "ready", meshes: 36 },
        { state: "ready", meshes: 40 },
        { state: "ready", meshes: 42 },
      ],
    });
    await expect.poll(async () => (await read()).meshDraws).toBeGreaterThan(0);
  };
  await ready();
  const initial = await read();
  expect(initial.cars).toHaveLength(3);
  expect(initial.cars.map((c) => c.asset).sort()).toEqual(
    ["rear", "middle", "front"].map((p) => `train-blue-${p}-authored-v3`).sort(),
  );
  expect(initial.cars.map((c) => c.roof)).toEqual([44, 44, 44]);
  for (const mode of ["canvas", "gpu", "gpu-mesh"] as const) {
    await canvas.evaluate(async (c, next) => {
      await (
        c as unknown as { __game: { renderHost: RenderHost } }
      ).__game.renderHost.rendererControl?.select(next);
    }, mode);
    await expect.poll(async () => (await read()).mode).toBe(mode);
    if (mode === "gpu-mesh") await ready();
    else expect((await read()).meshDraws).toBe(0);
    expect((await read()).cars).toEqual(initial.cars);
  }
  expect(errors).toEqual([]);
});

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

for (const renderer of ["canvas", "gpu", "gpu&meshes"]) {
  test(`native train comparison stays available (${renderer})`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/models/trains/")) requests.push(r.url());
    });
    await page.goto(
      `/tilefun/workshop.html?geometry=train-loop&nativeTrains&renderer=${renderer}#/tool/world-geometry`,
    );
    const canvas = page.getByLabel("World geometry scene");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(canvas).toHaveAttribute("data-train-art", "native-sprites");
    expect(await canvas.evaluate(diagnostics)).toMatchObject({ meshEligibleVehicleTypes: [] });
    expect(requests).toEqual([]);
  });
}

for (const fixture of ["train-loop", "city-trains", "train-authored-winding"]) {
  test(`reviewed blue train loads three own carriages in shared ${fixture} service`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=${fixture}&renderer=gpu&meshes#/tool/world-geometry`,
    );
    const canvas = page.getByLabel("World geometry scene");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(canvas).toHaveAttribute("data-train-art", "authored-blue-v3");
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
