import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { readRetainedReplayInput } from "./RetainedReplayInputs.test-helper.js";

it("preserves historical replay bytes while refusing unregistered or altered substitutes", () => {
  const root = mkdtempSync(join(tmpdir(), "vehicle-replay-input-"));
  const original = Buffer.from("original renderer\n");
  const expected = createHash("sha256").update(original).digest("hex");
  const path = "src/rendering/CarMeshAsset.ts";
  const snapshot = `art-source/vehicle-bake/replay-inputs/${expected}/${path}`;
  const catalog = "art-source/vehicle-bake/replay-inputs/catalog.json";
  const put = (name: string, bytes: Buffer | string) => {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), bytes);
  };
  const register = (replacement = snapshot) =>
    put(
      catalog,
      JSON.stringify({ version: 1, inputs: [{ path, sha256: expected, snapshot: replacement }] }),
    );
  try {
    put(path, original);
    expect(readRetainedReplayInput(root, path, expected)).toEqual(original);
    put(path, "new live renderer\n");
    put(snapshot, original);
    register();
    expect(readRetainedReplayInput(root, path, expected)).toEqual(original);
    expect(() => readRetainedReplayInput(root, "src/other.ts", expected)).toThrow("Unregistered");
    expect(() => readRetainedReplayInput(root, path, "0".repeat(64))).toThrow("Unregistered");
    put(snapshot, "modified historical renderer\n");
    expect(() => readRetainedReplayInput(root, path, expected)).toThrow("Stale historical");
    register("data/pretend-snapshot.ts");
    expect(() => readRetainedReplayInput(root, path, expected)).toThrow("Invalid historical");
    expect(() => readRetainedReplayInput(root, "../outside.ts", expected)).toThrow(
      "Invalid retained",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
