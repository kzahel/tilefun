import type { Entity } from "../entities/Entity.js";
import type { RealmRecords } from "../persistence/RealmRecords.js";
import { isWildlife } from "../wildlife/WildlifeKinds.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { RealmStreaming } from "./RealmStreaming.js";
import { WildlifeActivity } from "./WildlifeActivity.js";

/** Incremental demanded attachment membership; wake/readiness decisions remain live. */
export class RealmActivity {
  private records: RealmRecords | undefined;
  private revision = -1;
  private keys: string[] = [];
  private groups: Entity[][] = [];
  private wildlifeOnly: boolean[] = [];
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
    this.wildlifeOnly = [];
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
    if (changed || count !== this.keys.length) this.rebuild(records, streaming);
    this.wildlife.advance(dt);

    const { groups, wildlifeOnly } = this;
    const admitted = new Uint8Array(groups.length);
    const contacts: Entity[] = [];
    const addContact = (e: Entity) => {
      if (
        !isWildlife(e) &&
        e.collider?.solid !== false &&
        (e.type === "ball" || (!!e.velocity && (e.velocity.vx !== 0 || e.velocity.vy !== 0)))
      )
        contacts.push(e);
    };
    const supported = (group: readonly Entity[]) => {
      for (const member of group) if (!streaming.supported(member, dt)) return false;
      return true;
    };
    // Ordinary bodies, vehicles and players supply contact dependencies even
    // when every wildlife group is asleep. Their readiness checks remain live.
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i] as Entity[];
      if (wildlifeOnly[i] || !supported(group)) continue;
      admitted[i] = 1;
      for (const member of group) addContact(member);
    }
    for (const e of fixed.keys()) addContact(e);
    for (let i = 0; i < groups.length; i++)
      if (
        wildlifeOnly[i] &&
        this.wildlife.admit(groups[i] as Entity[], sessions, contacts, supported)
      )
        admitted[i] = 1;
    const result = new Map<Entity, number>();
    // Preserve native bucket/group order, including the wildlife second pass.
    for (let i = 0; i < groups.length; i++)
      if (admitted[i]) for (const member of groups[i] as Entity[]) result.set(member, dt);
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
    // Types are immutable, so wildlife-only membership holds until the next rebuild.
    this.wildlifeOnly = this.groups.map((group) => group.every(isWildlife));
  }
}
