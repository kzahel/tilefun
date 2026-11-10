import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { REPORT_VERSION } from "./report.js";

export const option = (key: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
export const lane = option("lane", "authority");
if (!["authority", "record", "client", "render"].includes(lane)) throw Error("Unknown --lane");
export const rabbits = Number(option("rabbits", "1000"));
export const cars = Number(option("cars", "50"));
export const warmup = Number(option("warmup", "180"));
export const ticks = Number(option("ticks", "600"));
if (![warmup, ticks].every((n) => Number.isInteger(n) && n > 0 && n <= 10_000))
  throw Error("--warmup and --ticks must be integers 1–10000");
export const output = option(
  "output",
  path.join(os.tmpdir(), `tilefun-crowd-${lane}.${lane === "record" ? "tape" : "json"}`),
);
export const compare = option("compare", "");
export const assertEquivalent = process.argv.includes("--assert-equivalent");
if (assertEquivalent && !compare) throw Error("--assert-equivalent requires --compare");
export const profile = process.argv.includes("--profile");
if (profile && lane !== "authority") throw Error("--profile currently supports authority only");
export const replay = option("replay", "");
if ((lane === "client" || lane === "render") && !replay)
  throw Error("This lane requires --replay=<file.tape>");
const git = (args: string[]) =>
  execFileSync(
    process.platform === "win32" ? "wsl" : "git",
    process.platform === "win32" ? ["git", ...args] : args,
    { encoding: "utf8" },
  ).trim();

export function reportBase(workload: unknown) {
  return {
    schemaVersion: REPORT_VERSION,
    date: new Date().toISOString(),
    lane,
    revision: git(["rev-parse", "HEAD"]),
    dirty: !!git(["status", "--porcelain"]),
    source: JSON.parse(process.env.TILEFUN_CROWD_SOURCE ?? "null") as unknown,
    environment: {
      node: process.version,
      v8: process.versions.v8,
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpu: os.cpus()[0]?.model,
      logicalCpus: os.cpus().length,
    },
    load: os.loadavg(),
    workload,
    instrumentation: { profile, stageTimings: lane === "authority" },
  };
}
