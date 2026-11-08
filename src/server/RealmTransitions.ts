import { CHUNK_SIZE_PX, ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { SavedPlayerData } from "../persistence/SaveManager.js";
import { teleportBody } from "../physics/PhysicalEdits.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import { type Arrival, safeArrival } from "./SafeArrival.js";

export interface RealmDestination {
  realm: Realm;
  beforeTransfer?: () => Promise<void>;
  arrival?: Arrival;
  /** Also keep the arrival clear of other bodies, such as a host's car beside a guest (226). */
  clearOfBodies?: boolean;
  allowInterior?: boolean;
  savedPlayer?: SavedPlayerData;
  returnLocation?: PlayerSession["returnLocation"];
}

type Point = { wx: number; wy: number };

/** What a transfer replaces; a failed transfer puts it back. */
type Previous = Pick<
  PlayerSession,
  | "realmId"
  | "player"
  | "gameplaySession"
  | "returnLocation"
  | "inputQueue"
  | "cameraX"
  | "cameraY"
  | "cameraZoom"
  | "visibleRange"
>;

/** One seat of a transfer: where it came from, its saved progress there, and its old state. */
interface Traveller {
  readonly session: PlayerSession;
  readonly oldId: string | null;
  readonly source: Realm | undefined;
  prepared: SavedPlayerData | null;
  previous?: Previous;
}

/** Where followers arrive, in tiles from the leader and in seat order (226). */
const FOLLOW_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
] as const;

/** Mark every seat as travelling, or refuse before touching any of them. */
function begin(party: readonly PlayerSession[]): () => void {
  if (party.some((session) => session.transitioning))
    throw new Error("A realm transition is already running.");
  stillSeated(party);
  const finishes = party.map((session) => {
    session.transitioning = true;
    let finish!: () => void;
    session.transitionDone = new Promise<void>((done) => {
      finish = done;
    });
    return () => {
      session.transitioning = false;
      finish();
    };
  });
  return () => {
    for (const finish of finishes) finish();
  };
}

function stillSeated(party: readonly PlayerSession[]): void {
  if (party.some((session) => session.retired))
    throw new Error("This player connection was replaced.");
}

/** A seat's state before it left; captured after dismounting, so the body survives rollback. */
function capture(s: PlayerSession, realmId: string | null): Previous {
  return {
    realmId,
    player: s.player,
    gameplaySession: s.gameplaySession,
    returnLocation: s.returnLocation,
    inputQueue: s.inputQueue,
    cameraX: s.cameraX,
    cameraY: s.cameraY,
    cameraZoom: s.cameraZoom,
    visibleRange: s.visibleRange,
  };
}

/** Buildings and their overworld share progress, regardless of older visit saves. */
function sameWorld(a: Realm, b: Realm): boolean {
  return (
    (a.interior?.parentWorldId ?? a.currentWorldId) ===
    (b.interior?.parentWorldId ?? b.currentWorldId)
  );
}

/** Put a placed seat at its checked arrival, with its camera and range around it. */
function arriveAt(session: PlayerSession, target: Realm, position: Point): void {
  const tx = Math.floor(position.wx / TILE_SIZE),
    ty = Math.floor(position.wy / TILE_SIZE);
  teleportBody(session.player, {
    ...position,
    wz: target.world.getHeightAt(tx, ty) * ELEVATION_PX,
  });
  session.cameraX = position.wx;
  session.cameraY = position.wy;
  session.gameplaySession.lastSafePosition = position;
  const cx = Math.floor(position.wx / CHUNK_SIZE_PX);
  const cy = Math.floor(position.wy / CHUNK_SIZE_PX);
  session.visibleRange = { minCx: cx - 2, minCy: cy - 2, maxCx: cx + 2, maxCy: cy + 2 };
}

/** One transfer lifecycle for menu navigation, building doors and a device's seats. */
export class RealmTransitions {
  constructor(
    private readonly findRealm: (id: string) => Realm | undefined,
    private readonly commit: (session: PlayerSession, realm: Realm) => Promise<void>,
    /** After a transfer: the realms its seats left (null for the lobby) and the one they entered. */
    private readonly moved: (oldIds: ReadonlySet<string | null>, newId: string) => void,
  ) {}

  /** One player's transfer; see `moveParty`. */
  move(session: PlayerSession, resolve: () => Promise<RealmDestination>) {
    return this.moveParty(session, [], resolve);
  }

  /**
   * Seats travelling together (226). The leader resolves the destination and passes its
   * checks; followers arrive beside it without them. Either every seat arrives, or every
   * seat stays (or is put back) where it was. Resolves to the leader's camera.
   */
  async moveParty(
    leader: PlayerSession,
    followers: readonly PlayerSession[],
    resolve: () => Promise<RealmDestination>,
  ) {
    const party = [leader, ...followers];
    const finish = begin(party);
    try {
      for (const session of party) await session.identityReady;
      const destination = await resolve();
      const { realm: target, arrival } = destination;
      if (target.interior && !destination.allowInterior)
        throw new Error("Enter this interior through its building door.");
      const position = arrival ? await safeArrival(target, arrival, destination) : undefined;
      const travellers = await this.prepare(party, destination);
      stillSeated(party);
      await destination.beforeTransfer?.();
      stillSeated(party);
      await this.transfer(travellers, destination, position);
      this.settled(travellers, target);
      return {
        cameraX: leader.player.position.wx,
        cameraY: leader.player.position.wy,
        cameraZoom: leader.cameraZoom,
      };
    } finally {
      finish();
    }
  }

  /** Read every seat's saved progress at the destination, flushing what it leaves first. */
  private async prepare(
    party: readonly PlayerSession[],
    { realm: target, savedPlayer }: RealmDestination,
  ): Promise<Traveller[]> {
    const travellers: Traveller[] = party.map((session) => {
      const oldId = session.realmId;
      return { session, oldId, source: oldId ? this.findRealm(oldId) : undefined, prepared: null };
    });
    // Same-world travel must read the latest live progress, not an older save.
    if (travellers.some((t) => t.source === target)) await target.flushAsync();
    for (const [i, t] of travellers.entries())
      t.prepared = (i === 0 ? savedPlayer : undefined) ?? (await target.preparePlayer(t.session));
    // A failed source save or destination read must leave every source player attached.
    for (const source of new Set(travellers.map((t) => t.source)))
      if (source && source !== target) await source.flushAsync();
    return travellers;
  }

  /** Move the seats, leader first; any failure puts every moved seat back where it was. */
  private async transfer(
    travellers: readonly Traveller[],
    destination: RealmDestination,
    lead: Point | undefined,
  ): Promise<void> {
    const target = destination.realm;
    const moved: Traveller[] = [];
    try {
      for (const t of travellers) {
        t.source?.removePlayer(t.session.clientId);
        t.previous = capture(t.session, t.oldId);
        moved.push(t);
        const position = moved.length === 1 ? lead : await this.follow(target, moved);
        await this.place(t, destination, position);
      }
      for (const source of new Set(travellers.map((t) => t.source)))
        await target.flushTransfer(source);
      for (const t of travellers) await this.commit(t.session, target);
    } catch (error) {
      for (const t of moved.reverse()) await this.restore(t, target);
      throw error;
    }
  }

  /** A follower's arrival: beside the leader, clear of walls, props and placed bodies. */
  private follow(target: Realm, moved: readonly Traveller[]): Promise<Point> {
    const leader = moved[0]?.session;
    if (!leader) throw new Error("A party needs its leader.");
    const [dx, dy] = FOLLOW_OFFSETS[(moved.length - 2) % FOLLOW_OFFSETS.length] ?? [1, 0];
    const { wx, wy } = leader.player.position;
    const arrival = {
      x: wx / TILE_SIZE + dx,
      y: wy / TILE_SIZE + dy,
      generation: target.generation,
    };
    return safeArrival(target, arrival, { clearOfBodies: true });
  }

  private async place(t: Traveller, destination: RealmDestination, position: Point | undefined) {
    const { session, source, previous } = t;
    const target = destination.realm;
    const restored = t.prepared ? { ...t.prepared } : t.prepared;
    if (position && restored) delete restored.driving;
    await target.addPlayer(session, restored);
    if (source && previous && sameWorld(source, target))
      session.gameplaySession.gemsCollected = previous.gameplaySession.gemsCollected;
    if (destination.returnLocation !== undefined)
      session.returnLocation = destination.returnLocation;
    session.inputQueue = [];
    if (position) arriveAt(session, target, position);
    target.savePlayerData(session);
  }

  /** Reattach a seat's original body where it was, superseding any staged destination. */
  private async restore({ session, source, previous }: Traveller, target: Realm) {
    if (target.sessions.get(session.clientId) === session) target.removePlayer(session.clientId);
    if (previous) Object.assign(session, previous);
    source?.restorePlayer(session);
    // A failed executor retains its pending destination pointer. Supersede it
    // with the restored source before any subsequent close/retry can commit it.
    if (source) await this.commit(session, source).catch(() => {});
  }

  private settled(travellers: readonly Traveller[], target: Realm): void {
    // Ticks during saving may have emitted baselines the join response clears.
    for (const { session } of travellers) target.clearClientRevisions(session.clientId);
    for (const source of new Set(travellers.map((t) => t.source)))
      if (source && source !== target) source.flush();
    this.moved(new Set(travellers.map((t) => t.oldId)), target.currentWorldId ?? "");
  }
}
