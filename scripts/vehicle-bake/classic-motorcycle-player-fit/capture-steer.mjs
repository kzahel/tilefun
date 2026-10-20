/** Actual raw F steering diagnostic only; neutral clearance is qualified separately. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const d = "data/vehicle-bake/classic-motorcycle-player-fit";
const o = "public/demos/vehicle-bake/classic-motorcycle-player-fit/v1";
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(d, "vite-cache-steer"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/tilefun/${o}/raw-diagnostic.html`,
  );
  await page.waitForFunction(() => window.cycleRawReady);
  const frames = [];
  for (const mode of ["study", "engine"])
    for (const yaw of [0, 45, 90, 135]) {
      const result = await page.evaluate(
        ({ mode, yaw }) => {
          const api = window.cycleRaw;
          const start = api.render({
            mode,
            yaw,
            view: "combined",
            wire: false,
            distance: 0,
            wheelDistances: null,
            steerRadians: 0,
          });
          const front = api.rigs[0].find((w) => w.id === "F");
          const pivot = front.roll.getWorldPosition(front.roll.position.clone());
          const fixed = [];
          api.bike.traverse((n) => {
            if (n.isMesh && n.parent !== front.roll) fixed.push([n, n.matrixWorld.toArray()]);
          });
          fixed.push([api.rider, api.rider.matrixWorld.toArray()]);
          const shots = [];
          for (const angle of [-0.2, 0.2, 0]) {
            const shot = api.render({ steerRadians: angle });
            assertFinite(shot.occupiedPixels);
            if (front.roll.getWorldPosition(front.roll.position.clone()).distanceTo(pivot) > 1e-5)
              throw Error("Steering translated actual wheel pivot");
            if (
              fixed.some(([n, m]) =>
                n.matrixWorld.elements.some((v, j) => Math.abs(v - m[j]) > 1e-5),
              )
            )
              throw Error("Steering moved fixed body/rider/rear wheel");
            const expected = front.steerRest.clone();
            expected
              .setFromAxisAngle(front.axis.clone().set(0, 1, 0), angle)
              .premultiply(front.steerRest);
            if (front.steer.quaternion.angleTo(expected) > 1e-5)
              throw Error("Steering quaternion differs");
            if (front.roll.quaternion.angleTo(front.rest) > 1e-5)
              throw Error("Steering altered roll");
            shots.push({ angle, png: shot.png });
          }
          const reset = api.render({ steerRadians: 0 });
          if (!reset.pixels.every((v, i) => v === start.pixels[i]))
            throw Error("Steer absolute reset pixels differ");
          return {
            shots,
            actualPivotFixed: true,
            bodyRiderRearWheelFixed: true,
            signedAngleExact: true,
            rollUnchanged: true,
            absoluteResetPixelsExact: true,
          };
          function assertFinite(n) {
            if (!Number.isFinite(n) || n <= 0) throw Error("Empty or nonfinite frame");
          }
        },
        { mode, yaw },
      );
      const { shots, ...proof } = result;
      for (const shot of shots) {
        const image = `steer-${mode}-${yaw}-${shot.angle}.png`;
        await writeFile(`${d}/captures/${image}`, Buffer.from(shot.png, "base64"));
        frames.push({ mode, yaw, angleRadians: shot.angle, image, ...proof });
      }
    }
  assert.deepEqual(errors, []);
  await writeFile(
    `${d}/steer-diagnostic.json`,
    `${JSON.stringify(
      {
        status: "passed-raw-rig-diagnostic",
        glbSha256: createHash("sha256")
          .update(await readFile(`${o}/model.glb`))
          .digest("hex"),
        frames,
        rawGLTFOnly: true,
        nonzeroSteeringClearanceQualified: false,
        operatingForkControlAnimationClaimed: false,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser?.close();
  await server.close();
}
