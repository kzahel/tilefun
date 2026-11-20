// Counts V8 bailouts per function in an optimization log, to find code the
// engine keeps optimizing and throwing away. A healthy function bails out a
// few times while it warms up; hundreds in one run is a loop, and the function
// is running unoptimized for much of it.
//
//   DEBUG=pw:browser npm run render:bench -- --scenes=woods --zooms=1 \
//     --js-flags="--trace-opt --trace-deopt" 2> /tmp/v8.log
//   node scripts/instrumentation/deopt-census.mjs /tmp/v8.log [--top=20]
//
// One process's log per file. Functions are told apart by name, so same-named
// functions in different modules are counted together.
import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file) throw Error("Usage: deopt-census.mjs <v8-trace.log> [--top=20]");
const top = Number(process.argv.find((s) => s.startsWith("--top="))?.slice(6) ?? 20);
const bailout =
  /\[bailout \(kind: [\w-]+, reason: ([^)]*)\): begin\. deoptimizing \S+ <JSFunction(?: ([^>]+?))? \(sfi = /;
const compiled = /\[completed (?:compiling|optimizing) \S+ <JSFunction(?: ([^>]+?))? \(sfi = /;
const functions = new Map();
const entry = (name) => {
  const key = name || "(anonymous)";
  let value = functions.get(key);
  if (!value) {
    value = { bailouts: 0, compiles: 0, reasons: new Map() };
    functions.set(key, value);
  }
  return value;
};
for (const line of (await readFile(file, "utf8")).split("\n")) {
  const out = bailout.exec(line);
  if (out) {
    const value = entry(out[2]);
    value.bailouts++;
    value.reasons.set(out[1], (value.reasons.get(out[1]) ?? 0) + 1);
    continue;
  }
  const done = compiled.exec(line);
  if (done) entry(done[1]).compiles++;
}
const rows = [...functions].sort((a, b) => b[1].bailouts - a[1].bailouts).slice(0, top);
if (!rows[0]?.[1].bailouts) console.log("No bailouts found: was the run made with --trace-deopt?");
for (const [name, { bailouts, compiles, reasons }] of rows) {
  if (!bailouts) break;
  const [reason, count] = [...reasons].sort((a, b) => b[1] - a[1])[0];
  console.log(
    `${String(bailouts).padStart(6)} bailouts ${String(compiles).padStart(6)} compiles  ${name}  (${count}× ${reason})`,
  );
}
