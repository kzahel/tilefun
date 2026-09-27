import { describe, expect, it } from "vitest";
import {
  buildConnectedRoomPlan,
  CONNECTED_ROOM_EXAMPLES,
  compileConnectedRoomPlan,
} from "./ConnectedRoomGrammar.js";

describe("connected room grammar", () => {
  it.each(CONNECTED_ROOM_EXAMPLES)("keeps the three passages aligned in $name", ({ spec }) => {
    const plan = buildConnectedRoomPlan(spec);
    const north = plan.cells[0]?.[spec.northOpeningX];
    const dividerTop = plan.cells[plan.dividerY]?.[spec.dividerOpeningX];
    const dividerBottom = plan.cells[plan.dividerY + 1]?.[spec.dividerOpeningX];
    const south = plan.cells[plan.height - 1]?.[spec.southOpeningX];
    expect(north?.passage).toBe("north");
    expect(dividerTop?.passage).toBe("divider");
    expect(dividerBottom?.passage).toBe("divider");
    expect(south?.passage).toBe("south");
    expect(dividerTop?.wall).toBeNull();
    expect(dividerBottom?.wall).toBeNull();
    expect(south?.floor).toBeNull();
    const reached = new Set<string>();
    const queue: [number, number][] = [[spec.northOpeningX, 0]];
    while (queue.length) {
      const [x, y] = queue.shift() as [number, number];
      const key = `${x},${y}`;
      if (reached.has(key)) continue;
      reached.add(key);
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const next = plan.cells[ny]?.[nx];
        if (next && !next.wall && (next.floor || next.passage)) queue.push([nx, ny]);
      }
    }
    expect(reached.has(`${spec.southOpeningX},${plan.height - 1}`)).toBe(true);
  });

  it("layers a transparent taper above floor at the offset edge", () => {
    const plan = buildConnectedRoomPlan(CONNECTED_ROOM_EXAMPLES[1].spec);
    const map = compileConnectedRoomPlan(plan);
    const taper = map.cells[plan.dividerY - 2]?.[plan.lowerRight + 1];
    expect(taper?.semantic).toBe("taper-right");
    expect(taper?.floor[0]?.key).toBe("room-builder/floors/c01-r31");
    expect(taper?.foreground[0]?.key).toBe("room-builder/3d-walls/c14-r04");
  });

  it("moves wall jambs with the divider passage", () => {
    const plan = buildConnectedRoomPlan(CONNECTED_ROOM_EXAMPLES[1].spec);
    const map = compileConnectedRoomPlan(plan);
    const y = plan.dividerY;
    expect(map.cells[y]?.[plan.dividerOpeningX - 1]?.wall[0]?.key).toBe(
      "room-builder/3d-walls/c08-r03",
    );
    expect(map.cells[y]?.[plan.dividerOpeningX + 1]?.wall[0]?.key).toBe(
      "room-builder/3d-walls/c08-r00",
    );
  });
});
