import { expect, it } from "vitest";
import type { Movement } from "../shared/Movement.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { MEADOW, outskirtsParkRecipe, PARK_STARTS, POND } from "./OutskirtsParkRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };

it("paints the pond and trails, keeps meadow animals fenced, and walks the dock dry", async () => {
  const s = await ScenarioSession.create(outskirtsParkRecipe());
  try {
    const world = s.realm.world;
    const flags = (tx: number, ty: number) => world.getCollisionIfLoaded(tx, ty);
    // Deep pond centre is water; the entrance trail differs from the grass beside it; the jetty is dry.
    expect(flags(Math.floor(POND.tx), Math.floor(POND.ty)) & CollisionFlag.Water).not.toBe(0);
    expect(world.getTerrainIfLoaded(0, 20)).not.toBe(world.getTerrainIfLoaded(-8, 20));
    const dock = PARK_STARTS.dock.position;
    expect(flags(Math.floor(dock.wx / 16), Math.floor(dock.wy / 16)) & CollisionFlag.Water).toBe(0);

    // Walk east along the dock to its end without being returned to shore.
    await s.command({ kind: "teleport", ...PARK_STARTS.dock });
    await steps(s, 20, { ...idle, dx: 1 });
    const x = s.player.player.position.wx;
    expect(x).toBeGreaterThan(dock.wx + 15);
    await steps(s, 10);
    expect(s.player.player.position.wx).toBeCloseTo(x, 0);

    // A minute of wildlife time: deer and rabbits stay inside the meadow fence.
    await steps(s, 3600);
    const grazers = s.realm.entityManager.entities.filter(
      (e) => e.type.includes("deer") || e.type.includes("rabbit"),
    );
    expect(grazers.length).toBeGreaterThanOrEqual(5);
    for (const e of grazers) {
      expect(e.position.wx).toBeGreaterThan(MEADOW.left);
      expect(e.position.wx).toBeLessThan(MEADOW.right);
      expect(e.position.wy).toBeGreaterThan(MEADOW.top);
      expect(e.position.wy).toBeLessThan(MEADOW.bottom + 4);
    }
  } finally {
    await s.close();
  }
}, 120000);

async function steps(s: ScenarioSession, count: number, input = idle) {
  for (let i = 0; i < count; i++) await s.step(input);
}
