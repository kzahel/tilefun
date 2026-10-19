import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import type { RenderBackend } from "../src/rendering/RenderFrame.js";
import { FROG_TYPE } from "../src/wildlife/Frog.js";

test.use({ channel: "chromium", viewport: { width: 1000, height: 800 } });
for (const renderer of ["canvas", "gpu&meshes"]) {
  test(`driving produces inert visible roadkill and saves its death (${renderer})`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
    await page.goto(
      `/tilefun/?nogamepad&renderer=${renderer}&generation=${encodeURIComponent(JSON.stringify(generation))}`,
    );
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 15000 });
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.getByTestId("world-menu")).toBeHidden();
    const editing = await page.evaluate(
      () =>
        (document.querySelector("#game") as unknown as { __game: GameClient }).__game.stateView
          .editorEnabled,
    );
    if (!editing) await page.keyboard.press("Tab");
    await page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      for (const e of g.remoteView.serverEntities)
        if (e.type !== "player") g.transport.send({ type: "edit-delete-entity", entityId: e.id });
      g.transport.send({ type: "edit-spawn", entityType: "vehicle-v1:compact-1", wx: 100, wy: 0 });
    });
    await page.keyboard.press("Tab");
    await page.evaluate(async () => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      await g.gcSendRequest({ type: "rcon", requestId: g.nextRequestId++, command: "tp 100 -16" });
    });
    await expect(page.getByRole("button", { name: /^Drive car(?: · [EY])?$/ })).toBeVisible();
    await page.getByRole("button", { name: /^Drive car(?: · [EY])?$/ }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
          return g.remoteView.serverPlayerEntity.parentId;
        }),
      )
      .toBeDefined();
    await page.evaluate((type) => {
      const canvas = document.querySelector("#game") as HTMLCanvasElement;
      const g = (canvas as unknown as { __game: GameClient }).__game;
      const car = g.remoteView.serverEntities.find(
        (e) => e.id === g.remoteView.serverPlayerEntity.parentId,
      );
      if (!car?.collider) throw Error("Missing car");
      const c = car.collider;
      g.transport.send({
        type: "edit-spawn",
        entityType: type,
        wx: car.position.wx + c.offsetX + c.width / 2 + 3,
        wy: car.position.wy + c.offsetY - c.height / 2 + 2,
      });
      // Observe production presentation submissions, without replacing their drawing.
      const backend = (g as unknown as { renderer: RenderBackend }).renderer;
      const submit = backend.submit.bind(backend);
      backend.submit = (view, pass) => {
        if (pass.kind === "scene") {
          const remains = pass.items.find((i) => i.kind === "sprite" && i.scaleY === 0.3);
          if (remains?.kind === "sprite")
            canvas.dataset.roadkillRender = JSON.stringify({
              sheet: remains.sheetKey,
              scale: remains.scaleY,
              shadow: remains.hasShadow,
              alpha: remains.alpha,
              frame: remains.frameCol,
              offset: remains.drawOffsetY,
            });
        }
        submit(view, pass);
      };
    }, FROG_TYPE);
    await page.locator("#game").focus();
    await page.keyboard.down("ArrowRight");
    const state = () =>
      page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        const remains = g.remoteView.serverEntities.find((e) => e.type.startsWith("roadkill:"));
        const car = g.remoteView.serverEntities.find(
          (e) => e.id === g.remoteView.serverPlayerEntity.parentId,
        );
        return {
          x: car?.position.wx ?? 0,
          corpse: remains
            ? {
                type: remains.type,
                position: remains.position,
                collider: remains.collider,
                ai: remains.wanderAI,
                velocity: remains.velocity,
                timer: remains.deathTimer,
                moving: remains.sprite?.moving,
                frame: remains.sprite?.frameCol,
                hidden: remains.flashHidden ?? false,
              }
            : null,
        };
      });
    await expect.poll(async () => (await state()).corpse?.type).toBe(`roadkill:${FROG_TYPE}`);
    await expect.poll(async () => (await state()).x).toBeGreaterThan(180);
    await page.keyboard.up("ArrowRight");
    const dead = (await state()).corpse;
    expect(dead).toMatchObject({
      collider: null,
      ai: null,
      velocity: null,
      moving: false,
      frame: 0,
      hidden: false,
    });
    await expect(page.locator("#game")).toHaveAttribute("data-roadkill-render", /"scale":0.3/);
    const render = JSON.parse(
      (await page.locator("#game").getAttribute("data-roadkill-render")) ?? "{}",
    );
    expect(render).toMatchObject({
      sheet: FROG_TYPE,
      scale: 0.3,
      shadow: false,
      alpha: 1,
      frame: 0,
      offset: 4.2,
    });
    await page.waitForTimeout(150);
    expect((await state()).corpse?.position).toEqual(dead?.position);
    await page.screenshot({ path: testInfo.outputPath("roadkill.png") });
    await page.evaluate(async () => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      g.loop.stop();
      const host = g.netEmulatedTransport.base as unknown as {
        setHidden(v: boolean): void;
        flush(): Promise<void>;
        shutdown(): Promise<void>;
      };
      host.setHidden(true);
      await host.flush();
      await host.shutdown();
    });
    await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 15000 });
    await expect.poll(async () => (await state()).corpse?.type).toBe(`roadkill:${FROG_TYPE}`);
    expect((await state()).corpse?.position).toEqual(dead?.position);
    expect((await state()).corpse?.timer).toBeLessThanOrEqual(dead?.timer ?? 30);
    expect(errors).toEqual([]);
  });
}
