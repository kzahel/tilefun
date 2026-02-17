import { describe, expect, it } from "vitest";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { moveAndCollide } from "./PlayerMovement.js";
import { createMovementContext, createSurfaceSampler } from "./SimulationEnvironment.js";
import { resolveGroundZForLanding, resolveGroundZForTracking } from "./surfaceHeight.js";

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

function makeWalkableSurfaceProp(wx: number, wy: number, topZ: number): Prop {
  return {
    id: 11,
    type: "platform",
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
      width: 14,
      height: 14,
      zBase: 0,
      zHeight: topZ,
      walkableTop: true,
      passable: true,
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

  it("keeps server/client blocking outcomes aligned for equivalent fixtures", () => {
    const base = createPlayer(100, 100);
    base.id = 1;
    base.wz = 0;
    base.velocity = { vx: 120, vy: 0 };
    const serverMover: Entity = {
      ...base,
      position: { ...base.position },
      velocity: { ...base.velocity! },
    };
    const clientMover: Entity = {
      ...base,
      position: { ...base.position },
      velocity: { ...base.velocity! },
    };

    const blocker = createPlayer(110, 100);
    blocker.id = 2;
    blocker.wz = 0;
    blocker.collider!.clientSolid = true;

    const fixtures = [blocker];
    const queryByOverlap = (aabb: { left: number; top: number; right: number; bottom: number }) =>
      fixtures.filter((entity) =>
        aabbsOverlap(aabb, getEntityAABB(entity.position, entity.collider!)),
      );

    const serverCtx = createMovementContext({
      getCollision: () => 0,
      getHeight: () => 0,
      queryEntities: queryByOverlap,
      queryProps: () => [],
      movingEntity: serverMover,
      excludeIds: new Set([serverMover.id]),
      noclip: false,
    });
    const clientCtx = createMovementContext({
      getCollision: () => 0,
      getHeight: () => 0,
      queryEntities: queryByOverlap,
      queryProps: () => [],
      movingEntity: clientMover,
      excludeIds: new Set([clientMover.id]),
      noclip: false,
      shouldEntityBlock: (other) => other.collider?.clientSolid === true,
    });

    moveAndCollide(serverMover, 1 / 60, serverCtx);
    moveAndCollide(clientMover, 1 / 60, clientCtx);

    expect(serverMover.position.wx).toBe(clientMover.position.wx);
    expect(serverMover.position.wy).toBe(clientMover.position.wy);
    expect(serverMover.position.wx).toBe(100);
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

  it("keeps mixed-surface ground outcomes aligned across adapter query styles", () => {
    const self = createPlayer(100, 100);
    self.id = 1;
    self.wz = 7;

    const walkableProp = makeWalkableSurfaceProp(100, 100, 10);
    const platform = createPlayer(100, 100);
    platform.id = 2;
    platform.wz = 0; // top = 12 from physicalHeight

    const getHeight = (tx: number, ty: number) => (tx === 6 && ty === 6 ? 1 : 0); // terrain Z=8
    const serverSampler = createSurfaceSampler({
      queryEntities: (aabb) =>
        [platform].filter((e) => aabbsOverlap(aabb, getEntityAABB(e.position, e.collider!))),
      queryProps: (aabb) =>
        [walkableProp].filter((p) => aabbsOverlap(aabb, getEntityAABB(p.position, p.collider!))),
    });
    const clientSampler = createSurfaceSampler({
      queryEntities: () => [platform],
      queryProps: () => [walkableProp],
    });

    const serverSurfaces = serverSampler(self);
    const clientSurfaces = clientSampler(self);
    const serverTrackingGround = resolveGroundZForTracking(
      self,
      getHeight,
      serverSurfaces.props,
      serverSurfaces.entities,
    );
    const clientTrackingGround = resolveGroundZForTracking(
      self,
      getHeight,
      clientSurfaces.props,
      clientSurfaces.entities,
    );

    expect(serverTrackingGround).toBe(clientTrackingGround);
    expect(serverTrackingGround).toBe(10); // terrain=8, prop=10, entity top=12 (too high for step-up at wz=7)

    self.wz = 11;
    const serverLandingGround = resolveGroundZForLanding(
      self,
      getHeight,
      serverSurfaces.props,
      serverSurfaces.entities,
      14,
    );
    const clientLandingGround = resolveGroundZForLanding(
      self,
      getHeight,
      clientSurfaces.props,
      clientSurfaces.entities,
      14,
    );

    expect(serverLandingGround).toBe(clientLandingGround);
    expect(serverLandingGround).toBe(12); // landing includes descended-through entity top
  });
});
