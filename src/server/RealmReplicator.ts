import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import { getGravityRevision, getGravityScale } from "../physics/Gravity.js";
import { diffEntitySnapshots, type EntityDelta } from "../shared/entityDelta.js";
import type {
  EntitySnapshot,
  FrameMessage,
  RemoteEditorCursor,
  ServerMessage,
  SyncChunksMessage,
} from "../shared/protocol.js";
import { reuseEntitySnapshot, serializeProp } from "../shared/serialization.js";
import type { World } from "../world/World.js";
import { type PlayerSession, seatAddress } from "./PlayerSession.js";
import {
  interestChunks,
  interestEntities,
  interestProps,
  StreamInterest,
} from "./ReplicationInterest.js";
import { createSeatSyncState, type SeatSyncState, seatSync } from "./SeatSync.js";

interface ReplicationSource {
  readonly roomState?: import("../interiors/GameplayRoom.js").GameplayRoomState | null;
  readonly world: World;
  readonly entityManager: EntityManager;
  readonly propManager: PropManager;
  readonly sessions: ReadonlyMap<string, PlayerSession>;
  readonly tickCounter: number;
  readonly simulationTime?: number;
  /** Prediction context around one anchor per seat in the stream. */
  readonly physicsSnapshot?: (
    anchorIds: readonly number[],
    visible: ReadonlySet<number>,
  ) => import("../physics/PhysicsState.js").PhysicsState;
  readonly tickRate: number;
  readonly playerNamesRevision: number;
  readonly editorCursorsRevision: number;
}

/**
 * Per-stream delta tracking (226: one stream per connection in a realm) — stores
 * last-sent values to avoid resending unchanged fields.
 */
interface StreamDeltaState {
  /** The seat the stream goes through; a new one is a new replica on the device. */
  address: string;
  /** Each seat's own session sync, by session id. */
  seats: Map<string, SeatSyncState>;

  // Objects — last-sent revision counter
  roomRevision: number;
  propRevision: number;
  propRangeKey: string;
  cvarsRevision: number;
  playerNamesRevision: number;
  editorCursorsRevision: number;

  // Chunk keys — last-sent joined string
  loadedChunkKeysJoined: string;

  // Chunk revisions (folded from old clientChunkRevisions)
  chunkRevisions: Map<string, number>;

  // Entity delta tracking — last-sent snapshot per entity ID
  lastSentEntities: Map<number, EntitySnapshot>;
}

function createStreamDeltaState(address: string): StreamDeltaState {
  return {
    address,
    seats: new Map(),
    roomRevision: -2,
    propRevision: -1,
    propRangeKey: "",
    cvarsRevision: -1,
    playerNamesRevision: -1,
    editorCursorsRevision: -1,
    loadedChunkKeysJoined: "",
    chunkRevisions: new Map(),
    lastSentEntities: new Map(),
  };
}

/** Owns per-stream baselines and translates live realm state into protocol messages. */
export class RealmReplicator {
  /** One stream per connection with seats in this realm, keyed by connection id. */
  private readonly streams = new Map<string, StreamDeltaState>();
  // Object identity prevents recycled IDs from borrowing another actor's state.
  // Weak keys release actors after despawn; each build checks live wire values,
  // including edits made between two clients' builds within the same tick.
  private snapshots = new WeakMap<Entity, EntitySnapshot>();

  /**
   * Force a full re-send for a seat: the whole stream when it goes through that seat (its
   * replica is cleared with it), otherwise only that seat's own session sync.
   */
  clearClient(clientId: string): void {
    const { connectionId } = seatAddress(clientId);
    const stream = this.streams.get(connectionId);
    if (stream?.address === clientId) this.streams.delete(connectionId);
    else stream?.seats.delete(clientId);
  }

  clear(): void {
    this.streams.clear();
    this.snapshots = new WeakMap();
  }

  /**
   * The stream sent through `clientId` (226: its connection's lowest live seat here): the
   * frame, that seat's own sync and the realm's shared sync. `others` are the connection's
   * other seats in the stream; their own sync comes from `seatSync`.
   */
  build(
    clientId: string,
    source: ReplicationSource,
    others: readonly PlayerSession[] = [],
  ): ServerMessage[] {
    const session = source.sessions.get(clientId);
    if (!session) throw new Error(`No session for ${clientId}`);
    const seats: [PlayerSession, ...PlayerSession[]] = [session, ...others];
    const delta = this.stream(session);
    const interest = new StreamInterest(seats.map((seat) => seat.visibleRange));
    const nearby = interestEntities(
      source.entityManager,
      interest,
      source.sessions.values(),
      seats,
    );
    const frame = this.frame(seats, source, nearby, delta.lastSentEntities);
    return [
      frame,
      ...this.seatSync(session, source.tickCounter, source.tickRate),
      ...this.sharedSync(session, source, interest, delta),
    ];
  }

  /** A seat's own session sync; its stream must have been built this tick. */
  seatSync(session: PlayerSession, tickCounter: number, tickRate: number): ServerMessage[] {
    const stream = this.streams.get(session.connectionId);
    if (!stream) throw Error(`No stream for ${session.clientId}`);
    let state = stream.seats.get(session.clientId);
    if (!state) {
      state = createSeatSyncState();
      stream.seats.set(session.clientId, state);
    }
    return seatSync(session, state, tickCounter, tickRate);
  }

  private stream(address: PlayerSession): StreamDeltaState {
    let stream = this.streams.get(address.connectionId);
    // A different lowest seat is a different replica on the device: start over.
    if (stream?.address !== address.clientId) {
      stream = createStreamDeltaState(address.clientId);
      this.streams.set(address.connectionId, stream);
    }
    return stream;
  }

  /** Entity baselines for new actors, deltas for changed ones and exits for departed ones. */
  private frame(
    seats: readonly [PlayerSession, ...PlayerSession[]],
    source: ReplicationSource,
    nearby: readonly Entity[],
    lastSent: Map<number, EntitySnapshot>,
  ): FrameMessage {
    const [session] = seats;
    const currentEntityIds = new Set<number>();
    const entityBaselines: EntitySnapshot[] = [];
    const entityDeltas: EntityDelta[] = [];
    for (const entity of nearby) {
      const snapshot = reuseEntitySnapshot(entity, this.snapshots.get(entity));
      this.snapshots.set(entity, snapshot);
      currentEntityIds.add(entity.id);
      const prev = lastSent.get(entity.id);
      if (!prev) entityBaselines.push(snapshot);
      else if (prev !== snapshot) {
        const d = diffEntitySnapshots(prev, snapshot);
        if (d) entityDeltas.push(d);
      }
      lastSent.set(entity.id, snapshot);
    }
    const entityExits: number[] = [];
    for (const id of lastSent.keys())
      if (!currentEntityIds.has(id)) {
        entityExits.push(id);
        lastSent.delete(id);
      }

    const frame: FrameMessage = {
      type: "frame",
      serverTick: source.tickCounter,
      ...(source.simulationTime !== undefined ? { simulationTime: source.simulationTime } : {}),
      // One acknowledgement per stream: its seats share the device's input timeline.
      lastProcessedInputSeq: session.lastProcessedInputSeq,
      playerEntityId: session.player.id,
    };
    if (seats.length > 1 || session.seat !== 0)
      frame.seats = seats.map((seat) => ({ seat: seat.seat, entityId: seat.player.id }));
    const anchors = seats.map((seat) => seat.player.parentId ?? seat.player.id);
    if (source.physicsSnapshot) frame.physics = source.physicsSnapshot(anchors, currentEntityIds);
    if (entityBaselines.length > 0) frame.entityBaselines = entityBaselines;
    if (entityDeltas.length > 0) frame.entityDeltas = entityDeltas;
    if (entityExits.length > 0) frame.entityExits = entityExits;
    return frame;
  }

  /** Terrain, room, props, names, editor cursors and cvars, each when it changed. */
  private sharedSync(
    session: PlayerSession,
    source: ReplicationSource,
    interest: StreamInterest,
    delta: StreamDeltaState,
  ): ServerMessage[] {
    const messages: ServerMessage[] = [];
    const chunks = interestChunks(source.world, interest, delta.chunkRevisions);
    chunks.loadedChunkKeys.sort();
    const keysJoined = chunks.loadedChunkKeys.join(";");
    const chunkKeysDirty = keysJoined !== delta.loadedChunkKeysJoined;
    if (chunkKeysDirty || chunks.chunkUpdates.length > 0) {
      const syncChunks: SyncChunksMessage = { type: "sync-chunks" };
      if (chunkKeysDirty) {
        syncChunks.loadedChunkKeys = chunks.loadedChunkKeys;
        delta.loadedChunkKeysJoined = keysJoined;
      }
      if (chunks.chunkUpdates.length > 0) syncChunks.chunkUpdates = chunks.chunkUpdates;
      messages.push(syncChunks);
    }

    const roomRevision = source.roomState?.revision ?? -1;
    if (roomRevision !== delta.roomRevision) {
      messages.push({ type: "sync-room", room: source.roomState ?? null });
      delta.roomRevision = roomRevision;
    }

    if (source.propManager.revision !== delta.propRevision || interest.key !== delta.propRangeKey) {
      const props = interestProps(source.propManager, interest);
      messages.push({ type: "sync-props", props: props.map(serializeProp) });
      delta.propRevision = source.propManager.revision;
      delta.propRangeKey = interest.key;
    }

    if (source.playerNamesRevision !== delta.playerNamesRevision) {
      const playerNames: Record<number, string> = {};
      for (const [, other] of source.sessions) playerNames[other.player.id] = other.displayName;
      messages.push({ type: "sync-player-names", playerNames });
      delta.playerNamesRevision = source.playerNamesRevision;
    }

    if (source.editorCursorsRevision !== delta.editorCursorsRevision) {
      messages.push({ type: "sync-editor-cursors", editorCursors: editorCursors(session, source) });
      delta.editorCursorsRevision = source.editorCursorsRevision;
    }

    const cvarsRev = getGravityRevision();
    if (cvarsRev !== delta.cvarsRevision) {
      messages.push({ type: "sync-cvars", cvars: { gravity: getGravityScale() } });
      delta.cvarsRevision = cvarsRev;
    }
    return messages;
  }
}

/** Other devices' editor cursors; a device's own seats are local to it. */
function editorCursors(session: PlayerSession, source: ReplicationSource): RemoteEditorCursor[] {
  const cursors: RemoteEditorCursor[] = [];
  for (const other of source.sessions.values()) {
    if (other.connectionId === session.connectionId || !other.editorEnabled || !other.editorCursor)
      continue;
    cursors.push({
      displayName: other.displayName,
      color: other.cursorColor,
      tileX: other.editorCursor.tileX,
      tileY: other.editorCursor.tileY,
      editorTab: other.editorCursor.editorTab,
      brushMode: other.editorCursor.brushMode,
    });
  }
  return cursors;
}
