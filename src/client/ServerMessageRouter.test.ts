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
    },
    canvas: { dataset: {} },
    camera: {
      zoom: 1,
      snapTo: log("camera.snapTo"),
      requestSnap: log("camera.requestSnap"),
    },
    renderer: { clear: log("renderer.clear") },
    device: { clearPresentation: log("device.clearPresentation") },
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
