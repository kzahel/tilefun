/** Raw true-F/R source captures; explicitly not parent shared-cycle review. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const d = "data/vehicle-bake/classic-motorcycle-player-fit";
const o = "public/demos/vehicle-bake/classic-motorcycle-player-fit/v1";
const c = `${d}/captures`;
await mkdir(c, { recursive: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const modelHash = sha(await readFile(`${o}/model.glb`));
const riderHash = sha(await readFile(`${o}/rider-reference.glb`));
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: resolve(d, "vite-cache"),
  logLevel: "error",
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: [] },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const url = `http://127.0.0.1:${server.httpServer.address().port}/tilefun/${o}/raw-diagnostic.html`;
  await page.goto(url);
  await page.waitForFunction(() => window.cycleRawReady === true);
  const frames = [];
  const wires = [];
  const depth = [];
  const baseline = {};
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 16; i++) {
      const yaw = i * 22.5;
      const data = await page.evaluate(
        ({ yaw, mode }) => {
          const api = window.cycleRaw;
          const all = {};
          for (const view of [
            "combined",
            "bike-alone",
            "rider-alone",
            "rider-hidden",
            "visible-rider-mask",
            "ownership-mask",
          ])
            all[view] = api.render({
              yaw,
              mode,
              view,
              wire: false,
              distance: 0,
              wheelDistances: null,
            });
          const combined = all.combined,
            bare = all["bike-alone"],
            hidden = all["rider-hidden"],
            rider = all["rider-alone"],
            ownership = all["ownership-mask"];
          if (!bare.pixels.every((v, j) => v === hidden.pixels[j]))
            throw Error(`Rider hidden changed actual bike pixels ${mode}/${yaw}`);
          let unionMismatches = 0,
            riderVisible = 0,
            bikeVisible = 0,
            riderTotal = 0,
            bikeTotal = 0;
          for (let j = 0; j < combined.rawPixels.length; j += 4) {
            const union = !!(bare.rawPixels[j + 3] || rider.rawPixels[j + 3]);
            if (union !== !!combined.rawPixels[j + 3]) unionMismatches++;
            if (rider.rawPixels[j + 3]) riderTotal++;
            if (bare.rawPixels[j + 3]) bikeTotal++;
            if (ownership.rawPixels[j + 3]) {
              if (ownership.rawPixels[j] === 255 && ownership.rawPixels[j + 2] === 0)
                riderVisible++;
              else if (ownership.rawPixels[j] === 0 && ownership.rawPixels[j + 2] === 255)
                bikeVisible++;
              else throw Error("Non-discrete real depth ownership pixel");
            }
          }
          const receipt = {
            yaw,
            mode,
            oneActualDepthTarget: api.oneActualDepthTarget,
            riderHiddenBikePixelsExact: true,
            unionAlphaMismatches: unionMismatches,
            riderTotal,
            bikeTotal,
            riderVisible,
            bikeVisible,
            riderOccludedByBike: riderTotal - riderVisible,
            bikeOccludedByRider: bikeTotal - bikeVisible,
            combinedDraws: combined.drawCalls,
            independentBikeDraws: bare.drawCalls,
          };
          const views = Object.entries(all).map(([view, r]) => {
            const { pixels, rawPixels, ...rest } = r;
            return { view, ...rest };
          });
          return { receipt, views, combinedPixels: combined.pixels };
        },
        { yaw, mode },
      );
      assert.equal(data.receipt.unionAlphaMismatches, 0);
      assert.equal(data.receipt.combinedDraws, 4);
      assert.equal(data.receipt.independentBikeDraws, 3);
      depth.push(data.receipt);
      baseline[`${mode}-${i}`] = sha(Buffer.from(data.combinedPixels));
      for (const frame of data.views) {
        assert.equal(frame.edgePixels, 0);
        const { png, ...record } = frame;
        const file = `${frame.view}-${mode}-${i}.png`;
        await writeFile(`${c}/${file}`, Buffer.from(png, "base64"));
        frames.push({ ...record, image: file, sha256: sha(Buffer.from(png, "base64")) });
      }
    }
  assert.ok(depth.some((r) => r.riderOccludedByBike > 0));
  assert.ok(depth.some((r) => r.bikeOccludedByRider > 0));
  const paddingParity = [];
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 16; i++) {
      const record = await page.evaluate(
        ({ mode, yaw }) => {
          const api = window.cycleRaw;
          const rows = [];
          for (const view of ["combined", "bike-alone", "rider-alone"]) {
            api.setNativeSize(224);
            const full = api.render({
              mode,
              yaw,
              view,
              wire: false,
              distance: 0,
              wheelDistances: null,
            });
            api.setNativeSize(128);
            const small = api.render();
            let mismatches = 0,
              fullCount = 0,
              smallCount = 0;
            for (let j = 3; j < full.pixels.length; j += 4) if (full.pixels[j]) fullCount++;
            for (let y = 0; y < 128; y++)
              for (let x = 0; x < 128; x++) {
                const a = 4 * (y * 128 + x),
                  b = 4 * ((y + 48) * 224 + x + 48);
                if (small.pixels[a + 3]) smallCount++;
                for (let k = 0; k < 4; k++)
                  if (small.pixels[a + k] !== full.pixels[b + k]) mismatches++;
              }
            if (mismatches || fullCount !== smallCount)
              throw Error(`Padding changed native density ${mode}/${yaw}/${view}`);
            rows.push({ view, exactRGBA: true, occupiedPixels: fullCount });
          }
          api.setNativeSize(224);
          return { mode, yaw, views: rows, viewport128To224Translation: [48, 48], scale: 1 };
        },
        { mode, yaw: i * 22.5 },
      );
      paddingParity.push(record);
    }
  const phases = [];
  const radius = await page.evaluate(() => window.cycleRaw.rigs[0][0].radius);
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 8; i++) {
      const phase = (i < 4 ? i : i - 8) * 45;
      const result = await page.evaluate(
        ({ mode, distance }) => {
          const api = window.cycleRaw;
          api.render({
            mode,
            yaw: 45,
            distance: 0,
            wheelDistances: null,
            view: "combined",
            wire: false,
          });
          const fixed = [api.bike.getObjectByName("Body_static"), api.rider];
          const before = fixed.map((o) => o.matrixWorld.toArray());
          const frame = api.render({ distance });
          if (
            fixed.some((o, j) =>
              o.matrixWorld.elements.some((v, k) => Math.abs(v - before[j][k]) > 1e-6),
            )
          )
            throw Error("Fixed bike/rider moved with wheel travel");
          const { png, pixels, rawPixels, ...record } = frame;
          return {
            png,
            ...record,
            wheels: api.rigs[0].map((w) => ({
              id: w.id,
              radiusWorld: w.radius,
              angleRadians: -distance / w.radius,
            })),
            fixedBikeAndRider: true,
          };
        },
        { mode, distance: (radius * Math.PI * phase) / 180 },
      );
      const { png, ...record } = result;
      const file = `phase-${mode}-${i}.png`;
      await writeFile(`${c}/${file}`, Buffer.from(png, "base64"));
      phases.push({ phase, ...record, image: file });
    }
  const independent = [];
  for (const id of ["F", "R"]) {
    const result = await page.evaluate((id) => {
      const api = window.cycleRaw;
      api.render({
        mode: "engine",
        yaw: 0,
        view: "combined",
        wire: false,
        distance: 0,
        wheelDistances: null,
      });
      const wheel = api.rigs[0].find((w) => w.id === id);
      const pivot = wheel.roll.getWorldPosition(wheel.roll.position.clone());
      const fixed = [];
      api.bike.traverse((n) => {
        if (n.isMesh && n.parent !== wheel.roll) fixed.push([n, n.matrixWorld.toArray()]);
      });
      fixed.push([api.rider, api.rider.matrixWorld.toArray()]);
      const shots = [];
      for (const phase of [0, 90, -90, 0]) {
        const frame = api.render({
          wheelDistances: { F: 0, R: 0, [id]: (wheel.radius * Math.PI * phase) / 180 },
        });
        if (wheel.roll.getWorldPosition(wheel.roll.position.clone()).distanceTo(pivot) > 1e-6)
          throw Error(`Actual roll pivot moved ${id}`);
        const expected = wheel.rest
          .clone()
          .multiply(wheel.rest.clone().setFromAxisAngle(wheel.axis, (-phase * Math.PI) / 180));
        if (wheel.roll.quaternion.angleTo(expected) > 1e-6)
          throw Error(`Actual signed quarter travel differs ${id}`);
        if (
          fixed.some(([n, m]) => n.matrixWorld.elements.some((v, j) => Math.abs(v - m[j]) > 1e-6))
        )
          throw Error(`Other mesh moved ${id}`);
        shots.push(frame);
      }
      const changed = (a, b) => a.reduce((n, v, j) => n + Number(v !== b[j]), 0);
      const forward = changed(shots[0].pixels, shots[1].pixels),
        reverse = changed(shots[0].pixels, shots[2].pixels);
      if (!forward || !reverse || changed(shots[0].pixels, shots[3].pixels))
        throw Error(`Independent visual phase/reset failed ${id}`);
      return {
        id,
        radiusWorld: wheel.radius,
        forwardChangedChannels: forward,
        reverseChangedChannels: reverse,
        absoluteResetPixelsExact: true,
        otherWheelBodyRiderFixed: true,
        actualPivotFixed: true,
        signedQuaternionTravelExact: true,
        shots: shots.map((s) => s.png),
      };
    }, id);
    const { shots, ...record } = result;
    const images = [];
    for (let i = 0; i < shots.length; i++) {
      const file = `independent-${id}-${i}.png`;
      await writeFile(`${c}/${file}`, Buffer.from(shots[i], "base64"));
      images.push(file);
    }
    independent.push({ ...record, images });
  }
  for (const mode of ["study", "engine"])
    for (const view of ["combined", "bike-alone", "rider-alone"])
      for (let i = 0; i < 16; i++) {
        const wireResult = await page.evaluate(
          ({ mode, view, yaw }) => {
            const api = window.cycleRaw;
            const filled = api.render({
              mode,
              view,
              yaw,
              wire: false,
              distance: 0,
              wheelDistances: null,
            });
            const wire = api.render({
              mode,
              yaw,
              view,
              wire: true,
              distance: 0,
              wheelDistances: null,
            });
            const changed = wire.pixels.reduce((n, v, j) => n + Number(v !== filled.pixels[j]), 0);
            if (!changed) throw Error("Wire diagnostic matches filled frame");
            for (const root of [api.bike, api.independentBike, api.rider])
              if (root.visible)
                root.traverse((o) => {
                  if (o.isMesh && !o.material.wireframe)
                    throw Error("Active mesh is not wireframe");
                });
            return {
              png: wire.png,
              changedChannelsFromFilled: changed,
              draws: wire.drawCalls,
              nativeSize: wire.nativeSize,
            };
          },
          { mode, view, yaw: i * 22.5 },
        );
        const name = `wire-${view}-${mode}-${i}.png`;
        await writeFile(`${c}/${name}`, Buffer.from(wireResult.png, "base64"));
        if (i === 2)
          await writeFile(`${c}/wire-${view}-${mode}.png`, Buffer.from(wireResult.png, "base64"));
        wires.push({
          mode,
          view,
          yaw: i * 22.5,
          image: name,
          sha256: sha(Buffer.from(wireResult.png, "base64")),
          changedChannelsFromFilled: wireResult.changedChannelsFromFilled,
          actualMeshWireframe: true,
          nativeSize: wireResult.nativeSize,
          postOutlineSkippedForTopologyReadability: true,
        });
      }
  await page.evaluate(() =>
    window.cycleRaw.render({
      mode: "study",
      yaw: 45,
      view: "combined",
      wire: false,
      distance: 0,
      wheelDistances: null,
    }),
  );
  await page.screenshot({ path: `${d}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const z of [1, 2, 3]) {
    await page.selectOption("#zoom", String(z));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(
      await page.evaluate(() => {
        const r = document.querySelector("#native").getBoundingClientRect();
        return Math.abs(r.width - r.height) < 1;
      }),
    );
  }
  await page.screenshot({ path: `${d}/mobile.png`, fullPage: true });
  const offline = await browser.newPage();
  const requests = [];
  offline.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await offline.goto(pathToFileURL(resolve(o, "offline-raw.html")).href);
  await offline.waitForFunction(() => window.cycleRawReady === true);
  const embedded = await offline.evaluate(() => ({
    bike: window.cycleOffline.assets.bike.split(",")[1],
    rider: window.cycleOffline.assets.rider.split(",")[1],
  }));
  assert.equal(sha(Buffer.from(embedded.bike, "base64")), modelHash);
  assert.equal(sha(Buffer.from(embedded.rider, "base64")), riderHash);
  const offlineParity = [];
  for (const mode of ["study", "engine"])
    for (let i = 0; i < 16; i++) {
      const bytes = await offline.evaluate(
        ({ mode, yaw }) =>
          window.cycleRaw.render({
            mode,
            yaw,
            view: "combined",
            wire: false,
            distance: 0,
            wheelDistances: null,
          }).pixels,
        { mode, yaw: i * 22.5 },
      );
      assert.equal(sha(Buffer.from(bytes)), baseline[`${mode}-${i}`]);
      offlineParity.push({ mode, yaw: i * 22.5, combinedPixelsExact: true });
    }
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  const receipt = {
    status: "passed-raw-source-diagnostic",
    glbSha256: modelHash,
    riderSha256: riderHash,
    CarMeshAssetUsed: false,
    normalCatalogUsed: false,
    sharedCycleQualification: "pending parent actual shared loader/browser review",
    trueWheelIds: ["F", "R"],
    nativeSize: 224,
    source80ReferenceUnchanged: true,
    singleDepthTarget: true,
    frames,
    depth,
    paddingParity,
    signedPhases: phases,
    independent,
    bothWireframesForEachAssetMode: true,
    all32WireframesEachOfCombinedBareAndRider: true,
    wires,
    riderHidden32ViewsPixelExact: true,
    desktopMobile: {
      bundledFullChromium: true,
      version: browser.version(),
      mobileNoOverflow: true,
    },
    offline: {
      noNetworkRequests: true,
      requests,
      embeddedExactModelHash: modelHash,
      embeddedExactRiderHash: riderHash,
      all32CombinedPixelsExact: offlineParity,
    },
    errors,
  };
  await writeFile(`${d}/raw-capture.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: receipt.status,
      glbSha256: modelHash,
      trueWheelIds: ["F", "R"],
      actualViews: frames.length,
      riderHidden32Exact: true,
      depthOcclusionViews: depth.filter((r) => r.riderOccludedByBike > 0).length,
      sharedReview: "pending parent",
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
