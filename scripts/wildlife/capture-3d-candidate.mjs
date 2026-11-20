import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { ENTITY_PALETTE } from "../../src/editor/EditorPalettes.ts";
import { ENTITY_DEFS } from "../../src/entities/EntityDefs.ts";
import { ENTITY_FACTORIES } from "../../src/entities/EntityFactories.ts";
import {
  classicWildlifeSideProfile,
  wildlifeModelClips,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";
import { ANIMAL_BROWSER_ENTRIES } from "../../src/workshop/AnimalBrowserData.ts";

const [, , configPath, outputPath] = process.argv;
if (!configPath || !outputPath)
  throw Error("Usage: node --import tsx capture-3d-candidate.mjs config.json output-dir");
const directory = resolve(outputPath);
const spec = JSON.parse(await readFile(configPath, "utf8"));
const browserAnimal = ANIMAL_BROWSER_ENTRIES.find((entry) => entry.type === spec.runtimeType);
const classic = spec.classicTravel && ENTITY_DEFS[spec.runtimeType]?.sprite;
const classicLabel = classic && ENTITY_PALETTE.find((entry) => entry.type === spec.runtimeType);
const classicActor = classicLabel && ENTITY_FACTORIES[spec.runtimeType]?.(0, 0);
const sideProfile = classicActor && classicWildlifeSideProfile(spec.runtimeType);
const animal =
  browserAnimal ??
  (classicLabel && {
    name: classicLabel.label,
    type: spec.runtimeType,
    image: `assets/sprites/${classic.sheetKey}.png`,
    sprite: {
      ...classic,
      clips: wildlifeModelClips(spec.runtimeType, spec.classicTravel),
    },
  });
assert(animal, spec.runtimeType);
const modelPath = resolve(directory, spec.model ?? "model.glb");
const spritePath = resolve("public", animal.image);
const spriteData = await readFile(spritePath);
const metadataPath = spritePath.replace(/sheet\.png$/, "sprite.json");
let metadata;
try {
  if (browserAnimal) metadata = JSON.parse(await readFile(metadataPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const { spriteWidth, spriteHeight } = animal.sprite;
const clips = Object.fromEntries(animal.sprite.clips.map((clip) => [clip.name, clip]));
const runtime = {
  name: animal.name,
  spriteWidth,
  spriteHeight,
  facings: Math.floor(spriteData.readUInt32BE(20) / spriteHeight),
  ...(classicActor && spec.rollout && !classicActor.wanderAI?.directional
    ? {
        reviewRows: sideProfile ? [2, 3] : [0],
        fixedSpriteRow: classicActor.sprite.frameRow,
        sideProfile,
      }
    : {}),
  anchor: metadata?.anchor ?? [
    spriteWidth / 2,
    (spriteHeight - (animal.sprite.drawOffsetY ?? 0)) / 2,
  ],
  clips,
};
assert(
  spec.clips.every((clip) => clips[clip]),
  spec.clips,
);
await mkdir(directory, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    sourcefile: "wildlife-review-capture.js",
    contents: `
      import * as THREE from "three";
      import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
      import { obliqueProjection } from "./src/rendering/firstperson/ObliqueCamera.ts";
      import { WILDLIFE_MESHES } from "./src/rendering/WildlifeMeshCatalog.ts";
      import { makeWildlifeCapture } from "./scripts/wildlife/capture-3d-scene.js";
      const config = ${JSON.stringify({ ...spec, runtime })};
      const gltf = await new GLTFLoader().loadAsync("/model.glb");
      const sprite = new Image();
      sprite.src = "/sprite.png";
      await sprite.decode();
      window.reviewCapture = makeWildlifeCapture({
        THREE, gltf, sprite, config, obliqueProjection, WILDLIFE_MESHES,
      });
    `,
    loader: "js",
  },
  bundle: true,
  format: "esm",
  write: false,
  logLevel: "warning",
});
const files = new Map([
  ["/model.glb", ["model/gltf-binary", await readFile(modelPath)]],
  ["/sprite.png", ["image/png", spriteData]],
  ["/preview.js", ["text/javascript", bundle.outputFiles[0].contents]],
  ["/", ["text/html", '<!doctype html><script type="module" src="/preview.js"></script>']],
]);
const server = createServer((request, response) => {
  const file = files.get(request.url);
  if (!file) return response.writeHead(404).end();
  response.writeHead(200, { "Content-Type": file[0] }).end(file[1]);
});
await new Promise((listen) => server.listen(0, "127.0.0.1", listen));
let browser;
try {
  browser = await chromium.launch({
    channel: "chromium",
    args: ["--enable-webgl", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  try {
    await page.waitForFunction(() => window.reviewCapture, { timeout: 6000 });
  } catch (error) {
    throw pageErrors[0] ?? error;
  }
  const evidence = {
    "four main views and model close-up": "appearance.png",
    "native pixels, left sprite and right model": "native.png",
    ...Object.fromEntries(
      spec.clips.slice(1).map((clip) => [`${clip} motion stills`, `${clip}.png`]),
    ),
    "side-by-side video": "comparison.mp4",
    "animated or runtime-driven model": spec.model ?? "model.glb",
  };
  const { clipNames, clipDurations, fit, footprints } = await page.evaluate(() => {
    const capture = window.reviewCapture;
    return {
      clipNames: capture.clipNames,
      clipDurations: capture.clipDurations,
      fit: capture.fit,
      footprints: capture.footprints,
    };
  });
  if (!spec.rigidRuntime) {
    const missing = Object.keys(clips).filter(
      (clip) => !clipNames.includes(spec.modelClips?.[clip] ?? clip),
    );
    assert.deepEqual(missing, [], "Each runtime clip needs an exported model clip or alias");
  }
  const stills = await page.evaluate(() => window.reviewCapture.stills());
  for (const [name, png] of Object.entries(stills)) {
    await writeFile(resolve(directory, `${name}.png`), Buffer.from(png, "base64"));
  }
  const jobs = [];
  for (const clip of spec.clips) {
    const repetitions = clips[clip].loop && clip !== "idle" ? 2 : 1;
    const duration =
      clip === "idle"
        ? spec.rollout
          ? clipDurations[spec.modelClips?.[clip] ?? clip]
          : 1.8
        : (clips[clip].count * clips[clip].frameDuration) / 1000;
    const frameCount = Math.max(spec.rollout ? 1 : 16, Math.round(duration * 24));
    for (let rep = 0; rep < repetitions; rep++) {
      for (let frame = 0; frame < frameCount; frame++) {
        jobs.push({ clip, phase: frame / frameCount, row: rep === 0 ? 3 : 0 });
      }
    }
  }
  const encoder = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      "24",
      "-c:v",
      "png",
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      "libx264",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      resolve(directory, "comparison.mp4"),
    ],
    { stdio: ["pipe", "ignore", "inherit"] },
  );
  const encoded = once(encoder, "exit");
  try {
    for (let start = 0; start < jobs.length; start += 16) {
      const images = await page.evaluate(
        (batch) => batch.map(window.reviewCapture.video),
        jobs.slice(start, start + 16),
      );
      for (const png of images) {
        if (!encoder.stdin.write(Buffer.from(png, "base64"))) await once(encoder.stdin, "drain");
      }
    }
  } finally {
    encoder.stdin.end();
  }
  assert.equal((await encoded)[0], 0, "FFmpeg did not make the review video");
  await writeFile(
    resolve(directory, "packet.json"),
    `${JSON.stringify(
      {
        name: animal.name,
        runtimeType: animal.type,
        version: spec.version,
        sprite: `public/${animal.image}`,
        evidence,
        reviewContext: spec.reviewContext,
        clipNames,
        fit,
        footprints,
        runtimeClips: animal.sprite.clips,
        modelClips: spec.modelClips,
      },
      null,
      2,
    )}\n`,
    { flag: "wx" },
  );
  console.log(
    `${animal.name}: ${jobs.length} review video frames and ${Object.keys(stills).length} stills.`,
  );
} finally {
  await browser?.close();
  server.close();
}
