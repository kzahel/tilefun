import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import { expect, it } from "vitest";
import contracts from "../../art-source/wildlife-v2/finishing.json" with { type: "json" };
import { ANIMAL_BROWSER_ENTRIES } from "../workshop/AnimalBrowserData.js";
import { DEER_IMAGE } from "./Deer.js";
import { FAUNA_PROFILES } from "./Fauna.js";
import { finishedBank } from "./FinishedArt.js";
import { PREDATOR_PROFILES } from "./Predator.js";
import reviews from "./reviews.json" with { type: "json" };

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const inputHashes = new Map<string, string>();

it("gives every active animal one whole-bank finishing policy in game and browser", () => {
  expect(new Set(contracts.animals.map((entry) => entry.id))).toEqual(
    new Set(ANIMAL_BROWSER_ENTRIES.map((entry) => entry.id)),
  );
  for (const contract of contracts.animals) {
    const browser = ANIMAL_BROWSER_ENTRIES.find((entry) => entry.id === contract.id);
    expect(browser, contract.id).toBeDefined();
    const bank = finishedBank(contract.id);
    if (contract.policy === "retained-bank") {
      expect(bank, contract.id).toBeUndefined();
      expect(browser?.image).toBe(contract.sourceImage);
      continue;
    }
    expect(bank?.policy).toBe(contract.policy);
    expect(browser?.image).toBe(bank?.image);
    const fauna = FAUNA_PROFILES.find((entry) => entry.species === contract.id);
    const predator = PREDATOR_PROFILES.find((entry) => entry.species === contract.id);
    if (fauna)
      expect([fauna.image, fauna.identity, fauna.sha256]).toEqual([
        bank?.image,
        bank?.identity,
        bank?.sha256,
      ]);
    else if (predator)
      expect([predator.revision, predator.art?.identity, predator.art?.sha256]).toEqual([
        bank?.revision,
        bank?.identity,
        bank?.sha256,
      ]);
    else expect(DEER_IMAGE).toBe(bank?.image);
  }
  expect(finishedBank("constructor")).toBeUndefined();
  expect(finishedBank("__proto__")).toBeUndefined();
});

it("keeps predecessors immutable and every corrected clip on its declared policy", () => {
  for (const contract of contracts.animals) {
    expect(hash(`public/${contract.sourceImage}`), contract.id).toBe(contract.sourceSha256);
    const bank = finishedBank(contract.id);
    if (!bank) continue;
    const original = read(`public/${contract.sourceImage.replace("sheet.png", "sprite.json")}`);
    const metadata = read(`public/${bank.image.replace("sheet.png", "sprite.json")}`);
    expect(metadata.clips, contract.id).toEqual(original.clips);
    expect(metadata.anchor).toEqual(original.anchor);
    expect([metadata.frameWidth, metadata.frameHeight]).toEqual([
      original.frameWidth,
      original.frameHeight,
    ]);
    expect(metadata.finishing).toMatchObject({
      policy: contracts.policy,
      method: contract.policy,
      contract: bank.identity,
    });
    expect(hash(`public/${bank.image}`)).toBe(bank.sha256);
    expect(metadata.sheetSha256).toBe(bank.sha256);
    const review = reviews.find(
      (entry) => entry.animalId === contract.id && entry.revision === bank.revision,
    );
    expect(review, `Unregistered correction ${contract.id}`).toBeDefined();
    expect(review?.sheet.image).toBe(bank.image);
    expect(review?.sheet.fingerprint).toBe(bank.sha256);
    const inputs = read(`art-source/wildlife-v2/${contract.id}/${bank.revision}/inputs.json`);
    for (const [path, expected] of Object.entries(inputs.sha256)) {
      let actual = inputHashes.get(path);
      if (!actual) {
        actual = hash(path);
        inputHashes.set(path, actual);
      }
      expect(actual, `${contract.id} retained input ${path}`).toBe(expected);
    }
  }
}, 30_000);

it("preserves all native painted cells for the five corrected action painters", () => {
  for (const contract of contracts.animals.filter((entry) => entry.policy === "retained-parts")) {
    const originalInputs = read(`${contract.source}/inputs.json`);
    const native = PNG.sync.read(readFileSync(originalInputs.sheet));
    const corrected = PNG.sync.read(readFileSync(`public/${finishedBank(contract.id)?.image}`));
    expect(corrected.height).toBe(native.height);
    for (let row = 0; row < native.height; row++) {
      expect(
        corrected.data
          .subarray(row * corrected.width * 4, row * corrected.width * 4 + native.width * 4)
          .equals(native.data.subarray(row * native.width * 4, (row + 1) * native.width * 4)),
        `${contract.id} native row ${row}`,
      ).toBe(true);
    }
  }
});

it("starts deer feeding with the original painted deer instead of a thick silhouette", () => {
  const metadata = read(`public/${DEER_IMAGE.replace("sheet.png", "sprite.json")}`);
  const sheet = PNG.sync.read(readFileSync(`public/${DEER_IMAGE}`));
  const width = metadata.frameWidth;
  for (let row = 0; row < 4; row++) {
    let changed = 0;
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) {
        const a = ((row * width + y) * sheet.width + x) * 4;
        const b = a + metadata.clips.lower.start * width * 4;
        if (!sheet.data.subarray(a, a + 4).equals(sheet.data.subarray(b, b + 4))) changed++;
      }
    }
    // The native tail/leg overlap can resolve two shared pixels differently.
    // The broken export changed over a hundred pixels before motion began.
    expect(changed, `deer facing ${row}`).toBeLessThanOrEqual(2);
  }
});
