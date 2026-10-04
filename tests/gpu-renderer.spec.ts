import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
test("GPU consumes the Canvas scene with retained textures and union clips", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const report = () =>
    page
      .locator("#result")
      .textContent()
      .then((text) => JSON.parse(text ?? "{}"));
  expect((await report()).mismatches).toBe(0);
  const cold = await report();
  await page.evaluate(() =>
    (window as unknown as { rendererLab: { draw(): unknown } }).rendererLab.draw(),
  );
  expect((await report()).uploads).toBe(cold.uploads);
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setClips(value: boolean): unknown } }
    ).rendererLab.setClips(true),
  );
  expect((await report()).mismatches).toBe(0);
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { changeTexture(): unknown } }
    ).rendererLab.changeTexture(),
  );
  expect((await report()).uploads).toBe(cold.uploads + 1);
  expect((await report()).mismatches).toBe(0);
  expect(errors).toEqual([]);
});

test("GPU host runs the shared game and retains the input/UI canvas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/?renderer=gpu");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#game")).toHaveAttribute("data-renderer", "gpu");
  await expect(page.locator("canvas[data-renderer=gpu][aria-hidden=true]")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.up("ArrowRight");
  expect(errors).toEqual([]);
});

test("optional mesh body rotates, composes in order and falls back atomically", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const report = () =>
    page
      .locator("#result")
      .textContent()
      .then((text) => JSON.parse(text ?? "{}"));
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setMesh(value: boolean): Promise<unknown> } }
    ).rendererLab.setMesh(true),
  );
  expect((await report()).meshDraws).toBe(1);
  expect((await report()).meshState).toBe("ready");
  const picture = () =>
    page.locator("#gpu").evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const first = await picture();
  await page.evaluate(() =>
    (window as unknown as { rendererLab: { setYaw(value: number): unknown } }).rendererLab.setYaw(
      Math.PI / 4,
    ),
  );
  expect(await picture()).not.toBe(first);
  const angled = await picture();
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setForeground(value: boolean): unknown } }
    ).rendererLab.setForeground(true),
  );
  expect(await picture()).not.toBe(angled);
  const before = await report();
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setMesh(value: boolean): Promise<unknown> } }
    ).rendererLab.setMesh(false),
  );
  const after = await report();
  expect(after.meshDraws).toBe(before.meshDraws);
  expect(after.mismatches).toBe(0);
  expect(after.targetBytes).toBeLessThanOrEqual(1024 * 1024 * 8);
});

test("shared traffic scenario feeds the same GPU mesh path", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect
    .poll(() => canvas.getAttribute("data-mesh-draws").then((value) => Number(value)))
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("shared room and editor passes match the native reference", async ({ page }) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const room = await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: { setInterior(v: boolean): Promise<{ mismatches: number }> };
      }
    ).rendererLab.setInterior(true),
  );
  expect(room.mismatches).toBe(0);
  const overlay = await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setOverlay(v: boolean): { mismatches: number } } }
    ).rendererLab.setOverlay(true),
  );
  // A staged 8-bit Canvas overlay incurs one additional premultiply/composite
  // rounding step. Only these three antialiased fixture pixels differ by 2.
  expect(overlay.mismatches).toBeLessThanOrEqual(3);
  expect((overlay as { maxError: number }).maxError).toBeLessThanOrEqual(2);
});

test("real graphics loss recovers resources without restarting gameplay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/?renderer=gpu&meshes");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const gpu = page.locator("canvas[data-renderer=gpu][aria-hidden=true]");
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

test("smooth shadows preserve final pixel placement at different scales", async ({ page }) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setSmoothShadows(v: boolean): unknown } }
    ).rendererLab.setSmoothShadows(true),
  );
  for (const zoom of [0.5, 1, 1.5]) {
    const report = await page.evaluate(
      (value) =>
        (
          window as unknown as { rendererLab: { setZoom(v: number): { maxError: number } } }
        ).rendererLab.setZoom(value),
      zoom,
    );
    expect(report.maxError).toBeLessThanOrEqual(1);
  }
});

test("GPU feedback capture includes the world and preserves generation metadata", async ({
  page,
}) => {
  await page.goto("/tilefun/?renderer=gpu");
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

test("portable car materials render through WebGPU selection and forced WebGL2", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  for (const forceWebGL of [false, true]) {
    const result = await page.evaluate(
      (force) =>
        (
          window as unknown as {
            rendererLab: {
              probeWebGpu(force: boolean): Promise<{ backend: string; coloredPixels: number }>;
            };
          }
        ).rendererLab.probeWebGpu(force),
      forceWebGL,
    );
    expect(result.backend).toMatch(forceWebGL ? /^WebGLBackend$/ : /^(WebGPU|WebGL)Backend$/);
    expect(result.coloredPixels).toBeGreaterThan(1000);
    expect(result.coloredPixels).toBeLessThan((192 * 192) / 2);
  }
});

test("unavailable WebGL2 leaves a usable Canvas game", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
      if (kind === "webgl2") return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  await page.goto("/tilefun/?renderer=gpu");
  await expect(page.locator("#game")).toHaveAttribute("data-renderer", "canvas-fallback");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("canvas[data-renderer=gpu]")).toHaveCount(0);
});

test("debug renderer selector switches live without replacing the game or Worker", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/?nogamepad&testflag=keep");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "☰", exact: true }).click();
  await page.getByRole("button", { name: "Debug", exact: true }).click();
  const selector = page.getByRole("combobox", { name: "Renderer", exact: true });
  await expect(selector).toHaveValue("canvas");
  const bounds = await selector.boundingBox();
  expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390).toBe(true);
  const original = await page.locator("#game").evaluateHandle((canvas) => {
    const game = (
      canvas as unknown as {
        __game: { transport: unknown; stateView: { playerEntity: { id: number } } };
      }
    ).__game;
    return { game, transport: game.transport, playerId: game.stateView.playerEntity.id };
  });
  for (const mode of ["gpu", "gpu-mesh", "canvas", "gpu", "canvas"]) {
    await selector.selectOption(mode);
    await expect(selector).toBeEnabled();
    await expect(selector).toHaveValue(mode);
    await expect(page.locator("#game")).toHaveAttribute(
      "data-renderer",
      mode === "canvas" ? "canvas" : "gpu",
    );
    await expect(page.locator("canvas[data-renderer=gpu][aria-hidden=true]")).toHaveCount(
      mode === "canvas" ? 0 : 1,
    );
    await page.waitForFunction(
      () =>
        (
          document.querySelector("#game") as unknown as {
            __game: { renderer: { getDiagnostics(): { resident: number } } };
          }
        ).__game.renderer.getDiagnostics().resident > 0,
    );
    expect(
      await original.evaluate((before) => {
        const game = (document.querySelector("#game") as unknown as { __game: typeof before.game })
          .__game;
        return (
          game === before.game &&
          game.transport === before.transport &&
          game.stateView.playerEntity.id === before.playerId
        );
      }),
    ).toBe(true);
    const url = new URL(page.url());
    expect(url.searchParams.get("testflag")).toBe("keep");
    expect(url.searchParams.get("renderer")).toBe(mode === "canvas" ? null : "gpu");
    expect(url.searchParams.has("meshes")).toBe(mode === "gpu-mesh");
    if (mode === "gpu-mesh")
      await page.waitForFunction(
        () =>
          (
            document.querySelector("#game") as unknown as {
              __game: { renderer: { getDiagnostics(): { gpu: { meshState: string } } } };
            }
          ).__game.renderer.getDiagnostics().gpu.meshState === "ready",
      );
  }
  await original.dispose();
  expect(errors).toEqual([]);
});
