import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FAUNA_PROFILES } from "./Fauna.js";

/** Key order as authored; present-but-undefined stays distinct from absent. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (v === undefined ? "__undefined__" : v));
}

describe("fauna profile data", () => {
  it("keeps the complete FAUNA_PROFILES serialization byte-identical", () => {
    expect(FAUNA_PROFILES).toHaveLength(153);
    // Construction and town farms changed the seed-2026 gazelle inspection destination.
    expect(createHash("sha256").update(canonical(FAUNA_PROFILES)).digest("hex")).toBe(
      "15fdf07719f4aa4221a79adf86cf5b5ed78a3cd06d6a0ad0389abda7dce7563b",
    );
  });
});
