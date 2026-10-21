/** Fresh declared-input pixel replay; no generated workspace or user save is input. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { promisify } from "node:util";

const bundle = resolve(process.argv[2] ?? "art-source/vehicle-bake/car-transporter/v2");
const receipt = JSON.parse(await readFile(resolve(bundle, "capture-recipe.json"), "utf8"));
const workspace = await mkdtemp(resolve("data/vehicle-bake/transporter-replay-"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const blender = process.argv.find((arg) => arg.startsWith("--blender="))?.slice(10);
if (blender) {
  const source = JSON.parse(await readFile(resolve(bundle, "construction-inputs.json"), "utf8"));
  for (const [file, expected] of Object.entries(source.inputs)) {
    const input = resolve(bundle, source.snapshots[file]),
      target = resolve(workspace, file);
    assert.ok(input.startsWith(bundle + sep) && target.startsWith(workspace + sep));
    assert.equal(sha(await readFile(input)), expected, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(input, target);
  }
  await promisify(execFile)(
    blender,
    [
      "--background",
      "--python",
      "scripts/vehicle-bake/transporter/author-v2.py",
      "--",
      "--output",
      "data/constructed",
    ],
    { cwd: workspace, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
  );
  const construction = JSON.parse(await readFile(resolve(bundle, "recipe.json"), "utf8"));
  for (const name of ["model.glb", "atlas.png"])
    assert.equal(
      sha(await readFile(resolve(workspace, "data/constructed", name))),
      construction.outputs[name],
      name,
    );
}
for (const [file, expected] of Object.entries(receipt.inputs)) {
  const source = resolve(bundle, receipt.snapshots[file]),
    target = resolve(workspace, file);
  assert.ok(source.startsWith(bundle + sep) && target.startsWith(workspace + sep));
  assert.equal(sha(await readFile(source)), expected, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
await symlink(
  resolve("node_modules"),
  resolve(workspace, "node_modules"),
  process.platform === "win32" ? "junction" : "dir",
);
await promisify(execFile)(
  process.execPath,
  ["scripts/vehicle-bake/transporter/capture.mjs", "--output", "data/replayed"],
  { cwd: workspace, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
);
for (const [file, expected] of Object.entries(receipt.outputs))
  assert.equal(sha(await readFile(resolve(workspace, "data/replayed", file))), expected, file);
await writeFile(
  resolve(workspace, "verified.json"),
  `${JSON.stringify({ outputs: receipt.outputs, exact: true }, null, 2)}\n`,
);
console.log(
  JSON.stringify({ workspace, captures: Object.keys(receipt.outputs).length, exact: true }),
);
