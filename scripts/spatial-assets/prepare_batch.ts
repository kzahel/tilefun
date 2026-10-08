/** Freeze ten existing runtime crops in a fresh external experiment bundle. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { createPlayer } from "../../src/entities/Player.js";
import {
  createProp,
  getPropSourceDefinitions,
  PROP_PALETTE,
} from "../../src/entities/PropFactories.js";
import bank from "../../src/traffic/vehicles-v1.json" with { type: "json" };
import selection from "./batch-assets.json" with { type: "json" };

const root = resolve(import.meta.dirname, "../..");
const output = resolve(process.argv[2] ?? `${root}/data/spatial-assets/071`);
const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
await mkdir(output, { recursive: false }); // never replace a frozen manifest
await mkdir(`${output}/inputs`);
await mkdir(`${output}/prompts`);
const definitions = getPropSourceDefinitions();
const records = [];
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
  if (scale < 1) throw Error("Expected small runtime sprite");
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
for (const asset of selection.assets) {
  let source: string;
  let rect: number[];
  let anchor: number[];
  let physical: unknown;
  let runtimeEvidence: unknown;
  if ("type" in asset) {
    const definition = definitions.find((item) => item.type === asset.type);
    if (!definition || !PROP_PALETTE.some((item) => item.type === asset.type))
      throw Error(`Not a current palette prop: ${asset.id}`);
    source = `public/assets/props/${asset.id}.png`;
    if (definition.sheetKey !== asset.type) throw Error("Expected a dedicated runtime sheet");
    rect = [...definition.rect];
    const prop = createProp(asset.type, 0, 0);
    if (!prop.sprite) throw Error("Missing runtime sprite");
    anchor = [
      prop.sprite.spriteWidth / 2,
      prop.sprite.spriteHeight - (prop.sprite.drawOffsetY ?? 0),
    ];
    physical = { collider: prop.collider, walls: prop.walls, sortOffsetY: prop.sortOffsetY ?? 0 };
    runtimeEvidence = {
      type: asset.type,
      factory: "src/entities/PropFactories.ts",
      registry: "src/assets/GameAssets.ts",
      paletteLabel: PROP_PALETTE.find((item) => item.type === asset.type)?.label,
    };
  } else {
    const view = bank.views.find(
      (item) => item.vehicleId === asset.vehicleId && item.direction === asset.direction,
    );
    if (!view) throw Error("Missing current runtime vehicle view");
    source = "public/assets/tilesets/me-complete.png";
    rect = [...view.rect];
    anchor = [...view.metadata.anchor];
    physical = view.metadata;
    runtimeEvidence = {
      view: view.id,
      bank: "src/traffic/vehicles-v1.json",
      consumer: "src/traffic/Vehicle.ts",
      actualFacing: "left; runtime corrects the legacy side-view labels",
    };
  }
  const bytes = await readFile(`${root}/${source}`);
  if (source.endsWith("me-complete.png") && hash(bytes) !== bank.sourceFingerprint)
    throw Error("Frozen runtime vehicle atlas changed");
  const image = crop(PNG.sync.read(bytes), rect);
  const original = PNG.sync.write(image);
  const nn = enlarge(image);
  const enlarged = PNG.sync.write(nn.image);
  await writeFile(`${output}/inputs/${asset.id}.png`, original);
  await writeFile(`${output}/inputs/${asset.id}-nn512.png`, enlarged);
  const prompt = `Stylized 3D game asset: ${asset.description}. Preserve reference shape, proportions, parts and colors. Full object, solid volume, orthographic view, soft studio light, isolated on plain gray background.`;
  await writeFile(`${output}/prompts/${asset.id}.txt`, `${prompt}\n`);
  records.push({
    id: asset.id,
    label: asset.label,
    source,
    sourceSha256: hash(bytes),
    rect,
    anchor,
    physical,
    runtimeEvidence,
    size: [image.width, image.height],
    input: `inputs/${asset.id}.png`,
    cropSha256: hash(original),
    cropRgbaSha256: hash(image.data),
    enlarged: `inputs/${asset.id}-nn512.png`,
    enlargedSha256: hash(enlarged),
    preprocessing: { method: "nearest integer enlargement", scale: nn.scale, padding: nn.padding },
    alpha: "Runtime RGBA preserved, including painted shadows",
    promptFile: `prompts/${asset.id}.txt`,
    prompt,
    investigationQuestion: asset.question,
  });
}
await writeFile(
  `${output}/inputs.json`,
  `${JSON.stringify(
    {
      version: "071-current-runtime-assets-v1",
      review: selection.review,
      axes: "X right, Y ground depth toward viewer, Z up; world pixels",
      projection: {
        u: "anchorX + X",
        v: "anchorY + Y - Z",
        depth: "(Y + Z) / sqrt(2); larger is nearer",
      },
      selectionSha256: hash(await readFile(`${import.meta.dirname}/batch-assets.json`)),
      inputs: records,
    },
    null,
    2,
  )}\n`,
);
const player = createPlayer(0, 0);
if (!player.sprite) throw Error("Missing current actor sprite");
const sprite = player.sprite;
const actorSource = "public/assets/sprites/player.png";
const actorBytes = await readFile(`${root}/${actorSource}`);
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
      review: "Observed current classic idle; actor depth remains a diagnostic hypothesis",
    },
    null,
    2,
  )}\n`,
);
await writeFile(`${output}/selection.json`, `${JSON.stringify(selection, null, 2)}\n`);
console.log(`Frozen ${records.length} current runtime assets in ${output}`);
