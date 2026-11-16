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
    // 2026-11-16: refresh six natural inspection destinations; art and gait data stay fixed.
    expect(createHash("sha256").update(canonical(FAUNA_PROFILES)).digest("hex")).toBe(
      "08342200cbeeed7e553702ed610756848a791c35c68cd7a6310a75639da43290",
    );
  });
});
