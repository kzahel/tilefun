import type { Entity } from "../entities/Entity.js";

/** Durable vehicle couplings (tow and carry). Records keep reciprocal procedural
 * identities; resident pairs publish replicated runtime IDs that the shared
 * physics scene turns into joints. Either arrival order resolves. */
export type LinkKind = "tow" | "carry";

const FIELDS = {
  tow: { lead: "towTargetId", load: "towedBy" },
  carry: { lead: "transportLoadId", load: "transportedBy" },
} as const;

export function linkVehicles(lead: Entity, load: Entity, kind: LinkKind) {
  if (!lead.proceduralId || !load.proceduralId) throw Error("Vehicle identity is missing");
  lead.vehicleLink = { kind, lead: true, partner: load.proceduralId };
  load.vehicleLink = { kind, lead: false, partner: lead.proceduralId };
  lead[FIELDS[kind].lead] = load.id;
  load[FIELDS[kind].load] = lead.id;
}

/** Remove one vehicle's coupling and, when resident, its partner's. */
export function unlinkVehicle(e: Entity, partner: Entity | undefined) {
  for (const v of [e, partner]) {
    if (!v) continue;
    delete v.vehicleLink;
    delete v.towTargetId;
    delete v.towedBy;
    delete v.transportLoadId;
    delete v.transportedBy;
  }
}

export function linkedPartnerId(e: Entity): number | undefined {
  return e.towTargetId ?? e.towedBy ?? e.transportLoadId ?? e.transportedBy;
}

/** Publish runtime IDs for resident pairs and withdraw them for absent partners.
 * Returns vehicles whose durable link changed (a partner was found deleted). */
export function resolveVehicleLinks(
  vehicles: readonly Entity[],
  tombstoned: (identity: string) => boolean,
): Entity[] {
  const byIdentity = new Map(vehicles.map((v) => [v.proceduralId, v]));
  const changed: Entity[] = [];
  for (const v of vehicles) {
    const link = v.vehicleLink;
    if (!link) continue;
    const partner = byIdentity.get(link.partner);
    const fields = FIELDS[link.kind];
    const own = link.lead ? fields.lead : fields.load;
    if (partner && partner.vehicleLink?.partner === v.proceduralId) v[own] = partner.id;
    else {
      delete v[own];
      if (partner || tombstoned(link.partner)) {
        // The partner no longer reciprocates (deleted or re-coupled elsewhere).
        delete v.vehicleLink;
        changed.push(v);
      }
    }
  }
  return changed;
}

interface LinkRegistry<S extends { entity: Entity }> {
  readonly states: ReadonlyMap<number, S>;
  readonly entities: {
    removalListeners: Set<(entity: Entity, destroyed: boolean) => void>;
  };
  onChange?: ((state: S, destroyed: boolean) => void) | undefined;
}
/** Registry-owned link maintenance: deletion releases the partner; each tick
 * publishes runtime IDs before the shared physics step reads them. */
export class VehicleLinkTracker<S extends { entity: Entity }> {
  private readonly deleted = new Set<string>();
  constructor(private readonly registry: LinkRegistry<S>) {
    registry.entities.removalListeners.add((entity, destroyed) => {
      if (!destroyed || !entity.vehicleLink || !entity.proceduralId) return;
      this.deleted.add(entity.proceduralId);
      const partner = [...registry.states.values()].find(
        (s) => s.entity.proceduralId === entity.vehicleLink?.partner,
      );
      if (partner) {
        unlinkVehicle(partner.entity, undefined);
        registry.onChange?.(partner, false);
      }
    });
  }
  tick() {
    const states = [...this.registry.states.values()];
    if (!states.some((s) => s.entity.vehicleLink || linkedPartnerId(s.entity) !== undefined))
      return;
    for (const s of states) if (!s.entity.vehicleLink) unlinkVehicle(s.entity, undefined);
    const changed = resolveVehicleLinks(
      states.map((s) => s.entity),
      (identity) => this.deleted.has(identity),
    );
    for (const s of states) if (changed.includes(s.entity)) this.registry.onChange?.(s, false);
  }
}

const trackers = new WeakMap<object, VehicleLinkTracker<{ entity: Entity }>>();
/** The registry's link tracker, created with its first shared-physics step. */
export function vehicleLinks<S extends { entity: Entity }>(registry: LinkRegistry<S>) {
  let tracker = trackers.get(registry) as VehicleLinkTracker<S> | undefined;
  if (!tracker) {
    tracker = new VehicleLinkTracker(registry);
    trackers.set(registry, tracker as unknown as VehicleLinkTracker<{ entity: Entity }>);
  }
  return tracker;
}
