import { describe, expect, it } from "vitest";
import { collectSceneOrder } from "./RenderFrame.js";
import type { SceneItem, SpriteItem } from "./SceneItem.js";

describe("backend-independent frame submission", () => {
  it("specifies ground shadows before the scene and elevated shadows immediately before their sprite", () => {
    const sprite = (terrain: number, hidden = false) =>
      ({
        kind: "sprite",
        hasShadow: true,
        flashHidden: hidden,
        shadowTerrainZ: terrain,
      }) as SpriteItem;
    const items: SceneItem[] = [
      sprite(0),
      sprite(16),
      sprite(0, true),
      { kind: "particle" } as SceneItem,
      sprite(0),
    ];
    const order: number[] = [999];
    expect(collectSceneOrder(items, order)).toBe(order);
    expect(order).toEqual([-1, -5, 0, -2, 1, 2, 3, 4]);
    expect(collectSceneOrder([], order)).toEqual([]);
  });
});
