import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpriteItem } from "../rendering/SceneItem.js";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { InteriorPresentation } from "./InteriorPresentation.js";
import { createLayeredInteriorMap } from "./LayeredInteriorMap.js";

afterEach(() => vi.unstubAllGlobals());
const plan = parseFloorPlan("####\n#LL#\n#LL#\n#+##");
function room() {
  const map = createLayeredInteriorMap(8, 8);
  map.contentOffsetY = 8;
  const cell = map.cells[2]?.[0];
  if (cell) cell.wall.push({ key: "fixture-wall" });
  return new InteriorPresentation(map, plan, () => true, true);
}
const actor = (depth: number): SpriteItem => ({
  kind: "sprite",
  sortKey: depth,
  wx: 32,
  wy: depth,
  zOffset: 0,
  sheetKey: "player",
  frameCol: 0,
  frameRow: 0,
  spriteWidth: 16,
  spriteHeight: 16,
  flipX: false,
  drawOffsetY: 0,
  hasShadow: true,
  shadowFeetWy: depth,
  shadowWidth: 10,
  shadowTerrainZ: 0,
  flashHidden: false,
});

describe("neutral interior frames", () => {
  it("preserves wall ties and inline shadows, reuses actor records, and releases scene references", () => {
    const r = room(),
      player = actor(64);
    const draws = r.collect([], [player]);
    expect(draws.map((d) => d.kind)).toEqual(["layer", "layer", "scene", "scene", "wall-band"]);
    expect(draws[2]).toMatchObject({ shadow: true, item: player, offsetY: 8 });
    expect(draws[3]).toMatchObject({ shadow: false, item: player });
    expect(draws[4]).toMatchObject({ row: 2, y: 24 });
    const body = draws[3];
    r.release();
    expect(draws).toEqual([]);
    expect(body).toMatchObject({ item: null });
    expect(r.collect([], [player])[3]).toBe(body);
    player.sortKey = 65;
    expect(r.collect([], [player]).map((d) => d.kind)).toEqual([
      "layer",
      "layer",
      "wall-band",
      "scene",
      "scene",
    ]);
    expect(room().content).not.toBe(r.content);
  });
});
