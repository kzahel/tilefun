import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import { type Arrival, safeArrival } from "./SafeArrival.js";

export interface RealmDestination {
  realm: Realm;
  arrival?: Arrival;
  allowInterior?: boolean;
  returnLocation?: PlayerSession["returnLocation"];
}

/** One transfer lifecycle for menu navigation and building doors. */
export class RealmTransitions {
  constructor(
    private readonly findRealm: (id: string) => Realm | undefined,
    private readonly moved: (oldId: string | null, newId: string) => void,
  ) {}

  async move(session: PlayerSession, resolve: () => Promise<RealmDestination>) {
    if (session.transitioning) throw new Error("A realm transition is already running.");
    session.transitioning = true;
    try {
      const { realm: target, arrival, allowInterior, returnLocation } = await resolve();
      if (target.interior && !allowInterior)
        throw new Error("Enter this interior through its building door.");
      const position = arrival ? safeArrival(target, arrival) : undefined;
      const oldId = session.realmId;
      const source = oldId ? this.findRealm(oldId) : undefined;
      // Same-world travel must read the latest live progress, not an older save.
      if (source === target) await source.flushAsync();
      const prepared = await target.preparePlayer(session);
      // A failed source save or destination read must leave the source player attached.
      if (source && source !== target) await source.flushAsync();
      source?.removePlayer(session.clientId);
      // Capture after dismounting; the original entity identity survives rollback.
      const previous = { ...session, realmId: oldId };
      try {
        await target.addPlayer(session, prepared);
        if (returnLocation !== undefined) session.returnLocation = returnLocation;
        session.inputQueue = [];
        if (position) {
          session.player.position = position;
          session.cameraX = position.wx;
          session.cameraY = position.wy;
          session.gameplaySession.lastSafePosition = position;
          const cx = Math.floor(position.wx / CHUNK_SIZE_PX);
          const cy = Math.floor(position.wy / CHUNK_SIZE_PX);
          session.visibleRange = { minCx: cx - 2, minCy: cy - 2, maxCx: cx + 2, maxCy: cy + 2 };
        }
        target.savePlayerData(session);
        await target.flushAsync();
      } catch (error) {
        if (target.sessions.get(session.clientId) === session)
          target.removePlayer(session.clientId);
        Object.assign(session, previous);
        source?.restorePlayer(session);
        throw error;
      }
      // Ticks during saving may have emitted baselines the join response clears.
      target.clearClientRevisions(session.clientId);
      if (source && source !== target) source.flush();
      this.moved(oldId, session.realmId ?? "");
      return {
        cameraX: session.player.position.wx,
        cameraY: session.player.position.wy,
        cameraZoom: session.cameraZoom,
      };
    } finally {
      session.transitioning = false;
    }
  }
}
