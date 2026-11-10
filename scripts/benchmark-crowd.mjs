// `npm run crowd:bench`: compiles scripts/benchmark-crowd.ts with esbuild (no
// keepNames, matching the Vite Worker build; tsx's name wrappers would add ~8% to
// hot closures) and runs it in plain Node. Arguments pass through:
//
//   npm run crowd:bench
//   npm run crowd:bench -- --profile --output=/tmp/crowd.json
//   npm run crowd:bench -- --compare=/tmp/crowd.json --rabbits=500 --cars=20
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

if (process.argv.includes("--help")) {
  console.log(`Crowd benchmark (sequential lanes, production code in Node)
  --lane=authority (default)  --rabbits=1000 --cars=50 --warmup=180 --ticks=600
  --lane=record --output=/tmp/crowd.tape   Record untimed binary output
  --lane=client --replay=/tmp/crowd.tape   Client CPU processing, 60/120Hz
  --lane=render --replay=/tmp/crowd.tape   Collection/order with actual GLB receivers
    --scene=moving|frozen                 Moving is the default
    --shadows=gpu|projected               gpu (default) leaves shadows to the depth pass (236)
  --verify                              Hash every replay state/scene (separate run)
  --assert-equivalent                   Require equal comparison outcomes (replay needs --verify)
  --output=<report.json> --compare=<before.json> [--allow-incompatible]
  --profile                             Authority CPU profile; separate from timing runs
Replay counts and warm-up come from the tape. Node lanes do not measure GPU or display cadence.`);
  process.exit(0);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Inside the repository so bare package imports resolve from node_modules.
const outfile = path.join(root, "node_modules/.cache/tilefun-crowd-bench/run.mjs");
const built = await build({
  absWorkingDir: root,
  entryPoints: [path.join(root, "scripts/benchmark-crowd.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: "inline",
  metafile: true,
  logLevel: "error",
});
// Content identity of the executable source and external dependency lock, including
// dirty/untracked inputs. A Git revision alone does not identify a local build.
const inputs = [
  ...new Set([
    ...Object.keys(built.metafile.inputs),
    "scripts/benchmark-crowd.mjs",
    "package-lock.json",
  ]),
].sort();
const digest = createHash("sha256");
for (const input of inputs)
  digest
    .update(input)
    .update("\0")
    .update(await readFile(path.join(root, input)));
const run = spawnSync(
  process.execPath,
  ["--enable-source-maps", outfile, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    cwd: root,
    env: {
      ...process.env,
      TILEFUN_CROWD_SOURCE: JSON.stringify({ sha256: digest.digest("hex"), inputs }),
    },
  },
);
process.exit(run.status ?? 1);
