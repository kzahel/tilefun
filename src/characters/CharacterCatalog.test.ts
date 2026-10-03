import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { CHARACTERS, createCharacterEntity, parseCharacterSettings } from "./CharacterCatalog.js";

describe("character proposals", () => {
  it("keeps Workshop entities controller-free alongside promoted NPC definitions", () => {
    expect(CHARACTERS).toHaveLength(6);
    for (const def of CHARACTERS) {
      const e = createCharacterEntity(def, def.defaults);
      expect(e.wanderAI).toBeNull();
      expect(ENTITY_DEFS[def.sheetKey]?.wanderAI?.speed).toBe(20);
      expect(ENTITY_FACTORIES[def.sheetKey]).toBeTypeOf("function");
      expect(required(e.sprite).spriteHeight - (required(e.sprite).drawOffsetY ?? 0)).toBe(27);
      expect(required(e.sprite).frameDuration).toBe(250);
    }
  });
  it("rejects incomplete, non-finite and extreme geometry and speed", () => {
    const s = required(CHARACTERS[0]).defaults;
    for (const patch of [
      { width: 0 },
      { depth: -1 },
      { fps: Infinity },
      { speed: 1e9 },
      { physicalHeight: NaN },
      { offsetX: 33 },
    ])
      expect(() => parseCharacterSettings({ ...s, ...patch })).toThrow();
    expect(() => parseCharacterSettings({})).toThrow();
    expect(parseCharacterSettings({ ...s, width: 14, drawOffsetY: -2 })).toEqual({
      ...s,
      width: 14,
      drawOffsetY: -2,
    });
  });
});
