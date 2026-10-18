import type { Entity } from "../entities/Entity.js";
import { actorScope, encodeActor } from "../persistence/ActorRecords.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { RealmStore } from "../persistence/WorldStorePool.js";
import type { Realm } from "./Realm.js";

/** Commit record ownership before publishing the NPC in its new realm. No live
 * duplicate, no reseeding on return, and no player location/session involvement. */
export async function transferResident(
  source: Realm,
  destination: Realm,
  entity: Entity,
  position: { wx: number; wy: number },
): Promise<void> {
  const behavior = entity.resident;
  const a = source.saveManager,
    b = destination.saveManager;
  if (
    !behavior ||
    !entity.persistentId ||
    !a ||
    !b ||
    !(a.store instanceof RealmStore) ||
    !(b.store instanceof RealmStore) ||
    a.store.physical !== b.store.physical
  )
    throw new Error("Resident transfer requires one world writer");
  if (
    entity.parentId !== undefined ||
    source.entityManager.entities.some((e) => e.parentId === entity.id)
  )
    throw new Error("An occupied resident cannot cross a doorway");
  behavior.transferring = true;
  if (entity.velocity) entity.velocity.vx = entity.velocity.vy = 0;
  let attempted = false;
  const original = encodeActor(entity);
  const lease = `resident-handoff:${entity.persistentId}`;
  for (const [realm, p] of [
    [source, entity.position],
    [destination, position],
  ] as const) {
    const cx = Math.floor(p.wx / 256),
      cy = Math.floor(p.wy / 256);
    realm.streaming?.interest.set(lease, [
      {
        range: { minCx: cx - 1, minCy: cy - 1, maxCx: cx + 1, maxCy: cy + 1 },
        activity: 0,
        reason: "dependency",
      },
    ]);
  }
  try {
    await SaveManager.flushTogether([a, b]);
    if (!destination.residentCanOccupy(entity, position, true))
      throw new Error("Resident doorway is occupied");
    const record = encodeActor(entity);
    record.wx = position.wx;
    record.wy = position.wy;
    const r = record.state.resident;
    if (!r) throw new Error("Missing saved resident behavior");
    r.place = destination.interior ? "inside" : "outside";
    r.index = 0;
    r.phase = "walk";
    r.elapsed = 0;
    r.retry = 0;
    r.path = [];
    delete r.transferring;
    // Prevent a concurrent hydration from observing a half move. The physical
    // executor publishes both namespaced mutations in a single acknowledged write.
    attempted = true;
    await a.store.physical.save([
      ...a.store.encode([
        { collection: "entities", key: record.persistentId, deleted: true, value: undefined },
      ]),
      ...b.store.encode([
        {
          collection: "entities",
          key: record.persistentId,
          scope: actorScope(position),
          value: record,
        },
      ]),
    ]);
    source.entityManager.remove(entity.id, false);
    destination.records?.restore([record]);
  } catch (error) {
    if (attempted) {
      // Failed coordinator writes retain their pending intents. Replace BOTH
      // intents before any producer can retry, even if storage is still unavailable.
      try {
        await a.store.physical.save([
          ...a.store.encode([
            {
              collection: "entities",
              key: original.persistentId,
              scope: actorScope(entity.position),
              value: original,
            },
          ]),
          ...b.store.encode([
            { collection: "entities", key: original.persistentId, deleted: true, value: undefined },
          ]),
        ]);
      } catch {
        /* The inverse group stays queued for the shared writer's retry. */
      }
    }
    delete behavior.transferring;
    behavior.phase = "act";
    behavior.elapsed = 0;
    throw error;
  } finally {
    source.streaming?.interest.release(lease);
    destination.streaming?.interest.release(lease);
  }
}
