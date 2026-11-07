import { describe, expect, it } from "vitest";
import { createFauna, FAUNA_PROFILES, faunaProfile, faunaType } from "./Fauna.js";

describe("fauna profile lookup", () => {
  it("preserves each distinct species and coat's live profile identity", () => {
    expect(new Set(FAUNA_PROFILES.map((p) => faunaType(p.species))).size).toBe(
      FAUNA_PROFILES.length,
    );
    for (const profile of FAUNA_PROFILES) {
      expect(faunaProfile(faunaType(profile.species))).toBe(profile);
      expect(faunaProfile(createFauna(profile.species, 0, 0).type)).toBe(profile);
    }
  });

  it("leaves missing, unrelated and prototype-like names unrecognized", () => {
    for (const type of [
      undefined,
      "",
      "dog",
      "player",
      "constructor",
      "__proto__",
      "wildlife-dog-provisional-v2",
    ]) {
      expect(faunaProfile(type)).toBeUndefined();
    }
  });
});
