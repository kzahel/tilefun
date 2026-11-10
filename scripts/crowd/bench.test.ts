import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { deserialize, serialize } from "node:v8";
import { readTape } from "./tape.js";

test("binary recording replays deterministically through client and real-mesh collection", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tilefun-crowd-test-"));
  const recording = path.join(directory, "scene.tape");
  const run = (args: string[]) => {
    const result = spawnSync(process.execPath, ["scripts/benchmark-crowd.mjs", ...args], {
      encoding: "utf8",
      timeout: 60_000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  };
  try {
    run([
      "--lane=record",
      "--rabbits=8",
      "--cars=1",
      "--warmup=30",
      "--ticks=10",
      `--output=${recording}`,
    ]);
    const clientFile = path.join(directory, "client.json");
    run(["--lane=client", `--replay=${recording}`, "--verify", `--output=${clientFile}`]);
    const client = JSON.parse(await readFile(clientFile, "utf8"));
    assert.equal(client.stages["client.update"].count, 10);
    assert.equal(client.stages["client.presentation"].count, 20);
    assert.equal(client.work.finalEntities, 10);
    let outcome: unknown;
    for (let i = 0; i < 2; i++) {
      const file = path.join(directory, `render-${i}.json`);
      run(["--lane=render", `--replay=${recording}`, "--verify", `--output=${file}`]);
      const render = JSON.parse(await readFile(file, "utf8"));
      assert.equal(render.stages["render.prepare"].count, 20);
      assert.equal(render.workload.meshes.length, 1);
      assert.ok(render.workload.meshes[0].triangles > 0);
      assert.ok(render.work.meanSceneItems >= 10);
      assert.equal(render.outcome.finalStateSha256, client.outcome.finalStateSha256);
      assert.equal(render.outcome.allStatesSha256, client.outcome.allStatesSha256);
      if (i) assert.deepEqual(render.outcome, outcome);
      outcome = render.outcome;
    }
    const corrupt = deserialize(await readFile(recording));
    corrupt.steps.pop();
    await writeFile(recording, serialize(corrupt));
    await assert.rejects(readTape(recording), /Invalid crowd recording/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
