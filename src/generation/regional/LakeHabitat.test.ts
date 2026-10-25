import { expect, it } from "vitest";
import { required } from "../../art/ArtCatalog.js";
import { TerrainId } from "../../autotile/TerrainId.js";
import { naturalLandscapeRecipe } from "../../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../../scenarios/ScenarioSession.js";
import { FAUNA_PROFILES, faunaType } from "../../wildlife/Fauna.js";
import { predatorProfile, predatorType } from "../../wildlife/Predator.js";
import { TileId } from "../../world/TileRegistry.js";
import { World } from "../../world/World.js";
import { createDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { NaturalLandscape } from "./NaturalLandscape.js";
import { regionalWorld } from "./WorldDescriptor.js";

it("gives large lakes broad deep basins, shallow shores and naturally seeded sharks and giants", () => {
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  const generator = createGenerator(createDescriptor("regional", 2026));
  const world = new World(generator.terrain);
  const giants = (["whale-shark", "humpback-whale", "blue-whale"] as const).map(faunaType);
  const seenGiants = new Set<string>();
  for (const [cx, cy] of [
    [1, -2],
    [2, -1],
    [3, -3],
    [3, 2],
  ] as const) {
    const lake = required(n.lake(cx, cy));
    let water = 0,
      deep = 0;
    for (let y = Math.floor(lake.y - lake.ry * 1.1); y <= lake.y + lake.ry * 1.1; y += 2)
      for (let x = Math.floor(lake.x - lake.rx * 1.1); x <= lake.x + lake.rx * 1.1; x += 2) {
        const terrain = n.terrain(x + 0.5, y + 0.5);
        if (terrain === TerrainId.DeepWater || terrain === TerrainId.ShallowWater) water++;
        if (terrain === TerrainId.DeepWater) deep++;
      }
    expect(deep / water, lake.id).toBeGreaterThan(0.78);
    expect(n.terrain(lake.x, lake.y - lake.ry + 1)).toBe(TerrainId.ShallowWater);
    expect(n.terrain(lake.x, lake.y - lake.ry - 1)).toBe(TerrainId.Sand);
    // This used to be shallow. Verify the realized game terrain, including
    // negative coordinates, rather than only the planner's habitat answer.
    expect(world.getTerrain(Math.floor(lake.x), Math.floor(lake.y + lake.ry * 0.8))).toBe(
      TileId.DeepWater,
    );
    const animals = Array.from(
      { length: 49 },
      (_, i) =>
        [
          Math.floor(lake.x / 16) - 3 + (i % 7),
          Math.floor(lake.y / 16) - 3 + Math.floor(i / 7),
        ] as const,
    )
      .flatMap(([x, y]) => required(generator.actors)(x, y))
      .filter((a) => a.featureId.startsWith(`wildlife:lake:2026:${lake.id}:`));
    expect(
      animals.some((a) =>
        [predatorType("shark"), predatorType("hammerhead-shark")].includes(a.type),
      ),
      lake.id,
    ).toBe(true);
    const giant = required(animals.find((a) => giants.includes(a.type)));
    seenGiants.add(giant.type);
    expect(new Set(animals.map((a) => a.featureId)).size).toBe(animals.length);
    for (const a of animals) {
      const profile = required(
        predatorProfile(a.type) ?? FAUNA_PROFILES.find((p) => faunaType(p.species) === a.type),
      );
      for (
        let ty = Math.floor((a.wy - profile.body[1] / 2) / 16);
        ty <= Math.floor((a.wy + profile.body[1] / 2 - 0.001) / 16);
        ty++
      )
        for (
          let tx = Math.floor((a.wx - profile.body[0] / 2) / 16);
          tx <= Math.floor((a.wx + profile.body[0] / 2 - 0.001) / 16);
          tx++
        )
          expect(world.getTerrain(tx, ty), a.featureId).toBe(TileId.DeepWater);
    }
  }
  expect(seenGiants.size).toBeGreaterThan(1);
});

it("admits lake wildlife and editor sharks/whales in the expanded basin and saves them normally", async () => {
  const lake = required(new NaturalLandscape(regionalWorld(2026), "thicket").lake(1, -2));
  const recipe = naturalLandscapeRecipe("lake", "thicket");
  recipe.player.position = { wx: lake.x * 16, wy: lake.y * 16 };
  const s = await ScenarioSession.create(recipe);
  try {
    const cx = Math.floor(lake.x / 16),
      cy = Math.floor(lake.y / 16);
    await s.ready({ minCx: cx - 3, maxCx: cx + 3, minCy: cy - 3, maxCy: cy + 3 });
    const natural = s.realm.entityManager.entities.filter((e) =>
      e.proceduralId?.startsWith(`wildlife:lake:2026:${lake.id}:`),
    );
    const shark = required(
      natural.find((e) =>
        [predatorType("shark"), predatorType("hammerhead-shark")].includes(e.type),
      ),
    );
    const giant = required(
      natural.find((e) =>
        (["whale-shark", "humpback-whale", "blue-whale"] as const).some(
          (p) => faunaType(p) === e.type,
        ),
      ),
    );
    const savedIds = [shark.persistentId, giant.persistentId];
    for (const [type, x, y] of [
      [predatorType("shark"), lake.x, lake.y + lake.ry * 0.8],
      [faunaType("blue-whale"), lake.x + lake.rx * 0.15, lake.y + lake.ry * 0.75],
    ] as const) {
      const known = new Set(s.realm.entityManager.entities.map((e) => e.id));
      await s.command({
        kind: "place-entity",
        entityType: type,
        position: { wx: x * 16, wy: y * 16 },
      });
      const placed = required(s.realm.entityManager.entities.find((e) => !known.has(e.id)));
      expect(placed.type).toBe(type);
      expect(placed.proceduralId).toBeUndefined();
      savedIds.push(placed.persistentId);
    }
    await s.reload();
    for (const id of savedIds) {
      expect(id).toBeDefined();
      expect(s.realm.entityManager.entities.filter((e) => e.persistentId === id)).toHaveLength(1);
    }
  } finally {
    await s.close();
  }
});
