import { writeFile } from "node:fs/promises";
import { Session } from "node:inspector/promises";
import { type Options, runBenchmark } from "./generation/workload.js";

const options = JSON.parse(process.env.TILEFUN_GENERATION_OPTIONS ?? "null") as Options;
if (!options) throw Error("Run via npm run generation:bench");
const output = process.env.TILEFUN_GENERATION_OUTPUT;
const profile = process.env.TILEFUN_GENERATION_PROFILE === "1";
const inspector = profile ? new Session() : undefined;
try {
  if (inspector) {
    inspector.connect();
    await inspector.post("Profiler.enable");
    await inspector.post("Profiler.start");
  }
  const report = await runBenchmark(options);
  if (inspector) {
    const cpu = (await inspector.post("Profiler.stop")).profile;
    await writeFile(`${output}.cpuprofile`, JSON.stringify(cpu));
  }
  process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {
  inspector?.disconnect();
}
