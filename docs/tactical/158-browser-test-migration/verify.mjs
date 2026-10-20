import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Execution ledger and current collection integrity; audit 157 remains frozen.
// --write-inventory records an intentionally reviewed collection, never approvals.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const resolutions = read("resolutions.json");
const baseline = read("../157-browser-test-audit/ledger.json");
const expected = new Map(
  baseline.files.flatMap((file) =>
    file.templates.map((entry) => [`${file.path}:${entry.line}`, entry]),
  ),
);
assert.equal(resolutions.templates.length, expected.size);
for (const entry of resolutions.templates) {
  assert.ok(expected.has(entry.source), `Unexpected/duplicate baseline key ${entry.source}`);
  const original = expected.get(entry.source);
  assert.equal(entry.cases, original.cases);
  assert.equal(entry.auditDisposition, original.disposition);
  assert.ok(["retained", "resolved"].includes(entry.status), `Unresolved ${entry.source}`);
  assert.ok(entry.resolution.trim(), `Missing decision ${entry.source}`);
  assert.ok(entry.validation.length, `Missing validation record ${entry.source}`);
  for (const path of [...entry.nativeCoverage, ...entry.browserCoverage])
    assert.ok(existsSync(resolve(root, path)), `Missing coverage path ${path}`);
  expected.delete(entry.source);
}
assert.equal(expected.size, 0);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const lanes = await Promise.all(
  [
    ["browser", "playwright.config.ts", "tests"],
    ["node-comparator", "playwright.node.config.ts", "tests-node"],
    ["http-ws", "playwright.http.config.ts", "tests-http"],
    ["capture", "playwright.capture.config.ts", "captures"],
  ].map(async ([name, config, directory]) => {
    const report = JSON.parse(
      execFileSync(
        "npx",
        ["--no-install", "playwright", "test", `--config=${config}`, "--list", "--reporter=json"],
        { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      ),
    );
    assert.deepEqual(report.errors, []);
    const specs = [];
    const collect = (suite) => {
      specs.push(...(suite.specs ?? []));
      for (const child of suite.suites ?? []) collect(child);
    };
    collect(report);
    const identities = [];
    const files = new Map();
    for (const spec of specs) {
      const path = `${directory}/${spec.file}`;
      files.set(path, (files.get(path) ?? 0) + spec.tests.length);
      for (const test of spec.tests)
        identities.push(
          JSON.stringify([
            path,
            spec.line,
            spec.column,
            spec.title,
            test.projectName,
            test.expectedStatus,
          ]),
        );
    }
    return {
      name,
      cases: identities.length,
      inventorySha256: hash(identities.sort().join("\n")),
      files: [...files]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, cases]) => ({
          path,
          cases,
          sourceSha256: hash(readFileSync(resolve(root, path))),
        })),
    };
  }),
);
const inventory = {
  baselineCommit: resolutions.baselineCommit,
  baselineTemplates: resolutions.templates.length,
  baselineCases: resolutions.templates.reduce((sum, entry) => sum + entry.cases, 0),
  lanes,
};
if (process.argv.includes("--write-inventory"))
  writeFileSync(
    new URL("inventory.json", import.meta.url),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
else
  assert.deepEqual(
    inventory,
    read("inventory.json"),
    "Collection changed; review the test level and refresh the migration inventory",
  );
console.log(
  `All ${inventory.baselineTemplates} baseline decisions complete. ${lanes.map((lane) => `${lane.name}: ${lane.cases}`).join("; ")}.`,
);
