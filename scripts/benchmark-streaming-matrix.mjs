import { spawn } from "node:child_process";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  markdownReport,
  planMatrix,
  sanitizeReport,
  sourceFingerprint,
} from "./streaming-matrix-lib.mjs";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(`Usage: npm run streaming:matrix -- [options]
  --targets=desktop,phone  Sequential platforms (default desktop)
  --repeats=2             Reverse configuration order on alternate repeats
  --zooms=1,0.5,0.25,0.1,2  Fresh seeded world and actual motion at each zoom
  --movement-seconds=8 --settle-seconds=30 --warm-seconds=2
  --cdp=http://127.0.0.1:9223 --port=4188 --device=Pixel-7a
  --output=/tmp/tilefun-streaming-matrix
  --resume                Reuse completed entries if settings/source match
  --retry-failed          With --resume, rerun failed entries
  --dry-run               Print order without launching browsers
Phone requires existing ADB CDP forwarding and reverse forwarding for --port.
Desktop uses bundled headed Chromium. Runs never overlap. Outputs matrix.json
(sanitized), comparison.md, per-run report.json/logs. Nonzero exit if any run fails.
Use streaming:bench for individual runs and traces.`);
  process.exit(0);
}
const allowed = new Set([
  "targets",
  "repeats",
  "zooms",
  "movement-seconds",
  "settle-seconds",
  "warm-seconds",
  "cdp",
  "port",
  "device",
  "output",
  "resume",
  "retry-failed",
  "dry-run",
]);
for (const arg of args)
  if (!arg.startsWith("--") || !allowed.has(arg.slice(2).split("=")[0]))
    throw Error(`Unknown option: ${arg}`);
const option = (name, fallback) =>
  args.find((s) => s.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const targets = option("targets", "desktop").split(",");
if (
  targets.some((t) => !["desktop", "phone"].includes(t)) ||
  new Set(targets).size !== targets.length
)
  throw Error("--targets must contain unique desktop/phone entries");
const repeats = Number(option("repeats", "2"));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20)
  throw Error("--repeats must be 1..20");
const config = {
  targets,
  repeats,
  zooms: option("zooms", "1,0.5,0.25,0.1,2"),
  movementSeconds: Number(option("movement-seconds", "8")),
  settleSeconds: Number(option("settle-seconds", "30")),
  warmSeconds: Number(option("warm-seconds", "2")),
  cdp: option("cdp", ""),
  port: Number(option("port", "0")),
  device: option("device", "physical Android"),
};
if (targets.includes("phone") && (!config.cdp || !config.port))
  throw Error("Phone requires --cdp and dedicated --port");
for (const x of [config.movementSeconds, config.settleSeconds, config.warmSeconds])
  if (!Number.isFinite(x) || x < 1 || x > 300) throw Error("Stage seconds must be 1..300");
const zooms = config.zooms.split(",").map(Number);
if (
  zooms.some((z) => !Number.isFinite(z) || z < 0.05 || z > 3) ||
  new Set(zooms).size !== zooms.length
)
  throw Error("Invalid --zooms");
const plan = planMatrix(targets, repeats);
if (args.includes("--dry-run")) {
  console.log(JSON.stringify({ config, plan }, null, 2));
  process.exit(0);
}
if (process.env.TILEFUN_DEV_URL)
  throw Error("Matrix requires isolated serving; unset TILEFUN_DEV_URL");
const output = path.resolve(option("output", path.join(os.tmpdir(), "tilefun-streaming-matrix")));
await mkdir(output, { recursive: true });
const fingerprint = sourceFingerprint();
const configKey = JSON.stringify(config);
let matrix = { schema: 1, fingerprint, configKey, config, plan, runs: [] };
const matrixPath = path.join(output, "matrix.json");
try {
  const previous = JSON.parse(await readFile(matrixPath, "utf8"));
  if (!args.includes("--resume"))
    throw Error("Output already has a matrix; use a new directory or --resume");
  if (previous.fingerprint !== fingerprint || previous.configKey !== configKey)
    throw Error("Cannot resume: executable source or settings changed");
  matrix = previous;
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
let child,
  interrupted = false;
const interrupt = () => {
  interrupted = true;
  child?.kill("SIGTERM");
};
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
async function save() {
  await writeFile(`${matrixPath}.tmp`, `${JSON.stringify(matrix, null, 2)}\n`);
  await rename(`${matrixPath}.tmp`, matrixPath);
  await writeFile(path.join(output, "comparison.md"), markdownReport(matrix));
}
await save();
try {
  for (const entry of plan) {
    if (interrupted) break;
    const existing = matrix.runs.find((r) => r.id === entry.id);
    if (
      existing &&
      (existing.status === "passed" ||
        (existing.status === "failed" && !args.includes("--retry-failed")))
    )
      continue;
    if (sourceFingerprint() !== fingerprint)
      throw Error("Executable source changed during matrix; resume refused");
    const directory = path.join(output, entry.id);
    await mkdir(directory, { recursive: true });
    await rm(path.join(directory, "report.json"), { force: true });
    const log = await open(path.join(directory, "runner.log"), "w");
    const command = [
      "scripts/benchmark-streaming.mjs",
      "--zoom-motion",
      "--noclip",
      `--zooms=${config.zooms}`,
      `--movement-seconds=${config.movementSeconds}`,
      `--settle-seconds=${config.settleSeconds}`,
      `--warm-seconds=${config.warmSeconds}`,
      `--renderer=${entry.renderer}`,
      `--terrain-pacing=${entry.pacing}`,
      `--output=${directory}`,
    ];
    if (entry.pacing === "responsive") command.push("--assert-bounded");
    command.push(
      ...(entry.target === "desktop"
        ? ["--headed"]
        : [`--cdp=${config.cdp}`, `--port=${config.port}`, `--device=${config.device}`, "--touch"]),
    );
    console.log(`[${entry.id}] starting ${zooms.length} zooms`);
    const started = new Date().toISOString();
    let code;
    let deadline, killDeadline;
    try {
      code = await new Promise((resolve, reject) => {
        child = spawn(process.execPath, command, { stdio: ["ignore", log.fd, log.fd] });
        // Bound even a hung startup/CDP evaluation. SIGTERM lets the runner close
        // its own tab/browser and server before the final process deadline.
        deadline = setTimeout(
          () => {
            child?.kill("SIGTERM");
            killDeadline = setTimeout(() => child?.kill("SIGKILL"), 10000);
          },
          (zooms.length *
            (60 + config.settleSeconds * 2 + config.movementSeconds + config.warmSeconds * 2) +
            60) *
            1000,
        );
        child.once("error", reject);
        child.once("exit", (status) => resolve(status));
      });
    } finally {
      clearTimeout(deadline);
      clearTimeout(killDeadline);
      child = undefined;
      await log.close();
    }
    let report;
    try {
      report = sanitizeReport(
        JSON.parse(await readFile(path.join(directory, "report.json"), "utf8")),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const sourceChanged = sourceFingerprint() !== fingerprint;
    const complete = report?.fixtures.length === zooms.length;
    const run = {
      ...entry,
      started,
      completed: new Date().toISOString(),
      exitCode: code,
      status: sourceChanged
        ? "source-changed"
        : interrupted
          ? "interrupted"
          : code === 0 && complete
            ? "passed"
            : "failed",
      report,
    };
    matrix.runs = matrix.runs.filter((r) => r.id !== entry.id);
    matrix.runs.push(run);
    await save();
    console.log(
      `[${entry.id}] ${run.status}; ${report?.fixtures.length ?? 0}/${zooms.length} zooms recorded`,
    );
    if (sourceChanged)
      throw Error("Executable source changed during run; result flagged and matrix stopped");
  }
} finally {
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
}
console.log(`Comparison: ${path.join(output, "comparison.md")}`);
if (
  interrupted ||
  matrix.runs.length !== plan.length ||
  matrix.runs.some((r) => r.status !== "passed")
)
  process.exitCode = 1;
