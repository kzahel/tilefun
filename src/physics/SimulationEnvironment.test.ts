import { describe, expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { createMovementContext, createSurfaceSampler } from "./SimulationEnvironment.js";

function makeTestProp(wx: number, wy: number): Prop {
  return {
    id: 10,
    type: "test",
    position: { wx, wy },
    sprite: {
      sheetKey: "test",
      frameCol: 0,
      frameRow: 0,
      spriteWidth: 16,
      spriteHeight: 16,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 12,
      height: 12,
    },
    walls: null,
    isProp: true,
  };
}

describe("createMovementContext", () => {
  it("blocks overlapping solid entities within Z overlap", () => {
    const self = createPlayer(100, 100);
    self.id = 1;
    self.wz = 0;

    const other = createPlayer(100, 100);
    other.id = 2;
    other.wz = 0;

    const aabb = getEntityAABB(self.position, self.collider!);
    const ctx = createMovementContext({
      getCollision: () => 0,
      getHeight: () => 0,
      queryEntities: () => [other],
      queryProps: () => [],
      movingEntity: self,
      excludeIds: new Set([self.id]),
      noclip: false,
    });

    expect(ctx.isEntityBlocked(aabb)).toBe(true);

    // Move blocker far above self so Z ranges no longer overlap.
    other.wz = 100;
    expect(ctx.isEntityBlocked(aabb)).toBe(false);
  });

  it("supports custom blocking policy (clientSolid semantics)", () => {
    const self = createPlayer(100, 100);
    self.id = 1;
    self.wz = 0;

    const other = createPlayer(100, 100);
    other.id = 2;
    other.wz = 0;
    other.collider!.clientSolid = false;

    const aabb = getEntityAABB(self.position, self.collider!);
    const ctx = createMovementContext({
      getCollision: () => 0,
      getHeight: () => 0,
      queryEntities: () => [other],
      queryProps: () => [],
      movingEntity: self,
      excludeIds: new Set([self.id]),
      noclip: false,
      shouldEntityBlock: (e) => e.collider?.clientSolid === true,
    });

    expect(ctx.isEntityBlocked(aabb)).toBe(false);
    other.collider!.clientSolid = true;
    expect(ctx.isEntityBlocked(aabb)).toBe(true);
  });

  it("checks prop collision through queryProps", () => {
    const self = createPlayer(100, 100);
    const prop = makeTestProp(100, 100);
    const aabb = getEntityAABB(self.position, self.collider!);

    const ctx = createMovementContext({
      getCollision: () => 0,
      getHeight: () => 0,
      queryEntities: () => [],
      queryProps: () => [prop],
      movingEntity: self,
      excludeIds: new Set([self.id]),
      noclip: false,
    });

    expect(ctx.isPropBlocked(aabb, 0, 12)).toBe(true);
  });
});

describe("createSurfaceSampler", () => {
  it("returns empty surfaces for entities without colliders", () => {
    const sampler = createSurfaceSampler({
      queryEntities: () => [],
      queryProps: () => [],
    });
    const noCollider: Entity = {
      id: 1,
      type: "test",
      position: { wx: 0, wy: 0 },
      velocity: null,
      sprite: null,
      collider: null,
      wanderAI: null,
    };

    expect(sampler(noCollider)).toEqual({ props: [], entities: [] });
  });

  it("queries props/entities using entity footprint", () => {
    const prop = makeTestProp(100, 100);
    const other = createPlayer(100, 100);
    const self = createPlayer(100, 100);
    const sampler = createSurfaceSampler({
      queryEntities: () => [other],
      queryProps: () => [prop],
    });

    const surfaces = sampler(self);
    expect(surfaces.props).toEqual([prop]);
    expect(surfaces.entities).toEqual([other]);
  });
});

