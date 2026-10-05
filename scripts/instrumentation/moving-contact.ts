// Deterministic before/after characterization using unmodified native fixtures.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { CONTACT_CASES } from "./moving-contact-cases.js";
import { CONTACT_PROFILES, runContactCase } from "./moving-contact-run.js";

const option = (key: string) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const selectedCase = option("case"),
  selectedProfile = option("profile");
const cases = CONTACT_CASES.filter((name) => !selectedCase || name === selectedCase);
const profiles = CONTACT_PROFILES.filter((p) => !selectedProfile || p.name === selectedProfile);
if (!cases.length || !profiles.length) throw Error("Unknown --case or --profile");
const results = [];
for (const name of cases)
  for (const profile of profiles) {
    const first = await runContactCase(name, profile);
    const second = await runContactCase(name, profile);
    const hash = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const repeatIdentical = hash(first) === hash(second);
    if (!repeatIdentical) throw Error(`Non-repeatable fixture: ${name}/${profile.name}`);
    results.push({ ...first, repeatIdentical, traceHash: hash(first) });
  }
if (process.argv.includes("--assert-fixed")) {
  for (const result of results) {
    const roof = result.case.endsWith("roof");
    if (roof) {
      if (
        (result.serverRoofOffsetRangePx ?? 0) > 0.001 ||
        (result.maxSupportResimErrorPx ?? 0) > 0.001
      )
        throw Error(`Support drift: ${result.case}/${result.profile}`);
    } else if (result.maxDisplayedReconcileShiftPx > 0.001)
      throw Error(`Display snap: ${result.case}/${result.profile}`);
    if (
      ["free-walk", "static-wall", "person-still", "cow-still"].includes(result.case) &&
      result.maxPostReplayShiftPx > 0.001
    )
      throw Error(`Control correction: ${result.case}/${result.profile}`);
    if (result.maxPresentationOffsetPx > 8) throw Error("Unbounded presentation correction");
  }
}
const report = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope:
    "Production Realm, native entity definitions/AI/contact/traffic/rail, binary replication and predictor; controlled clocks and ordered delays; independent repeats; no rendering or gameplay modifications",
  ticks: 180,
  commandDtMs: 16.67,
  serverHz: 60,
  profiles: CONTACT_PROFILES,
  results,
};
const output = option("output");
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.table(results.map(({ samples: _samples, traceHash: _traceHash, ...r }) => r));
