import {
  type ConnectionIdentity,
  type IServerTransport,
  isConnectionId,
} from "../transport/Transport.js";
import { PlayerSession, seatSessionId } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import type { RealmDirectory } from "./RealmDirectory.js";

const CURSOR_COLORS = [
  "#4fc3f7",
  "#ff8a65",
  "#81c784",
  "#ba68c8",
  "#fff176",
  "#f06292",
  "#4dd0e1",
  "#a1887f",
];

const DORMANT_TIMEOUT_MS = 60_000;

export interface SessionRegistryDeps {
  transport: IServerTransport;
  realms: RealmDirectory;
  /** Track durable/realm operations for the server's lifecycle fence. */
  track: <T>(operation: Promise<T>) => Promise<T>;
  saveLocation: (session: PlayerSession, realm: Realm) => Promise<void>;
}

/**
 * How a connecting client relates to its existing session: `retired` connections are
 * being replaced, `lobby` sessions have no realm, `rejoin` sessions resume their realm
 * and `new` sessions were just created.
 */
type Admission = { kind: "retired" } | { kind: "lobby" | "rejoin" | "new"; session: PlayerSession };

/** Master session list — every connected player, regardless of realm — plus dormancy. */
export class SessionRegistry {
  private readonly sessions = new Map<string, PlayerSession>();
  /** Sessions that disconnected but may reconnect within the grace period. */
  private readonly dormantSessions = new Map<string, ReturnType<typeof setTimeout>>();
  /** Monotonic player number, incremented on each connect. */
  private nextPlayerNumber = 1;

  constructor(private readonly deps: SessionRegistryDeps) {}

  get(clientId: string): PlayerSession | undefined {
    return this.sessions.get(clientId);
  }

  /** Iterate all connected sessions (including dormant). */
  values(): IterableIterator<PlayerSession> {
    return this.sessions.values();
  }

  /** Check if a session is dormant (disconnected, awaiting reconnect). */
  isDormant(clientId: string): boolean {
    return this.dormantSessions.has(clientId);
  }

  dormantIds(): Set<string> {
    return new Set(this.dormantSessions.keys());
  }

  /** Every awake connection's id (its seat 0 session), once per device, in session order. */
  *awakeConnectionIds(): Generator<string> {
    const dormantIds = this.dormantIds();
    for (const [cid, session] of this.sessions) {
      if (dormantIds.has(cid) || session.seat !== 0) continue;
      yield cid;
    }
  }

  /** A device connection's seats, dormant ones included, in seat order (226). */
  seats(connectionId: string): PlayerSession[] {
    return [...this.sessions.values()]
      .filter((session) => session.connectionId === connectionId)
      .sort((a, b) => a.seat - b.seat);
  }

  /** Cancel a dormant cleanup timer, then reuse or create the client's session. */
  admit(clientId: string, identity?: ConnectionIdentity): Admission {
    const dormantTimer = this.dormantSessions.get(clientId);
    if (dormantTimer) {
      clearTimeout(dormantTimer);
      this.dormantSessions.delete(clientId);
    }

    // Reconnection: reuse existing session and player entity
    const existing = this.sessions.get(clientId);
    if (existing?.retired) return { kind: "retired" };
    if (existing && !existing.realmId && !existing.transitioning)
      return { kind: "lobby", session: existing };
    if (existing) return { kind: "rejoin", session: existing };

    // New connection: create session
    const session = this.create(clientId, identity?.displayName);
    if (identity) {
      const profileId = isConnectionId(identity.profileId) ? identity.profileId : undefined;
      session.profileId = profileId ?? null;
      this.identify(session, profileId, identity.displayName);
    }
    return { kind: "new", session };
  }

  /**
   * Seat a guest of `host`'s device (226): resume its dormant session, else create one.
   * Guests have no profile, so they never take one over; their saved data sits under the
   * host's. A new guest starts with the host's editor mode; the caller seats its player.
   */
  admitGuest(host: PlayerSession, seat: number, displayName?: string) {
    const clientId = seatSessionId(host.connectionId, seat);
    const existing = this.sessions.get(clientId);
    const dormantTimer = this.dormantSessions.get(clientId);
    if (existing && (!dormantTimer || existing.retired || existing.transitioning))
      throw new Error(`Player ${seat + 1} is already playing.`);
    if (existing) {
      clearTimeout(dormantTimer);
      this.dormantSessions.delete(clientId);
      return { kind: "rejoin" as const, session: existing };
    }
    const session = this.create(clientId);
    session.guestKey = seatSessionId(host.persistId, seat);
    session.editorEnabled = host.editorEnabled;
    this.identify(session, undefined, displayName);
    return { kind: "new" as const, session };
  }

  private create(clientId: string, displayName?: string): PlayerSession {
    const session = new PlayerSession(clientId);
    const num = this.nextPlayerNumber++;
    session.playerNumber = num;
    session.displayName = displayName ?? `Player ${num}`;
    session.cursorColor = CURSOR_COLORS[(num - 1) % CURSOR_COLORS.length] ?? "#ffffff";
    this.sessions.set(clientId, session);
    return session;
  }

  /**
   * Keep a disconnected remote device's seats alive for a grace period to allow
   * reconnection (e.g. page refresh). Returns whether any seat became dormant.
   */
  disconnect(connectionId: string): boolean {
    if (connectionId === "local") return false;
    const seats = this.seats(connectionId);
    for (const session of seats) this.sleep(session);
    return seats.length > 0;
  }

  private sleep(session: PlayerSession): void {
    const clientId = session.clientId;
    // A guest left dormant across a reconnect keeps its first deadline (and one timer).
    if (this.dormantSessions.has(clientId)) return;

    // Zero velocity so the dormant player entity doesn't drift
    if (session.player?.velocity) {
      session.player.velocity.vx = 0;
      session.player.velocity.vy = 0;
    }

    console.log(
      `[tilefun] client disconnected: ${clientId} (${session.displayName}), dormant for ${DORMANT_TIMEOUT_MS / 1000}s`,
    );

    const timer = setTimeout(() => this.expire(clientId), DORMANT_TIMEOUT_MS);
    this.dormantSessions.set(clientId, timer);
  }

  private expire(clientId: string): void {
    this.dormantSessions.delete(clientId);
    const s = this.sessions.get(clientId);
    if (!s) return;
    this.drop(s);
    console.log(`[tilefun] dormant session expired: ${clientId} (${s.displayName})`);
  }

  /** Take a session out of whatever realm it is in and forget it, dormant or not. */
  drop(session: PlayerSession): void {
    const realmId = session.realmId;
    const realm = realmId ? this.deps.realms.get(realmId) : undefined;
    if (realmId && realm) {
      realm.removePlayer(session.clientId);
      this.deps.realms.tryUnload(realmId);
    }
    this.forget(session);
  }

  private forget(session: PlayerSession): void {
    if (this.sessions.get(session.clientId) === session) this.sessions.delete(session.clientId);
    clearTimeout(this.dormantSessions.get(session.clientId));
    this.dormantSessions.delete(session.clientId);
  }

  clearDormant(): void {
    for (const timer of this.dormantSessions.values()) clearTimeout(timer);
    this.dormantSessions.clear();
  }

  /**
   * Takeovers serialize behind the old connection's transfer before reading its location.
   * A profile id holding the seat separator is ignored: it would share a key with another
   * profile's guest (226).
   */
  identify(session: PlayerSession, profileId?: string, displayName?: string): void {
    if (isConnectionId(profileId)) {
      if (session.profileId && session.profileId !== profileId) {
        this.deps.transport.send(session.clientId, {
          type: "kicked",
          reason: "Reconnect to change player profile.",
        });
        return;
      }
      session.profileId = profileId;
      const replaced = [...this.sessions.values()].filter(
        (other) => other !== session && other.profileId === profileId && !other.retired,
      );
      for (const other of replaced) other.retired = true;
      if (replaced.length)
        session.identityReady = this.deps.track(this.takeOver(session, replaced));
    }
    if (
      displayName &&
      ![...this.sessions.values()].some(
        (other) => other !== session && !other.retired && other.displayName === displayName,
      )
    )
      session.displayName = displayName;
  }

  private async takeOver(session: PlayerSession, replaced: PlayerSession[]): Promise<void> {
    try {
      for (const other of replaced) {
        await other.identityReady;
        await other.transitionDone;
        const realm = this.deps.realms.get(other.realmId ?? "");
        if (realm) {
          await realm.flushAsync();
          await this.deps.saveLocation(other, realm);
          realm.removePlayer(other.clientId);
        }
        this.evict(other);
      }
    } catch (error) {
      this.abandonTakeover(session, replaced);
      throw error;
    }
  }

  private evict(other: PlayerSession): void {
    // The replaced device's guests leave with it, each once its own travel settles.
    for (const guest of this.seats(other.connectionId)) {
      if (guest.seat === 0) continue;
      guest.retired = true;
      void this.deps
        .track(guest.transitionDone.then(() => this.drop(guest)))
        .catch((error) => console.error("[tilefun] replaced guest cleanup failed:", error));
    }
    this.forget(other);
    this.deps.transport.send(other.clientId, {
      type: "kicked",
      reason: "Logged in from another connection",
    });
  }

  /** Save failure must leave the old live player usable, not silently evict it. */
  private abandonTakeover(session: PlayerSession, replaced: PlayerSession[]): void {
    for (const other of replaced)
      if (this.sessions.get(other.clientId) === other) other.retired = false;
    session.retired = true;
    if (this.sessions.get(session.clientId) === session) this.sessions.delete(session.clientId);
    this.deps.transport.send(session.clientId, {
      type: "kicked",
      reason: "Could not save the previous connection. Try again.",
    });
  }
}
