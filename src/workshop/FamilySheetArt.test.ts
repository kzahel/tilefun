import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { familyCanonicalJSON, loadFamilySheetCatalog } from "./FamilySheetArt.js";
import type { FamilySheetCatalog } from "./FamilySheetTypes.js";

const catalog = JSON.parse(
  readFileSync("public/data/family-sheets.json", "utf8"),
) as FamilySheetCatalog;
function revise(value: { revision: string }) {
  const { revision: _revision, ...contents } = value;
  value.revision = createHash("sha256").update(familyCanonicalJSON(contents)).digest("hex");
}
afterEach(() => vi.unstubAllGlobals());
it("accepts the committed catalog with current revisions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(catalog)),
  );
  await expect(loadFamilySheetCatalog()).resolves.toEqual(catalog);
});
it.each([
  "length",
  "empty",
  "zero",
  "negative",
  "fractional",
  "non-finite",
  "loop",
  "size",
] as const)(
  "rejects invalid animation %s even after metadata revisions are recomputed",
  async (invalid) => {
    const changed = structuredClone(catalog);
    const family = required(changed.families.find((item) => item.id === "animated-doors"));
    const example = required(family.examples[0]);
    const animation = required(example.animation);
    if (invalid === "length") animation.frameDurationsMs.pop();
    if (invalid === "empty") animation.frameDurationsMs = [];
    if (invalid === "zero") animation.frameDurationsMs[0] = 0;
    if (invalid === "negative") animation.frameDurationsMs[0] = -1;
    if (invalid === "fractional") animation.frameDurationsMs[0] = 1.5;
    if (invalid === "non-finite") animation.frameDurationsMs[0] = Number.POSITIVE_INFINITY;
    if (invalid === "loop") animation.loop = "yes" as unknown as boolean;
    if (invalid === "size") required(example.variants[1]).sprite.size[0] += 1;
    // HTTP JSON turns Infinity into null. Sign exactly the data delivered to the loader.
    const served = JSON.parse(JSON.stringify(changed)) as FamilySheetCatalog;
    for (const item of served.families) revise(item);
    revise(served);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(served)),
    );
    await expect(loadFamilySheetCatalog()).rejects.toThrow(
      invalid === "size"
        ? "Source demonstration frames must have the same size."
        : "Invalid source demonstration timing.",
    );
  },
);
