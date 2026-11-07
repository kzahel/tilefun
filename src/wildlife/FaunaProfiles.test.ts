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
    expect(createHash("sha256").update(canonical(FAUNA_PROFILES)).digest("hex")).toBe(
      "fd7930a522752b5c8f832af37bbefb9073d361609b58053e29544a2ff85e36a6",
    );
  });
});
