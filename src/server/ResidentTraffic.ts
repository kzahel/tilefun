import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { buildingDoor } from "../interiors/BuildingDoors.js";
import type { Realm } from "./Realm.js";
import type { RealmDirectory } from "./RealmDirectory.js";
import { transferResident } from "./ResidentTransfer.js";

export interface ResidentTrafficDeps {
  realms: RealmDirectory;
  /** Track durable/realm operations for the server's lifecycle fence. */
  track: <T>(operation: Promise<T>) => Promise<T>;
  reportStorageFailure: (error: unknown) => void;
}

/** Background activity for residents near awake players, and their doorway transfers. */
export class ResidentTraffic {
  private readonly transfers = new Map<string, Promise<void>>();

  constructor(private readonly deps: ResidentTrafficDeps) {}

  /** Whether any resident is crossing between realms (holds idle realm eviction). */
  get moving(): boolean {
    return this.transfers.size > 0;
  }

  /** Only visited interiors near an awake street player, or a visitor whose
   * home is occupied, receive background work. Never simulate a whole city's homes. */
  prepare(dormant: ReadonlySet<string>): void {
    const awake = (realm: Realm) =>
      [...realm.sessions.values()].some(
        (s) => !dormant.has(s.clientId) && !s.debugPaused && !s.transitioning && !s.retired,
      );
    let nearbyRooms = 0;
    for (const realm of this.deps.realms.values()) {
      realm.backgroundResidents.clear();
      const owners = new Set<string>();
      const nearby = this.nearStreetPlayer(realm, dormant, nearbyRooms < 4);
      if (nearby) nearbyRooms++;
      for (const entity of realm.entityManager.entities) {
        const r = entity.resident;
        if (!r) continue;
        const home = this.deps.realms.get(r.homeRealm);
        if (nearby || (r.place === "outside" && home && awake(home)))
          this.activate(realm, entity, owners);
      }
      realm.streaming?.interest.retainOwners(owners, "resident:");
      if (!realm.sessions.size && !realm.backgroundResidents.size && realm.idleSince === null)
        realm.idleSince = Date.now();
    }
  }

  /** An interior whose street door has an awake, unpaused player within range. */
  private nearStreetPlayer(realm: Realm, dormant: ReadonlySet<string>, allowed: boolean): boolean {
    const parent = realm.interior ? this.deps.realms.get(realm.interior.parentWorldId) : undefined;
    const door = realm.interior ? buildingDoor(realm.interior).outside : undefined;
    return Boolean(
      parent &&
        door &&
        allowed &&
        [...parent.sessions.values()].some(
          (s) =>
            !dormant.has(s.clientId) &&
            !s.debugPaused &&
            !s.retired &&
            Math.hypot(s.player.position.wx - door.wx, s.player.position.wy - door.wy) < 384,
        ),
    );
  }

  private activate(realm: Realm, entity: Entity, owners: Set<string>): void {
    realm.backgroundResidents.add(entity);
    realm.idleSince = null;
    const owner = `resident:${entity.persistentId}`;
    owners.add(owner);
    const cx = Math.floor(entity.position.wx / CHUNK_SIZE_PX),
      cy = Math.floor(entity.position.wy / CHUNK_SIZE_PX);
    realm.streaming?.interest.set(owner, [
      {
        range: { minCx: cx - 1, minCy: cy - 1, maxCx: cx + 1, maxCy: cy + 1 },
        activity: 0,
        reason: "dependency",
      },
    ]);
  }

  crossDoors(): void {
    for (const realm of this.deps.realms.values())
      for (const entity of realm.entityManager.entities) {
        const r = entity.resident,
          id = entity.persistentId;
        if (!r || !id || r.phase !== "transfer" || this.transfers.has(id)) continue;
        const crossing = this.move(realm, entity)
          .catch((error) => {
            // An occupied/deleted doorway leaves the same resident waiting at its source.
            if (entity.resident) {
              delete entity.resident.transferring;
              entity.resident.phase = "act";
              entity.resident.elapsed = -2;
            }
            if (realm.saveManager?.pressured) this.deps.reportStorageFailure(error);
          })
          .finally(() => this.transfers.delete(id));
        this.transfers.set(id, crossing);
        void this.deps.track(crossing);
      }
  }

  private async move(source: Realm, entity: Entity): Promise<void> {
    const r = entity.resident;
    if (!r) throw new Error("Missing resident behavior");
    r.transferring = true;
    const home = await this.deps.realms.getOrCreate(r.homeRealm);
    if (!home.interior) throw new Error("Resident home is unavailable");
    const door = buildingDoor(home.interior, r.doorId);
    const destination =
      r.place === "inside" ? await this.deps.realms.getOrCreate(r.parentRealm) : home;
    const position = destination.interior ? door.arrival : door.outside;
    const cx = Math.floor(position.wx / CHUNK_SIZE_PX),
      cy = Math.floor(position.wy / CHUNK_SIZE_PX);
    await destination.ensureReady({ minCx: cx - 1, minCy: cy - 1, maxCx: cx + 1, maxCy: cy + 1 });
    await transferResident(source, destination, entity, position);
  }
}
