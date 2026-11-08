import { afterEach, expect, it, vi } from "vitest";
import type { ServerMessage } from "../shared/protocol.js";
import { LAST_WORLD_KEY } from "../shared/storageKeys.js";
import { type ServerMessageHost, ServerMessageRouter } from "./ServerMessageRouter.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Records host effects in call order; only the members a case touches are real. */
function fakeHost() {
  const calls: string[] = [];
  const log =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push(`${name}${args.length ? ` ${JSON.stringify(args)}` : ""}`);
  const host = {
    stateView: {
      interior: undefined,
      hasPredictedPlayer: false,
      editorEnabled: false,
      clear: log("stateView.clear"),
      bufferMessage: (msg: ServerMessage) => calls.push(`buffer ${msg.type}`),
      bufferSeatSync: (seat: number, msg: ServerMessage) => calls.push(`seat ${seat} ${msg.type}`),
    },
    canvas: { dataset: {} },
    camera: {
      zoom: 1,
      snapTo: log("camera.snapTo"),
      requestSnap: log("camera.requestSnap"),
    },
    renderer: { clear: log("renderer.clear") },
    device: {
      clearPresentation: log("device.clearPresentation"),
      seats: { drop: log("seats.drop"), get: (seat: number) => (seat === 2 ? {} : undefined) },
    },
    doorPresentation: { receive: (msg: ServerMessage) => calls.push(`door ${msg.type}`) },
    mainMenu: { currentWorldId: null, showCreationError: log("showCreationError") },
    editorModel: { setPatternStatus: log("setPatternStatus") },
    requests: { receive: (msg: ServerMessage) => calls.push(`receive ${msg.type}`) },
    debugPaused: true,
    initDone: false,
    clearPlayInput: log("clearPlayInput"),
    showWorldIdentity: log("showWorldIdentity"),
    sendVisibleRange: log("sendVisibleRange"),
    sendDebugState: log("sendDebugState"),
    sendRequest: (msg: unknown) => {
      calls.push(`sendRequest ${JSON.stringify(msg)}`);
      return Promise.resolve({});
    },
    takeRequestId: () => 7,
    destroy: log("destroy"),
  } as unknown as ServerMessageHost;
  return { host, calls };
}

function stubSessionStorage(values: Record<string, string> = {}) {
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  });
  return values;
}

it("enters a realm in the established effect order and resolves the reply last", () => {
  const storage = stubSessionStorage();
  vi.spyOn(console, "log").mockImplementation(() => {});
  const { host, calls } = fakeHost();
  const router = new ServerMessageRouter(host, {
    autoJoinRealm: false,
    reloadCamera: { realmId: "w1", cameraX: 5, cameraY: 6, zoom: 2 } as never,
  });
  const generation = { type: "flat", seed: 3 } as never;
  router.route({
    type: "realm-joined",
    requestId: 1,
    worldId: "w1",
    generation,
    cameraX: 1,
    cameraY: 2,
    cameraZoom: 3,
  });
  expect(calls).toEqual([
    "clearPlayInput",
    `setPatternStatus ${JSON.stringify([{ error: "", canUndo: false, canRedo: false }])}`,
    `showWorldIdentity ${JSON.stringify([generation])}`,
    "stateView.clear",
    "renderer.clear",
    "device.clearPresentation",
    "camera.snapTo [5,6]",
    "sendVisibleRange [true]",
    "sendDebugState [true,true]",
    "receive realm-joined",
  ]);
  expect(host.camera.zoom).toBe(2);
  expect(host.mainMenu.currentWorldId).toBe("w1");
  expect(storage).toEqual({ [LAST_WORLD_KEY]: "w1" });

  // The reload camera applies once; later entries use the message camera.
  calls.length = 0;
  router.route({ type: "world-loaded", cameraX: 8, cameraY: 9, cameraZoom: 4 });
  expect(calls).toContain("camera.snapTo [8,9]");
  expect(calls).toContain("camera.requestSnap");
  expect(host.camera.zoom).toBe(4);
});

it("buffers frame/sync state and tears down on kick without resolving requests", () => {
  const { host, calls } = fakeHost();
  const router = new ServerMessageRouter(host, { autoJoinRealm: false, reloadCamera: null });
  router.route({ type: "sync-cvars" } as ServerMessage);
  router.route({ type: "world-renamed", requestId: 4 });
  expect(calls).toEqual(["buffer sync-cvars", "receive sync-cvars", "receive world-renamed"]);

  calls.length = 0;
  const appended: unknown[] = [];
  vi.stubGlobal("document", {
    createElement: () => ({ style: {} }),
    body: { appendChild: (node: unknown) => appended.push(node) },
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  router.route({ type: "kicked", reason: "bye" });
  expect(calls).toEqual(["destroy"]);
  expect(appended).toEqual([{ style: expect.anything(), textContent: "Disconnected: bye" }]);
});

it("holds a lobby realm list until init and auto-joins once", () => {
  stubSessionStorage({ [LAST_WORLD_KEY]: "b" });
  const { host, calls } = fakeHost();
  const realms = [
    { id: "a", playerCount: 1 },
    { id: "b", playerCount: 0 },
  ] as never;
  const lobby = new ServerMessageRouter(host, { autoJoinRealm: false, reloadCamera: null });
  lobby.route({ type: "realm-list", realms });
  expect(lobby.takeLobbyRealmList()).toBe(realms);
  expect(lobby.takeLobbyRealmList()).toBeNull();

  const auto = new ServerMessageRouter(host, { autoJoinRealm: true, reloadCamera: null });
  calls.length = 0;
  auto.route({ type: "realm-list", realms });
  auto.route({ type: "realm-list", realms });
  expect(calls.filter((call) => call.startsWith("sendRequest"))).toEqual([
    `sendRequest ${JSON.stringify({ type: "join-realm", requestId: 7, worldId: "b", resume: true })}`,
  ]);
  expect(auto.takeLobbyRealmList()).toBe(realms);
});

it("routes a guest's envelope: device replies, its own sync and door walk, its own departure", () => {
  stubSessionStorage();
  vi.spyOn(console, "log").mockImplementation(() => {});
  const { host, calls } = fakeHost();
  const router = new ServerMessageRouter(host, { autoJoinRealm: false, reloadCamera: null });
  const guest = (message: ServerMessage): ServerMessage => ({ type: "seat", seat: 2, message });
  // A guest-led trip's reply is the device's, and resolves the guest's request.
  router.route(
    guest({
      type: "realm-joined",
      requestId: 3,
      worldId: "w2",
      cameraX: 1,
      cameraY: 2,
      cameraZoom: 1,
    }),
  );
  expect(calls[0]).toBe("clearPlayInput");
  expect(calls).toContain("stateView.clear");
  expect(calls.at(-1)).toBe("receive realm-joined");
  calls.length = 0;
  router.route(guest({ type: "request-error", requestId: 4, message: "no" }));
  router.route(
    guest({ type: "sync-session", gemsCollected: 2, editorEnabled: false } as ServerMessage),
  );
  router.route(
    guest({ type: "sync-invincibility", startTick: 1, durationTicks: 2 } as ServerMessage),
  );
  expect(calls).toEqual([
    "receive request-error",
    "seat 2 sync-session",
    "seat 2 sync-invincibility",
  ]);
  // Its own door walk takes the device through; its copies of others' are seat 0's too.
  calls.length = 0;
  const door = { type: "door-motion", phase: "depart", self: true } as ServerMessage;
  router.route(guest(door));
  router.route(guest({ ...door, self: false } as ServerMessage));
  expect(calls).toEqual(["clearPlayInput", "door door-motion"]);
  // A stream through the guest alone, and its body's announcement, are ignored.
  calls.length = 0;
  router.route(guest({ type: "frame" } as ServerMessage));
  router.route(guest({ type: "sync-chunks" } as ServerMessage));
  router.route(guest({ type: "vehicle-horn" } as ServerMessage));
  router.route(guest({ type: "player-assigned", entityId: 5 }));
  expect(calls).toEqual([]);
  // A guest kicked by authority leaves alone: the device plays on.
  router.route(guest({ type: "kicked", reason: "bye" }));
  expect(calls).toEqual(["seats.drop [2]"]);
  // A seat this client has not joined moves nothing; an answer still resolves.
  calls.length = 0;
  const unjoined = (message: ServerMessage): ServerMessage => ({ type: "seat", seat: 3, message });
  router.route(unjoined({ type: "world-loaded", cameraX: 0, cameraY: 0, cameraZoom: 1 }));
  router.route(unjoined({ type: "storage-status", paused: true, message: "x" }));
  router.route(unjoined(door));
  router.route(unjoined({ type: "request-error", requestId: 5, message: "no" }));
  expect(calls).toEqual([
    "receive world-loaded",
    "receive storage-status",
    "receive request-error",
  ]);
});
