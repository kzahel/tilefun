// Isolated bundled Chromium, never the owner's normal browser/profile. Requires
// a Vite dev server; creates only ephemeral browser-local game worlds.
import { chromium } from "playwright-core";

const origin = process.env.TILEFUN_DEV_URL ?? "http://localhost:5174/tilefun";
const browser = await chromium.launch({ headless: !process.argv.includes("--headed") });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${origin}/tools.html`);
  const arrival = await page.evaluate(async () => {
    const { DenseDistrictSource } = await import(
      "/tilefun/src/generation/regional/DenseDistrictPlanner.ts"
    );
    const { regionalWorld } = await import("/tilefun/src/generation/regional/WorldDescriptor.ts");
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    const p = new DenseDistrictSource(regionalWorld(2026), true).owner(0, 0);
    const lot = p.blocks.flatMap((b) => b.lots).find((l) => l.buildingType.includes("condo"));
    if (!lot) throw Error("Missing apartment checkpoint");
    return {
      x: lot.entrance.x,
      y: lot.entrance.y,
      generation: createDescriptor("regional", 2026),
    };
  });
  await page.goto(
    `${origin}/?generation=${encodeURIComponent(JSON.stringify(arrival.generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await page.getByRole("button", { name: /^Enter apartment/ }).waitFor();
  const sample = () =>
    page.evaluate(async () => {
      const game = document.querySelector("#game").__game;
      const callbacks = game.loop.callbacks,
        render = callbacks.render;
      const costs = [];
      callbacks.render = (alpha) => {
        const start = performance.now();
        render(alpha);
        costs.push(performance.now() - start);
      };
      const frames = [];
      try {
        let last = await new Promise(requestAnimationFrame);
        for (let i = 0; i < 150; i++) {
          const now = await new Promise(requestAnimationFrame);
          if (i >= 30) frames.push(now - last);
          last = now;
        }
      } finally {
        callbacks.render = render;
      }
      const times = costs.slice(30).sort((a, b) => a - b);
      frames.sort((a, b) => a - b);
      return {
        frames: frames.length,
        renderMedianMs: times[Math.floor(times.length / 2)],
        renderP95Ms: times[Math.floor(times.length * 0.95)],
        frameMedianMs: frames[60],
        frameP95Ms: frames[114],
        entities: game.stateView.entities.length,
        props: game.stateView.props.length,
      };
    });
  const outdoor = await sample();
  await page.keyboard.press("e");
  await page.waitForFunction(() =>
    document.querySelector("#game").dataset.interior.includes("interior-v1"),
  );
  const indoor = await sample();
  let editedIndoor;
  if (process.argv.includes("--edited-room")) {
    await page.waitForFunction(
      () => document.querySelector("#game").__game.stateView.roomState !== null,
    );
    await page.evaluate(async () => {
      const game = document.querySelector("#game").__game;
      const { interiorRealmId } = await import("/tilefun/src/interiors/GameplayInterior.ts");
      const identity = game.stateView.interior;
      game.transport.send({ type: "set-editor-mode", enabled: true });
      game.transport.send({
        type: "edit-room",
        roomId: interiorRealmId(identity.parentWorldId, identity.featureId),
        expectedRevision: game.stateView.roomState.revision,
        edit: {
          path: [
            { x: 4, y: 2 },
            { x: 8, y: 3 },
          ],
          shape: "rectangle",
          value: "K",
          erase: false,
        },
      });
      game.transport.send({ type: "set-editor-mode", enabled: false });
    });
    await page.waitForFunction(
      () => document.querySelector("#game").__game.stateView.roomState.revision === 1,
    );
    editedIndoor = await sample();
  }
  const before = await page.evaluate(() => ({
    ...document.querySelector("#game").__game.stateView.playerEntity.position,
  }));
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(150);
  await page.keyboard.up("ArrowRight");
  const after = await page.evaluate(() => ({
    ...document.querySelector("#game").__game.stateView.playerEntity.position,
  }));
  await page.getByRole("button", { name: "Return to street" }).click();
  await page.waitForFunction(() => document.querySelector("#game").dataset.interior === "");
  if (errors.length) throw Error(errors.join("\n"));
  if (after.wx <= before.wx + 4) throw Error("Interior movement did not respond");
  console.log(
    JSON.stringify({
      outdoor,
      indoor,
      ...(editedIndoor ? { editedIndoor } : {}),
      indoorMovementPixels: after.wx - before.wx,
      errors,
    }),
  );
} finally {
  await browser.close();
}
