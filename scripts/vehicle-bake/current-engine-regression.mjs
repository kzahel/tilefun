/** Recompile today's shared engine in ignored scratch and compare frozen pixels. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { PNG } from "pngjs";

const root = resolve(".");
const config = JSON.parse(await readFile(process.argv[2], "utf8"));
const suffixes = { "four-wheel-v1": "", "multi-axle-v2": "-v2", "motorcycle-v1": "-cycle" };
const toolchain = config.toolchain ?? "four-wheel-v1";
assert.ok(Object.hasOwn(suffixes, toolchain), "Unknown review toolchain");
if (toolchain === "motorcycle-v1")
  assert.ok(process.argv.includes("--loader-qualified"), "Qualify the actual cycle loader first");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const frozen = resolve(config.output);
const frozenManifest = await readFile(resolve(frozen, "review-manifest.json"));
const model = await readFile(resolve(frozen, "inputs/model.glb"));
const qaRoot = resolve("data/vehicle-bake/current-engine-regression");
await mkdir(qaRoot, { recursive: true });
const scratch = await mkdtemp(resolve(qaRoot, `${config.id}-`));
assert.ok(scratch.startsWith(`${qaRoot}${sep}`), "Scratch must stay under ignored data");
const output = resolve(scratch, "review");
await cp(frozen, output, { recursive: true });
// Remove only this new scratch copy's immutability marker. The source is read-only.
await unlink(resolve(output, "review-manifest.json"));
const path = (absolute) => relative(root, absolute).replaceAll(sep, "/");
const current = { ...config, output: path(output), qa: path(resolve(scratch, "qa")) };
const configPath = resolve(scratch, "config.json");
await writeFile(configPath, `${JSON.stringify(current, null, 2)}\n`);
const run = (arguments_) => {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: root,
    stdio: "inherit",
    timeout: 180_000,
  });
  assert.equal(result.status, 0, `Failed current-engine stage: ${arguments_.join(" ")}`);
};
run(["scripts/vehicle-bake/family-build.mjs", path(output)]);
const captureTool = `scripts/vehicle-bake/family-capture${suffixes[toolchain]}.mjs`;
run([captureTool, configPath, ...(toolchain === "motorcycle-v1" ? ["--loader-qualified"] : [])]);
const names = ["study", "engine"].flatMap((mode) =>
  Array.from({ length: 16 }, (_, index) => `${mode}-${index}.png`),
);
names.push(
  ...["roll", "game-roll"].flatMap((mode) =>
    Array.from({ length: 8 }, (_, index) => `${mode}-${index}.png`),
  ),
  "wire-study.png",
  "wire-engine.png",
);
for (const name of names) {
  const expected = PNG.sync.read(await readFile(resolve(frozen, "captures", name)));
  const actual = PNG.sync.read(await readFile(resolve(output, "captures", name)));
  assert.deepEqual([actual.width, actual.height], [expected.width, expected.height], name);
  assert.deepEqual(actual.data, expected.data, `Current engine changed frozen RGBA: ${name}`);
}
if (config.composition) run(["scripts/vehicle-bake/component-parity.mjs", configPath]);
assert.deepEqual(await readFile(resolve(frozen, "review-manifest.json")), frozenManifest);
assert.deepEqual(await readFile(resolve(frozen, "inputs/model.glb")), model);
const capture = JSON.parse(await readFile(resolve(output, "captures/capture.json"), "utf8"));
const result = {
  status: "passed",
  id: config.id,
  toolchain,
  freshSharedCode: true,
  frozenNativeRGBAFramesExact: names.length,
  componentParityChecked: Boolean(config.composition),
  rendererSha256: hash(await readFile("src/rendering/CarMeshAsset.ts")),
  captureToolSha256: hash(await readFile(captureTool)),
  frozenManifestSha256: hash(frozenManifest),
  glbSha256: hash(model),
  wheelRig: capture.rig,
  normalActivationChanged: false,
  output: path(scratch),
};
await writeFile(resolve(scratch, "receipt.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
