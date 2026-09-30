import { describe, expect, it } from "vitest";
import { PIXEL_SCALE } from "../config/constants.js";
import { createProp } from "../entities/PropFactories.js";
import type { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import type { TileRenderer } from "./TileRenderer.js";

function visible(type: string, x: number, y: number) {
  const camera = new Camera();
  camera.zoom = 1 / PIXEL_SCALE;
  camera.setViewport(16, 16);
  camera.snapTo(x, y);
  return collectScene(
    [],
    [createProp(type, 0, 0)],
    { getHeightAt: () => 0 } as unknown as World,
    camera,
    { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 },
    1,
    { collectElevationItems: () => [] } as unknown as TileRenderer,
    [],
    false,
  );
}
describe("shared building accessory culling", () => {
  it("draws a projecting side sign even when the entire wall lies outside the viewport margin", () => {
    expect(visible("prop-city-v1-hotel-3", 180, -160)).toEqual([]);
    const items = visible("prop-city-v1-hotel-3-side-sign", 180, -160);
    expect(items.some((i) => i.kind === "sprite" && i.frameCol * 16 === 2192)).toBe(true);
  });
  it("draws a rooftop sign above the body when the wall and roof are offscreen", () => {
    expect(visible("prop-city-v1-hotel-3", 0, -345)).toEqual([]);
    const items = visible("prop-city-v1-hotel-3-roof-sign", 0, -345);
    expect(items.some((i) => i.kind === "sprite" && i.frameRow * 16 === 1744)).toBe(true);
  });
});
