import { RENDER_DISTANCE } from "../config/constants.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import {
  getAccelerate,
  getAirAccelerate,
  getAirWishCap,
  getFriction,
  getGravityScale,
  getNoBunnyHop,
  getPhysicsCVarRevision,
  getPlatformerAir,
  getSmallJumps,
  getStopSpeed,
  getTimeScale,
} from "../physics/PlayerMovement.js";
import { diffEntitySnapshots, type EntityDelta } from "../shared/entityDelta.js";
import type {
  EntitySnapshot,
  FrameMessage,
  RemoteEditorCursor,
  ServerMessage,
  SyncChunksMessage,
} from "../shared/protocol.js";
import { serializeChunk, serializeEntity, serializeProp } from "../shared/serialization.js";
import type { World } from "../world/World.js";
import type { PlayerSession } from "./PlayerSession.js";

const BROADCAST_BUFFER_CHUNKS = 2;

interface ReplicationSource {
  readonly roomState?: import("../interiors/GameplayRoom.js").GameplayRoomState | null;
  readonly world: World;
  readonly entityManager: EntityManager;
  readonly propManager: PropManager;
  readonly sessions: ReadonlyMap<string, PlayerSession>;
  readonly tickCounter: number;
  readonly simulationTime?: number;
  readonly tickRate: number;
  readonly physicsMult: number;
  readonly playerNamesRevision: number;
  readonly editorCursorsRevision: number;
}

/** Per-client delta tracking — stores last-sent values to avoid resending unchanged fields. */
interface ClientDeltaState {
  // Scalars — last-sent value (sentinel forces full first send)
  gemsCollected: number;
  /** Last observed server-side timer, used to detect invincibility starts/resets. */
  invincibilityTimer: number;
  editorEnabled: boolean;
  mountEntityId: number | null;

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

function createClientDeltaState(): ClientDeltaState {
  return {
    gemsCollected: -1,
    invincibilityTimer: -1,
    editorEnabled: false, // will differ from true default → forces first send
    mountEntityId: -2 as number | null, // impossible entity ID → forces first send
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

/** Owns per-client baselines and translates live realm state into protocol messages. */
export class RealmReplicator {
  private readonly clientDeltaStates = new Map<string, ClientDeltaState>();

  clearClient(clientId: string): void {
    this.clientDeltaStates.delete(clientId);
  }

  clear(): void {
    this.clientDeltaStates.clear();
  }

  build(clientId: string, source: ReplicationSource): ServerMessage[] {
    const session = source.sessions.get(clientId);
    if (!session) throw new Error(`No session for ${clientId}`);

    // Get or create per-client delta state (sentinels force full first send)
    let delta = this.clientDeltaStates.get(clientId);
    if (!delta) {
      delta = createClientDeltaState();
      this.clientDeltaStates.set(clientId, delta);
    }
    const revisions = delta.chunkRevisions;

    // Collect loaded chunk keys and build delta updates.
    // Only include chunks within this session's visible range (+ RENDER_DISTANCE
    // buffer) so we don't send chunks loaded for other sessions.
    const range = session.visibleRange;
    const chunkBuf = RENDER_DISTANCE;
    const cMinCx = range.minCx - chunkBuf;
    const cMaxCx = range.maxCx + chunkBuf;
    const cMinCy = range.minCy - chunkBuf;
    const cMaxCy = range.maxCy + chunkBuf;

    const loadedChunkKeys: string[] = [];
    const chunkUpdates = [];
    for (const [key, chunk] of source.world.chunks.entries()) {
      const commaIdx = key.indexOf(",");
      const cx = Number(key.slice(0, commaIdx));
      const cy = Number(key.slice(commaIdx + 1));
      if (cx < cMinCx || cx > cMaxCx || cy < cMinCy || cy > cMaxCy) continue;
      loadedChunkKeys.push(key);
      const lastRev = revisions.get(key) ?? -1;
      if (chunk.revision > lastRev) {
        chunkUpdates.push(serializeChunk(cx, cy, chunk));
        revisions.set(key, chunk.revision);
      }
    }

    // Clean up revisions for chunks no longer in this session's range
    for (const key of revisions.keys()) {
      const ci = key.indexOf(",");
      const kcx = Number(key.slice(0, ci));
      const kcy = Number(key.slice(ci + 1));
      if (kcx < cMinCx || kcx > cMaxCx || kcy < cMinCy || kcy > cMaxCy) {
        revisions.delete(key);
      }
    }

    // Filter entities to those near the player's viewport
    const buf = BROADCAST_BUFFER_CHUNKS;
    const nearbyEntities = source.entityManager.spatialHash.queryRange(
      range.minCx - buf,
      range.minCy - buf,
      range.maxCx + buf,
      range.maxCy + buf,
    );
    // Ensure the player entity is always included
    if (!nearbyEntities.includes(session.player)) {
      nearbyEntities.push(session.player);
    }
    // Ensure the mount entity is always included when riding
    if (session.gameplaySession.mountId !== null) {
      const mount = source.entityManager.entities.find(
        (e) => e.id === session.gameplaySession.mountId,
      );
      if (mount && !nearbyEntities.includes(mount)) {
        nearbyEntities.push(mount);
      }
    }

    // Entity delta compression: baselines for new, deltas for changed, exits for removed
    const lastSent = delta.lastSentEntities;
    const currentEntityIds = new Set<number>();
    const entityBaselines: EntitySnapshot[] = [];
    const entityDeltas: EntityDelta[] = [];

    for (const entity of nearbyEntities) {
      const snapshot = serializeEntity(entity);
      currentEntityIds.add(entity.id);
      const prev = lastSent.get(entity.id);
      if (!prev) {
        // New entity — send full baseline
        entityBaselines.push(snapshot);
      } else {
        // Known entity — diff and send delta if changed
        const d = diffEntitySnapshots(prev, snapshot);
        if (d) entityDeltas.push(d);
      }
      lastSent.set(entity.id, snapshot);
    }

    // Find entities that left visibility (were in lastSent but not in current nearby set)
    const entityExits: number[] = [];
    for (const id of lastSent.keys()) {
      if (!currentEntityIds.has(id)) {
        entityExits.push(id);
        lastSent.delete(id);
      }
    }

    // -- Build messages array: frame first, then sync events --
    const messages: ServerMessage[] = [];

    // Frame message (always sent every tick)
    const frame: FrameMessage = {
      type: "frame",
      serverTick: source.tickCounter,
      ...(source.simulationTime !== undefined ? { simulationTime: source.simulationTime } : {}),
      lastProcessedInputSeq: session.lastProcessedInputSeq,
      playerEntityId: session.player.id,
    };
    if (entityBaselines.length > 0) frame.entityBaselines = entityBaselines;
    if (entityDeltas.length > 0) frame.entityDeltas = entityDeltas;
    if (entityExits.length > 0) frame.entityExits = entityExits;
    messages.push(frame);

    // Sync: session scalars (gems, editor, mount)
    const gems = session.gameplaySession.gemsCollected;
    const invTimer = session.gameplaySession.invincibilityTimer;
    const currentMount = session.gameplaySession.mountId;
    const sessionDirty =
      gems !== delta.gemsCollected ||
      session.editorEnabled !== delta.editorEnabled ||
      currentMount !== delta.mountEntityId;
    if (sessionDirty) {
      messages.push({
        type: "sync-session",
        gemsCollected: gems,
        editorEnabled: session.editorEnabled,
        mountEntityId: currentMount,
      });
      delta.gemsCollected = gems;
      delta.editorEnabled = session.editorEnabled;
      delta.mountEntityId = currentMount;
    }

    // Sync: invincibility event (start/reset only, countdown reconstructed client-side)
    const invincibilityStarted =
      invTimer > 0 && (delta.invincibilityTimer <= 0 || invTimer > delta.invincibilityTimer);
    if (invincibilityStarted) {
      messages.push({
        type: "sync-invincibility",
        startTick: source.tickCounter,
        durationTicks: Math.max(1, Math.ceil(invTimer * source.tickRate)),
      });
    }
    delta.invincibilityTimer = invTimer;

    // Sync: chunks (keys and/or data)
    loadedChunkKeys.sort();
    const keysJoined = loadedChunkKeys.join(";");
    const chunkKeysDirty = keysJoined !== delta.loadedChunkKeysJoined;
    if (chunkKeysDirty || chunkUpdates.length > 0) {
      const syncChunks: SyncChunksMessage = { type: "sync-chunks" };
      if (chunkKeysDirty) {
        syncChunks.loadedChunkKeys = loadedChunkKeys;
        delta.loadedChunkKeysJoined = keysJoined;
      }
      if (chunkUpdates.length > 0) {
        syncChunks.chunkUpdates = chunkUpdates;
      }
      messages.push(syncChunks);
    }

    const roomRevision = source.roomState?.revision ?? -1;
    if (roomRevision !== delta.roomRevision) {
      messages.push({ type: "sync-room", room: source.roomState ?? null });
      delta.roomRevision = roomRevision;
    }

    // Sync: props
    const propRangeKey = `${range.minCx - buf},${range.minCy - buf},${range.maxCx + buf},${range.maxCy + buf}`;
    if (source.propManager.revision !== delta.propRevision || propRangeKey !== delta.propRangeKey) {
      const nearbyProps = source.propManager.getPropsInChunkRange(
        range.minCx - buf,
        range.minCy - buf,
        range.maxCx + buf,
        range.maxCy + buf,
      );
      messages.push({ type: "sync-props", props: nearbyProps.map(serializeProp) });
      delta.propRevision = source.propManager.revision;
      delta.propRangeKey = propRangeKey;
    }

    // Sync: playerNames
    if (source.playerNamesRevision !== delta.playerNamesRevision) {
      const playerNames: Record<number, string> = {};
      for (const [, other] of source.sessions) {
        playerNames[other.player.id] = other.displayName;
      }
      messages.push({ type: "sync-player-names", playerNames });
      delta.playerNamesRevision = source.playerNamesRevision;
    }

    // Sync: editorCursors
    if (source.editorCursorsRevision !== delta.editorCursorsRevision) {
      const editorCursors: RemoteEditorCursor[] = [];
      for (const [otherId, other] of source.sessions) {
        if (otherId === clientId || !other.editorEnabled || !other.editorCursor) continue;
        editorCursors.push({
          displayName: other.displayName,
          color: other.cursorColor,
          tileX: other.editorCursor.tileX,
          tileY: other.editorCursor.tileY,
          editorTab: other.editorCursor.editorTab,
          brushMode: other.editorCursor.brushMode,
        });
      }
      messages.push({ type: "sync-editor-cursors", editorCursors });
      delta.editorCursorsRevision = source.editorCursorsRevision;
    }

    // Sync: cvars
    const cvarsRev = getPhysicsCVarRevision();
    if (cvarsRev !== delta.cvarsRevision) {
      messages.push({
        type: "sync-cvars",
        cvars: {
          gravity: getGravityScale(),
          friction: getFriction(),
          accelerate: getAccelerate(),
          airAccelerate: getAirAccelerate(),
          airWishCap: getAirWishCap(),
          stopSpeed: getStopSpeed(),
          noBunnyHop: getNoBunnyHop(),
          smallJumps: getSmallJumps(),
          platformerAir: getPlatformerAir(),
          timeScale: getTimeScale(),
          tickMs: 1000 / source.tickRate,
          physicsMult: source.physicsMult,
          tickRate: source.tickRate,
        },
      });
      delta.cvarsRevision = cvarsRev;
    }

    return messages;
  }
}
