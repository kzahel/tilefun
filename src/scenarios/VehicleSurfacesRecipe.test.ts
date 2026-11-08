import { afterEach, expect, it, vi } from "vitest";
import { RecipeWorldClient } from "../client/RecipeWorldClient.js";
import { groundMaterialAt } from "../physics/GroundMaterial.js";
import { inProcessWorker } from "../server/testing/InProcessWorker.js";
import { required } from "../shared/required.js";
import { SURFACE_SPEED } from "../traffic/VehicleHandling.js";
import { RecipeWorldAuthority } from "./RecipeWorldAuthority.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { vehicleSurfacesRecipe } from "./VehicleSurfacesRecipe.js";

/** Field centres (world px) and the surface each must drive as. */
const FIELDS = [
  { wx: -200, wy: -136, material: "sand" },
  { wx: 200, wy: -136, material: "dirt" },
  { wx: -200, wy: 136, material: "dirt" },
  { wx: 300, wy: 136, material: "grass" },
  { wx: 0, wy: 0, material: "paved" },
] as const;

const clients: RecipeWorldClient[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.dispose();
});

it("paints the surface course so authority and the predicting client read the same surfaces", async () => {
  const recipe = vehicleSurfacesRecipe();
  const s = await ScenarioSession.create(recipe);
  try {
    for (const f of FIELDS)
      expect(groundMaterialAt(s.realm.world, f.wx, f.wy, 0), `${f.wx},${f.wy}`).toBe(f.material);
  } finally {
    await s.close();
  }
  const worker = inProcessWorker((transport) => new RecipeWorldAuthority(transport));
  const client = new RecipeWorldClient(recipe, { worker: () => worker.endpoint });
  clients.push(client);
  await client.ready;
  // Prediction geometry reads this replicated world through the same lookup.
  const { world } = client.replica;
  await vi.waitFor(() => {
    client.update();
    for (const f of FIELDS) expect(groundMaterialAt(world, f.wx, f.wy, 0)).toBe(f.material);
  });
});

/** Board the parked compact and hold one direction for two seconds; returns its final state. */
async function driveCompact(dy: number) {
  const s = await ScenarioSession.create(vehicleSurfacesRecipe());
  try {
    const car = required(s.realm.entityManager.byId.get(required(s.handles["compact-1"])));
    s.player.player.position = { wx: car.position.wx, wy: car.position.wy + 24 };
    s.realm.vehicles.enter(s.player, car.id);
    for (let i = 0; i < 120; i++) await s.step({ dx: 0, dy, jump: false, sprinting: false });
    return {
      material: groundMaterialAt(s.realm.world, car.position.wx, car.position.wy, 0),
      speed: Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0),
    };
  } finally {
    await s.close();
  }
}

it("slows an ordinary driven car in the sand field but not on dirt", async () => {
  const sand = await driveCompact(-1),
    dirt = await driveCompact(1);
  expect(sand.material).toBe("sand");
  expect(dirt.material).toBe("dirt");
  // The compact's 112px/s top speed; road tires keep 70% in sand.
  expect(sand.speed).toBeGreaterThan(SURFACE_SPEED.road.sand * 112 - 10);
  expect(sand.speed).toBeLessThan(SURFACE_SPEED.road.sand * 112 + 4);
  // Dirt costs grip, not speed.
  expect(dirt.speed).toBeGreaterThan(105);
});
