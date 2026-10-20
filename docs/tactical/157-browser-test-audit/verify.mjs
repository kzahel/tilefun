import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Snapshot integrity check, not an application test. --list does not launch Chromium.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const ledger = JSON.parse(readFileSync(new URL("ledger.json", import.meta.url), "utf8"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const utf8Order = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const report = JSON.parse(
  execFileSync("npx", ["--no-install", "playwright", "test", "--list", "--reporter=json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }),
);
assert.deepEqual(report.errors, [], "Playwright inventory collection errors");
const specs = [];
function collect(suite) {
  specs.push(...(suite.specs ?? []));
  for (const child of suite.suites ?? []) collect(child);
}
collect(report);
const identities = [];
const byTemplate = new Map();
for (const spec of specs) {
  const key = `${spec.file}:${spec.line}`;
  const collected = byTemplate.get(key) ?? { titles: [], cases: 0 };
  collected.titles.push(spec.title);
  collected.cases += spec.tests.length;
  byTemplate.set(key, collected);
  for (const test of spec.tests) {
    identities.push(
      JSON.stringify([
        spec.file,
        spec.line,
        spec.column,
        spec.title,
        test.projectName,
        test.expectedStatus,
      ]),
    );
  }
}
assert.equal(
  hash(identities.sort(utf8Order).join("\n")),
  ledger.inventorySha256,
  "Expanded case inventory has drifted; re-audit changed cases",
);
const counts = { node: 0, split: 0, browser: 0, capture: 0 };
const templateCounts = { node: 0, split: 0, browser: 0, capture: 0 };
let templates = 0;
for (const file of ledger.files) {
  assert.equal(
    hash(readFileSync(resolve(root, file.path))),
    file.sourceSha256,
    `Audited source changed: ${file.path}`,
  );
  for (const entry of file.templates) {
    const key = `${file.path.slice("tests/".length)}:${entry.line}`;
    const collected = byTemplate.get(key);
    assert.ok(collected, `Missing source template: ${key}`);
    assert.equal(collected.cases, entry.cases, `Case count changed: ${key}`);
    assert.equal(
      hash(JSON.stringify(collected.titles.sort(utf8Order))),
      entry.expandedTitlesSha256,
      `Expanded titles changed: ${key}`,
    );
    assert.ok(Object.hasOwn(counts, entry.disposition));
    assert.ok(["covered", "partial", "none", "browser"].includes(entry.existingCoverage));
    for (const ref of entry.nativeReferences) assert.ok(Object.hasOwn(ledger.referenceSha256, ref));
    counts[entry.disposition] += entry.cases;
    templateCounts[entry.disposition]++;
    templates++;
    byTemplate.delete(key);
  }
}
assert.equal(byTemplate.size, 0, "Collected cases lack audit decisions");
for (const [path, expected] of Object.entries(ledger.referenceSha256)) {
  assert.equal(
    hash(readFileSync(resolve(root, path))),
    expected,
    `Cited coverage/configuration changed: ${path}`,
  );
}
assert.equal(ledger.files.length, ledger.counts.specFiles);
assert.equal(templates, ledger.counts.templates);
assert.equal(identities.length, ledger.counts.cases);
assert.deepEqual(counts, ledger.counts.byDisposition);
assert.deepEqual(templateCounts, ledger.counts.templatesByDisposition);
console.log(
  `Audit verified: ${ledger.files.length} files, ${templates} templates, ${identities.length} cases; source and coverage hashes match.`,
);
