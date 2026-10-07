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
it("pins real locations and keeps ordinary generator output separate", () => {
  for (const c of NATURAL_CASES) {
    const r = naturalLandscapeRecipe(c.id, "balanced");
    expect(r.landscape).toBe("balanced");
    expect(r.generation.seed).toBe(c.seed);
  }
  const g = createGenerator(createDescriptor("regional", 2026));
  expect(g.placements(-26, -32, new Set()).placements).toEqual([]);
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

it.each(["lush", "thicket"] as const)(
  "carries a roof passenger through a full %s inter-town route and reload",
  async (profile) => {
    const s = await ScenarioSession.create(naturalLandscapeRecipe("train", profile));
    try {
      await s.command({ kind: "train-position", roof: true });
      let service = [...(s.realm.railway?.services.values() ?? [])][0];
      if (!service) throw new Error("Missing generated railway");
      let arrived = false,
        peakTrees = 0,
        peakThickets = 0;
      const start = s.player.player.position.wx;
      for (let i = 0; i < 1900; i++) {
        await s.step({ dx: 0, dy: 0, jump: false, sprinting: false }, 0.1);
        if (i % 100 === 0) {
          expect(s.player.player.wz).toBe(44);
          peakTrees = Math.max(
            peakTrees,
            s.realm.propManager.props.filter((p) => p.proceduralId?.startsWith("nature:")).length,
          );
          peakThickets = Math.max(
            peakThickets,
            s.realm.propManager.props.filter((p) => p.type.startsWith("pattern:forest-thicket-v1:"))
              .length,
          );
        }
        if (i === 700) {
          await s.reload();
          service = [...(s.realm.railway?.services.values() ?? [])][0];
          if (!service) throw new Error("Missing reloaded railway");
        }
        if (service.record.target === 0 && service.record.dwell > 0) {
          arrived = true;
          break;
        }
      }
      expect(arrived).toBe(true);
      expect(Math.abs(s.player.player.position.wx - start)).toBeGreaterThan(8000);
      expect(peakTrees).toBeGreaterThan(100);
      if (profile === "thicket") expect(peakThickets).toBeGreaterThan(0);
      expect(s.realm.railway?.error).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  30000,
);
