import { encodeClientMessage, encodeServerMessage } from "../../src/shared/binaryCodec.ts";
import type {
  ClientMessage,
  ServerMessage,
  PropSnapshot,
  RemoteEditorCursor,
  RealmInfo,
} from "../../src/shared/protocol.ts";
import type { WorldMeta } from "../../src/persistence/IWorldRegistry.ts";

function sizeClient(msg: ClientMessage): number {
  return encodeClientMessage(msg).byteLength;
}

function sizeServer(msg: ServerMessage): number {
  return encodeServerMessage(msg).byteLength;
}

const prop: PropSnapshot = {
  id: 101,
  type: "prop-flower-red",
  position: { wx: 123.5, wy: 456.25 },
  sprite: {
    sheetKey: "me-complete",
    frameCol: 1,
    frameRow: 2,
    spriteWidth: 16,
    spriteHeight: 16,
  },
  collider: null,
};

const cursor: RemoteEditorCursor = {
  displayName: "Player 12",
  color: "#4fc3f7",
  tileX: 40,
  tileY: 55,
  editorTab: "terrain",
  brushMode: "paint",
};

const realm: RealmInfo = {
  id: "realm-1234567890",
  name: "My Realm",
  playerCount: 3,
  createdAt: 1700000000000,
  lastPlayedAt: 1700000001000,
  worldType: "generated",
};

const world: WorldMeta = {
  id: "world-1234567890",
  name: "World Name",
  createdAt: 1700000000000,
  lastPlayedAt: 1700000001000,
  seed: 123456,
  worldType: "generated",
};

const clientSamples: Array<[string, ClientMessage]> = [
  ["player-interact", { type: "player-interact", wx: 123.5, wy: 456.25 }],
  [
    "edit-terrain-tile",
    {
      type: "edit-terrain-tile",
      tx: 10,
      ty: 11,
      terrainId: 2,
      paintMode: "positive",
      bridgeDepth: 0,
    },
  ],
  [
    "edit-terrain-subgrid",
    {
      type: "edit-terrain-subgrid",
      gsx: 12,
      gsy: 13,
      terrainId: 2,
      paintMode: "positive",
      bridgeDepth: 0,
      shape: "plus",
    },
  ],
  [
    "edit-terrain-corner",
    {
      type: "edit-terrain-corner",
      gsx: 12,
      gsy: 13,
      terrainId: 2,
      paintMode: "positive",
      bridgeDepth: 0,
    },
  ],
  ["edit-road", { type: "edit-road", tx: 10, ty: 11, roadType: 1, paintMode: "positive" }],
  ["edit-elevation", { type: "edit-elevation", tx: 10, ty: 11, height: 2, gridSize: 2 }],
  ["edit-spawn", { type: "edit-spawn", wx: 120, wy: 96, entityType: "prop-flower-red" }],
  ["edit-delete-entity", { type: "edit-delete-entity", entityId: 999 }],
  ["edit-delete-prop", { type: "edit-delete-prop", propId: 777 }],
  ["edit-clear-terrain", { type: "edit-clear-terrain", terrainId: 2 }],
  ["edit-clear-roads", { type: "edit-clear-roads" }],
  ["set-editor-mode", { type: "set-editor-mode", enabled: true }],
  ["set-debug", { type: "set-debug", paused: false, noclip: false }],
  ["visible-range", { type: "visible-range", minCx: -3, minCy: -3, maxCx: 3, maxCy: 3 }],
  ["flush", { type: "flush" }],
  ["invalidate-all-chunks", { type: "invalidate-all-chunks" }],
  ["load-world", { type: "load-world", requestId: 101, worldId: "world-1234567890" }],
  [
    "create-world",
    {
      type: "create-world",
      requestId: 102,
      name: "New World",
      worldType: "generated",
      seed: 123456,
    },
  ],
  ["delete-world", { type: "delete-world", requestId: 103, worldId: "world-1234567890" }],
  ["list-worlds", { type: "list-worlds", requestId: 104 }],
  [
    "rename-world",
    {
      type: "rename-world",
      requestId: 105,
      worldId: "world-1234567890",
      name: "Renamed World",
    },
  ],
  ["rcon", { type: "rcon", requestId: 106, command: "spawn chicken 10" }],
  [
    "editor-cursor",
    { type: "editor-cursor", tileX: 40, tileY: 55, editorTab: "terrain", brushMode: "paint" },
  ],
  ["throw-ball", { type: "throw-ball", dirX: 1, dirY: 0, force: 0.8 }],
  ["identify", { type: "identify", displayName: "Player 12", profileId: "profile-abc-123" }],
  ["list-realms", { type: "list-realms", requestId: 107 }],
  ["join-realm", { type: "join-realm", requestId: 108, worldId: "world-1234567890" }],
  ["leave-realm", { type: "leave-realm", requestId: 109 }],
];

const serverSamples: Array<[string, ServerMessage]> = [
  ["player-assigned", { type: "player-assigned", entityId: 1 }],
  ["kicked", { type: "kicked", reason: "Connected from another tab" }],
  ["sync-session", { type: "sync-session", gemsCollected: 3, editorEnabled: false, mountEntityId: null }],
  ["sync-invincibility", { type: "sync-invincibility", startTick: 500, durationTicks: 45 }],
  ["sync-props-1", { type: "sync-props", props: [prop] }],
  [
    "sync-props-40",
    {
      type: "sync-props",
      props: Array.from({ length: 40 }, (_, i) => ({ ...prop, id: i + 1 })),
    },
  ],
  [
    "sync-cvars",
    {
      type: "sync-cvars",
      cvars: {
        gravity: 1,
        friction: 100,
        accelerate: 100,
        airAccelerate: 1,
        airWishCap: 6,
        stopSpeed: 16,
        noBunnyHop: false,
        smallJumps: false,
        platformerAir: false,
        timeScale: 1,
        tickMs: 16.6667,
        physicsMult: 1,
        tickRate: 60,
      },
    },
  ],
  ["sync-player-names-2", { type: "sync-player-names", playerNames: { 1: "Player 1", 2: "Player 2" } }],
  [
    "sync-player-names-16",
    {
      type: "sync-player-names",
      playerNames: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [i + 1, `Player ${i + 1}`]),
      ),
    },
  ],
  ["sync-editor-cursors-1", { type: "sync-editor-cursors", editorCursors: [cursor] }],
  [
    "sync-editor-cursors-8",
    {
      type: "sync-editor-cursors",
      editorCursors: Array.from({ length: 8 }, (_, i) => ({
        ...cursor,
        tileX: i,
        displayName: `P${i + 1}`,
      })),
    },
  ],
  [
    "world-loaded",
    {
      type: "world-loaded",
      requestId: 1,
      worldId: "world-1234567890",
      cameraX: 100,
      cameraY: 200,
      cameraZoom: 1,
    },
  ],
  ["world-created", { type: "world-created", requestId: 2, meta: world }],
  ["world-deleted", { type: "world-deleted", requestId: 3 }],
  ["world-list-1", { type: "world-list", requestId: 4, worlds: [world] }],
  [
    "world-list-20",
    {
      type: "world-list",
      requestId: 4,
      worlds: Array.from({ length: 20 }, (_, i) => ({
        ...world,
        id: `world-${i + 1}`,
        name: `World ${i + 1}`,
      })),
    },
  ],
  ["world-renamed", { type: "world-renamed", requestId: 5 }],
  ["rcon-response-2", { type: "rcon-response", requestId: 6, output: ["ok", "done"] }],
  [
    "rcon-response-20",
    {
      type: "rcon-response",
      requestId: 6,
      output: Array.from({ length: 20 }, (_, i) => `line ${i + 1}`),
    },
  ],
  ["realm-list-1", { type: "realm-list", requestId: 7, realms: [realm] }],
  [
    "realm-list-20",
    {
      type: "realm-list",
      requestId: 7,
      realms: Array.from({ length: 20 }, (_, i) => ({
        ...realm,
        id: `realm-${i + 1}`,
        name: `Realm ${i + 1}`,
        playerCount: i,
      })),
    },
  ],
  [
    "realm-joined",
    {
      type: "realm-joined",
      requestId: 8,
      worldId: "world-1234567890",
      cameraX: 100,
      cameraY: 200,
      cameraZoom: 1,
    },
  ],
  ["realm-left", { type: "realm-left", requestId: 9 }],
  ["realm-player-count", { type: "realm-player-count", worldId: "world-1234567890", count: 4 }],
  ["chat", { type: "chat", sender: "Player 1", text: "hello there" }],
];

console.log("CLIENT_SAMPLE_SIZES");
for (const [name, msg] of clientSamples) {
  console.log(`${name}\t${sizeClient(msg)}`);
}

console.log("SERVER_SAMPLE_SIZES");
for (const [name, msg] of serverSamples) {
  console.log(`${name}\t${sizeServer(msg)}`);
}
