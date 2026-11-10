import { expect, test } from "@playwright/test";
import type { GpuRenderBackend } from "../src/rendering/GpuRenderBackend.js";
import type { GeometryCanvas } from "../src/workshop/WorldGeometryPage.js";

test.use({ channel: "chromium" });
test("adjacent sprites have no gaps or overlaps at fractional scales", async ({ page }) => {
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
  expect(reports).toHaveLength(32);
  expect(reports.filter((report) => report.mismatches !== 0)).toEqual([]);
});

test("world composition keeps scenery rigid and followed actors steady", async ({ page }) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const reports = await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: { probeCameraStability(): { mismatches: number; movedFrames: number }[] };
      }
    ).rendererLab.probeCameraStability(),
  );
  expect(reports).toHaveLength(10);
  expect(reports.filter((report) => report.mismatches !== 0 || report.movedFrames === 0)).toEqual(
    [],
  );
  const composed = await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: {
          probeWorldRegistration(atlas?: boolean): {
            zoom: number;
            relativeRange: number;
            elevationRange: number;
            actorXRange: number;
            actorYRange: number;
            actorXError: number;
            actorYError: number;
            bleed: number;
            positions: {
              sceneryDigest: number;
              relativeX: number;
              elevationX: number;
              actorX: number;
              actorY: number;
              bleed: number;
            }[];
          }[];
        };
      }
    ).rendererLab.probeWorldRegistration(),
  );
  expect(composed).toHaveLength(10);
  // The page atlas (232) samples the same texels as separate page textures:
  // nearest-sampled scenery (terrain, props, slabs; 0.5 is all texel ties) is
  // byte-identical. Filtered actor edges may round differently (layer-space UVs
  // carry less precision than a small page's; measured <=1 level on hardware,
  // <=2 on SwiftShader), moving centroids <=0.005 px.
  const separate = (await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: { probeWorldRegistration(atlas: boolean): unknown };
      }
    ).rendererLab.probeWorldRegistration(false),
  )) as typeof composed;
  expect(separate).toHaveLength(composed.length);
  composed.forEach((report, i) => {
    expect(report.positions).toHaveLength(7);
    expect(separate[i]?.positions).toHaveLength(7);
    report.positions.forEach((p, j) => {
      const other = separate[i]?.positions[j];
      expect(other?.sceneryDigest, `zoom ${report.zoom} phase ${j}`).toBe(p.sceneryDigest);
      expect(other?.relativeX).toBe(p.relativeX);
      expect(other?.elevationX).toBe(p.elevationX);
      expect(other?.bleed).toBe(p.bleed);
      expect(Math.abs((other?.actorX ?? 0) - p.actorX)).toBeLessThan(0.01);
      expect(Math.abs((other?.actorY ?? 0) - p.actorY)).toBeLessThan(0.01);
    });
  });
  // SwiftShader (hosted CI) rasterizes with 4 subpixel bits: a subpixel-placed
  // actor snaps by up to 1/16px (measured 0.032-0.054px, steadiness and absolute
  // placement). Hardware GPUs measure <=0.005px. Scenery registration and bleed keep
  // their bounds everywhere.
  const software = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return /SwiftShader/i.test(String(info && gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)));
  });
  const actorLimit = software ? 1 / 16 : 0.03;
  expect(
    composed.filter(
      (r) =>
        r.relativeRange > 0.03 ||
        r.elevationRange > 0.03 ||
        r.actorXRange > actorLimit ||
        r.actorYRange > actorLimit ||
        r.actorXError > actorLimit ||
        r.actorYError > actorLimit ||
        r.bleed > 1,
    ),
  ).toEqual([]);
});

test("split views compose into their regions without new GL objects", async ({ page }) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const reports = await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: {
          probeViewRegions(): {
            layout: string;
            compared?: number;
            mismatches?: number;
            glObjects?: number;
          }[];
        };
      }
    ).rendererLab.probeViewRegions(),
  );
  // Three layouts + one region-resizing run.
  expect(reports).toHaveLength(4);
  for (const report of reports)
    if (report.glObjects === undefined) {
      expect(report.compared).toBeGreaterThan(30000);
      expect(report).toMatchObject({ mismatches: 0 });
    } else expect(report).toMatchObject({ glObjects: 0 });
});

type LabReport = Record<string, number> & { uploads: number };
type RendererLabWindow = {
  rendererLab: {
    draw(): LabReport;
    setClips(value: boolean): LabReport;
    changeTexture(): LabReport;
    palette(colors: readonly string[]): {
      counts: number[];
      bounds: ([number, number, number, number] | null)[];
      other: number;
    };
  };
};

/** The lab scene's exact colors and counts at zoom 1 (232): clear, the striped and
 * orange fixture frames, the shadow, the blue-tinted hole, the half-alpha particle.
 * Recorded from the GPU when it still matched the Canvas reference exactly. */
const SCENE_COLORS = [
  "#243245",
  "#fa7345",
  "#246333",
  "#51be49",
  "#192330",
  "#8c579b",
  "#8e872e",
  "#f9a82e",
] as const;
const SCENE_COUNTS = [83203, 14940, 3744, 3744, 2513, 2304, 108, 36];
/** Each color's pixel bounds, so a lost flip or a shifted sprite fails too. */
const SCENE_BOUNDS = [
  [0, 0, 383, 287],
  [96, 96, 299, 191],
  [48, 48, 137, 143],
  [54, 48, 143, 143],
  [60, 144, 287, 228],
  [144, 120, 251, 167],
  [186, 90, 197, 101],
  [186, 96, 191, 101],
];

test("GPU draws the lab scene's expected pixels with retained textures and union clips", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  expect(
    await page.evaluate(
      (colors) => (window as unknown as RendererLabWindow).rendererLab.palette(colors),
      SCENE_COLORS,
    ),
  ).toEqual({ counts: SCENE_COUNTS, bounds: SCENE_BOUNDS, other: 0 });
  const cold = await page.evaluate(() =>
    (window as unknown as RendererLabWindow).rendererLab.draw(),
  );
  expect(
    (await page.evaluate(() => (window as unknown as RendererLabWindow).rendererLab.draw()))
      .uploads,
  ).toBe(cold.uploads);
  // Inside the union of the two clip rectangles the frame matches the unclipped
  // (shadow-free) frame; outside it is the clear color, where the unclipped frame
  // has sprite pixels.
  const clipped = await page.evaluate(() =>
    (window as unknown as RendererLabWindow).rendererLab.setClips(true),
  );
  expect(clipped.clipErrors).toBe(0);
  expect(clipped.clipOutsideContent).toBeGreaterThan(1000);
  const changed = await page.evaluate(() =>
    (window as unknown as RendererLabWindow).rendererLab.changeTexture(),
  );
  expect(changed.uploads).toBe(cold.uploads + 1);
  expect(changed.clipErrors).toBe(0);
  // The repainted 8×8 atlas corner (screen x 48–71 at 3× scale) shows on the first
  // sprite only right of the clip edge at x 70.
  expect(
    await page.evaluate(() =>
      (window as unknown as RendererLabWindow).rendererLab.palette(["#7722dd"]),
    ),
  ).toMatchObject({ counts: [48], bounds: [[70, 48, 71, 71]] });
  expect(errors).toEqual([]);
});

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
  // Disabled, the mesh body falls back to exactly the plain sprite car.
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { rendererLab: { spriteFallbackMatches(): boolean } }
      ).rendererLab.spriteFallbackMatches(),
    ),
  ).toBe(true);
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
      if (!canvas) throw Error("Missing GPU canvas");
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
        // The authored sprite frame at this heading is the registration reference.
        await lab.setMesh(false);
        const sprite = bounds("gpu");
        await lab.setMesh(true);
        samples.push({ zoom, yaw, sprite, model: bounds("gpu") });
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

test("shared room and editor passes draw their expected pixels", async ({ page }) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  await page.evaluate(() =>
    (
      window as unknown as { rendererLab: { setInterior(v: boolean): Promise<unknown> } }
    ).rendererLab.setInterior(true),
  );
  // Floor, wall, wall band, furniture and the room's actor at integer scale;
  // recorded from the GPU when it matched the Canvas reference (232).
  const room = await page.evaluate(
    (colors) =>
      (
        window as unknown as {
          rendererLab: {
            palette(c: readonly string[]): { counts: number[]; bounds: unknown; other: number };
          };
        }
      ).rendererLab.palette(colors),
    ROOM_COLORS,
  );
  expect(room).toEqual({ counts: ROOM_COUNTS, bounds: ROOM_BOUNDS, other: 0 });
  const overlay = await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: {
          setOverlay(v: boolean): { overlayOutside: number; overlayFillError: number };
        };
      }
    ).rendererLab.setOverlay(true),
  );
  // The editor overlay changes nothing outside its stroked box, and its fill is its
  // color blended over the room at the item's 0.7 alpha.
  expect(overlay.overlayOutside).toBe(0);
  expect(overlay.overlayFillError).toBeLessThanOrEqual(2);
});
const ROOM_COLORS = [
  "#243245",
  "#fa7345",
  "#a82b52",
  "#ac7949",
  "#9c2459",
  "#3a3a50",
  "#b48f54",
  "#8c579b",
  "#a9454f",
  "#a5643d",
  "#a63a50",
] as const;
const ROOM_COUNTS = [83952, 7488, 6282, 3663, 2493, 2232, 1557, 1152, 819, 783, 171];
const ROOM_BOUNDS = [
  [0, 0, 383, 287],
  [168, 156, 263, 251],
  [210, 159, 383, 284],
  [195, 162, 383, 287],
  [192, 159, 353, 287],
  [192, 156, 383, 254],
  [213, 162, 383, 287],
  [216, 180, 239, 227],
  [210, 171, 374, 278],
  [195, 162, 353, 287],
  [204, 171, 353, 278],
];

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

test("smooth shadows keep the pixel-exact shadows' placement at different scales", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const placements = await page.evaluate(() =>
    [0.5, 1, 1.5].map((zoom) =>
      (
        window as unknown as {
          rendererLab: {
            shadowPlacement(z: number): { zoom: number; massRatio: number; dx: number; dy: number };
          };
        }
      ).rendererLab.shadowPlacement(zoom),
    ),
  );
  // Darkening mass and centroid. Measured: within 1.5% and 0.05 px on hardware,
  // 1.2% and 0.17 px on SwiftShader.
  for (const p of placements) {
    expect(Math.abs(p.massRatio - 1), `zoom ${p.zoom}`).toBeLessThanOrEqual(0.05);
    expect(Math.hypot(p.dx, p.dy), `zoom ${p.zoom}`).toBeLessThanOrEqual(0.25);
  }
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
  // With the page atlas (232) and with separate page textures (the slot path).
  for (const atlas of [true, false]) {
    const result = await page.evaluate((atlas) => {
      const surface = (
        window as unknown as {
          rendererLab: {
            gpu: { surface: import("../src/rendering/GpuRasterSurface.js").GpuRasterSurface };
          };
        }
      ).rendererLab.gpu.surface;
      surface.setPageAtlas(atlas);
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
      // Four sources (white and three images: one atlas sampler, or four slots), more
      // than two full batches. Overlap and changing tint/alpha expose index order
      // errors; the final partial batch must not draw stale quads.
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
    }, atlas);
    expect(result.maxError).toBeLessThanOrEqual(1);
    expect(result.draws).toBe(3);
    expect(result.uploaded).toBe(4101 * 4 * 20 * 4);
  }
});

test("the page atlas draws exactly the pixels of separate page textures (232)", async ({
  page,
}) => {
  // A fresh lab per mode: grass and interior change the lab's view for good.
  const frames = async (atlas: boolean) => {
    await page.goto("/tilefun/renderer-lab.html");
    await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
    return page.evaluate(async (atlas) => {
      type Lab = {
        gpu: import("../src/rendering/GpuRenderBackend.js").GpuRenderBackend;
        setZoom(value: number): unknown;
        setOverlay(value: boolean): unknown;
        setClips(value: boolean): unknown;
        setInterior(value: boolean): Promise<unknown>;
        setGrassDetail(zoom: number, fixedProjection?: boolean): Promise<unknown>;
        digest(): string;
      };
      const lab = (window as unknown as { rendererLab: Lab }).rendererLab;
      const surface = lab.gpu.surface;
      surface.setPageAtlas(atlas);
      // Integer, half (exact texel-edge ties), fractional and overview zooms;
      // clips, the overlay raster, an interior and grass cover the other page users.
      const digests: string[] = [];
      for (const zoom of [1, 0.5, 0.375, 1.3, 0.1]) {
        lab.setZoom(zoom);
        digests.push(lab.digest());
      }
      lab.setZoom(1);
      lab.setClips(true);
      lab.setOverlay(true);
      digests.push(lab.digest());
      lab.setClips(false);
      lab.setOverlay(false);
      await lab.setInterior(true);
      digests.push(lab.digest());
      await lab.setInterior(false);
      await lab.setGrassDetail(0.5, true);
      digests.push(lab.digest());
      return { digests, layers: surface.stats.atlasLayers, misses: surface.stats.atlasMisses };
    }, atlas);
  };
  const atlas = await frames(true);
  const separate = await frames(false);
  expect(atlas.layers).toBeGreaterThan(0);
  expect(atlas.misses).toBe(0);
  expect(separate.layers).toBe(0);
  expect(new Set(atlas.digests).size).toBe(atlas.digests.length);
  expect(atlas.digests).toEqual(separate.digests);
});

test("the page atlas grows, falls back at its cap, re-uploads mid-batch and reuses evicted space (232)", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const run = (atlas: boolean) =>
    page.evaluate((atlas) => {
      const lab = (
        window as unknown as {
          rendererLab: {
            gpu: { surface: import("../src/rendering/GpuRasterSurface.js").GpuRasterSurface };
            touchRaster(source: object): void;
          };
        }
      ).rendererLab;
      const surface = lab.gpu.surface;
      // Two layers hold 32 of the 256² pages: the atlas grows 1 → 2, and the rest
      // fall back to separate textures in the same batches.
      surface.setPageAtlas(atlas, 2);
      const paint = (image: HTMLCanvasElement, i: number, shade: number) => {
        const ctx = image.getContext("2d");
        if (!ctx) throw Error("Missing source context");
        ctx.fillStyle = `hsl(${(i * 47) % 360} 70% ${shade}%)`;
        ctx.fillRect(0, 0, 256, 256);
        // A distinct top row: the page edge that layers store last (see GpuPageAtlas).
        ctx.fillStyle = `hsl(${(i * 47 + 180) % 360} 90% 50%)`;
        ctx.fillRect(0, 0, 256, 1);
      };
      const images = (shade: number) =>
        Array.from({ length: 36 }, (_, i) => {
          const image = document.createElement("canvas");
          image.width = image.height = 256;
          paint(image, i, shade);
          return image;
        });
      const read = () => {
        const copy = document.createElement("canvas");
        copy.width = surface.canvas.width;
        copy.height = surface.canvas.height;
        const ctx = copy.getContext("2d");
        if (!ctx) throw Error("Missing capture context");
        ctx.drawImage(surface.canvas, 0, 0);
        let hash = 0x811c9dc5;
        for (const value of ctx.getImageData(0, 0, copy.width, copy.height).data)
          hash = Math.imul(hash ^ value, 0x01000193);
        return hash >>> 0;
      };
      // Each page's top-left corner, at whole and half-pixel rows: a half-pixel row
      // puts pixel centers on the page's top edge (CLAMP_TO_EDGE for 2D pages).
      const draw = (sources: HTMLCanvasElement[]) =>
        sources.forEach((image, i) => {
          const x = (i % 18) * 21,
            y = Math.floor(i / 18) * 40;
          surface.drawImage(image, 0, 0, 8, 8, x, y, 8, 8);
          surface.drawImage(image, 0, 0, 8, 8, x + 10, y + 0.5, 8, 8);
          // Magnified 8:3, so no pixel center lands exactly on a texel edge: unbiased
          // hardware nearest resolves exact ties by interpolation rounding.
          surface.drawImage(image, 0, 0, 6, 6, x, y + 12, 16, 16);
        });
      const first = images(45);
      surface.beginFrame();
      draw(first);
      // A queued quad keeps the old pixels; the re-uploaded page draws the new ones.
      const changed = first[0];
      if (!changed) throw Error("Missing page");
      paint(changed, 0, 75);
      lab.touchRaster(changed);
      surface.drawImage(changed, 0, 0, 8, 8, 0, 90, 8, 8);
      surface.flush();
      const grown = { frame: read(), layers: surface.stats.atlasLayers };
      const misses = surface.stats.atlasMisses;
      // Age every page out; the emptied array shrinks.
      for (let i = 0; i < 125; i++) surface.beginFrame();
      const shrunk = surface.stats.atlasLayers;
      // New pages reuse evicted regions; their stale texels must not show.
      surface.beginFrame();
      draw(images(30));
      surface.flush();
      return { grown, misses, shrunk, reused: read() };
    }, atlas);
  const atlas = await run(true);
  const separate = await run(false);
  await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: {
          gpu: { surface: import("../src/rendering/GpuRasterSurface.js").GpuRasterSurface };
        };
      }
    ).rendererLab.gpu.surface.setPageAtlas(true, 64),
  );
  expect(atlas.grown.layers).toBe(2);
  expect(atlas.misses).toBe(4);
  expect(atlas.shrunk).toBe(1);
  expect(separate.grown.layers).toBe(0);
  expect(atlas.grown.frame).toBe(separate.grown.frame);
  expect(atlas.reused).toBe(separate.reused);
});

test("shared grass LOD fades linearly, hides when far and returns at ordinary zoom", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const digests: string[] = [];
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
                fadeError: number;
                fadeBlades: number;
                grassCount: number;
                grassAlpha: number;
              }>;
            };
          }
        ).rendererLab.setGrassDetail(zoom, true),
      zoom,
    );
    digests.push(
      await page.evaluate(() =>
        (window as unknown as { rendererLab: { digest(): string } }).rendererLab.digest(),
      ),
    );
    // Separate (non-overlapping) blades at the LOD alpha blend linearly between
    // full detail and none.
    expect(report.fadeError).toBeLessThanOrEqual(2);
    if (report.grassCount) expect(report.fadeBlades).toBeGreaterThan(10);
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
  // Ordinary zoom returns the same frame; hidden grass leaves the same frame as
  // its near-zero fade.
  expect(digests[7]).toBe(digests[0]);
  expect(digests[2]).toBe(digests[6]);
  expect(digests[4]).toBe(digests[3]);
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
  expect(result).toMatchObject({ meshState: "failed", meshDraws: 0 });
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { rendererLab: { spriteFallbackMatches(): boolean } }
      ).rendererLab.spriteFallbackMatches(),
    ),
  ).toBe(true);
});

test("production vehicle depth matches common 3D geometry through ordering, tilt and cached reuse", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const report = await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: {
          probeVehicleDepth: () => Promise<{
            reports: {
              pose: string;
              overlap: number;
              orderErrors: number;
              cacheErrors: number;
              oracleErrors: number;
            }[];
            imageHits: number;
            targetPool: { pairs: number; creates: number; hits: number; bytes: number };
          }>;
        };
      }
    ).rendererLab.probeVehicleDepth(),
  );
  expect(report.imageHits).toBeGreaterThan(0);
  expect(report.targetPool).toMatchObject({ pairs: 2, creates: 2 });
  expect(report.targetPool.hits).toBeGreaterThan(2);
  expect(report.targetPool.bytes).toBeLessThanOrEqual(16 * 1024 * 1024);
  expect(report.reports).toHaveLength(3);
  for (const result of report.reports) {
    expect(result.overlap).toBeGreaterThan(20);
    expect(result.orderErrors).toBe(0);
    expect(result.cacheErrors).toBe(0);
    expect(result.oracleErrors).toBe(0);
  }
});

test("GPU depth shadows match projected oval and vehicle decals on ground, ramps, decks and behind bodies", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const report = await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: {
          probeDeferredShadows: typeof import("../src/rendering/DeferredShadowProbe.js").probeDeferredShadows;
        };
      }
    ).rendererLab.probeDeferredShadows(),
  );
  expect(report).toHaveLength(30);
  for (const row of report) {
    const label = `${row.name} @${row.zoom}`;
    expect(row.queued, label).toBe(1);
    expect(row.shadedProjected, label).toBeGreaterThan(50);
    // The analytic masks and the 64 px mask images differ by a few levels at
    // most. Only the crest's seam strip differs more: projection leaves it unshaded.
    expect(row.differing, label).toBeLessThanOrEqual(row.name === "crest" ? 40 : 0);
    // Faint mask edges cross the "shaded" threshold on slightly different pixels.
    expect(Math.abs(row.shadedDeferred - row.shadedProjected), label).toBeLessThanOrEqual(
      Math.max(row.name === "crest" ? 40 : 12, row.shadedProjected * 0.07),
    );
  }
});

test("surface decals follow ramps, split at crests and blend over real mesh roofs without shadowing foreground bodies", async ({
  page,
}) => {
  await page.goto("/tilefun/renderer-lab.html");
  await expect(page.locator("#gpu")).toHaveAttribute("data-ready", "true");
  const report = await page.evaluate(() =>
    (
      window as unknown as {
        rendererLab: {
          probeSurfaceDecals: typeof import("../src/rendering/SurfaceDecalProbe.js").probeSurfaceDecals;
        };
      }
    ).rendererLab.probeSurfaceDecals(),
  );
  for (const row of report.report)
    for (const sample of row.samples) {
      if (row.name === "under") expect(sample.shadowed).toEqual(sample.baseline);
      else
        for (let i = 0; i < 3; i++) {
          const before = sample.baseline[i] ?? 0,
            after = sample.shadowed[i] ?? 0;
          expect(after / before).toBeCloseTo(0.72, 1);
        }
    }
  expect(report.protectedPixels).toBeGreaterThan(500);
  expect(report.occlusionErrors).toBe(0);
  expect(report.overlaySample).toEqual([255, 0, 170]);
  expect(report.roof.height).toBeGreaterThan(15);
  expect(report.roof.height).toBeLessThan(24);
  for (let i = 0; i < 3; i++)
    expect((report.roof.shadowed[i] ?? 0) / (report.roof.baseline[i] ?? 1)).toBeCloseTo(0.72, 1);
});
