import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { drivingCapture } from "./capture.mjs";

test("stops CPU sampling before trace transfer, decodes chunks and retires the stream on a failed profile stop", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "driving-capture-test-"));
  try {
    for (const fail of [false, true]) {
      const calls = [],
        listeners = new Map();
      const cdp = {
        on(name, callback) {
          listeners.set(name, callback);
        },
        async send(method) {
          calls.push(method);
          if (method === "Profiler.stop") {
            if (fail) throw Error("CPU target stopped");
            return { profile: { nodes: [], startTime: 1, endTime: 2 } };
          }
          if (method === "Tracing.end")
            listeners.get("Tracing.tracingComplete")({ stream: "owned", dataLossOccurred: false });
          if (method === "IO.read")
            return {
              data: Buffer.from('{"traceEvents":[]}').toString("base64"),
              base64Encoded: true,
              eof: true,
            };
          if (method === "Performance.getMetrics")
            return { metrics: [{ name: "NavigationStart", value: 42 }] };
          return {};
        },
      };
      const prefix = path.join(directory, fail ? "failed" : "success");
      const stop = await drivingCapture(cdp, { profile: true, trace: true }).start(prefix);
      if (fail) await assert.rejects(stop(), /CPU target stopped/);
      else assert.equal((await stop()).navigationStartS, 42);
      assert.ok(calls.indexOf("Profiler.stop") < calls.indexOf("Tracing.end"));
      assert.ok(calls.indexOf("Tracing.end") < calls.indexOf("IO.read"));
      assert.ok(calls.includes("IO.close"));
      assert.deepEqual(JSON.parse(await readFile(`${prefix}.trace.json`, "utf8")), {
        traceEvents: [],
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
