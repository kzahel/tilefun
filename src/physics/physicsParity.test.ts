import { describe, expect, it } from "vitest";
import { ELEVATION_PX, STEP_UP_THRESHOLD } from "../config/constants.js";
import type { AABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import type { MovementContext } from "./MovementContext.js";
import {
  applyMountInput,
  getMovementPhysicsParams,
  initiateJump,
  moveAndCollide,
  setGravityScale,
  tickJumpGravity,
} from "./PlayerMovement.js";
import { applyGroundTracking, getEffectiveGroundZ } from "./surfaceHeight.js";

/** Flat terrain getHeight — all tiles at height 0. */
const flatHeight = () => 0;

/** Create a MovementContext with no obstacles and flat terrain. */
function openContext(noclip = false): MovementContext {
  return {
    getCollision: () => 0,
    getHeight: flatHeight,
    isEntityBlocked: () => false,
    isPropBlocked: () => false,
    noclip,
  };
}

/** Create a MovementContext with a solid wall at the given tile. */
function wallContext(wallTx: number, wallTy: number): MovementContext {
  return {
    getCollision: (tx, ty) => (tx === wallTx && ty === wallTy ? 1 : 0), // CollisionFlag.Solid = 1
    getHeight: flatHeight,
    isEntityBlocked: () => false,
    isPropBlocked: () => false,
    noclip: false,
  };
}

/** Create a MovementContext with a blocking entity at the given AABB. */
function entityBlockContext(blockAABB: AABB): MovementContext {
  return {
    getCollision: () => 0,
    getHeight: flatHeight,
    isEntityBlocked: (aabb) =>
      aabb.left < blockAABB.right &&
      aabb.right > blockAABB.left &&
      aabb.top < blockAABB.bottom &&
      aabb.bottom > blockAABB.top,
    isPropBlocked: () => false,
    noclip: false,
  };
}

/** Create a MovementContext with specific tile heights. */
function elevatedContext(heights: Record<string, number>): MovementContext {
  return {
    getCollision: () => 0,
    getHeight: (tx, ty) => heights[`${tx},${ty}`] ?? 0,
    isEntityBlocked: () => false,
    isPropBlocked: () => false,
    noclip: false,
  };
}

describe("moveAndCollide", () => {
  it("moves entity freely in open world", () => {
    const player = createPlayer(100, 100);
    player.velocity = { vx: 64, vy: 0 };
    const ctx = openContext();

    moveAndCollide(player, 1 / 60, ctx);

    expect(player.position.wx).toBeCloseTo(100 + 64 / 60, 3);
    expect(player.position.wy).toBe(100);
  });

  it("blocks X movement into a wall, allows Y", () => {
    // Player collider: width=10, offsetX=0, height=6, offsetY=-3.
    // Player at (104, 96): AABB = [99,109] x [87,93] → covers tile (6,5) only.
    // Wall at tile (7, 5): x=[112,128), y=[80,96).
    // Moving right with large vx pushes AABB right edge past 112 → blocked.
    // Y movement stays within tile column 6 → not blocked.
    const player = createPlayer(104, 96);
    player.velocity = { vx: 1000, vy: -32 };
    const ctx = wallContext(7, 5);

    moveAndCollide(player, 1 / 60, ctx);

    // X blocked (would enter tile 7), Y free (stays in tile column 6)
    expect(player.position.wx).toBe(104);
    expect(player.position.wy).toBeCloseTo(96 - 32 / 60, 3);
  });

  it("skips collision in noclip mode", () => {
    const player = createPlayer(100, 100);
    player.velocity = { vx: 64, vy: 0 };
    const ctx = wallContext(7, 6);
    ctx.noclip = true;

    moveAndCollide(player, 1 / 60, ctx);

    // Should move freely despite wall
    expect(player.position.wx).toBeCloseTo(100 + 64 / 60, 3);
  });

  it("does nothing without velocity", () => {
    const player = createPlayer(100, 100);
    player.velocity = null;
    const ctx = openContext();

    moveAndCollide(player, 1 / 60, ctx);

    expect(player.position.wx).toBe(100);
    expect(player.position.wy).toBe(100);
  });

  it("blocks movement into entity AABB", () => {
    const player = createPlayer(100, 100);
    player.velocity = { vx: 64, vy: 0 };
    // Blocking entity to the right
    const ctx = entityBlockContext({ left: 105, top: 90, right: 120, bottom: 101 });

    moveAndCollide(player, 1 / 60, ctx);

    // X should be blocked by entity
    expect(player.position.wx).toBe(100);
  });

  it("blocks movement into elevated terrain using wz", () => {
    const player = createPlayer(100, 100);
    player.wz = 0; // At ground level
    player.velocity = { vx: 1000, vy: 0 };
    // Tile (7, 6) is at height 2 → 16px surface Z
    const ctx = elevatedContext({ "7,6": 2 });

    moveAndCollide(player, 1 / 60, ctx);

    // Blocked — surface Z (16) > entity wz (0)
    expect(player.position.wx).toBe(100);
  });

  it("allows movement on same-elevation terrain", () => {
    const player = createPlayer(100, 100);
    player.wz = 2 * ELEVATION_PX; // At elevation 2
    player.velocity = { vx: 64, vy: 0 };
    // All tiles at elevation 2
    const ctx = elevatedContext({ "6,6": 2, "7,6": 2 });

    moveAndCollide(player, 1 / 60, ctx);

    // Should move freely — same elevation
    expect(player.position.wx).toBeCloseTo(100 + 64 / 60, 3);
  });

  it("allows movement when entity wz is above terrain (jumping over)", () => {
    const player = createPlayer(100, 100);
    player.wz = 20; // High enough to clear elevation 2 (16px)
    player.velocity = { vx: 1000, vy: 0 };
    const ctx = elevatedContext({ "7,6": 2 });

    moveAndCollide(player, 1 / 60, ctx);

    // Allowed — entity wz (20) > surface Z (16)
    expect(player.position.wx).toBeGreaterThan(100);
  });
});

describe("initiateJump + tickJumpGravity", () => {
  it("sets jump fields on ground entity", () => {
    const player = createPlayer(100, 100);
    player.wz = 0;

    initiateJump(player, getMovementPhysicsParams());

    expect(player.jumpZ).toBe(0.01);
    expect(player.jumpVZ).toBeDefined();
    expect(player.jumpVZ).toBeGreaterThan(0);
    expect(player.wz).toBe(0.01);
  });

  it("does not re-initiate when already jumping", () => {
    const player = createPlayer(100, 100);
    player.jumpZ = 5;
    player.jumpVZ = 50;
    player.wz = 5;

    initiateJump(player, getMovementPhysicsParams());

    // Should not reset — jumpVZ is defined
    expect(player.jumpZ).toBe(5);
    expect(player.jumpVZ).toBe(50);
    expect(player.wz).toBe(5);
  });

  it("applies gravity and lands on flat terrain", () => {
    const player = createPlayer(100, 100);
    player.wz = 0;
    initiateJump(player, getMovementPhysicsParams());

    // Tick until landed
    let landed = false;
    for (let i = 0; i < 600; i++) {
      landed = tickJumpGravity(player, 1 / 60, flatHeight, getMovementPhysicsParams());
      if (landed) break;
    }

    expect(landed).toBe(true);
    expect(player.jumpZ).toBeUndefined();
    expect(player.jumpVZ).toBeUndefined();
    expect(player.wz).toBe(0); // Landed at ground level
  });

  it("lands on elevated terrain at correct wz", () => {
    const player = createPlayer(100, 100);
    // Start at elevation 1 (8px)
    const getHeight = () => 1;
    player.wz = ELEVATION_PX;
    initiateJump(player, getMovementPhysicsParams());

    let landed = false;
    for (let i = 0; i < 600; i++) {
      landed = tickJumpGravity(player, 1 / 60, getHeight, getMovementPhysicsParams());
      if (landed) break;
    }

    expect(landed).toBe(true);
    expect(player.wz).toBe(ELEVATION_PX); // Landed at elevation 1
    expect(player.jumpZ).toBeUndefined();
  });

  it("lands on the elevated edge surface when AABB still overlaps it", () => {
    const player = createPlayer(15, 12);
    const getHeight = (tx: number, ty: number) => (tx === 1 && ty === 0 ? 2 : 0);
    player.wz = 2 * ELEVATION_PX;
    initiateJump(player, getMovementPhysicsParams());

    let landed = false;
    for (let i = 0; i < 600; i++) {
      landed = tickJumpGravity(player, 1 / 60, getHeight, getMovementPhysicsParams());
      if (landed) break;
    }

    expect(landed).toBe(true);
    expect(player.wz).toBe(2 * ELEVATION_PX);
    expect(player.jumpZ).toBeUndefined();
  });

  it("tracks wz during jump arc", () => {
    const player = createPlayer(100, 100);
    player.wz = 0;
    initiateJump(player, getMovementPhysicsParams());

    // After a few ticks, wz should be above ground
    for (let i = 0; i < 5; i++) {
      tickJumpGravity(player, 1 / 60, flatHeight, getMovementPhysicsParams());
    }

    expect(player.wz).toBeGreaterThan(0);
    expect(player.jumpZ).toBeGreaterThan(0);
    expect(player.jumpZ).toBe(player.wz); // On flat terrain, jumpZ === wz
  });

  it("lower gravity produces higher jumps", () => {
    // Normal gravity
    setGravityScale(1);
    const normal = createPlayer(100, 100);
    normal.wz = 0;
    initiateJump(normal, getMovementPhysicsParams());
    let normalPeak = 0;
    for (let i = 0; i < 600; i++) {
      if (normal.wz !== undefined && normal.wz > normalPeak) normalPeak = normal.wz;
      if (tickJumpGravity(normal, 1 / 60, flatHeight, getMovementPhysicsParams())) break;
    }

    // Half gravity
    setGravityScale(0.5);
    const moon = createPlayer(100, 100);
    moon.wz = 0;
    initiateJump(moon, getMovementPhysicsParams());
    let moonPeak = 0;
    for (let i = 0; i < 600; i++) {
      if (moon.wz !== undefined && moon.wz > moonPeak) moonPeak = moon.wz;
      if (tickJumpGravity(moon, 1 / 60, flatHeight, getMovementPhysicsParams())) break;
    }

    // Reset
    setGravityScale(1);

    expect(moonPeak).toBeGreaterThan(normalPeak * 1.5);
  });
});

describe("applyMountInput", () => {
  it("sets mount velocity from input", () => {
    const mount = createPlayer(100, 100);
    mount.wanderAI = {
      state: "ridden",
      timer: 0,
      dirX: 0,
      dirY: 0,
      idleMin: 1,
      idleMax: 2,
      walkMin: 1,
      walkMax: 2,
      speed: 32,
      directional: true,
      rideSpeed: 80,
    };
    mount.velocity = { vx: 0, vy: 0 };

    applyMountInput(mount, { dx: 1, dy: 0, sprinting: false });

    expect(mount.velocity.vx).toBe(80);
    expect(mount.velocity.vy).toBe(0);
  });

  it("syncs rider direction to mount", () => {
    const mount = createPlayer(100, 100);
    mount.wanderAI = {
      state: "ridden",
      timer: 0,
      dirX: 0,
      dirY: 0,
      idleMin: 1,
      idleMax: 2,
      walkMin: 1,
      walkMax: 2,
      speed: 32,
      directional: true,
      rideSpeed: 80,
    };
    mount.velocity = { vx: 0, vy: 0 };
    const rider = createPlayer(100, 100);

    applyMountInput(mount, { dx: 1, dy: 0, sprinting: false }, rider);

    expect(rider.sprite?.direction).toBe(mount.sprite?.direction);
  });
});

describe("server/client context parity", () => {
  it("same shared function produces identical results with equivalent contexts", () => {
    const serverPlayer = createPlayer(100, 100);
    const clientPlayer = createPlayer(100, 100);

    const serverCtx = wallContext(7, 6);
    const clientCtx = wallContext(7, 6);

    const inputs = [
      { vx: 64, vy: 0 },
      { vx: 64, vy: -32 },
      { vx: 0, vy: 64 },
      { vx: -32, vy: -32 },
    ];
    const dt = 1 / 60;

    for (const input of inputs) {
      serverPlayer.velocity = { ...input };
      clientPlayer.velocity = { ...input };

      moveAndCollide(serverPlayer, dt, serverCtx);
      moveAndCollide(clientPlayer, dt, clientCtx);

      expect(serverPlayer.position.wx).toBe(clientPlayer.position.wx);
      expect(serverPlayer.position.wy).toBe(clientPlayer.position.wy);
    }
  });

  it("jump trajectory matches between server and client", () => {
    const serverPlayer = createPlayer(100, 100);
    const clientPlayer = createPlayer(100, 100);
    serverPlayer.wz = 0;
    clientPlayer.wz = 0;

    initiateJump(serverPlayer, getMovementPhysicsParams());
    initiateJump(clientPlayer, getMovementPhysicsParams());

    const dt = 1 / 60;
    for (let i = 0; i < 120; i++) {
      const serverLanded = tickJumpGravity(
        serverPlayer,
        dt,
        flatHeight,
        getMovementPhysicsParams(),
      );
      const clientLanded = tickJumpGravity(
        clientPlayer,
        dt,
        flatHeight,
        getMovementPhysicsParams(),
      );

      expect(serverPlayer.wz).toBe(clientPlayer.wz);
      expect(serverPlayer.jumpZ).toBe(clientPlayer.jumpZ);
      expect(serverPlayer.jumpVZ).toBe(clientPlayer.jumpVZ);
      expect(serverLanded).toBe(clientLanded);

      if (serverLanded) break;
    }
  });

  it("elevation blocking parity between server and client contexts", () => {
    const serverPlayer = createPlayer(100, 100);
    const clientPlayer = createPlayer(100, 100);
    serverPlayer.wz = 0;
    clientPlayer.wz = 0;

    // Both see an elevated tile at (7, 6) — height 2
    const serverCtx = elevatedContext({ "7,6": 2 });
    const clientCtx = elevatedContext({ "7,6": 2 });

    serverPlayer.velocity = { vx: 1000, vy: 0 };
    clientPlayer.velocity = { vx: 1000, vy: 0 };

    moveAndCollide(serverPlayer, 1 / 60, serverCtx);
    moveAndCollide(clientPlayer, 1 / 60, clientCtx);

    // Both should be blocked
    expect(serverPlayer.position.wx).toBe(clientPlayer.position.wx);
    expect(serverPlayer.position.wx).toBe(100);
  });
});

describe("mount ground tracking", () => {
  /** Create a walkable prop (like a seesaw step) at a given position with a walkable surface. */
  function makeWalkableProp(wx: number, wy: number, topZ: number): Prop {
    return {
      id: 100,
      type: "test-step",
      position: { wx, wy },
      sprite: { sheetKey: "test", frameCol: 0, frameRow: 0, spriteWidth: 16, spriteHeight: 16 },
      collider: {
        offsetX: 0,
        offsetY: 0,
        width: 32,
        height: 32,
        zBase: 0,
        zHeight: topZ,
        walkableTop: true,
        passable: true,
      },
      walls: null,
      isProp: true,
    };
  }

  it("getEffectiveGroundZ detects walkable prop surfaces", () => {
    const mount = createPlayer(100, 100);
    mount.wz = 0;

    const prop = makeWalkableProp(100, 100, STEP_UP_THRESHOLD);
    const groundZ = getEffectiveGroundZ(mount, flatHeight, [prop], []);

    expect(groundZ).toBe(STEP_UP_THRESHOLD);
  });

  it("applyGroundTracking snaps mount wz to walkable surface", () => {
    const mount = createPlayer(100, 100);
    mount.wz = 0;

    const groundZ = STEP_UP_THRESHOLD;
    applyGroundTracking(mount, groundZ, false);

    expect(mount.wz).toBe(STEP_UP_THRESHOLD);
    expect(mount.groundZ).toBe(STEP_UP_THRESHOLD);
  });

  it("mount + rider wz stays in sync across step-ups", () => {
    const mount = createPlayer(100, 100);
    mount.wz = 0;
    mount.groundZ = 0;

    const rider = createPlayer(100, 100);
    rider.parentId = mount.id;
    rider.jumpZ = 10; // ride offset
    rider.wz = 10; // initially at mount.wz + jumpZ

    // Simulate mount walking onto a step
    const stepZ = STEP_UP_THRESHOLD;
    applyGroundTracking(mount, stepZ, false);

    // Derive rider wz from mount (same as resolveParentedPositions)
    if (mount.wz !== undefined && rider.jumpZ !== undefined) {
      rider.wz = mount.wz + rider.jumpZ;
    }

    expect(mount.wz).toBe(stepZ);
    expect(rider.wz).toBe(stepZ + 10);
  });

  it("mount steps up progressively through staircase", () => {
    const mount = createPlayer(100, 100);
    mount.wz = 0;

    // Simulate walking up 3 steps, each STEP_UP_THRESHOLD high
    for (let step = 1; step <= 3; step++) {
      const groundZ = step * STEP_UP_THRESHOLD;
      applyGroundTracking(mount, groundZ, false);
      expect(mount.wz).toBe(groundZ);
    }
  });

  it("mount snaps down when walking off a step (canFall=false)", () => {
    const mount = createPlayer(100, 100);
    mount.wz = STEP_UP_THRESHOLD * 2;

    // Walk off to flat ground
    applyGroundTracking(mount, 0, false);

    // NPC mount snaps down (canFall=false means instant snap, not fall)
    expect(mount.wz).toBe(0);
  });

  it("getEffectiveGroundZ uses AABB-max for terrain under mount", () => {
    const mount = createPlayer(100, 100);
    mount.wz = 0;
    // Mount straddles two tiles — one flat, one at elevation 1
    const getHeight = (tx: number, ty: number) => (tx === 6 && ty === 6 ? 1 : 0);

    const groundZ = getEffectiveGroundZ(mount, getHeight, [], []);

    // Should use the max elevation under the AABB
    expect(groundZ).toBe(ELEVATION_PX);
  });
});
