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
    const westReturn = map.cells[6]?.[mainX - 1];
    const eastReturn = map.cells[6]?.[mainX + 14];
    expect(westReturn?.floor).toHaveLength(1);
    expect(westReturn?.foreground[0]?.key).toBe("room-builder/3d-walls/c14-r04");
    expect(eastReturn?.floor).toHaveLength(1);
    expect(eastReturn?.floor[0]?.key).toBe("room-builder/floors/c01-r31");
    expect(eastReturn?.foreground[0]?.key).toBe("room-builder/3d-walls/c09-r04");
    expect(map.cells[5]?.[mainX + 14]?.floor[0]?.key).toBe("room-builder/floors/c01-r31");
    expect(map.cells[2]?.[mainX - 1]?.wall[0]?.key).toBe("room-builder/3d-walls/c13-r03");
    expect(map.cells[3]?.[mainX - 1]?.wall[0]?.key).toBe("room-builder/3d-walls/c13-r04");
    expect(map.cells[3]?.[mainX + 14]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r03");
    expect(map.cells[4]?.[mainX + 14]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r04");
  });

  it("joins the lower room with a shared two-row divider and matching passage caps", () => {
    const { spec } = ADVANCED_SUITE_EXAMPLES[1];
    const map = buildAdvancedSuite(spec);
    const cell = map.cells[13]?.[spec.westWidth + 7];
    expect(cell?.semantic).toBe("opening");
    expect(cell?.floor.some((tile) => tile.key === "room-builder/floors/c13-r35")).toBe(true);
    expect(map.cells[14]?.[spec.westWidth + 7]?.semantic).toBe("opening");
    expect(map.cells[13]?.[spec.westWidth + 6]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r03");
    expect(map.cells[14]?.[spec.westWidth + 6]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r04");
    expect(map.cells[13]?.[spec.westWidth + 6]?.foreground).toHaveLength(0);
  });
});
