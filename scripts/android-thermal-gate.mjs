import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

export function parseAndroidThermals(battery, thermal) {
  const temperature = battery.match(/^\s*temperature:\s*(\d+)/m);
  const status = thermal.match(/^Thermal Status:\s*(\d+)/m);
  if (!temperature || !status) throw Error("Android temperature/status unavailable");
  return { batteryC: Number(temperature[1]) / 10, thermalStatus: Number(status[1]) };
}

export function readAndroidThermals(cli) {
  const read = (service) =>
    execFileSync(cli, ["shell", "--", "dumpsys", service], {
      encoding: "utf8",
      timeout: 15000,
    });
  return parseAndroidThermals(read("battery"), read("thermalservice"));
}

export async function waitForAndroidCool(cli, maxC, timeoutSeconds, signal) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  for (;;) {
    signal?.throwIfAborted();
    const sample = readAndroidThermals(cli);
    console.log(`Thermal gate: ${sample.batteryC} C, status ${sample.thermalStatus}`);
    if (sample.batteryC <= maxC && sample.thermalStatus === 0) return sample;
    if (Date.now() >= deadline) throw Error("Android cooldown gate timed out");
    await setTimeout(Math.min(15000, deadline - Date.now()), undefined, { signal });
  }
}
