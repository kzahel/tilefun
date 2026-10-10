import type { Entity } from "../entities/Entity.js";
import type { RealmRecords } from "../persistence/RealmRecords.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { RealmStreaming } from "./RealmStreaming.js";
import { isWildlife, WildlifeActivity } from "./WildlifeActivity.js";

/** Incremental demanded attachment membership; wake/readiness decisions remain live. */
export class RealmActivity {
  private records: RealmRecords | undefined;
  private revision = -1;
  private keys: string[] = [];
  private groups: Entity[][] = [];
  private wildlife = new WildlifeActivity();

  clear(): void {
    this.invalidate();
    this.wildlife = new WildlifeActivity();
  }

  /** Drop cached actor references immediately at eviction, even in a paused realm. */
  invalidate(): void {
    this.records = undefined;
    this.revision = -1;
    this.keys = [];
    this.groups = [];
  }

  select(
    records: RealmRecords,
    streaming: RealmStreaming,
    sessions: readonly PlayerSession[],
    fixed: ReadonlyMap<Entity, number>,
    dt: number,
  ): Map<Entity, number> {
    let changed = this.records !== records || this.revision !== records.membershipRevision;
    let count = 0;
    for (const [key, demand] of streaming.demand) {
      if (!demand.activity || !streaming.residency.ready(key)) continue;
      if (this.keys[count++] !== key) changed = true;
    }
    if (count !== this.keys.length) changed = true;
    if (changed) this.rebuild(records, streaming);
    this.wildlife.advance(dt);

    const admitted = new Set<readonly Entity[]>();
    const contacts: Entity[] = [];
    const addContact = (e: Entity) => {
      if (
        !isWildlife(e) &&
        e.collider?.solid !== false &&
        (e.type === "ball" || (!!e.velocity && (e.velocity.vx !== 0 || e.velocity.vy !== 0)))
      )
        contacts.push(e);
    };
    // Ordinary bodies, vehicles and players supply contact dependencies even
    // when every wildlife group is asleep. Their readiness checks remain live.
    for (const group of this.groups) {
      if (group.every(isWildlife)) continue;
      if (!group.every((member) => streaming.supported(member, dt))) continue;
      admitted.add(group);
      for (const member of group) addContact(member);
    }
    for (const e of fixed.keys()) addContact(e);

    for (const group of this.groups) {
      if (admitted.has(group) || !group.every(isWildlife)) continue;
      const fresh = group.some((member) => member.wz === undefined);
      // Preview cannot refresh hysteresis for a body whose terrain is not
      // ready. Sleeping residents need no trajectory readiness queries.
      if (!fresh && !this.wildlife.awake(group, sessions, contacts, false)) {
        for (const member of group) member.tickAccumulator = 0;
        continue;
      }
      if (!group.every((member) => streaming.supported(member, dt))) continue;
      if (!fresh) this.wildlife.awake(group, sessions, contacts);
      admitted.add(group);
    }
    const result = new Map<Entity, number>();
    // Preserve native bucket/group order, including the wildlife second pass.
    for (const group of this.groups)
      if (admitted.has(group)) for (const member of group) result.set(member, dt);
    for (const [entity, entityDt] of fixed) result.set(entity, entityDt);
    return result;
  }

  private rebuild(records: RealmRecords, streaming: RealmStreaming): void {
    this.records = records;
    this.revision = records.membershipRevision;
    this.keys = [];
    this.groups = [];
    const roots = new Set<number>();
    for (const [key, demand] of streaming.demand) {
      if (!demand.activity || !streaming.residency.ready(key)) continue;
      this.keys.push(key);
      for (const actor of records.buckets.get(key) ?? []) {
        if ("isProp" in actor) continue;
        const root = records.root(actor);
        if (roots.has(root.id)) continue;
        roots.add(root.id);
        this.groups.push(records.group(actor));
      }
    }
  }
}
