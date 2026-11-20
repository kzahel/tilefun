import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

const directory = resolve(process.argv[2] ?? "data/experiments/cat");
const renders = resolve(directory, "renders");
await mkdir(renders, { recursive: true });

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    sourcefile: "cat-preview.js",
    contents: `
      import * as THREE from "three";
      import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
      import { obliqueProjection } from "./src/rendering/firstperson/ObliqueCamera.ts";

      const gltf = await new GLTFLoader().loadAsync("/cat.glb");
      const scene = new THREE.Scene();
      const model = gltf.scene;
      scene.add(model);
      let skinned = 0;
      model.traverse(object => {
        if (object.isSkinnedMesh) {
          skinned++;
          object.frustumCulled = false;
          object.material.map.generateMipmaps = false;
          object.material.map.minFilter = THREE.NearestFilter;
        }
      });
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0, 0);
      const mixer = new THREE.AnimationMixer(model);
      const clips = new Map(gltf.animations.map(clip => [clip.name, clip]));
      const camera = new THREE.Camera();
      const portrait = new THREE.OrthographicCamera(-2.66, 2.66, 1.63, -1.63, .01, 30);
      portrait.position.set(3.6, 2.28, 5.65);
      portrait.lookAt(0, 1.03, -.18);

      window.catCheck = {
        skinned,
        clips: Object.fromEntries(Array.from(clips, ([name, clip]) => [name, clip.duration])),
      };
      const facing = { right: -Math.PI / 2, left: Math.PI / 2, front: Math.PI, back: 0 };
      window.drawCat = ({ clip, time, view }) => {
        mixer.stopAllAction();
        const animation = clips.get(clip);
        const action = mixer.clipAction(animation);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.reset().play();
        mixer.setTime(time * animation.duration);
        if (view === "portrait") {
          model.rotation.y = Math.PI;
          model.scale.setScalar(1);
          renderer.setSize(564, 344, false);
          renderer.render(scene, portrait);
        } else {
          const width = 100, height = 56, anchorY = 40;
          const [sx,,,,,sy,,,,depth,,constant] = obliqueProjection(1, width, height);
          camera.projectionMatrix.set(
            sx, 0, 0, 0,
            0, sy, -sy, 1 - 2 * anchorY / height,
            0, -depth, -depth, constant,
            0, 0, 0, 1,
          );
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
          model.rotation.y = facing[view];
          model.scale.set(6.8, 5.20, 6.70);
          renderer.setSize(width, height, false);
          renderer.render(scene, camera);
        }
        return renderer.domElement.toDataURL("image/png").split(",")[1];
      };
    `,
    loader: "js",
  },
  bundle: true,
  format: "esm",
  write: false,
  logLevel: "warning",
});
const glb = await readFile(resolve(directory, "cat.glb"));
const server = createServer((request, response) => {
  if (request.url === "/cat.glb") {
    response.writeHead(200, { "Content-Type": "model/gltf-binary" }).end(glb);
  } else if (request.url === "/preview.js") {
    response.writeHead(200, { "Content-Type": "text/javascript" }).end(bundle.outputFiles[0].contents);
  } else {
    response.writeHead(200, { "Content-Type": "text/html" })
      .end('<!doctype html><script type="module" src="/preview.js"></script>');
  }
});
await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
let browser;
try {
  browser = await chromium.launch({ channel: "chromium", args: ["--enable-webgl", "--use-angle=swiftshader"] });
  const page = await browser.newPage();
  page.on("pageerror", error => console.error(error));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.drawCat);
  const check = await page.evaluate(() => window.catCheck);
  assert.equal(check.skinned, 1);
  assert.deepEqual(Object.keys(check.clips).sort(),
    ["Action", "Bat", "Climb", "Idle", "Pounce", "Sit", "Stalk", "Walk"]);

  const jobs = [];
  for (const [clip, view, frames] of [
    ["Walk", "right", 32], ["Stalk", "right", 24], ["Pounce", "right", 24],
    ["Idle", "front", 48], ["Idle", "back", 1], ["Walk", "left", 1],
    ["Idle", "portrait", 6], ["Stalk", "portrait", 24], ["Pounce", "portrait", 24],
  ]) {
    for (let frame = 0; frame < frames; frame++) {
      jobs.push({ clip, view, frame, time: frame / frames });
    }
  }
  for (let start = 0; start < jobs.length; start += 20) {
    const group = jobs.slice(start, start + 20);
    const images = await page.evaluate(items => items.map(window.drawCat), group);
    await Promise.all(group.map((job, i) => writeFile(
      resolve(renders, `${job.view}-${job.clip}-${job.frame}.png`),
      Buffer.from(images[i], "base64"),
    )));
  }
  console.log(`Captured ${jobs.length} frames from the exported cat GLB.`);
  await writeFile(resolve(renders, "frames.json"), JSON.stringify({ clips: check.clips, jobs }, null, 2));
} finally {
  await browser?.close();
  server.close();
}
