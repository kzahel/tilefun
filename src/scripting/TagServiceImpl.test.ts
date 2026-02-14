import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { EntityHandle } from "../server/EntityHandle.js";
import { TagServiceImpl } from "./TagServiceImpl.js";

/** Helper: create a minimal entity for testing. */
function testEntity(type = "test", tags?: string[]): Entity {
  const entity: Entity = {
    id: 0,
    type,
    position: { wx: 100, wy: 100 },
    velocity: null,
    sprite: null,
    collider: null,
    wanderAI: null,
  };
  if (tags) entity.tags = new Set(tags);
  return entity;
}

describe("TagServiceImpl", () => {
  it("notifySpawn indexes initial tags", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);

    const entity = testEntity("chicken", ["befriendable", "npc"]);
    em.spawn(entity);
    service.notifySpawn(entity);

    const tagged = service.getTagged("befriendable");
    expect(tagged).toHaveLength(1);
    expect(tagged[0]!.type).toBe("chicken");

    const npcs = service.getTagged("npc");
    expect(npcs).toHaveLength(1);
  });

  it("notifySpawn fires onTagAdded for initial tags", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagAdded("befriendable", cb);

    const entity = testEntity("chicken", ["befriendable"]);
    em.spawn(entity);
    service.notifySpawn(entity);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0].type).toBe("chicken");
  });

  it("addTag adds to index and fires callback", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagAdded("hostile", cb);

    const entity = testEntity("ghost");
    em.spawn(entity);
    const handle = new EntityHandle(entity, em);

    service.addTag(handle, "hostile");

    expect(handle.hasTag("hostile")).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(service.getTagged("hostile")).toHaveLength(1);
  });

  it("removeTag removes from index and fires callback", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagRemoved("befriendable", cb);

    const entity = testEntity("chicken", ["befriendable"]);
    em.spawn(entity);
    service.notifySpawn(entity);
    const handle = new EntityHandle(entity, em);

    service.removeTag(handle, "befriendable");

    expect(handle.hasTag("befriendable")).toBe(false);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(service.getTagged("befriendable")).toHaveLength(0);
  });

  it("hasTag delegates to entity tags", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);

    const entity = testEntity("chicken", ["befriendable"]);
    em.spawn(entity);
    const handle = new EntityHandle(entity, em);

    expect(service.hasTag(handle, "befriendable")).toBe(true);
    expect(service.hasTag(handle, "hostile")).toBe(false);
  });

  it("getTagged returns empty array for unknown tag", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);

    expect(service.getTagged("nonexistent")).toEqual([]);
  });

  it("getTagged returns multiple entities", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);

    const e1 = testEntity("chicken", ["npc"]);
    const e2 = testEntity("cow", ["npc"]);
    em.spawn(e1);
    em.spawn(e2);
    service.notifySpawn(e1);
    service.notifySpawn(e2);

    const npcs = service.getTagged("npc");
    expect(npcs).toHaveLength(2);
    expect(npcs.map((h) => h.type).sort()).toEqual(["chicken", "cow"]);
  });

  it("EntityHandle.addTag fires onTagAdded via hook", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagAdded("collectible", cb);

    const entity = testEntity("gem");
    em.spawn(entity);
    const handle = new EntityHandle(entity, em);

    handle.addTag("collectible");

    expect(cb).toHaveBeenCalledTimes(1);
    expect(service.getTagged("collectible")).toHaveLength(1);
  });

  it("EntityHandle.removeTag fires onTagRemoved via hook", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagRemoved("npc", cb);

    const entity = testEntity("chicken", ["npc"]);
    em.spawn(entity);
    service.notifySpawn(entity);
    const handle = new EntityHandle(entity, em);

    handle.removeTag("npc");

    expect(cb).toHaveBeenCalledTimes(1);
    expect(service.getTagged("npc")).toHaveLength(0);
  });

  it("EntityHandle.addTag is idempotent (no double fire)", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagAdded("x", cb);

    const entity = testEntity("test");
    em.spawn(entity);
    const handle = new EntityHandle(entity, em);

    handle.addTag("x");
    handle.addTag("x");

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("EntityHandle.removeTag is idempotent (no double fire)", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagRemoved("x", cb);

    const entity = testEntity("test", ["x"]);
    em.spawn(entity);
    service.notifySpawn(entity);
    const handle = new EntityHandle(entity, em);

    handle.removeTag("x");
    handle.removeTag("x");

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("tick detects removed entities and fires onTagRemoved", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagRemoved("befriendable", cb);

    const entity = testEntity("chicken", ["befriendable", "npc"]);
    em.spawn(entity);
    service.notifySpawn(entity);

    // Remove the entity
    em.remove(entity.id);

    // Tick detects removal
    service.tick();

    expect(cb).toHaveBeenCalledTimes(1);
    expect(service.getTagged("befriendable")).toHaveLength(0);
  });

  it("tick fires onTagRemoved for all tags on removed entity", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const befriendCb = vi.fn();
    const npcCb = vi.fn();
    service.onTagRemoved("befriendable", befriendCb);
    service.onTagRemoved("npc", npcCb);

    const entity = testEntity("chicken", ["befriendable", "npc"]);
    em.spawn(entity);
    service.notifySpawn(entity);

    em.remove(entity.id);
    service.tick();

    expect(befriendCb).toHaveBeenCalledTimes(1);
    expect(npcCb).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe removes the listener", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    const unsub = service.onTagAdded("x", cb);

    unsub();

    const entity = testEntity("test");
    em.spawn(entity);
    const handle = new EntityHandle(entity, em);
    service.addTag(handle, "x");

    expect(cb).not.toHaveBeenCalled();
  });

  it("handles errors in callbacks without crashing", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const errorCb = vi.fn(() => {
      throw new Error("test error");
    });
    const goodCb = vi.fn();
    service.onTagAdded("x", errorCb);
    service.onTagAdded("x", goodCb);

    const entity = testEntity("test");
    em.spawn(entity);
    const handle = new EntityHandle(entity, em);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    service.addTag(handle, "x");
    consoleSpy.mockRestore();

    expect(errorCb).toHaveBeenCalled();
    expect(goodCb).toHaveBeenCalled();
  });

  it("clear removes all state", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagAdded("x", cb);

    const entity = testEntity("test", ["x"]);
    em.spawn(entity);
    service.notifySpawn(entity);

    service.clear();

    expect(service.getTagged("x")).toHaveLength(0);

    // Callback should not fire after clear
    const entity2 = testEntity("test2");
    em.spawn(entity2);
    const handle2 = new EntityHandle(entity2, em);
    handle2.addTag("x");
    expect(cb).toHaveBeenCalledTimes(1); // only from notifySpawn, not from addTag after clear
  });

  it("notifySpawn skips entities with no tags", () => {
    const em = new EntityManager();
    const service = new TagServiceImpl(em);
    const cb = vi.fn();
    service.onTagAdded("x", cb);

    const entity = testEntity("test");
    em.spawn(entity);
    service.notifySpawn(entity);

    expect(cb).not.toHaveBeenCalled();
    expect(service.getTagged("x")).toHaveLength(0);
  });
});
