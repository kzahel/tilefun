import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { collectWorldSprites } from "./collectScene.js";
import type { SceneItem, SpriteItem } from "./SceneItem.js";

it("keeps a roof rider's shadow on its roof without surface queries", () => {
  const car = createVehicle("compact-1", 200, 150);
  car.id = 1;
  car.wz = 0;
  const rider = createPlayer(200, 150);
  rider.id = 2;
  rider.wz = car.collider?.physicalHeight ?? 24;
  const world = { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 };
  const items: SceneItem[] = [];
  collectWorldSprites({
    entities: [car, rider],
    props: [],
    world,
    alpha: 1,
    cull: { left: -10000, right: 10000, top: -10000, bottom: 10000 },
    items,
    depthShadows: true,
  });
  const item = items.find(
    (i): i is SpriteItem => i.kind === "sprite" && i.gpuShadow?.mask === "oval",
  );
  expect(item?.gpuShadow?.plane[2]).toBeGreaterThan(rider.wz);
});
