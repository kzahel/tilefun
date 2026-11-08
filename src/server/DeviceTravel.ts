import { descriptorFromMetadata } from "../generation/GenerationDescriptor.js";
import type { IWorldRegistry } from "../persistence/IWorldRegistry.js";
import type { PlayerLocationStore } from "../persistence/PlayerLocationStore.js";
import type { ClientMessage } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import type { RealmDirectory } from "./RealmDirectory.js";
import type { RealmDestination, RealmTransitions } from "./RealmTransitions.js";
import { resumeDestination } from "./ResumeDestination.js";
import type { Arrival } from "./SafeArrival.js";
import type { SessionRegistry } from "./SessionRegistry.js";

export interface DeviceTravelDeps {
  transport: IServerTransport;
  sessions: SessionRegistry;
  realms: RealmDirectory;
  transitions: RealmTransitions;
  registry: IWorldRegistry;
  /** Saved player destinations, once the server has opened them. */
  locations: () => PlayerLocationStore | null;
  playerCountChanged: (worldId: string) => void;
}

/** A device's seats that travel together, the leading seat first. */
type Party = readonly [PlayerSession, ...PlayerSession[]];
type JoinRealm = Extract<ClientMessage, { type: "join-realm" }>;

/**
 * Party travel (226): a device's awake seats go through doors, between worlds and out to
 * the lobby together. Whichever seat asks leads; the others follow it without its checks
 * and arrive beside it, and each hears only its new body. `realmId` stays per seat, so a
 * seat can still be elsewhere mid-transfer or while dormant.
 */
export class DeviceTravel {
  constructor(private readonly deps: DeviceTravelDeps) {}

  /** `leader` and every other awake seat of its device, in seat order. */
  party(leader: PlayerSession): Party {
    const { sessions } = this.deps;
    const others = sessions
      .seats(leader.connectionId)
      .filter((s) => s !== leader && !s.retired && !sessions.isDormant(s.clientId));
    return [leader, ...others];
  }

  /**
   * Move `leader`'s device to `resolve`'s destination; every seat arrives or none moves.
   * `lead` may hand the lead to another seat while `leader` keeps the reply.
   */
  async move(leader: PlayerSession, resolve: () => Promise<RealmDestination>, lead = leader) {
    const party = this.party(lead);
    const [, ...followers] = party;
    const camera = await this.deps.transitions.moveParty(lead, followers, resolve);
    // The requesting seat hears its body with the reply (`arrived`).
    for (const seat of party) if (seat !== leader) this.assign(seat);
    return camera;
  }

  /** World travel from the menu or the map. */
  toWorld(leader: PlayerSession, worldId: string, arrival?: Arrival) {
    return this.move(leader, async () => ({
      realm: await this.deps.realms.getOrCreate(worldId),
      ...(arrival ? { arrival } : {}),
      returnLocation: null,
    }));
  }

  /**
   * A `join-realm` request: from the lobby, resume the device's saved place, which only
   * seat 0 keeps, so seat 0 leads even when a guest asked. Otherwise travel.
   */
  joinRealm(leader: PlayerSession, msg: JoinRealm) {
    if (!msg.resume || leader.realmId) return this.toWorld(leader, msg.worldId, msg.arrival);
    const { locations, registry, realms, sessions } = this.deps;
    const host = sessions.get(leader.connectionId);
    const lead = host && this.party(leader).includes(host) ? host : leader;
    const resume = () =>
      resumeDestination({ locations: locations(), registry, realms }, lead, msg.worldId);
    return this.move(leader, resume, lead);
  }

  /** The travel reply: the leader's new body, then where its device now plays. */
  arrived(leader: PlayerSession) {
    return () => {
      if (leader.retired) return null;
      const realm = leader.realmId ? this.deps.realms.get(leader.realmId) : undefined;
      if (!realm) throw new Error("Destination realm unavailable.");
      this.assign(leader);
      return {
        worldId: leader.realmId ?? "",
        generation: realm.generation,
        interior: realm.interior ?? undefined,
        cameraX: leader.player.position.wx,
        cameraY: leader.player.position.wy,
        cameraZoom: leader.cameraZoom,
      };
    };
  }

  /** `leave-realm`: the device's seats go to the lobby and follow it into its next realm. */
  leave(leader: PlayerSession): void {
    const party = this.party(leader);
    if (party.some((seat) => seat.transitioning))
      throw new Error("A realm transition is already running.");
    const left = new Set<string>();
    for (const seat of party) {
      const realmId = seat.realmId;
      if (!realmId) continue;
      this.deps.realms.get(realmId)?.removePlayer(seat.clientId);
      this.deps.realms.tryUnload(realmId);
      left.add(realmId);
    }
    for (const realmId of left) this.deps.playerCountChanged(realmId);
  }

  /**
   * Everyone leaves realms that are being deleted: each device's awake seats as one party,
   * to `fallback` with one `world-loaded`, or out to the lobby with one `realm-left`.
   * Dormant seats move alone. Transfers in progress settle first, and again before each
   * device, so none is refused part-way (226): a party that was leaving is gone, and one
   * that was arriving moves on.
   */
  async evacuate(realms: readonly Realm[], fallback: string | null): Promise<void> {
    const handled = new Set<PlayerSession>();
    for (;;) {
      const travelling = [...this.deps.sessions.values()].filter((s) => s.transitioning);
      if (travelling.length) {
        await Promise.all(travelling.map((s) => s.transitionDone));
        continue;
      }
      const next = realms
        .flatMap((realm) => [...realm.sessions.values()])
        .find((s) => !handled.has(s));
      if (!next) return;
      const party = this.leaving(next);
      for (const seat of party) handled.add(seat);
      // Synchronously after the check above: no transfer can begin in between.
      if (fallback) await this.relocate(party, fallback);
      else this.vacate(party);
    }
  }

  /** The seats that leave with `session`: its awake device behind seat 0, or itself alone. */
  private leaving(session: PlayerSession): Party {
    const { sessions } = this.deps;
    const host = sessions.get(session.connectionId);
    const awake = (s: PlayerSession) => !s.retired && !sessions.isDormant(s.clientId);
    return host && awake(host) && awake(session) ? this.party(host) : [session];
  }

  private async relocate(party: Party, worldId: string): Promise<void> {
    const [leader, ...followers] = party;
    await this.deps.transitions.moveParty(leader, followers, async () => ({
      realm: await this.deps.realms.getOrCreate(worldId),
      returnLocation: null,
    }));
    for (const seat of party) this.assign(seat);
    this.deps.transport.send(leader.clientId, {
      type: "world-loaded",
      worldId,
      generation: this.deps.realms.get(worldId)?.generation ?? descriptorFromMetadata(),
      cameraX: leader.cameraX,
      cameraY: leader.cameraY,
      cameraZoom: leader.cameraZoom,
    });
  }

  private vacate(party: Party): void {
    for (const seat of party) this.deps.realms.get(seat.realmId ?? "")?.removePlayer(seat.clientId);
    this.deps.transport.send(party[0].clientId, { type: "realm-left", requestId: 0 });
  }

  /** A seat's new body, in its own envelope. */
  private assign(seat: PlayerSession): void {
    if (seat.retired) return;
    this.deps.transport.send(seat.clientId, { type: "player-assigned", entityId: seat.player.id });
  }
}
