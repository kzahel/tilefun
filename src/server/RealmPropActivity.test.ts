import { expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createChicken } from "../entities/Chicken.js";
import type { Prop } from "../entities/Prop.js";
import { PropManager } from "../entities/PropManager.js";
import { actorScope } from "../persistence/ActorRecords.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { RealmPropActivity } from "./RealmPropActivity.js";

const prop = (wx = 32, wy = 32): Prop => ({
  id: 0,
  type: "test",
  isProp: true,
  position: { wx, wy },
  sprite: { sheetKey: "test", frameCol: 0, frameRow: 0, spriteWidth: 16, spriteHeight: 16 },
  collider: { offsetX: 0, offsetY: 0, width: 16, height: 16 },
  walls: null,
});
async function fixture() {
  const s = await ScenarioSession.create({
    version: 1,
    id: "prop-admission",
    generation: FLAT_SCENARIO,
    player: createChicken(32, 32),
    actors: [],
    props: [],
  });
  await s.ready({ minCx: -5, maxCx: 6, minCy: -3, maxCy: 3 });
  const streaming = required(s.realm.streaming),
    manager = s.realm.propManager;
  const selector = new RealmPropActivity();
  const check = (m = manager) => {
    const reference = m.props.filter(
      (p) => !!streaming.demand.get(actorScope(p.position))?.activity && streaming.supported(p),
    );
    const selected = selector.select(m, streaming);
    expect([...selected]).toEqual(reference);
    return selected;
  };
  return { s, streaming, manager, selector, check };
}

it("matches live admission through demand, halo readiness, failure and recovery", async () => {
  const { s, streaming, manager, check } = await fixture();
  try {
    const p = manager.add(prop(255));
    expect(check()).toContain(p);
    const scope = actorScope(p.position),
      demand = required(streaming.demand.get(scope));
    streaming.demand.set(scope, { ...demand, activity: 0 });
    expect(check()).not.toContain(p);
    streaming.demand.set(scope, demand);
    expect(check()).toContain(p);
    // This neighboring support chunk is resident without simulation activity.
    const halo = required(streaming.demand.get("1,0"));
    streaming.demand.set("1,0", { ...halo, activity: 0 });
    expect(check()).toContain(p);
    const holder = required(streaming.residency.holders.get("1,0"));
    for (const state of ["saving", "loading", "failed"] as const) {
      holder.state = state;
      expect(check()).not.toContain(p);
    }
    holder.state = "ready";
    expect(check()).toContain(p);
    streaming.residency.holders.delete("1,0");
    expect(check()).not.toContain(p);
    streaming.residency.holders.set("1,0", holder);
    expect(check()).toContain(p);
  } finally {
    await s.close();
  }
});

it("catches same-cell edits, geometry replacement, moves, additions and removal without changing order", async () => {
  const { s, manager, check } = await fixture();
  try {
    const a = manager.add(prop()),
      b = manager.add(prop(300));
    expect(check()).toEqual([a, b]);
    required(a.collider).width = 4096;
    expect(check()).toEqual([b]);
    a.collider = null;
    expect(check()).toEqual([a, b]);
    a.collider = { ...required(b.collider), height: 4096 };
    expect(check()).toEqual([b]);
    a.collider.height = 16;
    a.position.wx = 10000;
    expect(check()).toEqual([b]);
    a.position = { wx: 33, wy: 32 };
    expect(check()).toEqual([a, b]);
    manager.move(a.id, 10000, 32);
    expect(check()).toEqual([b]);
    manager.remove(b.id, false);
    expect(check()).toEqual([]);
    const replacement = manager.add(prop(300));
    expect(check()).toEqual([replacement]);
  } finally {
    await s.close();
  }
});

it("reuses warm results with zero support queries and releases references on paused eviction/reset", async () => {
  const { s, manager, streaming, selector } = await fixture();
  try {
    for (let i = 0; i < 1000; i++) manager.add(prop(32 + (i % 100)));
    const supported = vi.spyOn(streaming, "supported");
    const selected = selector.select(manager, streaming);
    expect(selected).toHaveLength(1000);
    supported.mockClear();
    for (let i = 0; i < 120; i++) expect(selector.select(manager, streaming)).toBe(selected);
    expect(supported).not.toHaveBeenCalled();
    manager.remove(required(manager.props[0]).id, false);
    expect(manager.removalListeners.size).toBe(0);
    expect(selector.select(manager, streaming)).toHaveLength(999);
    selector.clear();
    expect(manager.removalListeners.size).toBe(0);
    const other = new PropManager();
    const p = other.add(prop());
    expect(selector.select(other, streaming)).toEqual([p]);
    expect(manager.removalListeners.size).toBe(0);
    selector.clear();
    expect(other.removalListeners.size).toBe(0);
  } finally {
    await s.close();
  }
});
