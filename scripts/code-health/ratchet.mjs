#!/usr/bin/env node
// Size and complexity ratchet for non-test source under src/.
//
// A file fails when it exceeds MAX_LINES or holds a function whose Biome
// cognitive complexity exceeds MAX_COMPLEXITY, unless the baseline records it.
// Baselined files may shrink but not grow: lines, worst function score and the
// number of over-limit functions are each capped at their recorded values.
//
//   node scripts/code-health/ratchet.mjs           check (used by `npm run check`)
//   node scripts/code-health/ratchet.mjs --update  rewrite the baseline
//
// Lower the baseline after splitting a file; raising it is an explicit,
// reviewable decision recorded in the diff of ratchet-baseline.json.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LINES = 600;
const MAX_COMPLEXITY = 25;
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const baselinePath = join(root, "scripts/code-health/ratchet-baseline.json");

const isSource = (path) => /^src\/.*\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path);
const sources = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "src"],
  {
    cwd: root,
    encoding: "utf8",
  },
)
  .split("\n")
  .filter(isSource);

const measured = new Map();
const entry = (path) => {
  let value = measured.get(path);
  if (!value) {
    value = { lines: 0, worst: 0, overLimit: 0 };
    measured.set(path, value);
  }
  return value;
};

for (const path of sources) {
  let text;
  try {
    text = readFileSync(join(root, path), "utf8");
  } catch {
    continue; // Deleted in the working tree but still in the index.
  }
  entry(path).lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

// Biome's JSON reporter is marked experimental, so any shape change must fail
// loudly instead of silently reporting zero complexity.
const fail = (message) => {
  console.error(`Code-health ratchet cannot read Biome output: ${message}`);
  process.exit(2);
};
let output;
try {
  output = execFileSync(
    "npx",
    [
      "biome",
      "lint",
      "--only=complexity/noExcessiveCognitiveComplexity",
      "--reporter=json",
      "--max-diagnostics=none",
      "src",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (error) {
  fail(String(error.stderr || error.message));
}
let report;
try {
  report = JSON.parse(output);
} catch (error) {
  fail(`invalid JSON (${error.message})`);
}
if (!Array.isArray(report?.diagnostics)) fail("missing diagnostics array");
if (!report.diagnostics.length) fail("no complexity diagnostics; the rule or reporter changed");
for (const diagnostic of report.diagnostics) {
  if (diagnostic.category !== "lint/complexity/noExcessiveCognitiveComplexity") continue;
  const path = diagnostic.location?.path?.replaceAll("\\", "/");
  const score = Number(/complexity of (\d+)/.exec(diagnostic.message)?.[1]);
  if (!path || !Number.isFinite(score))
    fail(`unrecognized diagnostic ${JSON.stringify(diagnostic)}`);
  if (!isSource(path) || score <= MAX_COMPLEXITY) continue;
  const value = entry(path);
  value.worst = Math.max(value.worst, score);
  value.overLimit++;
}

const current = Object.fromEntries(
  [...measured]
    .filter(([, v]) => v.lines > MAX_LINES || v.worst > MAX_COMPLEXITY)
    .sort(([a], [b]) => a.localeCompare(b)),
);

if (process.argv.includes("--update")) {
  const body = { maxLines: MAX_LINES, maxComplexity: MAX_COMPLEXITY, files: current };
  writeFileSync(baselinePath, `${JSON.stringify(body, null, 2)}\n`);
  console.log(`Ratchet baseline updated: ${Object.keys(current).length} files.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).files;
const failures = [];
const tighter = [];
for (const [path, now] of Object.entries(current)) {
  const was = baseline[path];
  if (!was) {
    failures.push(
      `${path}: new over-limit file (${now.lines} lines, worst complexity ${now.worst}; limits ${MAX_LINES}/${MAX_COMPLEXITY})`,
    );
    continue;
  }
  for (const key of ["lines", "worst", "overLimit"]) {
    if (now[key] > was[key]) failures.push(`${path}: ${key} ${was[key]} → ${now[key]}`);
    else if (now[key] < was[key]) tighter.push(path);
  }
}
for (const path of Object.keys(baseline)) if (!current[path]) tighter.push(path);

if (failures.length) {
  console.error("Code-health ratchet failed (split the code, or run with --update to accept):");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
const improved = new Set(tighter).size;
console.log(
  `Code-health ratchet: ${Object.keys(current).length} baselined files within limits` +
    (improved ? `; ${improved} improved (run --update to tighten).` : "."),
);
