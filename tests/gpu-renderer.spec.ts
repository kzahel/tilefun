import { expect, test } from "@playwright/test";
import type { GpuRenderBackend } from "../src/rendering/GpuRenderBackend.js";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";

test.use({ channel: "chromium" });
test("adjacent sprites have no gaps or overlaps at fractional scales on either backend", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const reports = await page.evaluate(() => {
    const lab = (
      window as unknown as {
        rendererLab: { probeSpriteSeams(snap?: boolean): { mismatches: number }[] };
      }
    ).rendererLab;
    return [...lab.probeSpriteSeams(), ...lab.probeSpriteSeams(true)];
  });
  expect(reports).toHaveLength(64);
  expect(reports.filter((report) => report.mismatches !== 0)).toEqual([]);
});

test("stationary terrain, props and grass stay rigid while the camera settles", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const reports = await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: { probeCameraStability(): { mismatches: number; movedFrames: number }[] };
      }
    ).rendererLab.probeCameraStability(),
  );
  expect(reports).toHaveLength(20);
  expect(reports.filter((report) => report.mismatches !== 0 || report.movedFrames === 0)).toEqual(
    [],
  );
});

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

test("default GPU mesh host runs the shared game and retains the input/UI canvas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/");
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
  ).toBe(true);
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
    const target = document.createElement("canvas");
    const first = game.renderHost.captureFrame?.(target);
    const second = game.renderHost.captureFrame?.(target);
    return {
      mode: game.renderHost.rendererControl?.mode,
      reused: first === target && second === target,
      dimensions: [target.width, target.height],
      expected: [(canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height],
      visible: target
        .getContext("2d")
        ?.getImageData(0, 0, target.width, target.height)
        .data.some((v) => v !== 0),
      independentSnapshot: game.renderHost.captureFrame?.() !== target,
    };
  });
  expect(capture.mode).toBe("gpu-mesh");
  expect(capture.reused).toBe(true);
  expect(capture.dimensions).toEqual(capture.expected);
  expect(capture.visible).toBe(true);
  expect(capture.independentSnapshot).toBe(true);
  await page.keyboard.press("Escape");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.up("ArrowRight");
  expect(errors).toEqual([]);
});

test("optional mesh body rotates, composes in order and falls back atomically", async ({
  page,
}) => {
  const shaderErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("THREE.")) shaderErrors.push(m.text());
  });
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
  expect((await report()).meshParts).toBe(55);
  expect(shaderErrors).toEqual([]);
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

test("grade pitch, roll and height reach the GPU and reset on a reused car asset", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const result = await page.evaluate(async () => {
    const lab = (
      window as unknown as {
        rendererLab: {
          gpu: GpuRenderBackend;
          setMesh(value: boolean): Promise<unknown>;
          setYaw(value: number): unknown;
          setPose(yaw: number, pitch: number, roll: number): unknown;
          draw(): unknown;
        };
      }
    ).rendererLab;
    await lab.setMesh(true);
    lab.setYaw(0.5);
    const canvas = document.querySelector<HTMLCanvasElement>("#gpu");
    if (!canvas) throw Error("Missing GPU canvas");
    const flat = canvas.toDataURL();
    const submit = lab.gpu.submit.bind(lab.gpu);
    let grade = { gradePitch: 0, gradeRoll: 0, gradeOffsetZ: 0 };
    lab.gpu.submit = (view, pass) =>
      submit(
        view,
        pass.kind === "scene"
          ? {
              ...pass,
              items: pass.items.map((item) =>
                item.kind === "sprite" && item.mesh
                  ? {
                      ...item,
                      mesh: { ...item.mesh, ...grade },
                    }
                  : item,
              ),
            }
          : pass,
      );
    const samples = [];
    for (const [pitch, roll, offset] of [
      [0.24, 0, 0],
      [0, -0.21, 0],
      [0.2, 0.1, -8],
    ]) {
      grade = { gradePitch: pitch ?? 0, gradeRoll: roll ?? 0, gradeOffsetZ: offset ?? 0 };
      lab.draw();
      const tilted = canvas.toDataURL();
      const object = lab.gpu.meshes.car.value?.object;
      if (!object) throw Error("Missing loaded car");
      const position = object.position.toArray();
      const actual = object.quaternion.toArray();
      grade = { gradePitch: 0, gradeRoll: 0, gradeOffsetZ: 0 };
      lab.setPose(0.5, -(pitch ?? 0), roll ?? 0);
      const expected = object.quaternion.toArray();
      lab.setYaw(0.5);
      samples.push({
        changed: tilted !== flat,
        reset: canvas.toDataURL() === flat,
        actual,
        expected,
        position,
        offset,
      });
    }
    return samples;
  });
  for (const sample of result) {
    expect(sample.changed).toBe(true);
    expect(sample.reset).toBe(true);
    expect(sample.position).toEqual([0, 0, sample.offset]);
    for (let i = 0; i < 4; i++) expect(sample.actual[i]).toBeCloseTo(sample.expected[i] ?? 0, 10);
  }
});

test("a graded mesh group carries its child and supported feet while sprite planes stay upright", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const samples = await page.evaluate(async () => {
    const lab = (
      window as unknown as {
        rendererLab: {
          gpu: GpuRenderBackend;
          setMesh(value: boolean): Promise<unknown>;
          setYaw(value: number): unknown;
          draw(): unknown;
        };
      }
    ).rendererLab;
    await lab.setMesh(true);
    while (lab.gpu.meshes.ambulance.state === "loading")
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    lab.setYaw(0.5);
    const submit = lab.gpu.submit.bind(lab.gpu);
    let tilted = false;
    lab.gpu.submit = (view, pass) =>
      submit(
        view,
        pass.kind !== "scene"
          ? pass
          : {
              ...pass,
              items: pass.items.map((item) => {
                if (item.kind !== "sprite" || !item.mesh) return item;
                const foot = {
                  ...item,
                  wx: item.wx - 20,
                  wy: item.wy + 3,
                  zOffset: item.zOffset + 12,
                  sheetKey: "fixture",
                  frameCol: 0,
                  frameRow: 0,
                  spriteWidth: 8,
                  spriteHeight: 16,
                  drawOffsetY: 0,
                  meshBedSupport: true,
                };
                delete foot.mesh;
                return {
                  ...item,
                  mesh: {
                    ...item.mesh,
                    radius: 160,
                    gradePitch: tilted ? 0.2 : 0,
                    gradeRoll: tilted ? -0.1 : 0,
                    gradeOffsetZ: tilted ? -8 : 0,
                  },
                  bedGroup: { heading: 0.5, contents: [foot] },
                  towGroup: {
                    ...item,
                    wy: item.wy - 150,
                    zOffset: item.zOffset + 30,
                    mesh: { ...item.mesh, assetId: "ambulance-authored-v3", radius: 112 },
                  },
                };
              }),
            },
      );
    const canvas = document.querySelector<HTMLCanvasElement>("#gpu");
    if (!canvas) throw Error("Missing GPU canvas");
    const results = [];
    let flat = "";
    for (const active of [false, true, false]) {
      tilted = active;
      lab.draw();
      const parent = lab.gpu.meshes.car.value?.object,
        child = lab.gpu.meshes.ambulance.value?.object,
        plane = lab.gpu.meshes.contents.group.children[0];
      if (!parent || !child || !plane) throw Error("Missing compound draw");
      const yaw = parent.quaternion.clone().set(0, 0, Math.sin(0.25), Math.cos(0.25));
      const q = parent.quaternion.clone().multiply(yaw.clone().invert());
      const childPosition = parent.position
        .clone()
        .set(0, -150, 30)
        .applyQuaternion(q)
        .add(parent.position);
      const footPosition = parent.position
        .clone()
        .set(-20, 3, 12)
        .applyQuaternion(q)
        .add(parent.position);
      footPosition.z += 8;
      const picture = canvas.toDataURL();
      if (!flat) flat = picture;
      results.push({
        active,
        sameAsFlat: picture === flat,
        childPosition: child.position.toArray(),
        expectedChildPosition: childPosition.toArray(),
        childRotation: child.quaternion.toArray(),
        expectedChildRotation: parent.quaternion.toArray(),
        footPosition: plane.position.toArray(),
        expectedFootPosition: footPosition.toArray(),
        planeRotation: plane.quaternion.toArray(),
        targetBytes: lab.gpu.meshes.targetBytes - lab.gpu.meshes.images.bytes,
        minimumRadius: Math.max(
          160,
          Math.abs(childPosition.x) + 112,
          Math.abs(childPosition.y - childPosition.z) + 112,
        ),
      });
    }
    return results;
  });
  for (const sample of samples) {
    expect(sample.sameAsFlat).toBe(!sample.active);
    expect(sample.targetBytes).toBeGreaterThanOrEqual(
      Math.ceil(sample.minimumRadius * 2) ** 2 * 12,
    );
    for (let i = 0; i < 3; i++) {
      expect(sample.childPosition[i]).toBeCloseTo(sample.expectedChildPosition[i] ?? 0, 8);
      expect(sample.footPosition[i]).toBeCloseTo(sample.expectedFootPosition[i] ?? 0, 8);
    }
    for (let i = 0; i < 4; i++)
      expect(sample.childRotation[i]).toBeCloseTo(sample.expectedChildRotation[i] ?? 0, 8);
    expect(sample.planeRotation[0]).toBeCloseTo(Math.SQRT1_2, 10);
    expect(sample.planeRotation[1]).toBe(0);
    expect(sample.planeRotation[2]).toBe(0);
    expect(sample.planeRotation[3]).toBeCloseTo(Math.SQRT1_2, 10);
  }
});

test("authored car retains its fixed width registration across headings and zoom", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const results = await page.evaluate(async () => {
    const lab = (
      window as unknown as {
        rendererLab: {
          setMesh(value: boolean): Promise<unknown>;
          setYaw(value: number): unknown;
          setZoom(value: number): unknown;
        };
      }
    ).rendererLab;
    await lab.setMesh(true);
    const bounds = (id: string) => {
      const canvas = document.querySelector<HTMLCanvasElement>(`#${id}`);
      if (!canvas) throw Error("Missing comparison canvas");
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const ctx = copy.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw Error("Missing comparison context");
      ctx.drawImage(canvas, 0, 0);
      const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
      let left = copy.width,
        right = -1,
        top = copy.height,
        bottom = -1;
      // Blue body paint excludes background, green fixture, shadow and marker.
      // Compare visible source/model extents, not transparent sprite padding.
      for (let y = 0; y < copy.height; y++)
        for (let x = 0; x < copy.width; x++) {
          const offset = (y * copy.width + x) * 4;
          const r = pixels[offset] ?? 0,
            g = pixels[offset + 1] ?? 0,
            b = pixels[offset + 2] ?? 0;
          if (b > r * 1.18 && b > g * 1.12 && b > 85 && r < 160) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      return { width: right - left + 1, height: bottom - top + 1 };
    };
    const samples = [];
    for (const zoom of [0.5, 1])
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        lab.setZoom(zoom);
        lab.setYaw(yaw);
        samples.push({ zoom, yaw, sprite: bounds("reference"), model: bounds("gpu") });
      }
    return samples;
  });
  expect(results).toHaveLength(8);
  for (const { sprite, model } of results) {
    expect(model.width).toBeGreaterThan(0);
    expect(model.height).toBeGreaterThan(0);
    expect(model.width / sprite.width).toBeGreaterThan(0.88);
    expect(model.width / sprite.width).toBeLessThan(1.12);
  }
});

test("shared traffic scenario feeds the same GPU mesh path", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  expect(
    await canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().pixelSnap),
  ).toBe(true);
  await expect
    .poll(() =>
      canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
    )
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Traffic override selects original non-blue road vehicles without changing their types", async ({
  page,
}) => {
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes&allcars3d#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect
    .poll(() =>
      canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
    )
    .toBeGreaterThan(0);
  const diagnostics = await canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.());
  expect(diagnostics?.carMeshOverride).toBe(true);
  expect(
    diagnostics?.meshEligibleVehicleTypes?.some((type) => type !== "vehicle-v1:compact-1"),
  ).toBe(true);
  await page.getByRole("button", { name: "Reset scene", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-ready", "true");
  expect(
    await canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().carMeshOverride),
  ).toBe(true);
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

test("separate surface passes reuse local rasters through camera movement", async ({ page }) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const result = await page.evaluate(() => {
    const backend = (
      window as unknown as {
        rendererLab: { gpu: import("../src/rendering/GpuRenderBackend.js").GpuRenderBackend };
      }
    ).rendererLab.gpu;
    const view = { x: 0, y: 0, zoom: 1, viewportWidth: 384, viewportHeight: 288 };
    const rect = (
      i: number,
      dx: number,
    ): import("../src/rendering/OverlayFrame.js").OverlayDraw => ({
      kind: "rect",
      x: 25 + i * 90 + dx,
      y: 45 + i * 20,
      width: 64,
      height: 35,
      fill: ["#58736c", "#62676b", "#735b44"][i] ?? "black",
      stroke: "#b9c9ca",
      lineWidth: 1.5,
      text: "",
      font: "",
      centered: false,
      sheetKey: "",
      srcX: 0,
      srcY: 0,
      srcWidth: 0,
      srcHeight: 0,
      alpha: 0.8,
    });
    const draw = (dx: number) => {
      backend.beginFrame();
      backend.submit(view, { kind: "clear", color: "#243245" });
      for (let i = 0; i < 3; i++)
        backend.submit(view, { kind: "overlay", cacheKey: `slab:${i}`, items: [rect(i, dx)] });
    };
    const pixels = () => {
      const image = document.createElement("canvas");
      image.width = 384;
      image.height = 288;
      const ctx = image.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw Error("No readback");
      ctx.drawImage(backend.surface.canvas, 0, 0);
      return ctx.getImageData(0, 0, 384, 288).data;
    };
    backend.clear();
    draw(0);
    const before = backend.getDiagnostics().gpu;
    draw(11);
    const after = backend.getDiagnostics().gpu,
      warm = pixels();
    backend.clear();
    draw(11);
    const rebuilt = pixels();
    draw(1000);
    const culled = backend.getDiagnostics().gpu.overlayRasterCulls;
    backend.clear();
    return {
      uploads: after.uploads - before.uploads,
      builds: after.overlayRasterBuilds - before.overlayRasterBuilds,
      hits: after.overlayRasterHits - before.overlayRasterHits,
      bytes: after.overlayRasterBytes,
      exact: warm.every((value, i) => value === rebuilt[i]),
      culled,
      cleared: backend.getDiagnostics().gpu.overlayRasterBytes === 0,
    };
  });
  expect(result).toMatchObject({ uploads: 0, builds: 0, hits: 3, exact: true, cleared: true });
  expect(result.bytes).toBeLessThan(64 * 1024);
  expect(result.culled).toBeGreaterThanOrEqual(3);
});

test("real graphics loss recovers resources without restarting gameplay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/?renderer=gpu&meshes");
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
  await page.goto("/tilefun/");
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
  await expect(selector).toHaveValue("gpu-mesh");
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
    expect(url.searchParams.get("renderer")).toBe(mode === "canvas" ? "canvas" : "gpu");
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
  await page.reload();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#game")).toHaveAttribute("data-renderer", "canvas");
  expect(errors).toEqual([]);
});

test("GPU reads decoded image dimensions once per frame and resets on recovery", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const result = await page.evaluate(async () => {
    const surface = (
      window as unknown as {
        rendererLab: {
          gpu: { surface: import("../src/rendering/GpuRasterSurface.js").GpuRasterSurface };
        };
      }
    ).rendererLab.gpu.surface;
    const source = document.createElement("canvas");
    source.width = source.height = 8;
    source.getContext("2d")?.fillRect(0, 0, 8, 8);
    const image = new Image();
    image.src = source.toDataURL();
    await image.decode();
    // Gameplay uses ImageBitmap; decoded HTML images are supported too.
    const bitmap = await createImageBitmap(image);
    const width = Object.getOwnPropertyDescriptor(ImageBitmap.prototype, "width")?.get;
    if (!width) throw Error("No bitmap width getter");
    let reads = 0;
    Object.defineProperty(bitmap, "width", {
      get() {
        reads++;
        return width.call(bitmap);
      },
    });
    surface.beginFrame();
    for (let i = 0; i < 100; i++) surface.drawImage(bitmap, i, 0);
    surface.flush();
    const first = reads;
    const uploads = surface.stats.uploads;
    surface.beginFrame();
    surface.drawImage(bitmap, 0, 0);
    surface.flush();
    const second = reads;
    const reused = surface.stats.uploads === uploads;
    surface.recover();
    surface.drawImage(bitmap, 0, 0);
    surface.flush();
    return {
      first,
      second,
      recovered: reads > second,
      reused,
      reuploaded: surface.stats.uploads === uploads + 1,
    };
  });
  expect(result.first).toBeLessThanOrEqual(2);
  expect(result.second).toBeGreaterThan(result.first);
  expect(result).toMatchObject({ recovered: true, reused: true, reuploaded: true });
});

test("GPU indexed batches preserve quad order, capacity boundaries and upload accounting", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const result = await page.evaluate(() => {
    const surface = (
      window as unknown as {
        rendererLab: {
          gpu: { surface: import("../src/rendering/GpuRasterSurface.js").GpuRasterSurface };
        };
      }
    ).rendererLab.gpu.surface;
    const reference = document.createElement("canvas");
    reference.width = surface.canvas.width;
    reference.height = surface.canvas.height;
    const ctx = reference.getContext("2d");
    if (!ctx) throw Error("Missing reference context");
    ctx.imageSmoothingEnabled = false;
    const images = ["#2c85b7", "#e4a64c", "#6742a1"].map((color) => {
      const image = document.createElement("canvas");
      image.width = image.height = 3;
      const paint = image.getContext("2d");
      if (!paint) throw Error("Missing source context");
      paint.fillStyle = color;
      paint.fillRect(0, 0, 3, 3);
      surface.drawImage(image, 0, 0);
      return image;
    });
    surface.flush();
    const before = { ...surface.stats };
    surface.beginFrame();
    // Four textures, more than two full batches. Overlap and changing tint/alpha
    // expose index order errors; the final partial batch must not draw stale quads.
    for (const target of [ctx, surface]) {
      target.save();
      target.translate(3, 5);
      target.scale(2, 2);
      for (let i = 0; i < 4101; i++) {
        target.fillStyle = i % 2 ? "#28a45d" : "#9631e2";
        // Use a representable 8-bit alpha, keeping the one-channel tolerance
        // independent of Canvas/WebGL rounding exactly halfway between bytes.
        target.globalAlpha = i % 3 ? 1 : 128 / 255;
        const x = (i * 7) % 160,
          y = (i * 11) % 120;
        const image = images[i % images.length];
        if (i % 4 && image) target.drawImage(image, x, y, 4, 5);
        else target.fillRect(x, y, 4, 5);
      }
      target.restore();
    }
    surface.flush();
    const copy = document.createElement("canvas");
    copy.width = reference.width;
    copy.height = reference.height;
    const gpuCtx = copy.getContext("2d");
    if (!gpuCtx) throw Error("Missing GPU capture context");
    gpuCtx.drawImage(surface.canvas, 0, 0);
    const actual = gpuCtx.getImageData(0, 0, copy.width, copy.height).data;
    const expected = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let maxError = 0;
    for (let i = 0; i < actual.length; i++)
      maxError = Math.max(maxError, Math.abs((actual[i] ?? 0) - (expected[i] ?? 0)));
    return {
      maxError,
      uploaded: surface.stats.vertexUploadedBytes - before.vertexUploadedBytes,
      draws: surface.stats.drawCalls - before.drawCalls,
    };
  });
  expect(result.maxError).toBeLessThanOrEqual(1);
  expect(result.draws).toBe(3);
  expect(result.uploaded).toBe(4101 * 4 * 9 * 4);
});

test("shared grass LOD fades consistently in Canvas and GPU and returns at ordinary zoom", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  for (const zoom of [1, 0.5, 0.375, 0.251, 0.25, 0.1, 0.375, 1]) {
    const report = await page.evaluate(
      (zoom) =>
        (
          window as unknown as {
            rendererLab: {
              setGrassDetail(
                zoom: number,
                fixedProjection?: boolean,
              ): Promise<{
                mismatches: number;
                maxError: number;
                grassCount: number;
                grassAlpha: number;
              }>;
            };
          }
        ).rendererLab.setGrassDetail(zoom, true),
      zoom,
    );
    expect(report.mismatches).toBe(0);
    if (zoom <= 0.25) expect(report.grassCount).toBe(0);
    else {
      expect(report.grassCount).toBeGreaterThan(0);
      if (zoom >= 0.5) expect(report.grassAlpha).toBe(1);
      if (zoom === 0.375) expect(report.grassAlpha).toBe(0.5);
      if (zoom === 0.251) expect(report.grassAlpha).toBeLessThan(0.001);
    }
    if ([0.5, 0.375, 0.25].includes(zoom)) {
      await page.evaluate(
        (zoom) =>
          (
            window as unknown as {
              rendererLab: { setGrassDetail(zoom: number): Promise<unknown> };
            }
          ).rendererLab.setGrassDetail(zoom),
        zoom,
      );
      await page.screenshot({ path: `/tmp/tilefun-059-grass-${zoom}.png` });
    }
  }
});

test("missing authored GLB keeps the complete sprite body", async ({ page }) => {
  await page.route("**/assets/models/vehicles/compact-1-v7.glb", (route) =>
    route.fulfill({ status: 404, body: "missing model" }),
  );
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const result = await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setMesh(value: boolean): Promise<unknown> } }
    ).rendererLab.setMesh(true),
  );
  expect(result).toMatchObject({ meshState: "failed", meshDraws: 0, mismatches: 0 });
});
