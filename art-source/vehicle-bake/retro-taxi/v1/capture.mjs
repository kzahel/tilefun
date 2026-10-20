/** Author-only actual GLB inspection, confined to ignored taxi scratch. */

import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const base = "data/vehicle-bake/retro-taxi";
const output = `${base}/author-view`;
await mkdir(output, { recursive: true });
const config = JSON.parse(await readFile("scripts/vehicle-bake/retro-taxi/review.json", "utf8"));
const report = JSON.parse(await readFile(`${config.source}/report.json`, "utf8"));
for (const file of ["model.glb", "atlas.png", "report.json"])
  await copyFile(`${config.source}/${file}`, `${output}/${file}`);
for (const [src, dest] of [
  ["family-review.html", "index.html"],
  ["family-review.css", "review.css"],
])
  await copyFile(`scripts/vehicle-bake/${src}`, `${output}/${dest}`);
await copyFile(config.styleReference, `${output}/style-reference.png`);
const candidate = {
  id: config.id,
  name: config.name,
  title: config.title,
  nativeSize: 224,
  glb: "model.glb",
  atlas: "atlas.png",
  report: "report.json",
  styleReference: "style-reference.png",
  audit: report.geometry,
  method:
    "Author inspection: actual exported retro-taxi, unchanged engine projection and study lens",
};
await writeFile(
  `${output}/candidate.json`,
  `${JSON.stringify({ candidates: [candidate] }, null, 2)}\n`,
);
const authorConfig = {
  ...config,
  output,
  qa: `${base}/author-qa`,
  offline: `${base}/author-review.html`,
};
await writeFile(`${base}/author-config.json`, `${JSON.stringify(authorConfig, null, 2)}\n`);
for (const args of [
  ["scripts/vehicle-bake/family-build.mjs", output],
  ["scripts/vehicle-bake/family-capture.mjs", `${base}/author-config.json`],
  ["scripts/vehicle-bake/retro-taxi/crop-parity.mjs"],
]) {
  const result = spawnSync(process.execPath, args, { cwd: resolve(root), stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
