import { expect, type Page, test } from "@playwright/test";
import type { AudioManager } from "../src/audio/AudioManager.js";
import type { ClientStateView, RemoteStateView } from "../src/client/ClientStateView.js";
import type { GameLoop } from "../src/core/GameLoop.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import type { TapMovement } from "../src/input/TapMovement.js";
import type { TouchButtons } from "../src/input/TouchButtons.js";
import { authoredVehicleForType } from "../src/rendering/AuthoredVehicleMeshes.js";
import type { GpuRenderBackend } from "../src/rendering/GpuRenderBackend.js";
import { projectWorld } from "../src/rendering/Projection.js";
import type { RequestMessage } from "../src/shared/requests.js";
import type { WorkerClientTransport } from "../src/transport/WorkerClientTransport.js";
import { worldTap } from "./helpers/worldTap.js";

type Game = {
  audioManager: AudioManager;
  touchButtons: TouchButtons;
  stateView: ClientStateView;
  remoteView: RemoteStateView;
  loop: GameLoop;
  tapMovement: TapMovement;
  gcSendRequest(request: RequestMessage): Promise<unknown>;
  nextRequestId: number;
  netEmulatedTransport: { base: WorkerClientTransport };
};
test.use({
  channel: "chromium",
  isMobile: true,
  hasTouch: true,
  viewport: { width: 600, height: 800 },
});
async function read(page: Page) {
  return page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
    const p = g.remoteView.serverPlayerEntity;
    const car = g.remoteView.serverEntities.find((e) => e.id === p.parentId);
    return {
      id: p.id,
      parent: p.parentId ?? null,
      x: p.position.wx,
      y: p.position.wy,
      speed: Math.hypot(car?.velocity?.vx ?? 0, car?.velocity?.vy ?? 0),
      type: car?.type,
      editing: g.stateView.editorEnabled,
      target: g.tapMovement.target,
    };
  });
}
async function checkHorn(page: Page, kind: "car" | "train") {
  const canvas = page.locator("#game");
  await canvas.evaluate((c) => {
    const g = (c as unknown as { __game: Game }).__game;
    const play = g.audioManager.playVehicleHorn.bind(g.audioManager);
    (c as HTMLElement).dataset.horns = "0";
    g.audioManager.playVehicleHorn = (message, listener) => {
      (c as HTMLElement).dataset.horns = String(Number((c as HTMLElement).dataset.horns) + 1);
      (c as HTMLElement).dataset.hornKind = message.kind;
      play(message, listener);
    };
  });
  await page.keyboard.press("h");
  await expect(canvas).toHaveAttribute("data-horns", "1");
  if (kind === "train") await expect(canvas).toHaveAttribute("data-horn-kind", "train");
  await expect
    .poll(() =>
      canvas.evaluate((c) => (c as unknown as { __game: Game }).__game.audioManager.ready),
    )
    .toBe(true);
  await page.waitForTimeout(850); // Authority admits one short horn per 800 ms.
  const spot = await canvas.evaluate((c) => {
    const g = (c as unknown as { __game: Game }).__game,
      rect = c.getBoundingClientRect();
    return { x: rect.right - 52, y: rect.bottom - 52 - (g.touchButtons.emergency ? 136 : 0) };
  });
  await page.touchscreen.tap(spot.x, spot.y);
  await expect(canvas).toHaveAttribute("data-horns", "2");
}
async function start(page: Page, backend: string, cars = false) {
  const generation = createDescriptor("regional", 2026);
  const arrival = cars
    ? {
        x: backend.includes("meshes") ? 212 : 300,
        y: backend.includes("meshes") ? 491 : 519,
        generation,
      }
    : undefined;
  await page.goto(
    `/tilefun/?nogamepad&renderer=${backend}&generation=${encodeURIComponent(JSON.stringify(generation))}${arrival ? `&arrival=${encodeURIComponent(JSON.stringify(arrival))}` : ""}`,
  );
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByPlaceholder("World name...").fill("Vehicle driving");
  await page.getByRole("button", { name: "New World", exact: true }).tap();
  await expect(page.getByRole("button", { name: "New World", exact: true })).not.toBeVisible();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(generation),
  );
  await expect.poll(async () => (await read(page)).id).not.toBe(-1);
  if ((await read(page)).editing) await page.keyboard.press("Tab");
}
async function tapMode(page: Page, mode = "Tap to move") {
  await page.locator("button[aria-label=Options]").tap();
  await page.getByRole("button", { name: mode, exact: true }).tap();
  await page.getByRole("button", { name: "Back to game", exact: true }).tap();
}
for (const backend of ["canvas", "gpu", "gpu&meshes", "gpu&meshes&allcars3d"]) {
  test(`car boarding, tap destination, saved inside seat and exit (${backend})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page, backend, true);
    const override = backend.includes("allcars3d");
    const exactBlue = backend.includes("meshes") && !override;
    const desiredModel = exactBlue ? "blue" : override ? "other" : "any";
    if (exactBlue) {
      // The seeded blue compact starts on the west street, outside the
      // initial replica window. Let native traffic populate, then approach it.
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
              return g.stateView.entities.some((e) => e.type.startsWith("vehicle-v1:"));
            }),
          { timeout: 15000 },
        )
        .toBe(true);
      await page.evaluate(async () => {
        const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
        await g.gcSendRequest({
          type: "rcon",
          requestId: g.nextRequestId++,
          command: "tp 3360 7344",
        });
      });
    }
    await expect
      .poll(
        () =>
          page.evaluate((mode) => {
            const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
            return g.stateView.entities.some(
              (e) =>
                e.type.startsWith("vehicle-v1:") &&
                (mode !== "blue" || e.type === "vehicle-v1:compact-1") &&
                (mode !== "other" || e.type !== "vehicle-v1:compact-1"),
            );
          }, desiredModel),
        { timeout: 15000 },
      )
      .toBe(true);
    await page.evaluate(async (mode) => {
      const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      const car = g.stateView.entities.find(
        (e) =>
          e.type.startsWith("vehicle-v1:") &&
          (mode !== "blue" || e.type === "vehicle-v1:compact-1") &&
          (mode !== "other" || e.type !== "vehicle-v1:compact-1"),
      );
      if (!car?.collider) throw Error("No car");
      const dir = car.sprite?.direction ?? 3;
      const dx = dir === 3 ? 1 : dir === 2 ? -1 : 0,
        dy = dir === 0 ? 1 : dir === 1 ? -1 : 0;
      const x = car.position.wx + car.collider.offsetX + dx * (car.collider.width / 2 + 12);
      const y =
        car.position.wy +
        car.collider.offsetY -
        car.collider.height / 2 +
        dy * (car.collider.height / 2 + 12);
      await g.gcSendRequest({
        type: "rcon",
        requestId: g.nextRequestId++,
        command: `tp ${x} ${y}`,
      });
    }, desiredModel);
    await expect(page.getByRole("button", { name: "Drive car · E", exact: true })).toBeVisible({
      timeout: 15000,
    });
    await tapMode(page);
    await page.getByRole("button", { name: "Drive car · E", exact: true }).tap();
    await expect.poll(async () => (await read(page)).parent).not.toBeNull();
    expect((await read(page)).type).toMatch(/^vehicle-v1:/);
    await checkHorn(page, "car");
    if (backend.includes("meshes")) {
      if (override) expect((await read(page)).type).not.toBe("vehicle-v1:compact-1");
      else expect((await read(page)).type).toBe("vehicle-v1:compact-1");
      const expectedAsset =
        authoredVehicleForType((await read(page)).type ?? "")?.assetId ?? "compact-1-authored-v7";
      await expect
        .poll(() =>
          page.locator("#game").evaluate((c, assetId) => {
            const g = (
              c as unknown as {
                __game: Game & {
                  renderer: GpuRenderBackend;
                  sceneFrame: {
                    meshPoses: { poses: Map<number, { instance: { assetId: string } }> };
                  };
                };
              }
            ).__game;
            const pose = g.sceneFrame.meshPoses.poses.get(
              g.remoteView.serverPlayerEntity.parentId ?? -1,
            );
            return {
              drivenAsset: pose?.instance.assetId,
              ownState: g.renderer.meshes.assetStates[assetId]?.state,
              ownError: g.renderer.meshes.assetStates[assetId]?.error,
              ownMeshes: g.renderer.meshes.assetStates[assetId]?.meshes ?? 0,
              draws: g.renderer.meshes.draws,
            };
          }, expectedAsset),
        )
        .toMatchObject({
          drivenAsset: expectedAsset,
          ownState: "ready",
          ownError: null,
          ownMeshes: expect.any(Number),
          draws: expect.any(Number),
        });
      const diagnostics = await page.locator("#game").evaluate((c, assetId) => {
        const g = (c as unknown as { __game: Game & { renderer: GpuRenderBackend } }).__game;
        return {
          meshes: g.renderer.meshes.assetStates[assetId]?.meshes ?? 0,
          draws: g.renderer.meshes.draws,
        };
      }, expectedAsset);
      expect(diagnostics.meshes).toBeGreaterThan(0);
      expect(diagnostics.draws).toBeGreaterThan(0);
    }
    // The same loaded GLB can draw multiple actors. Measure this driver's pose;
    // exported roll axes and backend application are covered by actual asset probes.
    const wheelPose = () =>
      page.locator("#game").evaluate((c) => {
        const g = (
          c as unknown as {
            __game: Game & {
              sceneFrame: {
                meshPoses: { poses: Map<number, { instance: { wheelTravel?: number } }> };
              };
            };
          }
        ).__game;
        return g.sceneFrame.meshPoses.poses.get(g.remoteView.serverPlayerEntity.parentId ?? -1)
          ?.instance.wheelTravel;
      });
    const wheelBefore = backend.includes("meshes") ? await wheelPose() : null;
    const before = await read(page);
    const target = await page.evaluate(() => {
      const canvas = document.querySelector("#game") as HTMLCanvasElement;
      const g = (canvas as unknown as { __game: Game }).__game;
      const p = g.stateView.playerEntity;
      const rect = canvas.getBoundingClientRect();
      const view = g.stateView.entities.find((e) => e.id === p.parentId);
      const dir = view?.sprite?.direction ?? 3;
      return {
        p: p.position,
        dx: dir === 2 ? -64 : dir === 3 ? 64 : 0,
        dy: dir === 0 ? 64 : dir === 1 ? -64 : 0,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        camera: (
          g.tapMovement as unknown as { view: import("../src/rendering/RenderFrame.js").RenderView }
        ).view,
        z: p.wz ?? 0,
      };
    });
    const point = projectWorld(
      target.camera,
      target.p.wx + target.dx,
      target.p.wy + target.dy,
      target.z,
    );
    await worldTap(
      page,
      target.rect.x + (point.sx * target.rect.width) / target.camera.viewportWidth,
      target.rect.y + (point.sy * target.rect.height) / target.camera.viewportHeight,
    );
    await expect
      .poll(async () => {
        const s = await read(page);
        return Math.hypot(s.x - before.x, s.y - before.y);
      })
      .toBeGreaterThan(16);
    await expect.poll(async () => (await read(page)).target, { timeout: 10000 }).toBeNull();
    await expect.poll(async () => (await read(page)).speed).toBeLessThan(0.1);
    if (backend.includes("meshes")) expect(await wheelPose()).not.toEqual(wheelBefore);
    if (backend.includes("meshes")) {
      // Sample the same displayed pose cache used by the collector. The shared
      // GPU asset draws several cars, so its last quaternion need not be ours.
      await page.keyboard.down("ArrowDown");
      await page.keyboard.down("ArrowRight");
      const alignment = await page.evaluate(async () => {
        const g = (
          document.querySelector("#game") as unknown as {
            __game: Game & {
              sceneFrame: {
                meshPoses: { poses: Map<number, { x: number; y: number; orientation: number[] }> };
              };
            };
          }
        ).__game;
        const id = g.remoteView.serverPlayerEntity.parentId;
        if (id === undefined) throw Error("Missing driver parent");
        const samples: { x: number; y: number; angle: number }[] = [];
        for (let i = 0; i < 30; i++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const pose = g.sceneFrame.meshPoses.poses.get(id);
          if (!pose) throw Error("Missing displayed car pose");
          samples.push({
            x: pose.x,
            y: pose.y,
            angle: 2 * Math.atan2(pose.orientation[2] ?? 0, pose.orientation[3] ?? 1),
          });
        }
        return samples.slice(1).flatMap((sample, i) => {
          const previous = samples[i];
          if (!previous) return [];
          const dx = sample.x - previous.x,
            dy = sample.y - previous.y;
          if (Math.hypot(dx, dy) < 0.001) return [];
          const error = Math.atan2(
            Math.sin(sample.angle - Math.atan2(dy, dx)),
            Math.cos(sample.angle - Math.atan2(dy, dx)),
          );
          return [error];
        });
      });
      await page.keyboard.up("ArrowDown");
      await page.keyboard.up("ArrowRight");
      expect(alignment.length).toBeGreaterThan(5);
      expect(Math.max(...alignment.map(Math.abs))).toBeLessThan(0.001);
      await expect.poll(async () => (await read(page)).speed).toBeLessThan(0.1);
      const stoppedHeading = () =>
        page.evaluate(() => {
          const g = (
            document.querySelector("#game") as unknown as {
              __game: Game & {
                sceneFrame: { meshPoses: { poses: Map<number, { orientation: number[] }> } };
              };
            }
          ).__game;
          return g.sceneFrame.meshPoses.poses
            .get(g.remoteView.serverPlayerEntity.parentId ?? -1)
            ?.orientation.slice();
        });
      const stopped = await stoppedHeading();
      await page.waitForTimeout(350);
      expect(await stoppedHeading()).toEqual(stopped);
      if (override) expect((await read(page)).type).not.toBe("vehicle-v1:compact-1");
    }
    await page.screenshot({ path: `/tmp/tilefun-driving-car-${backend}.png` });
    await page.evaluate(async () => {
      const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      g.loop.stop();
      g.netEmulatedTransport.base.setHidden(true);
      await g.netEmulatedTransport.base.flush();
      await g.netEmulatedTransport.base.shutdown();
    });
    await page.goto(`/tilefun/?nogamepad&renderer=${backend}`);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect.poll(async () => (await read(page)).parent).not.toBeNull();
    expect((await read(page)).type).toBe(before.type);
    if ((await read(page)).editing) await page.keyboard.press("Tab");
    await page.getByRole("button", { name: "Get out · E", exact: true }).tap();
    await expect.poll(async () => (await read(page)).parent).toBeNull();
    expect(errors).toEqual([]);
  });
  if (backend.includes("meshes")) continue;
  for (const mode of ["Tap to move", "Hold to move"]) {
    test(`train ${mode} starts, stops, reverses, and UI stays isolated (${backend})`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await start(page, backend);
      const enter = page.getByRole("button", { name: "Drive train · E", exact: true });
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
              return g.stateView.entities.some((e) => e.type.startsWith("train"));
            }),
          { timeout: 15000 },
        )
        .toBe(true);
      await page.evaluate(async () => {
        const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
        const trains = g.stateView.entities.filter((e) => e.type.startsWith("train"));
        const direction = (trains[0]?.velocity?.vx ?? 0) < 0 ? -1 : 1;
        const lead = trains.sort((a, b) => direction * (b.position.wx - a.position.wx))[0];
        if (!lead?.collider) throw Error("No train");
        const x =
          lead.position.wx + lead.collider.offsetX + direction * (lead.collider.width / 2 + 12);
        await g.gcSendRequest({
          type: "rcon",
          requestId: g.nextRequestId++,
          command: `tp ${x} ${lead.position.wy + lead.collider.offsetY}`,
        });
      });
      await expect(enter).toBeVisible({ timeout: 15000 });
      await tapMode(page, mode);
      await expect(enter).toBeEnabled();
      await enter.tap();
      await expect.poll(async () => (await read(page)).parent).not.toBeNull();
      expect((await read(page)).type).toMatch(/^train/);
      await checkHorn(page, "train");
      const session = await page.context().newCDPSession(page);
      if (mode === "Hold to move")
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: 530, y: 300, id: 1 }],
        });
      else await page.touchscreen.tap(530, 300);
      await expect.poll(async () => (await read(page)).speed).toBeGreaterThan(24);
      if (mode === "Hold to move") {
        await page.waitForTimeout(1000);
        expect((await read(page)).speed).toBeGreaterThan(24);
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else await page.touchscreen.tap(530, 300);
      await expect.poll(async () => (await read(page)).speed).toBeLessThan(0.1);
      const stopped = await read(page);
      await page.waitForTimeout(400);
      expect(
        Math.hypot((await read(page)).x - stopped.x, (await read(page)).y - stopped.y),
      ).toBeLessThan(1);
      if (mode === "Hold to move")
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: 70, y: 300, id: 2 }],
        });
      else await page.touchscreen.tap(70, 300);
      await expect.poll(async () => (await read(page)).x).toBeLessThan(stopped.x - 8);
      await page
        .locator("button[aria-label=Options]")
        .evaluate((b: HTMLButtonElement) => b.click());
      if (mode === "Hold to move")
        await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await session.detach();
      await expect.poll(async () => (await read(page)).speed).toBeLessThan(0.1);
      await page.getByRole("button", { name: "Back to game", exact: true }).tap();
      expect((await read(page)).speed).toBeLessThan(0.1);
      await page.screenshot({ path: `/tmp/tilefun-driving-train-${backend}.png` });
      await page.getByRole("button", { name: "Get out · E", exact: true }).tap();
      await expect.poll(async () => (await read(page)).parent).toBeNull();
      expect(errors).toEqual([]);
    });
  }
}
