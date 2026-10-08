import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { createPlayer } from "../../src/entities/Player.js";
import { createProp } from "../../src/entities/PropFactories.js";
import { CAR_PROXY, carProxyPatches } from "../../src/projection/CarProxy.js";
import bank from "../../src/traffic/vehicles-v1.json" with { type: "json" };

const root = resolve(import.meta.dirname, "../..");
const output = resolve(process.argv[2] ?? `${root}/data/spatial-assets/070`);
const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const atlasBytes = await readFile(`${root}/public/assets/tilesets/me-complete.png`);
if (hash(atlasBytes) !== bank.sourceFingerprint) throw Error("Pinned vehicle atlas changed");
const atlas = PNG.sync.read(atlasBytes);
await mkdir(`${output}/inputs`, { recursive: true });

function crop(image: PNG, rect: readonly number[]) {
  const [x, y, w, h] = rect as [number, number, number, number];
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > image.width || y + h > image.height)
    throw Error(`Invalid crop ${rect}`);
  const result = new PNG({ width: w, height: h });
  PNG.bitblt(image, result, x, y, w, h, 0, 0);
  return result;
}

function enlarge(image: PNG) {
  const scale = Math.floor(512 / Math.max(image.width, image.height));
  const result = new PNG({ width: 512, height: 512 });
  const left = Math.floor((512 - image.width * scale) / 2);
  const top = Math.floor((512 - image.height * scale) / 2);
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++)
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const src = (y * image.width + x) * 4;
          const dst = ((top + y * scale + dy) * 512 + left + x * scale + dx) * 4;
          image.data.copy(result.data, dst, src, src + 4);
        }
  return { image: result, scale, padding: [left, top] };
}

const inputs = [];
for (const name of ["oak-tree", "picnic-table", "beach-umbrella"]) {
  const source = `public/assets/props/${name}.png`;
  const bytes = await readFile(`${root}/${source}`);
  const image = PNG.sync.read(bytes);
  const prop = createProp(`prop-${name}`, 0, 0);
  inputs.push({
    id: name,
    source,
    sourceSha256: hash(bytes),
    rect: [0, 0, image.width, image.height],
    anchor: [image.width / 2, image.height],
    physical: { collider: prop.collider, walls: prop.walls, sortOffsetY: prop.sortOffsetY ?? 0 },
    observation: "single stylized oblique image; camera inferred from game projection",
    actualFacing: "not directional",
    landmarks: [],
    image,
  });
}
for (const view of bank.views.filter((v) => v.vehicleId === "compact-1")) {
  inputs.push({
    id: `compact-1-${view.direction}`,
    source: "public/assets/tilesets/me-complete.png",
    sourceSha256: hash(atlasBytes),
    rect: view.rect,
    anchor: view.metadata.anchor,
    physical: view.metadata,
    observation: "genuine directional sprite; proportions/camera may differ across views",
    actualFacing: {
      east: "left",
      west: "right",
      north: "up (hood at top)",
      south: "down (hood at bottom)",
    }[view.direction as "east" | "west" | "north" | "south"],
    landmarks: [],
    image: crop(atlas, view.rect),
  });
}
inputs.push({
  id: "compact-1-side-body",
  source: "public/assets/tilesets/me-complete.png",
  sourceSha256: hash(atlasBytes),
  rect: [...CAR_PROXY.rect],
  anchor: [CAR_PROXY.sourceOrigin[0], CAR_PROXY.sourceOrigin[1] - CAR_PROXY.cropTop],
  physical: bank.views.find((v) => v.id === CAR_PROXY.sourceView)?.metadata,
  observation: "037/038 authoring origin differs from approved gameplay anchor; keep both explicit",
  actualFacing: "left",
  landmarks: [
    { kind: "tire ground boundary", uv: [16, 39], confidence: "fitted control" },
    { kind: "tire ground boundary", uv: [48, 39], confidence: "fitted control" },
    { kind: "roof/side seam", uv: [32, 18], confidence: "fitted control" },
  ],
  image: crop(atlas, CAR_PROXY.rect),
});

const records = [];
for (const { image, ...input } of inputs) {
  const original = PNG.sync.write(image);
  const nn = enlarge(image);
  const enlarged = PNG.sync.write(nn.image);
  await writeFile(`${output}/inputs/${input.id}.png`, original);
  await writeFile(`${output}/inputs/${input.id}-nn512.png`, enlarged);
  records.push({
    ...input,
    cropSha256: hash(original),
    cropRgbaSha256: hash(image.data),
    size: [image.width, image.height],
    input: `inputs/${input.id}.png`,
    enlarged: `inputs/${input.id}-nn512.png`,
    enlargedSha256: hash(enlarged),
    preprocessing: { method: "nearest integer enlargement", scale: nn.scale, padding: nn.padding },
    alpha: "original RGBA preserved, transparent padding; painted shadows retained",
  });
}
const manifest = {
  version: "070-inputs-v1",
  axes: "X right, Y ground depth toward viewer, Z up; world pixels",
  projection: {
    u: "anchorX + X",
    v: "anchorY + Y - Z",
    depth: "(Y + Z) / sqrt(2); larger is nearer",
  },
  review: "unreviewed investigation inputs; no promotion",
  inputs: records,
};
await writeFile(`${output}/inputs.json`, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(
  `${output}/car-control.json`,
  `${JSON.stringify({ source: CAR_PROXY, patches: carProxyPatches() }, null, 2)}\n`,
);
console.log(`Pinned ${records.length} inputs in ${output}`);

// Separate actor record keeps the eight-input model corpus manifest stable.
const player = createPlayer(0, 0);
if (!player.sprite) throw Error("Player sprite missing");
const actorSource = "public/assets/sprites/player.png";
const actorBytes = await readFile(`${root}/${actorSource}`);
const sprite = player.sprite;
const actorRect = [
  sprite.frameCol * sprite.spriteWidth,
  sprite.frameRow * sprite.spriteHeight,
  sprite.spriteWidth,
  sprite.spriteHeight,
];
const actor = PNG.sync.write(crop(PNG.sync.read(actorBytes), actorRect));
await writeFile(`${output}/inputs/player-idle.png`, actor);
await writeFile(
  `${output}/actor.json`,
  `${JSON.stringify(
    {
      source: actorSource,
      sourceSha256: hash(actorBytes),
      rect: actorRect,
      input: "inputs/player-idle.png",
      cropSha256: hash(actor),
      anchor: [sprite.spriteWidth / 2, sprite.spriteHeight - (sprite.drawOffsetY ?? 0)],
      collider: player.collider,
      sortOffsetY: player.sortOffsetY ?? 0,
      review: "observed classic idle sprite; diagnostic depth approximations are unreviewed",
    },
    null,
    2,
  )}\n`,
);
