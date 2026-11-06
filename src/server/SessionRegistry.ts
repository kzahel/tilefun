import type { ConnectionIdentity, IServerTransport } from "../transport/Transport.js";
import { PlayerSession } from "./PlayerSession.js";
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

  /** Every connected, non-dormant client id, in session order. */
  *awakeClientIds(): Generator<string> {
    const dormantIds = this.dormantIds();
    for (const [cid] of this.sessions) {
      if (dormantIds.has(cid)) continue;
      yield cid;
    }
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
    const session = new PlayerSession(clientId);
    const num = this.nextPlayerNumber++;
    session.playerNumber = num;
    session.displayName = identity?.displayName ?? `Player ${num}`;
    if (identity) session.profileId = identity.profileId;
    session.cursorColor = CURSOR_COLORS[(num - 1) % CURSOR_COLORS.length] ?? "#ffffff";

    // Add to global sessions map
    this.sessions.set(clientId, session);
    if (identity) this.identify(session, identity.profileId, identity.displayName);
    return { kind: "new", session };
  }

  /**
   * Keep a disconnected remote session alive for a grace period to allow reconnection
   * (e.g. page refresh). Returns whether a session became dormant.
   */
  disconnect(clientId: string): boolean {
    if (clientId === "local") return false;

    const session = this.sessions.get(clientId);
    if (!session) return false;

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
    return true;
  }

  private expire(clientId: string): void {
    this.dormantSessions.delete(clientId);
    const s = this.sessions.get(clientId);
    if (!s) return;
    // Remove from whatever realm the session is in
    if (s.realmId) {
      const realm = this.deps.realms.get(s.realmId);
      if (realm) {
        const realmId = s.realmId;
        realm.removePlayer(clientId);
        this.deps.realms.tryUnload(realmId);
      }
    }
    this.sessions.delete(clientId);
    console.log(`[tilefun] dormant session expired: ${clientId} (${s.displayName})`);
  }

  clearDormant(): void {
    for (const timer of this.dormantSessions.values()) clearTimeout(timer);
    this.dormantSessions.clear();
  }

  /** Takeovers serialize behind the old connection's transfer before reading its location. */
  identify(session: PlayerSession, profileId?: string, displayName?: string): void {
    if (profileId) {
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
    if (this.sessions.get(other.clientId) === other) this.sessions.delete(other.clientId);
    const timer = this.dormantSessions.get(other.clientId);
    if (timer) clearTimeout(timer);
    this.dormantSessions.delete(other.clientId);
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
