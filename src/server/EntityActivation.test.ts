import { describe, expect, it, vi } from "vitest";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { createChicken } from "../entities/Chicken.js";
import { createPlayer } from "../entities/Player.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { PlayerSession } from "./PlayerSession.js";
import { Realm } from "./Realm.js";

const dt = 1 / 60;

function fixture() {
  const realm = new Realm([]);
  vi.spyOn(realm.world, "getCollisionIfLoaded").mockReturnValue(CollisionFlag.None);
  vi.spyOn(realm.world, "getHeightAt").mockReturnValue(0);
  const transport = new LocalTransport();
  const addPlayer = (cx: number) => {
    const player = realm.entityManager.spawn(createPlayer(cx * CHUNK_SIZE_PX + 32, 32));
    const session = new PlayerSession(`player-${cx}`, player);
    session.visibleRange = { minCx: cx, maxCx: cx, minCy: 0, maxCy: 0 };
    realm.sessions.set(session.clientId, session);
    return session;
  };
  addPlayer(0);
  const crowd = (cx: number) => {
    const x = cx * CHUNK_SIZE_PX + 128;
    const actors = [createChicken(x, 128), createChicken(x, 128)];
    for (const actor of actors) {
      if (actor.wanderAI) {
        actor.wanderAI.timer = 100;
        actor.wanderAI.befriendable = false;
      }
      realm.entityManager.spawn(actor);
    }
    return { actors, x };
  };
  const tick = () => realm.tick(dt, transport.serverSide, false, new Set());
  return { realm, addPlayer, crowd, tick };
}

describe("Realm separation activation", () => {
  it("freezes far crowds and wakes them when the camera range returns", () => {
    const { realm, crowd, tick } = fixture();
    const { actors, x } = crowd(20);
    for (let i = 0; i < 8; i++) tick();
    for (const actor of actors) expect(actor.position).toEqual({ wx: x, wy: 128 });
    const session = realm.getFirstSession();
    if (!session) throw new Error("Missing player");
    session.visibleRange = { minCx: 20, maxCx: 20, minCy: 0, maxCy: 0 };
    tick();
    expect(actors[0]?.position.wx).toBeLessThan(x);
    expect(actors[1]?.position.wx).toBeGreaterThan(x);
  });

  it.each([1, 2])("accumulates mid-tier separation time with %i physics substeps", (substeps) => {
    const { realm, crowd, tick } = fixture();
    realm.physicsMult = substeps;
    const { actors, x } = crowd(4);
    for (let i = 0; i < 3; i++) tick();
    for (const actor of actors) expect(actor.position.wx).toBe(x);
    tick();
    expect(x - (actors[0]?.position.wx ?? 0)).toBeCloseTo(20 * 4 * dt);
    expect((actors[1]?.position.wx ?? 0) - x).toBeCloseTo(20 * 4 * dt);
  });

  it("activates crowds near either player but not between distant players", () => {
    const { addPlayer, crowd, tick } = fixture();
    addPlayer(40);
    const first = crowd(1);
    const second = crowd(41);
    const middle = crowd(20);
    tick();
    for (const { actors, x } of [first, second]) {
      expect(actors[0]?.position.wx).toBeLessThan(x);
      expect(actors[1]?.position.wx).toBeGreaterThan(x);
    }
    for (const actor of middle.actors) expect(actor.position.wx).toBe(middle.x);
  });
});
