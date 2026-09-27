import { describe, expect, it } from "vitest";
import {
  ADVANCED_SUITE_EXAMPLES,
  buildAdvancedSuite,
  reachableSuiteCells,
  suiteWalkableCellCount,
} from "./AdvancedSuite.js";

describe("advanced interior suites", () => {
  it.each(ADVANCED_SUITE_EXAMPLES)("connects every room in $name", ({ spec }) => {
    const map = buildAdvancedSuite(spec);
    const mainX = spec.westWidth;
    expect(map.cells[4]?.[mainX - 1]?.semantic).toBe("opening");
    expect(map.cells[4]?.[mainX]?.semantic).toBe("opening");
    expect(map.cells[5]?.[mainX + 13]?.semantic).toBe("opening");
    expect(map.cells[5]?.[mainX + 14]?.semantic).toBe("opening");
    expect(reachableSuiteCells(map, mainX + 7, 0)).toBe(suiteWalkableCellCount(map));
  });

  it("continues floor beneath the source's transparent south portal", () => {
    const { spec } = ADVANCED_SUITE_EXAMPLES[1];
    const map = buildAdvancedSuite(spec);
    const cell = map.cells[13]?.[spec.westWidth + 7];
    expect(cell?.semantic).toBe("opening");
    expect(cell?.floor.some((tile) => tile.key === "room-builder/floors/c13-r35")).toBe(true);
    expect(map.cells[14]?.[spec.westWidth + 7]?.semantic).toBe("opening");
  });
});
