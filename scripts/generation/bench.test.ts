import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createDescriptor } from "../../src/generation/GenerationDescriptor.js";
import { route, summarize } from "./report.js";
import { streamingFixture } from "./streaming.js";
import { type Options, runBenchmark } from "./workload.js";

const options: Options = {
  seed: 2026,
  side: 3,
  trials: 1,
  fixtures: ["district"],
  lanes: ["generate", "streaming"],
  verify: true,
};

test("route crosses negative boundaries without revisits; percentiles retain the slowest observation", () => {
  const coordinates = route(0, 0, 3);
  assert.equal(new Set(coordinates.map((c) => `${c.cx},${c.cy}`)).size, 9);
  assert.deepEqual(coordinates[0], { cx: -1, cy: -1 });
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1],
      b = coordinates[i];
    assert.ok(a && b);
    assert.equal(Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy), 1);
  }
  assert.deepEqual(summarize([100, ...Array<number>(19).fill(1)]), {
    count: 20,
    totalMs: 119,
    p50: 1,
    p95: 1,
    p99: 100,
    max: 100,
    over8Ms: 1,
    over16Ms: 1,
  });
});

test("real generation and publication keep every coordinate, output, phase and tail sample", async () => {
  const report = await runBenchmark(options);
  const unseen = report.cells.find((c) => c.pass === "unseen");
  const regenerate = report.cells.find((c) => c.pass === "regenerate");
  const streaming = report.cells.find((c) => c.lane === "streaming");
  assert.ok(unseen && regenerate && streaming);
  const output = (samples: typeof unseen.samples) =>
    samples.map(({ cx, cy, props, actors, gridBytes, contentHash }) => ({
      cx,
      cy,
      props,
      actors,
      gridBytes,
      contentHash,
    }));
  assert.deepEqual(output(unseen.samples), output(regenerate.samples));
  assert.equal(unseen.total.count, 9);
  assert.equal(streaming.total.count, 2);
  assert.equal(streaming.publication?.count, 9);
  assert.deepEqual(
    streaming.samples.flatMap((s) => s.coordinates ?? []),
    route(18, 32, 3),
  );
  assert.deepEqual(
    streaming.samples.map((s) => s.residentChunks),
    [8, 9],
  );
  assert.equal(
    streaming.samples.reduce((n, s) => n + (s.planProps ?? 0), 0),
    unseen.samples.reduce((n, s) => n + s.props, 0),
  );
  assert.equal(
    streaming.samples.reduce((n, s) => n + (s.planActors ?? 0), 0),
    unseen.samples.reduce((n, s) => n + s.actors, 0),
  );
  for (const cell of report.cells) {
    assert.equal(cell.total.count, cell.samples.length);
    assert.equal(cell.first, cell.samples[0]);
    assert.equal(cell.afterFirst?.count, cell.samples.length - 1);
    assert.equal(cell.slowest[0]?.totalMs, Math.max(...cell.samples.map((s) => s.totalMs)));
    for (const sample of cell.samples) {
      assert.ok(sample.contentHash);
      assert.ok(sample.gridBytes > 0);
      assert.ok(
        Math.abs(Object.values(sample.phasesMs).reduce((a, b) => a + b, 0) - sample.totalMs) <
          0.001,
      );
    }
  }
});

test("invalid workloads and repeated streaming chunks fail instead of reporting partial success", async () => {
  await assert.rejects(runBenchmark({ ...options, side: 0 }), /Invalid workload/);
  await assert.rejects(
    runBenchmark({ ...options, fixtures: ["district", "district"] }),
    /Invalid workload/,
  );
  const f = await streamingFixture(createDescriptor("regional", 2026), false);
  try {
    await f.visit([{ cx: 18, cy: 32 }]);
    await assert.rejects(f.visit([{ cx: 18, cy: 32 }]), /Repeated streaming chunk/);
  } finally {
    await f.close();
  }
});

test("CLI comparison refuses different work and diagnostic CPU profiles are saved", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tilefun-generation-test-"));
  const before = path.join(directory, "before.json"),
    after = path.join(directory, "after.json");
  const run = (args: string[]) =>
    spawnSync(
      process.execPath,
      [
        "scripts/benchmark-generation.mjs",
        "--side=1",
        "--trials=1",
        "--fixtures=district",
        "--lanes=generate",
        ...args,
      ],
      { encoding: "utf8", timeout: 30_000 },
    );
  try {
    const initial = run([`--output=${before}`, "--profile"]);
    assert.equal(initial.status, 0, initial.stderr);
    const cpu = JSON.parse(await readFile(`${before}.cpuprofile`, "utf8"));
    assert.ok(cpu.samples.length > 0);
    const compared = run([`--output=${after}`, `--compare=${before}`, "--profile"]);
    assert.equal(compared.status, 0, compared.stderr);
    const report = JSON.parse(await readFile(after, "utf8"));
    assert.ok(report.cells[0].changeMs);
    assert.match(report.source.sha256, /^[a-f0-9]{64}$/);
    const incompatible = run([
      `--output=${after}`,
      `--compare=${before}`,
      "--seed=2027",
      "--profile",
    ]);
    assert.notEqual(incompatible.status, 0);
    assert.match(incompatible.stderr, /Incompatible comparison/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
