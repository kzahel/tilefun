import { open, writeFile } from "node:fs/promises";
import path from "node:path";

/** One listener per CDP session, including the raw device-tab adapter. Full
 * traces can include unrelated browser metadata; keep these artifacts local. */
export function drivingCapture(cdp, { profile, trace }) {
  let complete;
  if (trace) cdp.on("Tracing.tracingComplete", (event) => complete?.(event));
  return {
    async start(prefix) {
      let traced;
      if (trace) {
        traced = new Promise((resolve) => {
          complete = resolve;
        });
        await cdp.send("Tracing.start", {
          transferMode: "ReturnAsStream",
          categories:
            "devtools.timeline,toplevel,blink.user_timing,cc,viz,gpu,v8,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.gc",
        });
      }
      try {
        if (profile) {
          await cdp.send("Profiler.enable");
          await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
          await cdp.send("Profiler.start");
        }
      } catch (error) {
        if (traced) {
          await cdp.send("Tracing.end");
          const { stream } = await traced;
          complete = undefined;
          await cdp.send("IO.close", { handle: stream });
        }
        throw error;
      }
      return async () => {
        const result = {};
        // Stop sampling before transferring a trace or serializing large files.
        let cpu, failure;
        try {
          if (profile) cpu = (await cdp.send("Profiler.stop")).profile;
        } catch (error) {
          failure = error;
        } finally {
          if (trace) await cdp.send("Tracing.end");
        }
        if (cpu) {
          const file = `${prefix}.main.cpuprofile`;
          await writeFile(file, JSON.stringify(cpu));
          result.profile = { file: path.basename(file), intervalUs: 1000 };
        }
        if (traced) {
          const { stream, dataLossOccurred } = await traced;
          complete = undefined;
          const file = `${prefix}.trace.json`;
          let output;
          try {
            output = await open(file, "w");
            for (;;) {
              const chunk = await cdp.send("IO.read", { handle: stream, size: 1024 * 1024 });
              await output.writeFile(
                chunk.base64Encoded ? Buffer.from(chunk.data, "base64") : chunk.data,
              );
              if (chunk.eof) break;
            }
          } finally {
            await output?.close();
            await cdp.send("IO.close", { handle: stream });
          }
          result.trace = { file: path.basename(file), dataLossOccurred: !!dataLossOccurred };
        }
        if (failure) throw failure;
        await cdp.send("Performance.enable");
        const { metrics } = await cdp.send("Performance.getMetrics");
        result.navigationStartS = metrics.find((m) => m.name === "NavigationStart")?.value;
        return result;
      };
    },
  };
}
