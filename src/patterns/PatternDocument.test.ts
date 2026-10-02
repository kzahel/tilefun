import { describe, expect, it } from "vitest";
import { RoadType } from "../road/RoadType.js";
import { compileTreeRun, treeRunLength, treeRunProp, treeRuns } from "./FencedTrees.js";
import { DocumentHistory, gridLine, strokeCells } from "./GridStroke.js";
import {
  applyPatternEdit,
  exampleDocument,
  parsePatternDocument,
  roomSketch,
} from "./PatternDocument.js";
import { patternWorld } from "./PatternRuntime.js";

describe("shared pattern strokes", () => {
  it("interpolates reverse drags and deduplicates revisits", () => {
    expect(gridLine({ x: 3, y: 1 }, { x: -2, y: 1 })).toHaveLength(6);
    expect(
      strokeCells(
        [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 0, y: 0 },
        ],
        "free",
      ),
    ).toHaveLength(5);
    expect(
      strokeCells(
        [
          { x: 3, y: 1 },
          { x: -2, y: 9 },
        ],
        "horizontal",
      ).every((p) => p.y === 1),
    ).toBe(true);
    expect(() => gridLine({ x: NaN, y: 0 }, { x: 0, y: 0 })).toThrow();
    expect(() => gridLine({ x: 0, y: 0 }, { x: 10000, y: 0 })).toThrow();
  });
  it("commits whole gestures and branches history after undo", () => {
    const h = new DocumentHistory({ value: 0 }, 2);
    h.commit({ value: 1 });
    h.commit({ value: 2 });
    expect(h.undo().value).toBe(1);
    expect(h.redo().value).toBe(2);
    h.undo();
    h.commit({ value: 3 });
    expect(h.canRedo).toBe(false);
    expect(h.commit({ value: 3 })).toBe(false);
  });
});
describe("pattern adapters", () => {
  it("splits a row and resolves new caps; rejects unsupported short fragments atomically", () => {
    const d = exampleDocument("fenced-trees-v1");
    const split = applyPatternEdit(d, {
      path: [{ x: 9, y: 6 }],
      shape: "free",
      value: 1,
      erase: true,
    });
    expect(treeRuns(split.cells).map((r) => r.length)).toEqual([6, 6]);
    expect(() =>
      applyPatternEdit(d, { path: [{ x: 5, y: 6 }], shape: "free", value: 1, erase: true }),
    ).toThrow("2-cell run");
    expect(d.cells).toHaveLength(13);
    const p = treeRunProp(6, 0, 0);
    expect(p.collider?.width).toBe(96);
    expect(p.sprite.spriteWidth).toBe(128);
    expect(compileTreeRun(6)).toHaveLength(4);
    expect(treeRunLength("pattern:fenced-trees-v1:999")).toBeNull();
  });
  it("allows independent neighboring rows and snaps only the current gesture", () => {
    const d = exampleDocument("fenced-trees-v1");
    const next = applyPatternEdit(d, {
      path: [
        { x: 3, y: 7 },
        { x: 10, y: 12 },
      ],
      shape: "free",
      value: 1,
      erase: false,
    });
    expect(treeRuns(next.cells).map((r) => r.y)).toEqual([6, 7]);
  });
  it("compiles rooms and rejects invalid doors without changing the document", () => {
    const d = exampleDocument("rooms-v1");
    expect(roomSketch(d).split("\n")[10]?.[6]).toBe("+");
    expect(() =>
      applyPatternEdit(d, { path: [{ x: 0, y: 0 }], shape: "free", value: "+", erase: false }),
    ).toThrow("Passage");
    expect(() =>
      applyPatternEdit(d, {
        path: [{ x: 1, y: 1 }],
        shape: "rectangle",
        value: "L",
        roomRectangle: true,
        erase: false,
      }),
    ).toThrow("3×3");
  });
  it("roundtrips intent and uses the existing road backend", () => {
    const d = exampleDocument("city-surfaces-v1");
    expect(parsePatternDocument(JSON.parse(JSON.stringify(d)))).toEqual(d);
    const world = patternWorld(d);
    expect(world.getRoadAt(5, 5)).toBe(RoadType.CityPavement);
    expect(world.getRoadAt(5, 7)).toBe(RoadType.CityAsphalt);
    expect(() => parsePatternDocument({ ...d, cells: [{ x: 0, y: 0, value: 255 }] })).toThrow();
  });
});
