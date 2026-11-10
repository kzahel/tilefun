// `npm run crowd:bench`: compiles scripts/benchmark-crowd.ts with esbuild (no
// keepNames, matching the Vite Worker build; tsx's name wrappers would add ~8% to
// hot closures) and runs it in plain Node. Arguments pass through:
//
//   npm run crowd:bench
//   npm run crowd:bench -- --profile --output=/tmp/crowd.json
//   npm run crowd:bench -- --compare=/tmp/crowd.json --rabbits=500 --cars=20
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Inside the repository so bare package imports resolve from node_modules.
const outfile = path.join(root, "node_modules/.cache/tilefun-crowd-bench/run.mjs");
await build({
  entryPoints: [path.join(root, "scripts/benchmark-crowd.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: "inline",
  logLevel: "error",
});
const run = spawnSync(
  process.execPath,
  ["--enable-source-maps", outfile, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    cwd: root,
  },
);
process.exit(run.status ?? 1);
