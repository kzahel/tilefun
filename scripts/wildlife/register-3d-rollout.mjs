import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ENTITY_DEFS } from "../../src/entities/EntityDefs.ts";
import { NATURAL_CASES } from "../../src/scenarios/NaturalLandscapeRecipe.ts";
import {
  wildlifeModelClips,
  wildlifeModelReviewPath,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";

const [batch, ...inputs] = process.argv.slice(2);
assert(
  /^wildlife-3d-[a-z0-9-]+$/.test(batch ?? "") && inputs.length > 0 && inputs.length <= 4,
  "Usage: register-3d-rollout.mjs wildlife-3d-BATCH ID:LAB:CAPTURE_DIRECTORY [...up to four]",
);
const registryPath = "src/wildlife/model-reviews.json";
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const entries = [];
const seen = new Set(registry.map(({ id }) => id));
const alreadyRegistered = registry.filter((row) => row.batch === batch);
assert(alreadyRegistered.length + inputs.length <= 4, "A review batch holds up to four animals");
const occupiedTypes = new Set(alreadyRegistered.map(({ type }) => type));
for (const input of inputs) {
  const [id, lab, directory] = input.split(":");
  assert(/^[a-z0-9-]+$/.test(id) && !seen.has(id), `Invalid or registered model candidate: ${id}`);
  assert(
    NATURAL_CASES.some((row) => row.id === lab),
    `Unknown lab: ${lab}`,
  );
  seen.add(id);
  const capture = JSON.parse(await readFile(join(directory, "packet.json"), "utf8"));
  const { name, runtimeType: type, fit, runtimeClips, modelClips, clipNames } = capture;
  assert(!occupiedTypes.has(type), `Duplicate type in the same review batch: ${type}`);
  occupiedTypes.add(type);
  const sprite = ENTITY_DEFS[type]?.sprite;
  assert(sprite, `Unknown animal: ${type}`);
  const classicTravel = sprite.clips ? undefined : runtimeClips[1]?.name;
  const requiredClips = wildlifeModelClips(type, classicTravel);
  assert(requiredClips, `Expected idle and travel clips for ${type}`);
  assert.deepEqual(runtimeClips, requiredClips, `Runtime clip contract changed: ${type}`);
  const actions = runtimeClips.map((clip) => modelClips?.[clip.name] ?? clip.name);
  assert(
    actions.every((action) => clipNames.includes(action)),
    `Missing exported action: ${type}`,
  );
  assert.equal(new Set(actions).size, runtimeClips.length, `Reused action binding: ${type}`);
  assert(fit.length === 3 && fit.every((v) => Number.isFinite(v) && v > 0), `Invalid fit: ${type}`);

  const files = new Map([["capture-config.json", "capture-config.json"]]);
  for (const filename of Object.values(capture.evidence)) {
    assert(/^[a-z0-9-]+\.(png|mp4|glb)$/.test(filename), `Invalid evidence filename: ${filename}`);
    if (filename.endsWith(".glb")) {
      files.set("model.glb", filename);
      files.set("model.blend", filename.replace(/\.glb$/, ".blend"));
    } else files.set(filename, filename);
  }
  for (const name of ["model.glb", "model.blend", "appearance.png", "native.png", "comparison.mp4"])
    assert(files.has(name), `Missing candidate evidence: ${id}/${name}`);
  const hashes = {};
  for (const [name, filename] of [...files.entries()].sort()) {
    hashes[name] = createHash("sha256")
      .update(await readFile(join(directory, filename)))
      .digest("hex");
  }
  const [x, y, z] = fit;
  entries.push({
    directory,
    files,
    review: {
      id,
      type,
      name,
      batch,
      lab,
      scale: z,
      topDown: { width: x / z, height: y / z },
      ...(modelClips ? { actions: modelClips } : {}),
      ...(classicTravel ? { classicTravel } : {}),
      files: hashes,
    },
  });
}

for (const { directory, files, review } of entries) {
  await mkdir(join("public", dirname(wildlifeModelReviewPath(review.id, "model.glb"))));
  for (const [name, filename] of files)
    await copyFile(
      join(directory, filename),
      join("public", wildlifeModelReviewPath(review.id, name)),
    );
}
registry.push(...entries.map(({ review }) => review));
await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Registered ${entries.length} pending 3D wildlife candidates in ${batch}.`);
