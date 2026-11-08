import { applyPlayerModel, normalizePlayerModel } from "../characters/PlayerModels.js";
import { TILE_SIZE } from "../config/constants.js";
import type { IWorldRegistry } from "../persistence/IWorldRegistry.js";
import type { PlayerLocationStore } from "../persistence/PlayerLocationStore.js";
import { type ClientMessage, MAX_SEATS } from "../shared/protocol.js";
import type { ConnectionIdentity, IServerTransport } from "../transport/Transport.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import type { RealmDirectory } from "./RealmDirectory.js";
import type { RealmTransitions } from "./RealmTransitions.js";
import { resumeDestination } from "./ResumeDestination.js";
import { type Arrival, raisedStanding } from "./SafeArrival.js";
import type { SessionRegistry } from "./SessionRegistry.js";

export interface DeviceConnectionsDeps {
  transport: IServerTransport;
  sessions: SessionRegistry;
  realms: RealmDirectory;
  transitions: RealmTransitions;
  registry: IWorldRegistry;
  /** Saved player destinations, once the server has opened them. */
  locations: () => PlayerLocationStore | null;
  /** Track durable/realm operations for the server's lifecycle fence. */
  track: <T>(operation: Promise<T>) => Promise<T>;
  /** Where the local connection plays without a saved destination. */
  activeRealm: () => Realm;
  /** A local player that cannot be restored stops the local authority. */
  fail: (error: unknown) => void;
  playerCountChanged: (worldId: string) => void;
}

type JoinSeat = Extract<ClientMessage, { type: "join-seat" }>;

/** Clients restart their input sequence on every connection. */
function resetInput(session: PlayerSession, seq = 0): void {
  session.lastProcessedInputSeq = seq;
  session.controls.reset(seq);
  session.inputQueue = [];
}

/**
 * Device connections and their seats (226). A connection's seat 0 is admitted when it
 * connects: the local connection joins its world at once, others start in the lobby or
 * resume a dormant session. Other seats join and leave on a live connection as guests of
 * seat 0, beside it in its realm; a disconnect makes every seat dormant (see
 * `DeviceTransport`).
 */
export class DeviceConnections {
  constructor(private readonly deps: DeviceConnectionsDeps) {}

  connect(connectionId: string, identity?: ConnectionIdentity): void {
    const { transport, sessions } = this.deps;
    const admission = sessions.admit(connectionId, identity);
    if (admission.kind === "retired")
      transport.send(connectionId, {
        type: "kicked",
        reason: "This player connection is being replaced.",
      });
    else if (admission.kind === "lobby") this.sendRealmList(connectionId);
    else if (admission.kind === "rejoin") this.rejoin(admission.session);
    else if (connectionId === "local")
      // Single-player: auto-join default realm immediately
      this.joinLocal(admission.session);
    else {
      // Multiplayer: start in lobby, send realm list
      console.log(
        `[tilefun] client connected: ${connectionId} as ${admission.session.displayName} (lobby)`,
      );
      this.sendRealmList(connectionId);
    }
  }

  /** Seat a guest of `host`'s device beside it, in its realm; a dormant guest resumes. */
  async join(host: PlayerSession, msg: JoinSeat): Promise<PlayerSession> {
    const { seat } = msg;
    if (host.seat !== 0 || !Number.isInteger(seat) || seat < 1 || seat >= MAX_SEATS)
      throw new Error("Invalid player seat.");
    const realm = host.realmId ? this.deps.realms.get(host.realmId) : undefined;
    if (!realm || host.transitioning) throw new Error("Join a world before adding players.");
    const name = typeof msg.displayName === "string" ? msg.displayName : undefined;
    const { kind, session } = this.deps.sessions.admitGuest(host, seat, name);
    if (msg.playerModel !== undefined) session.playerModel = normalizePlayerModel(msg.playerModel);
    session.debugPaused = host.debugPaused;
    if (kind === "rejoin") {
      // The returning device's one timeline: seat 0's sequence, not the old connection's.
      resetInput(session, host.lastProcessedInputSeq);
      applyPlayerModel(session.player, session.playerModel);
      if (session.realmId === host.realmId) {
        // Its client holds nothing for this seat yet: resend its session sync in seat 0's stream.
        realm.clearClientRevisions(session.clientId);
        return session;
      }
      // Seat 0 travelled while it was away (party travel, 226): it arrives beside seat 0.
    }
    try {
      await this.deps.transitions.move(session, async () => ({
        realm,
        arrival: beside(host, realm),
        clearOfBodies: true,
        standingZ: raisedStanding(realm, host.player),
        allowInterior: true,
        returnLocation: host.returnLocation,
      }));
    } catch (error) {
      this.deps.sessions.drop(session);
      throw error;
    }
    return session;
  }

  /** A guest leaves its device; the device's own seat leaves by disconnecting. */
  leave(host: PlayerSession, seat: number): void {
    const guest = this.deps.sessions
      .seats(host.connectionId)
      .find((session) => session.seat === seat && seat !== 0 && host.seat === 0);
    if (!guest) throw new Error("That player is not playing.");
    if (guest.transitioning) throw new Error("Wait for travel to finish.");
    const realmId = guest.realmId;
    this.deps.sessions.drop(guest);
    if (realmId) this.deps.playerCountChanged(realmId);
  }

  private sendRealmList(connectionId: string): void {
    void this.deps
      .track(this.deps.realms.realmList())
      .then((realms) => {
        this.deps.transport.send(connectionId, { type: "realm-list", realms });
      })
      .catch((error) => {
        console.error("[tilefun] realm list failed:", error);
        this.deps.transport.send(connectionId, { type: "realm-list", realms: [] });
      });
  }

  /** Reconnection: reuse the existing session and player entity once any transfer settles. */
  private rejoin(session: PlayerSession): void {
    const reconnect = () => {
      if (session.retired) return;
      const realm = this.deps.realms.get(session.realmId ?? "");
      if (!realm) return;
      resetInput(session);
      this.sendWorldLoaded(session, realm);
      realm.clearClientRevisions(session.clientId);
    };
    if (!session.transitioning) reconnect();
    else
      void this.deps
        .track(session.transitionDone.then(reconnect))
        .catch((error) => console.error("[tilefun] reconnect after transition failed:", error));
  }

  private joinLocal(session: PlayerSession): void {
    const { transitions, registry, realms } = this.deps;
    const realm = this.deps.activeRealm();
    const locations = this.deps.locations();
    const joining = locations
      ? transitions.move(session, () =>
          resumeDestination({ locations, registry, realms }, session, realm.currentWorldId ?? ""),
        )
      : realm.addPlayer(session);
    this.deps
      .track<unknown>(joining)
      .then(() => {
        if (session.retired) return;
        const realm = realms.get(session.realmId ?? "");
        if (!realm) throw new Error("Player destination unavailable.");
        console.log(
          `[tilefun] local client connected as ${session.displayName} (${realm.sessions.size} in realm)`,
        );
        this.sendWorldLoaded(session, realm);
      })
      .catch((error) => {
        this.deps.fail(error);
        this.deps.transport.send(session.clientId, {
          type: "kicked",
          reason: `Could not restore player: ${String(error)}`,
        });
      });
  }

  private sendWorldLoaded(session: PlayerSession, realm: Realm): void {
    this.deps.transport.send(session.clientId, {
      type: "player-assigned",
      entityId: session.player.id,
    });
    this.deps.transport.send(session.clientId, {
      type: "world-loaded",
      generation: realm.generation,
      ...(realm.interior ? { interior: realm.interior } : {}),
      ...(realm.currentWorldId ? { worldId: realm.currentWorldId } : {}),
      cameraX: session.player.position.wx,
      cameraY: session.player.position.wy,
      cameraZoom: session.cameraZoom,
    });
  }
}

/** One tile beside the host; the arrival search moves it off walls and water. */
function beside(host: PlayerSession, realm: Realm): Arrival {
  const { wx, wy } = host.player.position;
  return { x: wx / TILE_SIZE + 1, y: wy / TILE_SIZE, generation: realm.generation };
}
