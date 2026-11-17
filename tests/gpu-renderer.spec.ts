import { expect, test } from "@playwright/test";
import type { GeometryCanvas } from "../src/workshop/WorldGeometryPage.js";

test.use({ channel: "chromium" });
test("default GPU mesh host runs the shared game and retains the input/UI canvas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Stale renderer links are ignored (232): there is only the WebGL2 renderer.
  await page.goto("/tilefun/?renderer=legacy-canvas&meshes");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#game")).toHaveAttribute("data-renderer", "gpu");
  expect(
    await page
      .locator("#game")
      .evaluate(
        (canvas) =>
          (canvas as unknown as { __game: { camera: { pixelSnap: boolean } } }).__game.camera
            .pixelSnap,
      ),
  ).toBe(false);
  await expect(page.locator("canvas[data-renderer=gpu][aria-hidden=true]")).toBeVisible();
  await page.waitForFunction(
    () =>
      (
        document.querySelector("#game") as unknown as {
          __game: { renderer: { getDiagnostics(): { gpu: { meshState: string } } } };
        }
      ).__game.renderer.getDiagnostics().gpu.meshState === "ready",
  );
  expect(
    await page.locator("#game").evaluate((canvas) => {
      const game = (
        canvas as unknown as {
          __game: {
            renderer: {
              getDiagnostics(): { gpu: { vehicleAssets: Record<string, { drawMeshes: number }> } };
            };
          };
        }
      ).__game;
      return game.renderer.getDiagnostics().gpu.vehicleAssets["compact-1-authored-v7"]?.drawMeshes;
    }),
  ).toBe(8);
  const capture = await page.locator("#game").evaluate((canvas) => {
    const game = (
      canvas as unknown as {
        __game: { renderHost: import("../src/rendering/RenderHost.js").RenderHost };
      }
    ).__game;
    const first = game.renderHost.captureFrame?.();
    const second = game.renderHost.captureFrame?.();
    return {
      mode: (canvas as HTMLCanvasElement).dataset.renderer,
      dimensions: [first?.width, first?.height],
      expected: [(canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height],
      visible: first
        ?.getContext("2d")
        ?.getImageData(0, 0, first.width, first.height)
        .data.some((v) => v !== 0),
      independentSnapshot: !!first && !!second && first !== second && first !== canvas,
    };
  });
  expect(capture.mode).toBe("gpu");
  expect(capture.dimensions).toEqual(capture.expected);
  expect(capture.visible).toBe(true);
  expect(capture.independentSnapshot).toBe(true);
  await page.keyboard.press("Escape");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.up("ArrowRight");
  expect(errors).toEqual([]);
});

test("shared traffic scenario feeds the same GPU mesh path", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html#/tool/traffic");
  const canvas = page.getByLabel("World geometry scene");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  expect(
    await canvas.evaluate((c: GeometryCanvas) => c.__presentationDiagnostics?.().pixelSnap),
  ).toBe(false);
  await expect
    .poll(() =>
      canvas.evaluate((c: GeometryCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
    )
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Traffic override selects original non-blue road vehicles without changing their types", async ({
  page,
}) => {
  await page.goto(
    "/tilefun/workshop.html?geometry=car-garage&vehicle=pickup&allcars3d#/tool/world-geometry",
  );
  const canvas = page.getByLabel("World geometry scene");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect
    .poll(() =>
      canvas.evaluate((c: GeometryCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
    )
    .toBeGreaterThan(0);
  const diagnostics = await canvas.evaluate((c: GeometryCanvas) => c.__presentationDiagnostics?.());
  expect(diagnostics?.carMeshOverride).toBe(true);
  expect(
    diagnostics?.meshEligibleVehicleTypes?.some((type) => type !== "vehicle-v1:compact-1"),
  ).toBe(true);
  await page.getByRole("button", { name: "Reset scene", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-ready", "true");
  expect(
    await canvas.evaluate((c: GeometryCanvas) => c.__presentationDiagnostics?.().carMeshOverride),
  ).toBe(true);
});

test("real graphics loss recovers resources without restarting gameplay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const gpu = page.locator("canvas[data-renderer=gpu][aria-hidden=true]");
  // Renderer readiness can precede the first authority snapshot. Capture a
  // real player identity rather than the temporary -1 replica placeholder.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            document.querySelector("#game") as unknown as {
              __game: { stateView: { playerEntity: { id: number } } };
            }
          ).__game.stateView.playerEntity.id,
      ),
    )
    .toBeGreaterThan(0);
  const extension = await gpu.evaluateHandle((c: HTMLCanvasElement) =>
    c.getContext("webgl2")?.getExtension("WEBGL_lose_context"),
  );
  const identity = await page.evaluate(
    () =>
      (
        document.querySelector("#game") as unknown as {
          __game: { stateView: { playerEntity: { id: number } } };
        }
      ).__game.stateView.playerEntity.id,
  );
  await extension.evaluate((e) => e?.loseContext());
  await expect(page.locator("#game")).toHaveAttribute("data-gpu-device", "lost");
  await extension.evaluate((e) => e?.restoreContext());
  await expect(page.locator("#game")).toHaveAttribute("data-gpu-device", "ready");
  await page.waitForFunction(
    () =>
      (
        document.querySelector("#game") as unknown as {
          __game: { renderer: { getDiagnostics(): { gpu: { recoveries: number } } } };
        }
      ).__game.renderer.getDiagnostics().gpu.recoveries === 1,
  );
  expect(
    await page.evaluate(
      () =>
        (
          document.querySelector("#game") as unknown as {
            __game: { stateView: { playerEntity: { id: number } } };
          }
        ).__game.stateView.playerEntity.id,
    ),
  ).toBe(identity);
  await extension.dispose();
  expect(errors).toEqual([]);
});

test("GPU feedback capture includes the world and preserves generation metadata", async ({
  page,
}) => {
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.waitForFunction(
    () =>
      (
        document.querySelector("#game") as unknown as {
          __game: { renderer: { getDiagnostics(): { resident: number } } };
        }
      ).__game.renderer.getDiagnostics().resident > 0,
  );
  const snapshot = await page.evaluate(() => {
    const original = document.querySelector("#game") as HTMLCanvasElement & {
      __game: { renderHost: { captureFrame(): HTMLCanvasElement } };
    };
    const copy = original.__game.renderHost.captureFrame(),
      ctx = copy.getContext("2d");
    if (!ctx) throw Error("Missing capture context");
    const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let opaque = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 255) opaque++;
    return {
      opaque,
      area: copy.width * copy.height,
      generation: copy.dataset.generation,
      expected: original.dataset.generation,
    };
  });
  expect(snapshot.opaque).toBe(snapshot.area);
  expect(snapshot.generation).toBe(snapshot.expected);
});

test("unavailable WebGL2 shows the needs-WebGL2 screen in the game and labs", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind === "webgl2") return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  // No Canvas fallback (232); an old renderer link changes nothing.
  await page.goto("/tilefun/?renderer=legacy-canvas");
  const dialog = page.getByRole("alertdialog", { name: "Tilefun needs WebGL2" });
  await expect(dialog.getByText(/Turn on hardware acceleration/)).toBeVisible();
  await expect(dialog.getByRole("group")).toHaveCount(0); // no stack details
  await expect(page.locator("canvas[data-renderer=gpu]")).toHaveCount(0);
  await page.goto("/tilefun/workshop.html#/tool/character-lab?character=tiger");
  await expect(page.getByText(/^Tilefun needs WebGL2/)).toBeVisible();
});

test("a GPU backend failure after a successful WebGL2 probe is an ordinary fault", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    let webgl2 = 0;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      // The first request is the probe; the renderer's own context then fails.
      if (kind === "webgl2" && ++webgl2 > 1) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  await page.goto("/tilefun/");
  await expect(page.getByRole("alertdialog", { name: "Something went wrong" })).toBeVisible();
  await expect(page.getByRole("alertdialog", { name: "Tilefun needs WebGL2" })).toHaveCount(0);
});
