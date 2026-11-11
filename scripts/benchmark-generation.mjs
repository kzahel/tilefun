// Compile without tsx keepNames overhead, like crowd:bench and production Workers.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";

const option = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (process.argv.includes("--help")) {
  console.log(`Generation benchmark: successive unseen chunks, regeneration control, streaming publication
  --fixtures=district,farm,woodland,negative-coast --side=7 --trials=3 --seed=2026
  --lanes=generate,streaming     Empty memory storage; no physical IO or physics
  --output=/tmp/generation.json --compare=/tmp/before.json
  --verify                       Separate content verification run (affects allocation)
  --profile                      Node CPU profile saved beside report; separate timing run
  --browser                      Same workload in an isolated bundled Chromium Worker
  --cdp=http://127.0.0.1:9223 --port=4188 --device=pixel7a   Owned device tab/Worker
Fixtures/trials get fresh planner caches, not fresh process JIT. Every timing sample is retained.
Streaming samples are batches of up to eight chunks; per-chunk synchronous publishMs is also retained.
Browser/device timings exclude rendering and do not measure display cadence.`);
  process.exit(0);
}
const output = path.resolve(option("output", path.join(os.tmpdir(), "tilefun-generation.json")));
const endpoint = option("cdp", "");
const inBrowser = process.argv.includes("--browser") || !!endpoint;
const profile = process.argv.includes("--profile");
if (profile && inBrowser)
  throw Error(
    "--profile is a Node lane; use render:bench --profile --trace for live phone Worker profiles",
  );
const options = {
  seed: Number(option("seed", "2026")),
  side: Number(option("side", "7")),
  trials: Number(option("trials", "3")),
  fixtures: option("fixtures", "district,farm,woodland,negative-coast").split(","),
  lanes: option("lanes", "generate,streaming").split(","),
  verify: process.argv.includes("--verify"),
};
const directory = await mkdtemp(path.join(os.tmpdir(), "tilefun-generation-"));
try {
  await mkdir(path.dirname(output), { recursive: true });
  const built = await build({
    entryPoints: [inBrowser ? "scripts/generation/worker.ts" : "scripts/benchmark-generation.ts"],
    bundle: true,
    platform: inBrowser ? "browser" : "node",
    format: "esm",
    target: "es2022",
    packages: inBrowser ? "bundle" : "external",
    sourcemap: "inline",
    metafile: true,
    write: false,
    logLevel: "error",
  });
  const inputs = [
    ...new Set([
      ...Object.keys(built.metafile.inputs),
      "scripts/benchmark-generation.mjs",
      "scripts/generation/browser.mjs",
      "scripts/cdp-tab.mjs",
      "package-lock.json",
    ]),
  ].sort();
  const digest = createHash("sha256");
  for (const input of inputs)
    digest
      .update(input)
      .update("\0")
      .update(await readFile(input));
  const code = built.outputFiles[0].text;
  let result, runtime;
  if (inBrowser) {
    const { runBrowser } = await import("./generation/browser.mjs");
    ({ result, runtime } = await runBrowser({
      code,
      options,
      endpoint,
      port: Number(option("port", "0")),
    }));
    runtime.device = option("device", endpoint ? "attached-device" : os.cpus()[0]?.model);
  } else {
    // The bundle has only Node built-ins; no unresolved repository package imports.
    const bundle = path.join(directory, "run.mjs");
    await writeFile(bundle, code);
    const run = spawnSync(process.execPath, [bundle], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        TILEFUN_GENERATION_OPTIONS: JSON.stringify(options),
        TILEFUN_GENERATION_OUTPUT: output,
        TILEFUN_GENERATION_PROFILE: profile ? "1" : "0",
      },
    });
    if (run.status !== 0)
      throw Error(run.stderr || String(run.error ?? `Benchmark exit ${run.status}`));
    result = JSON.parse(run.stdout);
    runtime = {
      kind: "node",
      version: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpu: os.cpus()[0]?.model,
    };
  }
  const report = {
    ...result,
    date: new Date().toISOString(),
    runtime,
    profiled: profile,
    source: { sha256: digest.digest("hex"), inputs, build: "esbuild, no keepNames, unminified" },
  };
  const compare = option("compare", "");
  if (compare) {
    const before = JSON.parse(await readFile(compare, "utf8"));
    if (
      before.schemaVersion !== report.schemaVersion ||
      before.cells.length !== report.cells.length ||
      JSON.stringify(before.workload) !== JSON.stringify(report.workload) ||
      JSON.stringify(before.runtime) !== JSON.stringify(report.runtime) ||
      before.profiled !== report.profiled ||
      before.descriptor.version !== report.descriptor.version
    )
      throw Error(
        "Incompatible comparison: schema, workload, runtime, generator version and profiling mode must match",
      );
    for (const [i, cell] of report.cells.entries()) {
      const old = before.cells[i];
      if (
        !old ||
        [cell.lane, cell.fixture, cell.trial, cell.pass].join() !==
          [old.lane, old.fixture, old.trial, old.pass].join() ||
        JSON.stringify(
          cell.samples.map(
            ({
              cx,
              cy,
              props,
              actors,
              gridBytes,
              contentHash,
              coordinates,
              chunks,
              planProps,
              planActors,
              residentChunks,
            }) => ({
              cx,
              cy,
              props,
              actors,
              gridBytes,
              contentHash,
              coordinates,
              chunks,
              planProps,
              planActors,
              residentChunks,
            }),
          ),
        ) !==
          JSON.stringify(
            old.samples.map(
              ({
                cx,
                cy,
                props,
                actors,
                gridBytes,
                contentHash,
                coordinates,
                chunks,
                planProps,
                planActors,
                residentChunks,
              }) => ({
                cx,
                cy,
                props,
                actors,
                gridBytes,
                contentHash,
                coordinates,
                chunks,
                planProps,
                planActors,
                residentChunks,
              }),
            ),
          )
      )
        throw Error("Comparison work/content differs; inspect reports before comparing timings");
      cell.changeMs = {
        p50: cell.total.p50 - old.total.p50,
        p95: cell.total.p95 - old.total.p95,
        max: cell.total.max - old.total.max,
      };
    }
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  for (const cell of report.cells)
    console.log(
      `${cell.lane.padEnd(9)} ${cell.fixture.padEnd(14)} #${cell.trial + 1} ${cell.pass.padEnd(14)} n=${cell.total.count} p50=${cell.total.p50} p95=${cell.total.p95} max=${cell.total.max} ms${cell.publication ? `; single publish p95=${cell.publication.p95} max=${cell.publication.max} ms` : ""}`,
    );
  console.log(`Report: ${output}${profile ? `\nCPU profile: ${output}.cpuprofile` : ""}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
