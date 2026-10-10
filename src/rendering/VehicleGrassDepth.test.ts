import { describe, expect, it } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { Direction } from "../entities/Entity.js";
import { createProp } from "../entities/PropFactories.js";
import { createVehicle, VEHICLE_MODELS } from "../traffic/Vehicle.js";
import { Chunk } from "../world/Chunk.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { SceneFrame } from "./SceneFrame.js";
import type { TerrainPresentation } from "./TerrainPresentation.js";

const chunk = new Chunk();
chunk.blendBase.fill(TerrainId.Grass);
chunk.autotileComputed = true;
const world = { getChunkIfLoaded: () => chunk, getHeightAt: () => 0, getRoadAt: () => 0 };
const terrain = { collectElevationItems: () => [] } as unknown as TerrainPresentation;
const camera = new Camera();
camera.setViewport(1200, 900);
camera.snapTo(128, 128);
const visible = { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 };

describe("grass stays under every vehicle", () => {
  it.each(VEHICLE_MODELS)(
    "orders all four native %s views using their interpolated sprite bounds",
    (model) => {
      const frame = new SceneFrame();
      for (const direction of [Direction.Down, Direction.Up, Direction.Left, Direction.Right]) {
        const car = createVehicle(model, 128, 128, direction);
        car.prevPosition = { wx: 108, wy: 148 };
        for (const alpha of [0, 0.5, 1]) {
          const items = collectScene(
            [car],
            [],
            world,
            camera,
            visible,
            alpha,
            terrain,
            [],
            true,
            undefined,
            undefined,
            frame,
          );
          const body = requiredSprite(items);
          const bottom = body.wy - body.zOffset + body.drawOffsetY;
          const overlapping = items.filter(
            (i) =>
              i.kind === "grass" &&
              i.wx >= body.wx - body.spriteWidth / 2 &&
              i.wx <= body.wx + body.spriteWidth / 2 &&
              i.wy >= bottom - body.spriteHeight &&
              i.wy <= bottom + 7,
          );
          expect(overlapping.length).toBeGreaterThan(0);
          for (const blade of overlapping) expect(blade.sortKey).toBeLessThan(body.sortKey);
          const distant = items.filter((i) => i.kind === "grass" && i.wx > 240);
          for (const blade of distant) expect(blade.sortKey).toBe(blade.wy);
        }
      }
    },
  );
  it.each(["prop-city-street-v1-car-east", "prop-city-commercial-v1-car-west"])(
    "also covers parked %s",
    (type) => {
      const items = collectScene(
        [],
        [createProp(type, 128, 128)],
        world,
        camera,
        visible,
        1,
        terrain,
        [],
        true,
      );
      const body = requiredSprite(items);
      const blades = items.filter(
        (i) =>
          i.kind === "grass" &&
          Math.abs(i.wx - body.wx) < body.spriteWidth / 2 &&
          i.wy > body.wy - body.spriteHeight &&
          i.wy < body.wy + 7,
      );
      expect(blades.length).toBeGreaterThan(0);
      for (const blade of blades) expect(blade.sortKey).toBeLessThan(body.sortKey);
    },
  );
});

function requiredSprite(items: ReturnType<typeof collectScene>) {
  const body = items.find((i) => i.kind === "sprite");
  if (body?.kind !== "sprite") throw new Error("Missing vehicle sprite");
  return body;
}
