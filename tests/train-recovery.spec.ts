import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";
import { cityTrainRecipe } from "../src/scenarios/CityTrainRecipe.js";

type TrainDisplaySample = {
  at: number;
  time: number;
  train: number;
  camera: number;
  cameraY: number;
  player: number;
  playerY: number;
  z: number;
};

test.use({ channel: "chromium", hasTouch: true, viewport: { width: 1000, height: 800 } });
test("station recall and assisted train roof riding use ordinary game Worker authority", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const recipe = cityTrainRecipe();
  // Boarding, riding and display continuity are Worker/prediction/presentation behavior.
  // Canvas keeps the eight-second boarding window reachable on hosted software WebGL.
  await page.goto("/tilefun/?nogamepad&renderer=canvas");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(async (recipe) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Train recovery",
      generation: recipe.generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: {
        generation: recipe.generation,
        x: recipe.player.position.wx / 16,
        y: recipe.player.position.wy / 16,
      },
    });
    g.transport.send({ type: "set-editor-mode", enabled: false });
  }, recipe);
  const state = () =>
    page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
      const p = g.stateView.serverPlayerEntity;
      const cars = g.stateView.serverEntities.filter(
        (e) => e.type.startsWith("train-carriage-v1:") || e.type.startsWith("train-curve-proof-v1"),
      );
      const middle = cars.find(
        (e) => e.type === "train-carriage-v1:middle" || e.type === "train-curve-proof-v1",
      );
      return {
        x: p.position.wx,
        y: p.position.wy,
        z: p.wz ?? 0,
        air: p.jumpVZ !== undefined,
        carX: middle?.position.wx ?? 0,
        carY: middle?.position.wy ?? 0,
        count: cars.length,
        speed: Math.hypot(middle?.velocity?.vx ?? 0, middle?.velocity?.vy ?? 0),
      };
    });
  const call = page.getByRole("button", { name: /^Call train/ });
  await expect(call).toBeVisible();
  await call.tap();
  await expect(page.getByText("Poof! Your train is here.", { exact: true })).toBeVisible();
  await expect.poll(async () => (await state()).count).toBe(3);
  const start = await state();
  // Release keys when the predicted player crosses a threshold, sampled every frame.
  // Server replicas lag input; releasing on them overshoots the 24px-deep roof.
  const until = (axis: "x" | "y" | "z", above: number) =>
    page.waitForFunction(
      ({ axis, above }) => {
        const p = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game
          .stateView.playerEntity;
        return (axis === "x" ? p.position.wx : axis === "y" ? p.position.wy : (p.wz ?? 0)) > above;
      },
      { axis, above },
      { polling: "raf", timeout: 15_000 },
    );
  const hold = async (keys: string[], reached: () => Promise<unknown>) => {
    for (const key of keys) await page.keyboard.down(key);
    try {
      await reached();
    } finally {
      for (const key of [...keys].reverse()) await page.keyboard.up(key);
    }
  };
  // The car's north face is at carY - 12; jump assist needs a gap of at most 24px.
  await hold(["ArrowDown"], () => until("y", start.carY - 34));
  await hold(["ArrowRight"], () => until("x", start.carX - 193));
  // The first recall provides eight seconds to board. Approach leaves bench
  // range, so do not request a redundant recall from beside the carriage.
  // Land near the middle of the roof ([carY - 12, carY + 12]).
  await hold(["ArrowDown", "Space"], async () => {
    await until("z", 44);
    await until("y", start.carY - 2);
  });
  await expect
    .poll(async () => {
      const p = await state();
      return !p.air && p.z > 43 && p.z < 45;
    })
    .toBe(true);
  const onRoof = await state();
  await expect
    .poll(async () => (await state()).carX, { timeout: 15000 })
    .toBeGreaterThan(onRoof.carX + 20);
  expect((await state()).x).toBeGreaterThan(onRoof.x + 15);
  // Exercise the actual Worker/input/prediction flight boundary at cruise speed.
  await expect.poll(async () => (await state()).speed, { timeout: 10000 }).toBeGreaterThan(191);
  await page.evaluate(() => {
    const canvas = document.querySelector("#game") as unknown as {
      __game: {
        renderer: import("../src/rendering/RenderFrame.js").RenderBackend;
        time: { presentationSeconds: number; alpha: number };
        stateView: import("../src/client/ClientStateView.js").RemoteStateView;
      };
      __trainCapture?: {
        stop(): TrainDisplaySample[];
      };
    };
    const g = canvas.__game,
      submit = g.renderer.submit.bind(g.renderer);
    const samples: TrainDisplaySample[] = [];
    g.renderer.submit = (camera, pass) => {
      if (pass.kind === "scene") {
        const car = pass.items.find(
          (i) =>
            i.kind === "sprite" &&
            ["train-carriage-v1:middle", "train-curve-proof-v1"].includes(i.sheetKey),
        );
        if (car?.kind === "sprite" && samples.length < 600) {
          const p = g.stateView.presentedPlayerEntity;
          samples.push({
            at: performance.now(),
            time: g.time.presentationSeconds * 1000,
            train: car.wx,
            camera: camera.x,
            cameraY: camera.y,
            player: p.position.wx,
            playerY: p.position.wy,
            z: p.wz ?? 0,
          });
        }
      }
      return submit(camera, pass);
    };
    canvas.__trainCapture = {
      stop() {
        g.renderer.submit = submit;
        return samples;
      },
    };
  });
  const takeoff = await state();
  await page.keyboard.press("Space", { delay: 60 });
  await expect.poll(async () => (await state()).z, { intervals: [20] }).toBeGreaterThan(50);
  await expect
    .poll(
      async () => {
        const p = await state();
        return !p.air && p.z > 43 && p.z < 45;
      },
      { intervals: [30] },
    )
    .toBe(true);
  const landing = await state();
  expect(Math.abs(landing.x - landing.carX - (takeoff.x - takeoff.carX))).toBeLessThan(3);
  // A second airborne press can be held through landing for one buffered hop.
  await page.keyboard.press("Space", { delay: 60 });
  await expect.poll(async () => (await state()).z, { intervals: [20] }).toBeGreaterThan(50);
  await page.keyboard.down("Space");
  const queued = () =>
    page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
      return (
        g.stateView.physicsState?.bodies.find((b) => b.id === g.stateView.serverPlayerEntity.id)
          ?.jumpQueued ?? false
      );
    });
  await expect.poll(queued, { intervals: [20] }).toBe(true);
  await expect.poll(queued, { intervals: [20] }).toBe(false);
  await page.keyboard.up("Space");
  await expect
    .poll(async () => {
      const p = await state();
      return !p.air && p.z > 43 && p.z < 45;
    })
    .toBe(true);
  // Jump off the side, then remain on the ground long enough to hand the train
  // back to ordinary buffered presentation while it remains visible.
  await page.keyboard.down("Space");
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(550);
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowDown");
  await expect
    .poll(async () => {
      const p = await state();
      return !p.air && p.z < 5;
    })
    .toBe(true);
  await page.waitForTimeout(700);
  const trace = await page.evaluate(() => {
    const canvas = document.querySelector("#game") as unknown as {
      __trainCapture?: {
        stop(): TrainDisplaySample[];
      };
    };
    const data = canvas.__trainCapture?.stop() ?? [];
    delete canvas.__trainCapture;
    return data;
  });
  const tracePath = test.info().outputPath("train-jump-display.json");
  await writeFile(tracePath, JSON.stringify(trace));
  await test
    .info()
    .attach("train-jump-display.json", { path: tracePath, contentType: "application/json" });
  const intervals = trace
    .slice(1)
    .map((s, i) => ({
      dt: s.at - (trace[i]?.at ?? s.at),
      dx: s.train - (trace[i]?.train ?? s.train),
      camera: s.camera - (trace[i]?.camera ?? s.camera),
    }))
    .filter((s) => s.dt > 5 && s.dt < 40);
  expect(intervals.length).toBeGreaterThan(60);
  expect(Math.min(...intervals.map((s) => s.dx))).toBeGreaterThan(-0.5);
  const firstY = trace[0]?.playerY ?? 0;
  const riding = trace
    .slice(1)
    .map((s, i) => ({ s, previous: trace[i] }))
    .filter(
      ({ s, previous }) =>
        previous &&
        Math.abs(s.playerY - firstY) < 0.5 &&
        s.time - previous.time > 5 &&
        s.time - previous.time < 40,
    );
  expect(riding.length).toBeGreaterThan(30);
  // On a starved runner a replay can span two updates: one frame holds, the next
  // doubles (~3.2 px; tactical 221 open item: riding stutter under slow replays).
  // Bound every step to one frame of travel and require steady average progress.
  let travelled = 0,
    elapsed = 0,
    cameraTravelled = 0;
  for (const { s, previous } of riding) {
    if (!previous) continue;
    expect(Math.abs(s.cameraY - previous.cameraY)).toBeLessThan(0.5);
    const expected = (s.time - previous.time) * 0.192;
    expect(Math.abs(s.train - previous.train - expected)).toBeLessThan(4.5);
    expect(Math.abs(s.camera - previous.camera - expected)).toBeLessThan(4.5);
    travelled += s.train - previous.train;
    cameraTravelled += s.camera - previous.camera;
    elapsed += s.time - previous.time;
  }
  expect(travelled / elapsed).toBeCloseTo(0.192, 1);
  expect(cameraTravelled / elapsed).toBeCloseTo(0.192, 1);
  await page.screenshot({
    path: test.info().outputPath("restored-train-roof.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await page.goto("about:blank");
  await expect.poll(() => page.workers().length).toBe(0);
});

test("embedded station keeps its bench start, paused reload and shared recall controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html?geometry=train&renderer=gpu&meshes#/tool/world-geometry");
  const canvas = page.getByLabel("World geometry scene");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  const call = page.getByRole("button", { name: /^Call train/ });
  await expect(call).toBeVisible();
  await call.tap();
  await expect(page.getByText("Poof! Your train is here.", { exact: true })).toBeVisible();
  const x = Number(await canvas.getAttribute("data-player-x"));
  expect(Math.abs(x)).toBeGreaterThan(1000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-reload-count", "1");
  expect(Number(await canvas.getAttribute("data-player-x"))).toBeCloseTo(x, 1);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "bench", exact: true }).click();
  await expect(call).toBeVisible();
  await canvas.focus();
  await page.keyboard.press("e");
  await expect(page.getByText("Poof! Your train is here.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});
