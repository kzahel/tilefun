import { expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createChicken } from "../entities/Chicken.js";
import type { Entity } from "../entities/Entity.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createRobin } from "../wildlife/Robin.js";
import { PlayerSession } from "./PlayerSession.js";
import { RealmActivity } from "./RealmActivity.js";
import { isWildlife, WildlifeActivity } from "./WildlifeActivity.js";

const view = (cx = 0) => ({ minCx: cx, maxCx: cx, minCy: 0, maxCy: 0 });
async function fixture() {
  const s = await ScenarioSession.create({
    version: 1,
    id: "activity-cache",
    generation: FLAT_SCENARIO,
    player: createChicken(32, 32),
    actors: [],
    props: [],
  });
  await s.ready({ minCx: -5, maxCx: 6, minCy: -3, maxCy: 3 });
  s.player.visibleRange = view();
  const records = required(s.realm.records),
    streaming = required(s.realm.streaming);
  const selector = new RealmActivity(),
    reference = new WildlifeActivity();
  const bird = (x: number, y = 32) => s.realm.entityManager.spawn({ ...createRobin(x, y), wz: 0 });
  const check = (dt = 1 / 60, sessions: PlayerSession[] = [s.player]) => {
    // Pre-change policy: readiness for every demanded group, then wildlife sleep.
    const old = new Map<Entity, number>(),
      seen = new Set<number>();
    for (const [key, demand] of streaming.demand) {
      if (!demand.activity || !streaming.residency.ready(key)) continue;
      for (const actor of records.buckets.get(key) ?? []) {
        if ("isProp" in actor) continue;
        const root = records.root(actor);
        if (seen.has(root.id)) continue;
        seen.add(root.id);
        const group = records.group(actor);
        if (group.every((e) => streaming.supported(e, dt))) for (const e of group) old.set(e, dt);
      }
    }
    const fixed = new Map<Entity, number>();
    for (const session of sessions)
      if (streaming.supported(session.player, dt)) fixed.set(session.player, dt);
    for (const [e, d] of fixed) old.set(e, d);
    reference.advance(dt);
    const contacts = [...old.keys()].filter(
      (e) =>
        !isWildlife(e) &&
        e.collider?.solid !== false &&
        (e.type === "ball" || (!!e.velocity && (e.velocity.vx !== 0 || e.velocity.vy !== 0))),
    );
    const visited = new Set<Entity>();
    for (const e of old.keys()) {
      if (visited.has(e)) continue;
      const group = records.group(e);
      for (const member of group) visited.add(member);
      if (group.some((e) => e.wz === undefined) || reference.awake(group, sessions, contacts))
        continue;
      for (const member of group) old.delete(member);
    }
    const actual = selector.select(records, streaming, sessions, fixed, dt);
    expect([...actual]).toEqual([...old]);
    return actual;
  };
  return { s, records, streaming, selector, bird, check };
}

it("matches the original selection through view/proximity/hysteresis changes and followers", async () => {
  const { s, bird, check } = await fixture();
  try {
    const near = bird(180),
      far = bird(650),
      remote = bird(1100);
    expect(check().has(near)).toBe(true);
    expect(check().has(far)).toBe(false);
    s.player.visibleRange = view(2);
    expect(check().has(far)).toBe(true);
    s.player.visibleRange = view();
    expect(check(0.25).has(far)).toBe(true);
    expect(check(0.26).has(far)).toBe(false);
    required(remote.wanderAI).following = true;
    expect(check().has(remote)).toBe(true);
    required(remote.wanderAI).following = false;
    expect(check().has(remote)).toBe(false);
    s.player.player.position.wx = 520;
    expect(check().has(far)).toBe(true);
    s.player.player.position.wx = 0;
    s.player.visibleRange = { minCx: -100, maxCx: 100, minCy: -100, maxCy: 100 };
    expect(check().has(remote)).toBe(false);
  } finally {
    await s.close();
  }
});

it("wakes immediately for new moving contacts and ignores unsupported contact bodies", async () => {
  const { s, bird, check, streaming } = await fixture();
  try {
    const far = bird(650);
    expect(check().has(far)).toBe(false);
    const ball = s.realm.entityManager.spawn(createChicken(655, 32));
    required(ball.velocity).vx = 1;
    expect(check().has(far)).toBe(true);
    s.realm.entityManager.remove(ball.id);
    expect(check(0.51).has(far)).toBe(false);
    const other = s.realm.entityManager.spawn(createChicken(655, 32));
    required(other.velocity).vx = 1;
    const supported = streaming.supported.bind(streaming);
    const spy = vi
      .spyOn(streaming, "supported")
      .mockImplementation((e, dt) => (e === other ? false : supported(e, dt)));
    expect(check().has(far)).toBe(false);
    spy.mockRestore();
  } finally {
    await s.close();
  }
});

it("invalidates cached groups for spawn, removal, reparenting and cross-chunk movement", async () => {
  const { s, bird, check } = await fixture();
  try {
    const far = bird(650);
    check();
    const child = bird(650);
    child.parentId = far.id;
    expect(check().has(far)).toBe(true);
    delete child.parentId;
    expect(check().has(far)).toBe(false);
    far.position.wx = 180;
    expect(check().has(far)).toBe(true);
    s.realm.entityManager.remove(far.id);
    expect(check().has(far)).toBe(false);
    const fresh = s.realm.entityManager.spawn(createRobin(680, 32));
    expect(check().has(fresh)).toBe(true);
    fresh.wz = 0;
    expect(check().has(fresh)).toBe(false);
  } finally {
    await s.close();
  }
});

it("does not refresh wake grace while terrain is unavailable, and responds to demand/readiness", async () => {
  const { s, bird, check, streaming } = await fixture();
  try {
    const far = bird(650);
    s.player.visibleRange = view(2);
    expect(check().has(far)).toBe(true);
    const supported = streaming.supported.bind(streaming);
    const spy = vi
      .spyOn(streaming, "supported")
      .mockImplementation((e, dt) => (e === far ? false : supported(e, dt)));
    expect(check(0.6).has(far)).toBe(false);
    s.player.visibleRange = view();
    spy.mockRestore();
    expect(check().has(far)).toBe(false);
    s.player.visibleRange = view(2);
    const holder = required(streaming.residency.holders.get("2,0"));
    holder.state = "saving";
    expect(check().has(far)).toBe(false);
    holder.state = "ready";
    expect(check().has(far)).toBe(true);
    const demand = required(streaming.demand.get("2,0"));
    demand.activity = 0;
    expect(check().has(far)).toBe(false);
    demand.activity = 2;
    expect(check().has(far)).toBe(true);
    const collider = required(far.collider),
      width = collider.width;
    const revision = required(s.realm.records).membershipRevision;
    collider.width = 4096;
    expect(required(s.realm.records).membershipRevision).toBe(revision);
    expect(check().has(far)).toBe(false);
    collider.width = width;
    expect(check().has(far)).toBe(true);
  } finally {
    await s.close();
  }
});

it("avoids group rebuilding and sleeping-body readiness while retaining a live wake check", async () => {
  const { s, records, streaming, selector, bird } = await fixture();
  try {
    const birds = Array.from({ length: 200 }, (_, i) => bird(650 + (i % 20), 32 + (i % 4)));
    const fixed = new Map([[s.player.player, 1 / 60]]);
    selector.select(records, streaming, [s.player], fixed, 1 / 60);
    const groups = vi.spyOn(records, "group"),
      supported = vi.spyOn(streaming, "supported");
    for (let i = 0; i < 60; i++) selector.select(records, streaming, [s.player], fixed, 1 / 60);
    expect(groups).not.toHaveBeenCalled();
    expect(supported).not.toHaveBeenCalled();
    s.player.visibleRange = view(2);
    expect(selector.select(records, streaming, [s.player], fixed, 1 / 60).size).toBe(
      birds.length + 1,
    );
    expect(supported).toHaveBeenCalledTimes(birds.length);
    expect(groups).not.toHaveBeenCalled();
    groups.mockRestore();
    supported.mockRestore();
  } finally {
    await s.close();
  }
});

it("unions separated players, observes same-cell edits and rebuilds after an explicit clear", async () => {
  const { s, bird, check, selector, streaming, records } = await fixture();
  try {
    const far = bird(1100);
    expect(check().has(far)).toBe(false);
    const second = new PlayerSession("second", createChicken(1050, 32));
    second.visibleRange = view(4);
    expect(check(1 / 60, [s.player, second]).has(far)).toBe(true);
    const sameCell = bird(200);
    s.player.visibleRange = view(50);
    expect(check().has(sameCell)).toBe(true);
    const revision = records.membershipRevision;
    sameCell.position.wx = 240;
    expect(records.membershipRevision).toBe(revision);
    expect(check(0.6).has(sameCell)).toBe(false);
    required(far.wanderAI).state = "ridden";
    expect(check().has(far)).toBe(true);
    selector.clear();
    expect(
      selector
        .select(records, streaming, [s.player], new Map([[s.player.player, 1 / 60]]), 1 / 60)
        .has(far),
    ).toBe(true);
  } finally {
    await s.close();
  }
});
