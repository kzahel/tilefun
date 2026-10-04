import { CHUNK_SIZE_PX, ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { SavedPlayerData } from "../persistence/SaveManager.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import { type Arrival, safeArrival } from "./SafeArrival.js";

export interface RealmDestination {
  realm: Realm;
  beforeTransfer?: () => Promise<void>;
  arrival?: Arrival;
  allowInterior?: boolean;
  savedPlayer?: SavedPlayerData;
  returnLocation?: PlayerSession["returnLocation"];
}

/** One transfer lifecycle for menu navigation and building doors. */
export class RealmTransitions {
  constructor(
    private readonly findRealm: (id: string) => Realm | undefined,
    private readonly commit: (session: PlayerSession, realm: Realm) => Promise<void>,
    private readonly moved: (oldId: string | null, newId: string) => void,
  ) {}

  async move(session: PlayerSession, resolve: () => Promise<RealmDestination>) {
    if (session.transitioning) throw new Error("A realm transition is already running.");
    if (session.retired) throw new Error("This player connection was replaced.");
    session.transitioning = true;
    let finish!: () => void;
    session.transitionDone = new Promise<void>((resolve) => {
      finish = resolve;
    });
    try {
      await session.identityReady;
      const {
        realm: target,
        arrival,
        allowInterior,
        returnLocation,
        savedPlayer,
        beforeTransfer,
      } = await resolve();
      if (target.interior && !allowInterior)
        throw new Error("Enter this interior through its building door.");
      const position = arrival ? await safeArrival(target, arrival) : undefined;
      const oldId = session.realmId;
      const source = oldId ? this.findRealm(oldId) : undefined;
      // Same-world travel must read the latest live progress, not an older save.
      if (source === target) await source.flushAsync();
      const prepared = savedPlayer ?? (await target.preparePlayer(session));
      // A failed source save or destination read must leave the source player attached.
      if (source && source !== target) await source.flushAsync();
      if (session.retired) throw new Error("This player connection was replaced.");
      await beforeTransfer?.();
      if (session.retired) throw new Error("This player connection was replaced.");
      source?.removePlayer(session.clientId);
      // Capture after dismounting; the original entity identity survives rollback.
      const previous = {
        realmId: oldId,
        player: session.player,
        gameplaySession: session.gameplaySession,
        returnLocation: session.returnLocation,
        inputQueue: session.inputQueue,
        cameraX: session.cameraX,
        cameraY: session.cameraY,
        cameraZoom: session.cameraZoom,
        visibleRange: session.visibleRange,
      };
      try {
        await target.addPlayer(session, prepared);
        if (returnLocation !== undefined) session.returnLocation = returnLocation;
        session.inputQueue = [];
        if (position) {
          session.player.position = position;
          // Explicit travel leaves any saved moving-roof support behind.
          session.player.wz =
            target.world.getHeightAt(
              Math.floor(position.wx / TILE_SIZE),
              Math.floor(position.wy / TILE_SIZE),
            ) * ELEVATION_PX;
          session.player.groundZ = session.player.wz;
          delete session.player.jumpVZ;
          delete session.player.jumpZ;
          session.cameraX = position.wx;
          session.cameraY = position.wy;
          session.gameplaySession.lastSafePosition = position;
          const cx = Math.floor(position.wx / CHUNK_SIZE_PX);
          const cy = Math.floor(position.wy / CHUNK_SIZE_PX);
          session.visibleRange = { minCx: cx - 2, minCy: cy - 2, maxCx: cx + 2, maxCy: cy + 2 };
        }
        target.savePlayerData(session);
        await target.flushTransfer(source);
        await this.commit(session, target);
      } catch (error) {
        if (target.sessions.get(session.clientId) === session)
          target.removePlayer(session.clientId);
        Object.assign(session, previous);
        source?.restorePlayer(session);
        // A failed executor retains its pending destination pointer. Supersede it
        // with the restored source before any subsequent close/retry can commit it.
        if (source) await this.commit(session, source).catch(() => {});
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
      finish();
    }
  }
}
