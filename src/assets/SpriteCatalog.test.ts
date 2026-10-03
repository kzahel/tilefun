import { describe, expect, it } from "vitest";
import { createSpriteCatalog, spriteMetadata, spriteRegion } from "./SpriteCatalog.js";

describe("sprite metadata boundary", () => {
  it("retains native source geometry without a browser or image resource", () => {
    const metadata = spriteMetadata(65, 48, 16, 24);
    expect(metadata).toEqual({
      width: 65,
      height: 48,
      tileWidth: 16,
      tileHeight: 24,
      cols: 4,
      rows: 2,
    });
    expect(spriteRegion(metadata, 3, 1)).toEqual({ x: 48, y: 24, width: 16, height: 24 });
    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it("shares immutable alias metadata, excluding resources and tracking catalog replacement", () => {
    const old = { metadata: spriteMetadata(32, 32, 16, 16), image: { backendOnly: true } };
    const resources = new Map([
      ["water", old],
      ["alias", old],
    ]);
    const first = createSpriteCatalog(resources);
    expect(first.get("water")).toBe(first.get("alias"));
    expect(JSON.stringify([...first])).not.toContain("backendOnly");
    const replacement = { metadata: spriteMetadata(64, 64, 16, 16), image: { backendOnly: true } };
    resources.set("water", replacement);
    resources.delete("alias");
    const next = createSpriteCatalog(resources);
    expect(next.has("alias")).toBe(false);
    expect(next.get("water")?.cols).toBe(4);
    expect(first.get("water")?.cols).toBe(2);
  });
});
