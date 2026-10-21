/** Copy only retained recipe inputs into a fresh ignored workspace and replay. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { promisify } from "node:util";

const bundle = resolve(process.argv[2] ?? "art-source/vehicle-bake/towing-fallbacks/v2"),
  root = resolve(".");
const recipe = JSON.parse(await readFile(resolve(bundle, "recipe.json"), "utf8"));
const workspace = await mkdtemp(resolve("data/vehicle-bake/towing-replay-"));
const hash = (b) => createHash("sha256").update(b).digest("hex");
for (const [file, expected] of Object.entries(recipe.inputs)) {
  const target = resolve(workspace, file),
    snapshot = recipe.snapshots[file],
    source = snapshot ? resolve(bundle, snapshot) : resolve(root, file);
  assert.ok(target.startsWith(workspace + sep));
  assert.ok(source.startsWith((snapshot ? bundle : root) + sep));
  const bytes = await readFile(source);
  assert.equal(hash(bytes), expected, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
await symlink(
  resolve("node_modules"),
  resolve(workspace, "node_modules"),
  process.platform === "win32" ? "junction" : "dir",
);
const result = await promisify(execFile)(
  process.execPath,
  ["scripts/vehicle-bake/capture-towing-fallbacks.mjs", "--output=data/replayed"],
  { cwd: workspace, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
);
const outputs = {};
for (const [file, expected] of Object.entries(recipe.outputs)) {
  const bytes = await readFile(resolve(workspace, "data/replayed", file));
  assert.equal(hash(bytes), expected, file);
  outputs[file] = { sha256: expected, exact: true };
}
await writeFile(
  resolve(workspace, "verification.json"),
  `${JSON.stringify({ outputs }, null, 2)}\n`,
);
console.log(result.stdout);
console.log(JSON.stringify({ workspace, outputs }, null, 2));
