import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "vite";
import {
  WILDLIFE_DEFAULT_MODELS,
  WILDLIFE_MODEL_REVIEWS,
  wildlifeModelReviewPath,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";
import { campaignPreview } from "./3d-campaign-preview.mjs";

const rolloutArg = process.argv.find((arg) => arg.startsWith("--rollout="));
const rollout = rolloutArg
  ? WILDLIFE_MODEL_REVIEWS.filter(({ batch }) => batch === rolloutArg.slice("--rollout=".length))
  : undefined;
assert(!rollout || rollout.length, "No registered rollout candidates in the requested batch");
const defaults = process.argv.includes("--defaults") ? WILDLIFE_DEFAULT_MODELS : undefined;
assert(!(rollout && defaults), "Choose --defaults or --rollout");
const campaign = rollout || defaults ? undefined : await campaignPreview();
if (campaign) assert.equal(campaign.count, 219);
const module = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import * as THREE from "three";
      import { WILDLIFE_MESHES } from "./src/rendering/WildlifeMeshCatalog.ts";
      import { obliqueProjection } from "./src/rendering/firstperson/ObliqueCamera.ts";
      import { FirstPersonWildlifeMeshes } from "./src/rendering/firstperson/FirstPersonWildlifeMeshes.ts";
      window.verifyCampaign = (reviews) => (${verifyCampaign.toString()})(THREE, WILDLIFE_MESHES, obliqueProjection, FirstPersonWildlifeMeshes, reviews);
    `,
  },
  define: { "import.meta.env": JSON.stringify({ DEV: true, BASE_URL: "/tilefun/" }) },
  bundle: true,
  format: "esm",
  write: false,
  logLevel: "warning",
});
const [registry] = campaign?.plugin.transformIndexHtml() ?? [];
const temp = await mkdtemp(join(tmpdir(), "tilefun-wildlife-campaign-"));
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: join(temp, "cache"),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  logLevel: "error",
  plugins: [
    {
      name: "tilefun-campaign-runtime-check",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = request.url?.split("?")[0];
          if (pathname === "/tilefun/verify-campaign") {
            response.setHeader("Content-Type", "text/html");
            response.end(
              `<!doctype html>${registry ? `<script type="application/json" id="${registry.attrs.id}">${registry.children}</script>` : ""}<script type="module" src="./verify-campaign.js"></script>`,
            );
          } else if (pathname === "/tilefun/verify-campaign.js") {
            response.setHeader("Content-Type", "text/javascript");
            response.end(module.outputFiles[0].contents);
          } else next();
        });
      },
    },
    campaign?.plugin,
  ].filter(Boolean),
});
let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  browser = await chromium.launch({ channel: "chromium", args: ["--enable-webgl"] });
  const page = await browser.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
  });
  const parts = [];
  for (const review of rollout ?? [null]) {
    const query = review ? `wildlife3dReview=${review.id}` : defaults ? "" : "wildlife3dDrafts=1";
    await page.goto(`http://127.0.0.1:${port}/tilefun/verify-campaign?${query}`);
    await page.waitForFunction(() => typeof window.verifyCampaign === "function");
    if (!review) {
      parts.push(await page.evaluate((models) => window.verifyCampaign(models), defaults));
      continue;
    }
    const path = `/tilefun/${wildlifeModelReviewPath(review.id, "model.glb")}`;
    const [response, part] = await Promise.all([
      page.waitForResponse((res) => new URL(res.url()).pathname === path),
      page.evaluate((candidate) => window.verifyCampaign([candidate]), review),
    ]);
    assert(response.ok(), path);
    const modelSha256 = createHash("sha256")
      .update(await response.body())
      .digest("hex");
    assert.equal(modelSha256, review.files["model.glb"], `Unexpected model bytes for ${review.id}`);
    assert.equal(part.candidates.length, 1, review.id);
    Object.assign(part.candidates[0], { candidateId: review.id, modelSha256 });
    parts.push(part);
  }
  const result = {
    candidates: parts.flatMap((part) => part.candidates),
    clipSamples: parts.reduce((total, part) => total + part.clipSamples, 0),
    testedDepth: parts.some((part) => part.testedDepth),
  };
  if (result.candidates.some(({ type }) => type === "wildlife-cat-provisional-v1"))
    assert(result.testedDepth, "Cat depth check did not run");
  assert.deepEqual(
    problems.filter((message) => /wildlife|GLTF|WebGL|shader|texture/i.test(message)),
    [],
  );
  assert.equal(result.candidates.length, campaign?.count ?? defaults?.length ?? rollout.length);
  await writeFile(
    resolve(
      process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
        "data/wildlife-3d-campaign/runtime-pilot/all-animals.json",
    ),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(
    `${result.candidates.length} registered animals drawn, ${result.clipSamples} runtime animation samples.`,
  );
  if (result.testedDepth) console.log("Cat depth and independent instances verified.");
} finally {
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}

async function verifyCampaign(
  THREE,
  WILDLIFE_MESHES,
  obliqueProjection,
  FirstPersonWildlifeMeshes,
  reviews,
) {
  const size = 192;
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  const target = new THREE.WebGLRenderTarget(size, size);
  renderer.setRenderTarget(target);
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  world.scale.y = -1;
  scene.add(world);
  const camera = new THREE.Camera();
  camera.projectionMatrix.fromArray(obliqueProjection(1, size, size)).transpose();
  const pixels = new Uint8Array(size * size * 4);
  const candidates = [];
  const reviewsByPath = new Map(
    reviews?.map((review) => [`demos/wildlife-3d/${review.id}/model.glb`, review]),
  );
  let clipSamples = 0;
  let testedDepth = false;

  function snapshot() {
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    return pixels.slice();
  }
  for (const [sheetKey, definition] of WILDLIFE_MESHES) {
    const path = definition.path;
    const review = reviewsByPath.get(path);
    if (reviews ? !review : !path.startsWith("assets/models/wildlife3d-review/")) continue;
    const type = review?.type ?? path.split("/").at(-1).replace(".glb", "");
    const clips = definition.animation.clips;
    const batch = new FirstPersonWildlifeMeshes(world, () => {});
    const item = { sheetKey, wx: 0, wy: 0, zOffset: 0, frameCol: 0, frameRow: 3 };
    function draw(clip, phase, enabled = true, direction = 3) {
      const { start, count, frameDuration } = clips[clip];
      const elapsedMs = phase * count * frameDuration;
      item.frameCol = start + Math.min(count - 1, Math.floor(phase * count));
      item.wildlifePose = {
        clip,
        direction,
        elapsedMs,
        frameTimeMs: elapsedMs % frameDuration,
        idleTime: phase * 2,
      };
      batch.begin(enabled, true);
      return { disposition: batch.push(item), drawn: batch.end() };
    }
    const deadline = performance.now() + 5000;
    while (!draw(0, 0).drawn) {
      if (performance.now() >= deadline) throw Error(`Model did not load for ${type}`);
      await new Promise(requestAnimationFrame);
    }
    const measuredClips = [];
    const curves = new Set();
    for (const [clip, state] of clips.entries()) {
      const directions = review ? [3, 0, 1, 2] : [3];
      const phases = review ? [0, 0.15, 0.33, 0.5, 0.68, 0.85, 0.99] : [0, 0.37, 0.74];
      const poses = [];
      let peakBoneScale = 1;
      for (const direction of directions)
        for (const phase of phases) {
          if (draw(clip, phase, true, direction).drawn !== 1)
            throw Error(`Missing ${type} clip ${clip}`);
          const frame = snapshot();
          if (!frame.some((value, i) => i % 4 === 3 && value > 0)) {
            throw Error(`Empty frame for ${type}, ${state.name} at ${phase}`);
          }
          if (review && direction === 3) {
            const transform = [];
            world.traverse((node) => {
              if (!node.isBone) return;
              const sign = node.quaternion.w < 0 ? -1 : 1;
              transform.push(
                ...node.position.toArray(),
                ...node.quaternion.toArray().map((value) => sign * value),
                ...node.scale.toArray(),
              );
              peakBoneScale = Math.max(peakBoneScale, ...node.scale.toArray());
            });
            if (!transform.length) throw Error(`Missing deforming bones for ${type}`);
            poses.push(transform.map((value) => Math.round(value * 1000)).join(","));
          }
          clipSamples++;
        }
      if (review) {
        const curve = poses.join(";");
        if (curves.has(curve) || new Set(poses).size < 2)
          throw Error(`Static or duplicate motion curves for ${type}, ${state.name}`);
        if (
          type === "wildlife-pufferfish-provisional-v1" &&
          state.name === "action" &&
          (peakBoneScale < 1.25 || peakBoneScale > 1.35)
        )
          throw Error(`Pufferfish action inflation missing: ${peakBoneScale}`);
        curves.add(curve);
        measuredClips.push({
          state: state.name,
          action: definition.animation.names?.[state.name] ?? state.name,
          frames: directions.length * phases.length,
          gameDurationMs: state.frameDuration * state.count,
          ...(peakBoneScale > 1.02 ? { peakBoneScale } : {}),
        });
      }
    }
    if (type === "wildlife-cat-provisional-v1") {
      const pounce = clips.findIndex(({ name }) => name === "pounce");
      draw(pounce, 0);
      const start = snapshot();
      draw(pounce, 0.42);
      const leap = snapshot();
      if (!start.some((value, i) => value !== leap[i])) throw Error("Cat pounce does not move");
      batch.begin(true, true);
      batch.push({ ...item, wx: -30, wildlifePose: { ...item.wildlifePose, elapsedMs: 0 } });
      batch.push({ ...item, wx: 30 });
      if (batch.end() !== 2) throw Error("Two cat instances did not draw");
      world.updateMatrixWorld(true);
      const skins = [];
      world.traverse((node) => {
        if (node.isSkinnedMesh && node.skeleton) skins.push(node.skeleton);
      });
      if (
        skins.length !== 2 ||
        skins[0] === skins[1] ||
        !skins[0].bones.some((bone, i) => !bone.quaternion.equals(skins[1].bones[i].quaternion))
      ) {
        throw Error("Cat instances did not retain independent poses");
      }

      draw(pounce, 0);
      const model = snapshot();
      // Move the same upright card along the view ray. The screen footprint
      // stays fixed while its depth crosses the skinned mesh.
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 26),
        new THREE.MeshBasicMaterial({ color: 0xe032cd, side: THREE.DoubleSide }),
      );
      card.rotation.x = Math.PI / 2;
      scene.add(card);
      card.position.set(0, 30, -24);
      const behind = snapshot();
      card.position.set(0, -30, 36);
      const front = snapshot();
      let covered = 0;
      for (let pixel = 0; pixel < model.length; pixel += 4) {
        if (!model[pixel + 3]) continue;
        if (front[pixel] !== model[pixel] || front[pixel + 2] !== model[pixel + 2]) {
          if (model[pixel] !== behind[pixel] || model[pixel + 2] !== behind[pixel + 2]) {
            throw Error("A depth card behind the cat covered its pixels");
          }
          covered++;
        }
      }
      if (covered < 10) throw Error("The depth card in front did not overlap the cat");
      testedDepth = true;
      scene.remove(card);
      card.geometry.dispose();
      card.material.dispose();
    }
    const disabled = draw(0, 0, false);
    if (disabled.disposition !== "sprite" || disabled.drawn)
      throw Error(`Disabled mesh blocked the sprite for ${type}`);
    candidates.push({ type, clips: clips.length, ...(review ? { measuredClips } : {}) });
    batch.dispose();
  }
  renderer.dispose();
  target.dispose();
  return { candidates, clipSamples, testedDepth };
}
