import fs from "node:fs";
import { parseFloorPlan } from "../src/interiors/ApartmentFloorPlan.js";
import { buildProfileApartmentPlan } from "../src/interiors/ApartmentWallProfiles.js";
import { auditCase } from "../src/interiors/review/CounterexampleAudit.js";
import { generateProbe } from "../src/interiors/review/CounterexampleGenerator.js";
import {
  proposeVisualReduction,
  reduceFailure,
} from "../src/interiors/review/CounterexampleReducer.js";
import { searchCounterexamples } from "../src/interiors/review/CounterexampleSearch.js";
import { reviewCases } from "../src/interiors/review/ReviewCases.js";
import { parseReviewFeedback } from "../src/interiors/review/ReviewFeedback.js";

const args = process.argv.slice(2),
  command = args.shift() ?? "search";
const option = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const cases = reviewCases();
if (command === "search") {
  const through = Number(option("--through-stage") ?? Infinity);
  if (Number.isNaN(through)) throw new Error("Invalid --through-stage");
  const result = searchCounterexamples(
    cases.filter((c) => c.stage <= through),
    Number(option("--count") ?? 8),
  );
  console.log(
    JSON.stringify(
      {
        ...result,
        failures: result.failures.map((f) => ({
          seed: f.seed,
          codes: [...new Set(f.issues.map((i) => i.code))],
        })),
        selected: result.selected.map(({ fixture, ...r }) => ({
          ...r,
          id: fixture.id,
          name: fixture.name,
        })),
      },
      null,
      2,
    ),
  );
} else if (command === "audit" || command === "reduce") {
  const id = option("--case"),
    seed = option("--seed"),
    file = option("--fixture"),
    feedback = option("--feedback");
  const records = feedback
    ? fs
        .readFileSync("data/interior-review/feedback.ndjson", "utf8")
        .trim()
        .split("\n")
        .map((s) => parseReviewFeedback(JSON.parse(s)))
    : [];
  const report = records.filter((r) => r.caseId === feedback).at(-1);
  const fixture = report
    ? {
        id: report.caseId,
        name: report.name,
        sketch: report.sketch,
        stage: 14,
        ...(report.profiles ? { profiles: report.profiles } : {}),
      }
    : file
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : seed !== undefined
        ? generateProbe(Number(seed))
        : cases.find((c) => c.id === id);
  if (!fixture)
    throw new Error("Provide --case ID, --seed N, --fixture FILE, or --feedback CASE_ID");
  const issues = auditCase(fixture);
  if (command === "audit") console.log(JSON.stringify({ id: fixture.id, issues }, null, 2));
  else {
    const code = option("--issue") ?? issues[0]?.code;
    if (code)
      console.log(
        JSON.stringify(
          {
            issue: code,
            ...reduceFailure(fixture, (c) => auditCase(c).some((i) => i.code === code)),
          },
          null,
          2,
        ),
      );
    else {
      const offset = fixture.profiles
        ? (buildProfileApartmentPlan(parseFloorPlan(fixture.sketch), fixture.profiles)
            .contentOffsetY ?? 0)
        : 0;
      const explicit = option("--pin")?.split(",").map(Number);
      const pins: [number, number][] =
        explicit?.length === 2
          ? [explicit as [number, number]]
          : (report?.pins ?? []).map((p) => [
              Math.floor(p.x / 32),
              Math.max(0, Math.floor((p.y - offset) / 32)),
            ]);
      if (pins.some((p) => p.some((v) => !Number.isInteger(v) || v < 0)))
        throw new Error("Pins must be zero-based source-cell x,y coordinates");
      console.log(JSON.stringify(proposeVisualReduction(fixture, pins), null, 2));
    }
  }
} else
  throw new Error(
    "Use search, audit, or reduce. Results go to stdout; no render cache is written.",
  );
