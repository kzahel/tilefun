// Exact native authority/replica/predictor traces across matching frozen sources.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const option = (key) => process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const beforeRoot = option("before-root"),
  afterRoot = option("after-root"),
  output = option("output");
if (!beforeRoot || !afterRoot || !output)
  throw Error("Supply --before-root, --after-root, --output");
const before = await import(
  pathToFileURL(path.join(beforeRoot, "scripts/instrumentation/car-driving-prediction-case.ts"))
    .href
);
const after = await import(
  pathToFileURL(path.join(afterRoot, "scripts/instrumentation/car-driving-prediction-case.ts")).href
);
const hash = (r) => createHash("sha256").update(JSON.stringify(r)).digest("hex");
const cases = [];
for (const hz of [30, 60])
  for (const profile of before.CAR_DRIVING_PROFILES)
    for (const motion of ["cruise", "turn-release"]) {
      const a = await before.runCarDrivingCase(hz, profile, motion),
        b = await after.runCarDrivingCase(hz, profile, motion);
      assert.equal(hash(a), hash(b), `${hz}/${profile}/${motion}`);
      cases.push({ hz, profile, motion, traceSHA256: hash(a), summary: b.summary });
      console.log(`${hz}/${profile}/${motion}: exact native authority/replica/prediction trace`);
    }
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "report.json"),
  JSON.stringify(
    {
      scope:
        "Four-second native fixed-clock authority/replica/predictor traces; clear ground and native walls, no browser timing claim",
      cases,
    },
    null,
    2,
  ),
);
