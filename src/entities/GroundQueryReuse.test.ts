import { afterEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { encodeActor } from "../persistence/ActorRecords.js";
import * as surfaceHeight from "../physics/surfaceHeight.js";
import { tickAllAI } from "../server/tickAllAI.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createFrog } from "../wildlife/Frog.js";
import { createRobin } from "../wildlife/Robin.js";
import { getEntityAABB } from "./collision.js";
import type { Entity } from "./Entity.js";
import { EntityManager } from "./EntityManager.js";
import { createPlayer } from "./Player.js";
import type { Prop } from "./Prop.js";
import { PropManager } from "./PropManager.js";

const noCollision = () => 0;
const flatHeight = () => 0;
function body(manager: EntityManager, wx: number, wy: number, wz = 0): Entity {
  const e = createPlayer(wx, wy);
  e.velocity = null;
  e.wz = wz;
  e.collider = { offsetX: 0, offsetY: 0, width: 8, height: 8, physicalHeight: 4 };
  return manager.spawn(e);
}
function platform(wx: number, wy: number, zHeight = 4): Prop {
  return {
    id: 0,
    type: "test-support",
    position: { wx, wy },
    isProp: true,
    sprite: { sheetKey: "", frameCol: 0, frameRow: 0, spriteWidth: 16, spriteHeight: 16 },
    walls: null,
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 16,
      height: 16,
      zHeight,
      walkableTop: true,
      passable: true,
    },
  };
}
afterEach(() => vi.restoreAllMocks());

describe("ground candidate reuse", () => {
  it("queries each exact range once per pass, including negative and spanning footprints", () => {
    const manager = new EntityManager();
    const props = new PropManager();
    body(manager, 40, 40);
    body(manager, 80, 80);
    body(manager, -40, -40);
    body(manager, -80, -80);
    body(manager, 256, 40);
    body(manager, 256, 80);
    const propQuery = vi.spyOn(props, "getPropsInChunkRange");
    const entityQuery = vi.spyOn(manager.spatialHash, "queryRange");
    manager.update(1 / 60, noCollision, [], props, undefined, flatHeight);
    expect(propQuery.mock.calls).toEqual([
      [0, 0, 0, 0],
      [-1, -1, -1, -1],
      [0, 0, 1, 0],
    ]);
    expect(entityQuery.mock.calls).toEqual(propQuery.mock.calls);
    manager.update(1 / 60, noCollision, [], props, undefined, flatHeight);
    expect(propQuery).toHaveBeenCalledTimes(6);
    expect(entityQuery).toHaveBeenCalledTimes(6);
  });

  it("reads earlier support snaps through live references in the same pass", () => {
    const manager = new EntityManager();
    const props = new PropManager();
    // First body establishes the cached list; second snaps up; third stands on it.
    body(manager, 40, 40);
    const support = body(manager, 80, 80);
    const rider = body(manager, 80, 80, 8);
    props.add(platform(80, 80));
    manager.update(1 / 60, noCollision, [], props, undefined, flatHeight);
    expect(support.wz).toBe(4);
    expect(rider.wz).toBe(8);
    expect(rider.groundZ).toBe(8);
  });

  it("starts fresh after terrain/prop edits, support motion, spawn/removal and readiness changes", () => {
    const manager = new EntityManager();
    const props = new PropManager();
    const first = body(manager, 40, 40);
    const second = body(manager, 80, 80);
    let elevation = 0;
    const height = () => elevation;
    const step = () => manager.update(1 / 60, noCollision, [], props, undefined, height);
    step();
    expect(second.groundZ).toBe(0);
    const p = props.add(platform(80, 80));
    step();
    expect(second.groundZ).toBe(4);
    if (p.collider) p.collider.zHeight = 7;
    step();
    expect(second.groundZ).toBe(7);
    props.move(p.id, 140, 80);
    step();
    expect(second.groundZ).toBe(0);
    props.remove(p.id);
    elevation = 1;
    step();
    expect(second.groundZ).toBe(8);
    elevation = 0;
    const support = body(manager, 80, 80);
    const active = new Map([
      [first, 1 / 60],
      [second, 1 / 60],
    ]);
    second.wz = 4;
    manager.update(1 / 60, noCollision, [], props, active, height);
    expect(second.groundZ).toBe(4); // sleeping bodies remain real supports
    support.position.wx = 120;
    manager.spatialHash.update(support);
    step();
    expect(second.groundZ).toBe(0);
    support.position.wx = 80;
    manager.spatialHash.update(support);
    manager.remove(support.id);
    step();
    expect(second.groundZ).toBe(0);
    props.add(platform(80, 80, 4));
    step();
    expect(second.groundZ).toBe(4);
  });

  it("matches fresh per-entity ground queries through live AI, edits, motion, contacts and saved frames", () => {
    const run = (fresh: boolean) => {
      const manager = new EntityManager();
      const props = new PropManager();
      const player = manager.spawn(createPlayer(42, 44));
      const horse = manager.spawn(createFauna("horse", 100, 80));
      for (const e of [
        createFauna("dog", 46, 44),
        createFauna("kangaroo", 74, 74),
        createFrog(112, 36),
        createRobin(72, 40),
        createFauna("dog", 256, 44),
      ])
        manager.spawn(e);
      const sleeping = body(manager, 254, 44, 4);
      const attached = manager.spawn(createPlayer(100, 80));
      attached.parentId = horse.id;
      attached.jumpZ = 18;
      const externalPlayer = createPlayer(-40, -40);
      externalPlayer.id = 999;
      props.add(platform(72, 40));
      for (const e of manager.entities) e.persistentId = `fixture-${e.id}`;
      const resolve = surfaceHeight.resolveGroundZForTracking;
      // Frozen pre-cache query policy: every sample fetches both lists independently.
      const spy = fresh
        ? vi.spyOn(surfaceHeight, "resolveGroundZForTracking").mockImplementation((e, height) => {
            const b = e.collider ? getEntityAABB(e.position, e.collider) : null;
            const minCx = Math.floor((b?.left ?? e.position.wx) / CHUNK_SIZE_PX);
            const maxCx = Math.floor((b?.right ?? e.position.wx) / CHUNK_SIZE_PX);
            const minCy = Math.floor((b?.top ?? e.position.wy) / CHUNK_SIZE_PX);
            const maxCy = Math.floor((b?.bottom ?? e.position.wy) / CHUNK_SIZE_PX);
            return resolve(
              e,
              height,
              props.getPropsInChunkRange(minCx, minCy, maxCx, maxCy),
              manager.spatialHash.queryRange(minCx, minCy, maxCx, maxCy),
            );
          })
        : undefined;
      let rng = 2026;
      const draws: number[] = [];
      const random = () => {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        draws.push(rng);
        return rng / 4294967296;
      };
      const frames = [];
      try {
        for (let step = 0; step < 240; step++) {
          if (step === 30) props.move(1, 90, 80);
          if (step === 60) props.remove(1);
          if (step === 90) props.add(platform(100, 80, 6));
          if (step === 120 && horse.collider) horse.collider.physicalHeight = 16;
          if (step === 150) {
            sleeping.position.wx = 280;
            manager.spatialHash.update(sleeping);
          }
          if (step === 180) manager.remove(sleeping.id);
          const active = new Map(
            manager.entities.filter((e) => e !== sleeping).map((e) => [e, 1 / 60]),
          );
          const height = (tx: number, ty: number) => (tx === 5 && ty >= 4 && step >= 100 ? 1 : 0);
          tickAllAI(
            manager.entities,
            [player.position],
            active,
            random,
            {
              perches: () => [],
              surfaceZ: (p) => height(Math.floor(p.wx / 16), Math.floor(p.wy / 16)) * 8,
              isWater: () => false,
              isDeepWater: () => false,
              canOccupy: () => true,
            },
            step,
          );
          manager.update(
            1 / 60,
            noCollision,
            [player, externalPlayer],
            props,
            active,
            height,
            step % 13 === 0 ? new Set([horse.id]) : undefined,
          );
          frames.push({
            live: structuredClone([...manager.entities, externalPlayer]),
            saved: manager.entities.map((e) => encodeActor(e, manager.byId.get(e.parentId ?? -1))),
            rng,
          });
        }
        if (spy) expect(spy).toHaveBeenCalled();
        return { frames, draws };
      } finally {
        spy?.mockRestore();
      }
    };
    expect(run(false)).toEqual(run(true));
  });
});
