import { expect, it } from "vitest";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { NATURAL_CASES, naturalLandscapeRecipe } from "./NaturalLandscapeRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

it("runs forest movement and persists tree deletion and movement through reload", async () => {
  const recipe = naturalLandscapeRecipe("forest", "balanced"),
    s = await ScenarioSession.create(recipe);
  try {
    const trees = s.realm.propManager.props.filter(
      (p) =>
        p.proceduralId?.startsWith("nature:") &&
        Math.hypot(
          p.position.wx - s.player.player.position.wx,
          p.position.wy - s.player.player.position.wy,
        ) < 500,
    );
    expect(trees.length).toBeGreaterThan(50);
    const removed = trees[0],
      moved = trees[1];
    if (!removed || !moved) throw new Error("Missing trees");
    s.realm.propManager.remove(removed.id);
    s.realm.propManager.move(moved.id, moved.position.wx + 24, moved.position.wy + 24);
    const position = { ...moved.position };
    const start = { ...s.player.player.position };
    for (let i = 0; i < 20; i++) await s.step({ dx: 1, dy: 0, jump: false, sprinting: false });
    expect(s.player.player.position.wx).toBeGreaterThan(start.wx + 10);
    await s.reload();
    expect(s.realm.propManager.props.some((p) => p.proceduralId === removed.proceduralId)).toBe(
      false,
    );
    expect(
      s.realm.propManager.props.find((p) => p.proceduralId === moved.proceduralId)?.position,
    ).toEqual(position);
    expect(
      s.realm.propManager.props.filter((p) => p.proceduralId?.startsWith("nature:")).length,
    ).toBeGreaterThan(50);
  } finally {
    await s.close();
  }
});
it.each(NATURAL_CASES)("$id keeps its explicit generation and landscape profile", (c) => {
  const r = naturalLandscapeRecipe(c.id, "balanced");
  if (r.generation.type === "regional") expect(r.landscape).toBe("balanced");
  else {
    expect(r.generation.type).toBe("flat");
    expect(r.landscape).toBeUndefined();
    if (c.id.startsWith("behavior-"))
      expect(r.actors?.some((e) => e.fauna || e.rabbit || e.robin || e.deer)).toBe(true);
    else expect(r.actors?.some((e) => e.predator)).toBe(true);
  }
  expect(r.generation.seed).toBe(c.seed);
});
it("retains native placements at the pinned forest sample", () => {
  const g = createGenerator(createDescriptor("regional", 2026));
  expect(g.placements(-26, -32, new Set()).placements.length).toBeGreaterThan(0);
});

it.each([
  [1, -1, -4],
  [2, -2, -5],
  [3, 1, -5],
] as const)(
  "forest kit %s blocks walking/jumping at its visible front and persists deletion",
  async (kit, cx, cy) => {
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    const row = n.forest(cx, cy).at(-1);
    if (!row) throw new Error("Missing thicket");
    const s = await ScenarioSession.create(naturalLandscapeRecipe(`thicket-${kit}`, "thicket"));
    try {
      await s.command({ kind: "teleport", position: { wx: row.wx + 8, wy: row.wy + 56 } });
      for (let i = 0; i < 180; i++)
        await s.step({ dx: 0, dy: -1, jump: i % 45 === 0, sprinting: false });
      expect(s.player.player.position.wy).toBeGreaterThanOrEqual(row.wy);
      expect(s.player.player.position.wy).toBeLessThan(row.wy + 40);
      const p = s.realm.propManager.props.find((p) => p.proceduralId === row.featureId);
      if (!p) throw new Error("Missing procedural thicket row");
      s.realm.propManager.remove(p.id);
      await s.reload();
      expect(s.realm.propManager.props.some((p) => p.proceduralId === row.featureId)).toBe(false);
      for (let i = 0; i < 50; i++) await s.step({ dx: 0, dy: -1, jump: false, sprinting: false });
      expect(s.player.player.position.wy).toBeLessThan(row.wy - 16);
    } finally {
      await s.close();
    }
  },
  20000,
);

it("keeps the pond arrival dry and computes authoritative shore blends", async () => {
  const recipe = naturalLandscapeRecipe("pond", "lush");
  const s = await ScenarioSession.create(recipe);
  try {
    const p = s.player.player.position;
    expect(s.realm.world.getTerrain(Math.floor(p.wx / 16), Math.floor(p.wy / 16))).toBe(1);
    const chunk = s.realm.world.getChunkIfLoaded(Math.floor(p.wx / 256), Math.floor(p.wy / 256));
    expect(chunk?.subgrid.some((v) => v === 4)).toBe(true);
    for (let i = 0; i < 30; i++) await s.step({ dx: 0, dy: 0, jump: false, sprinting: false });
    expect(chunk?.autotileComputed).toBe(true);
    expect(chunk?.blendBase.some((v) => v === 4)).toBe(true);
  } finally {
    await s.close();
  }
});
