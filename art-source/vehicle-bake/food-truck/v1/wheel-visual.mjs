/** Road-wheel actual-GLB diagnostics. Equal-angle phases are separate from
 * ordinary distance-driven captures; wheel-ID colors diagnose occlusion only. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const base = "data/vehicle-bake/food-truck";
const folder = `${base}/author-view/captures`;
const sha = createHash("sha256")
  .update(await readFile("public/demos/vehicle-bake/food-truck/v1/model.glb"))
  .digest("hex");
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(base, "mixed-vite-cache"),
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
    `http://127.0.0.1:${server.httpServer.address().port}/tilefun/${base}/author-view/index.html`,
  );
  await page.waitForFunction(() => window.familyReviewReady === true);
  const phases = [];
  for (const mode of ["study", "engine"]) {
    for (let index = 0; index < 8; index++) {
      const phase = (index < 4 ? index : index - 8) * 45;
      const frame = await page.evaluate(
        async ({ mode, phase }) => {
          const THREE = await import("/tilefun/node_modules/three/build/three.module.js");
          const { createWheelRig } = await import(
            "/tilefun/scripts/authored-assets/runtime/wheel-rig.mjs"
          );
          const api = window.familyReview;
          const asset = api.state.asset;
          const original = asset.setTravel.bind(asset);
          original(0);
          const rig = createWheelRig(asset.object, THREE);
          api.pose(45, 0, mode);
          asset.object.updateMatrixWorld(true);
          const body = asset.object.getObjectByName("Body_static");
          const fixed = body.matrixWorld.toArray();
          asset.setTravel = () => {
            original(0);
            for (const w of rig.wheels)
              rig.setWheelTravel(w.id, (w.radius * Math.PI * phase) / 180);
          };
          api.pose(45, 0, mode);
          asset.object.updateMatrixWorld(true);
          if (body.matrixWorld.elements.some((v, i) => Math.abs(v - fixed[i]) > 1e-6))
            throw Error("Equal-phase diagnostic moved body");
          for (const w of rig.wheels) {
            const expected = w.restRoll
              .clone()
              .multiply(new THREE.Quaternion().setFromAxisAngle(w.axis, (-phase * Math.PI) / 180));
            if (w.roll.quaternion.angleTo(expected) > 1e-6)
              throw Error(`Wheel phase mismatch ${w.id}`);
          }
          const png = document.querySelector("#low").toDataURL().split(",")[1];
          asset.setTravel = original;
          original(0);
          return {
            png,
            wheels: rig.wheels.map((w) => ({
              id: w.id,
              radius: w.radius,
              phaseDegrees: phase,
              perWheelDiagnosticDistance: (w.radius * Math.PI * phase) / 180,
            })),
          };
        },
        { mode, phase },
      );
      const path = `${folder}/equal-phase-${mode}-${index}.png`;
      await writeFile(path, Buffer.from(frame.png, "base64"));
      phases.push({
        mode,
        phaseDegrees: phase,
        wheels: frame.wheels,
        fixedBody: true,
        image: path,
      });
    }
  }
  await page.evaluate(async () => {
    const THREE = await import("/tilefun/node_modules/three/build/three.module.js");
    const { createWheelRig } = await import(
      "/tilefun/scripts/authored-assets/runtime/wheel-rig.mjs"
    );
    const rig = createWheelRig(window.familyReview.state.asset.object, THREE);
    const colors = { FL: 0x00ff00, FR: 0xffff00, RL: 0x00ffff, RR: 0xff0000 };
    for (const w of rig.wheels)
      w.roll.traverse((n) => {
        if (n.isMesh) n.material = new THREE.MeshBasicMaterial({ color: colors[w.id] });
      });
  });
  const ids = [];
  for (const mode of ["study", "engine"]) {
    for (let index = 0; index < 16; index++) {
      const png = await page.evaluate(
        ({ mode, index }) => {
          window.familyReview.pose(index * 22.5, 0, mode);
          return document.querySelector("#low").toDataURL().split(",")[1];
        },
        { mode, index },
      );
      const path = `${folder}/wheel-id-${mode}-${index}.png`;
      await writeFile(path, Buffer.from(png, "base64"));
      ids.push({ mode, yaw: index * 22.5, image: path });
    }
  }
  assert.deepEqual(errors, []);
  const receipt = {
    status: "passed",
    glbSha256: sha,
    browser: "bundled full Chromium",
    phases,
    wheelIdViews: ids,
    wheelIdLegend: { FL: "green", FR: "yellow", RL: "cyan", RR: "red" },
    meaning:
      "16 equal-angle phase diagnostics use each wheel's own radius. Standard capture.json separately proves ordinary shared-distance rolling. Wheel-ID views override only temporary wheel materials to inspect attachment and rear occlusion; never source/model paint or art acceptance.",
    errors,
  };
  await writeFile(`${base}/wheel-visual.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: "passed",
      glbSha256: sha,
      phaseViews: phases.length,
      wheelIdViews: ids.length,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
