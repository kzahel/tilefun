// Explicit generation/check only. Ordinary builds consume this committed registry.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const contracts = read("art-source/wildlife-v2/finishing.json");
const banks = {};
for (const contract of contracts.animals) {
  assert.equal(
    hash(`public/${contract.sourceImage}`),
    contract.sourceSha256,
    `Changed predecessor: ${contract.id}`,
  );
  if (contract.policy === "retained-bank") continue;
  const image = `demos/wildlife-v2/${contract.id}/${contract.revision}/sheet.png`;
  const metadata = read(`public/${image.replace("sheet.png", "sprite.json")}`);
  const original = read(`public/${contract.sourceImage.replace("sheet.png", "sprite.json")}`);
  assert.deepEqual(metadata.clips, original.clips);
  assert.deepEqual(metadata.anchor, original.anchor);
  assert.equal(metadata.frameWidth, original.frameWidth);
  assert.equal(metadata.frameHeight, original.frameHeight);
  assert.equal(metadata.finishing.policy, contracts.policy);
  assert.equal(metadata.finishing.method, contract.policy);
  assert.equal(metadata.sheetSha256, hash(`public/${image}`));
  banks[contract.id] = {
    identity: metadata.identity,
    revision: contract.revision,
    image,
    sha256: metadata.sheetSha256,
    policy: contract.policy,
  };
}
const path = "src/wildlife/finished-art.json";
if (process.argv.includes("--check")) assert.deepEqual(read(path), banks);
else writeFileSync(path, `${JSON.stringify(banks, null, 2)}\n`);
console.log(
  JSON.stringify({ policies: contracts.animals.length, corrected: Object.keys(banks).length }),
);
