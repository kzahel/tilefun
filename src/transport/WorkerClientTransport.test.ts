import { describe, expect, it, vi } from "vitest";
import { RequestBroker } from "../client/RequestBroker.js";
import { type LocalAuthority, LocalServerRuntime } from "../server/LocalServerRuntime.js";
import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import type { LocalHostBoot, LocalHostPacket } from "../shared/localHostProtocol.js";
import type { ClientMessage } from "../shared/protocol.js";
import type { ChannelEnvelope } from "./OrderedWorkerChannel.js";
import type { IServerTransport } from "./Transport.js";
import { WorkerClientTransport, type WorkerEndpoint } from "./WorkerClientTransport.js";

function rig(
  options: {
    init?: () => Promise<void>;
    settle?: () => Promise<void>;
    flush?: () => Promise<void>;
    watchdogMs?: number;
    keepAliveWhenHidden?: boolean;
  } = {},
) {
  const events: string[] = [];
  const errors: Error[] = [];
  const faults: { kind: string; error: Error }[] = [];
  let serverTransport!: IServerTransport;
  const authority: LocalAuthority = {
    init: async () => {
      await options.init?.();
      events.push("init");
    },
    startLoop: () => events.push("start"),
    stopLoop: () => events.push("stop"),
    settle: async () => {
      events.push("settle");
      await options.settle?.();
    },
    flushAsync: async () => {
      events.push("flush");
      await options.flush?.();
    },
    destroy: () => {
      events.push("destroy");
    },
    completedTicks: 0,
    onLoopError: undefined,
  };
  const deliver = (data: unknown, transfer: ArrayBuffer[] = []) => {
    const copied = structuredClone(data, { transfer });
    queueMicrotask(() => endpoint.onmessage?.({ data: copied } as MessageEvent));
  };
  const runtime = new LocalServerRuntime(
    deliver,
    (error) => deliver({ kind: "failed", error: String(error) }),
    (transport) => {
      serverTransport = transport;
      transport.onConnect((id) => events.push(`connect:${id}`));
      transport.onDisconnect((id) => events.push(`disconnect:${id}`));
      transport.onMessage((id, message: ClientMessage) => {
        events.push(message.type);
        if (id !== "local") events.push(`${id}:${message.type}`);
      });
      return authority;
    },
  );
  const endpoint: WorkerEndpoint = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (data, transfer) => {
      const message = structuredClone(data, { transfer }) as
        | LocalHostBoot
        | ChannelEnvelope<LocalHostPacket>;
      queueMicrotask(() => {
        if (message.kind === "init")
          void runtime.init(message.metrics, message.keepAliveWhenHidden).then(
            () => deliver({ kind: "ready" }),
            (error) => runtime.fail(error),
          );
        else if (message.kind === "attach-peer")
          runtime.attachPeer(message.clientId, message.connectionId, message.port, (error) =>
            deliver({
              kind: "peer-closed",
              clientId: message.clientId,
              connectionId: message.connectionId,
              ...(error === undefined ? {} : { error: String(error) }),
            }),
          );
        else if (message.kind === "detach-peer")
          runtime.detachPeer(message.clientId, message.connectionId);
        else if (message.kind === "batch" || message.kind === "credit") runtime.receive(message);
      });
    },
    terminate: () => events.push("terminate"),
  };
  const client = new WorkerClientTransport(endpoint, {
    onError: (error) => errors.push(error),
    onFault: (kind, error) => faults.push({ kind, error }),
    timeoutMs: 1000,
    keepAliveWhenHidden: options.keepAliveWhenHidden ?? false,
    ...(options.watchdogMs === undefined ? {} : { watchdogMs: options.watchdogMs }),
  });
  return { client, endpoint, runtime, serverTransport, events, errors, faults, authority };
}

describe("local server Worker lifecycle", () => {
  it("routes isolated guest links and keeps an obstructed recipient from blocking others", async () => {
    const r = rig({ keepAliveWhenHidden: true });
    await r.client.ready();
    const local: string[] = [],
      guest: string[] = [];
    r.client.onMessage((message) => local.push(message.type));
    let consumeSlow = false;
    const slow = r.client.attachPeer(
      "slow",
      () => {},
      () => {},
      () => consumeSlow,
    );
    const fast = r.client.attachPeer(
      "fast",
      ({ buffer, messageType }) => {
        guest.push(decodeServerMessage(buffer).type);
        expect(messageType).toBe("chat");
      },
      () => {},
    );
    await vi.waitFor(() => expect(r.events).toContain("connect:fast"));
    fast.send({ buffer: encodeClientMessage({ type: "identify", displayName: "Guest" }) });
    await vi.waitFor(() => expect(r.events).toContain("fast:identify"));
    for (let i = 0; i < 160; i++)
      r.serverTransport.send("slow", { type: "chat", sender: "test", text: String(i) });
    r.serverTransport.broadcast({ type: "chat", sender: "test", text: "all" });
    await vi.waitFor(() => expect(guest).toEqual(["chat"]));
    expect(local).toEqual(["chat"]);
    expect(r.serverTransport.canSend?.("slow")).toBe(false);
    expect(r.serverTransport.canSend?.("fast")).toBe(true);
    expect(r.serverTransport.canSend?.()).toBe(true);
    consumeSlow = true;
    await vi.waitFor(() => expect(r.serverTransport.canSend?.("slow")).toBe(true));
    slow.close();
    fast.close();
    await r.client.shutdown();
  });

  it("replaces guest identities without admitting old traffic or stale disconnects", async () => {
    const r = rig();
    await r.client.ready();
    const closed = vi.fn();
    const old = r.client.attachPeer("guest", () => {}, closed);
    await vi.waitFor(() => expect(r.events).toContain("connect:guest"));
    const received: string[] = [];
    const replacement = r.client.attachPeer(
      "guest",
      ({ buffer }) => received.push(decodeServerMessage(buffer).type),
      () => {},
    );
    await vi.waitFor(() =>
      expect(r.events.filter((event) => event === "connect:guest")).toHaveLength(2),
    );
    expect(closed).toHaveBeenCalledOnce();
    old.send({ buffer: encodeClientMessage({ type: "set-editor-mode", enabled: true }) });
    r.runtime.detachPeer("guest", 1);
    r.serverTransport.send("guest", { type: "chat", sender: "test", text: "replacement" });
    await vi.waitFor(() => expect(received).toEqual(["chat"]));
    expect(r.events).not.toContain("guest:set-editor-mode");
    expect(r.events.filter((event) => event === "disconnect:guest")).toHaveLength(1);
    replacement.close();
    await r.client.shutdown();
  });

  it("keeps multiplayer authority running while hidden and defers only its local replica", async () => {
    const r = rig({ keepAliveWhenHidden: true });
    await r.client.ready();
    r.client.start();
    r.client.setHidden(true);
    await vi.waitFor(() => expect(r.events).toContain("flush"));
    expect(r.events).not.toContain("stop");
    expect(r.serverTransport.canSend?.("local")).toBe(false);
    expect(r.serverTransport.canSend?.()).toBe(true);
    r.client.setHidden(false);
    await vi.waitFor(() => expect(r.serverTransport.canSend?.("local")).toBe(true));
    await r.client.shutdown();
  });

  it("isolates malformed guest traffic and closes guest ports when authority fails", async () => {
    const r = rig();
    await r.client.ready();
    const badClosed = vi.fn(),
      goodClosed = vi.fn();
    const bad = r.client.attachPeer("bad", () => {}, badClosed);
    r.client.attachPeer("good", () => {}, goodClosed);
    await vi.waitFor(() => expect(r.events).toContain("connect:good"));
    bad.send({ buffer: new Uint8Array([255]).buffer });
    await vi.waitFor(() => expect(badClosed).toHaveBeenCalledOnce());
    expect(r.events).toContain("disconnect:bad");
    expect(r.errors).toEqual([]);
    r.runtime.fail(new Error("authority failed"));
    await vi.waitFor(() => expect(goodClosed).toHaveBeenCalledOnce());
    expect(r.events).toContain("terminate");
  });

  it("preserves Worker failure evidence and rejects subsequent game requests immediately", async () => {
    const r = rig();
    await r.client.ready();
    const requests = new RequestBroker((message) => r.client.send(message));
    r.client.onDisconnect(() => requests.disconnect());
    const pending = requests.send({ type: "get-world-map", requestId: 1 });
    const rejected = expect(pending).rejects.toThrow("Connection to server closed");
    const stack = "Error: authority tick failed\n    at Realm.tick (local-server.worker.js:123:4)";
    r.endpoint.onmessage?.({
      data: { kind: "failed", error: "authority tick failed", stack },
    } as MessageEvent);
    await rejected;
    await expect(requests.send({ type: "get-world-map", requestId: 2 })).rejects.toThrow(
      "authority tick failed",
    );
    // Fire-and-forget input cleanup during disconnect must not interrupt the
    // failure notification or overwrite the first fatal error.
    expect(() => r.client.send({ type: "set-editor-mode", enabled: false })).not.toThrow();
    expect(r.errors[0]?.stack).toBe(stack);
    expect(await r.client.getDiagnostics()).toMatchObject({
      state: "failed",
      error: "authority tick failed",
      stack,
    });
    expect(r.events.filter((event) => event === "terminate")).toHaveLength(1);
    requests.dispose();
  });
  it("orders connect and identification, then fences shutdown behind save and outstanding delivery", async () => {
    let finishSave!: () => void;
    const save = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const r = rig({ flush: () => save });
    await r.client.ready();
    r.client.connect();
    r.client.send({ type: "identify", displayName: "Player", profileId: "profile" });
    const messages: string[] = [];
    r.client.onMessage((message) => messages.push(message.type));
    r.serverTransport.send("local", { type: "chat", sender: "test", text: "first" });
    r.serverTransport.send("local", { type: "chat", sender: "test", text: "second" });
    const stopped = r.client.shutdown();
    await vi.waitFor(() => expect(r.events).toContain("flush"));
    expect(r.events.indexOf("connect:local")).toBeLessThan(r.events.indexOf("identify"));
    expect(r.events).not.toContain("destroy");
    expect(r.events).not.toContain("terminate");
    finishSave();
    await stopped;
    expect(messages).toEqual(["chat", "chat"]);
    expect(r.events.slice(-2)).toEqual(["destroy", "terminate"]);
    expect(r.errors).toEqual([]);
  });

  it("does not serialize ordinary command admission behind an asynchronous flush", async () => {
    let finish!: () => void;
    const wait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const r = rig({ settle: () => wait });
    await r.client.ready();
    r.client.connect();
    const flushed = r.client.flush();
    r.client.send({ type: "visible-range", minCx: 1, minCy: 1, maxCx: 2, maxCy: 2 });
    await vi.waitFor(() => expect(r.events).toContain("visible-range"));
    expect(r.events).not.toContain("flush");
    finish();
    await flushed;
    await r.client.shutdown();
  });

  it("pauses authority on hide and resumes without stopping command handling", async () => {
    const r = rig();
    await r.client.ready();
    r.client.connect();
    r.client.start();
    r.client.setHidden(true);
    await vi.waitFor(() => expect(r.events).toContain("flush"));
    r.client.send({ type: "set-editor-mode", enabled: true });
    r.client.setHidden(false);
    await vi.waitFor(() => expect(r.events.filter((e) => e === "start")).toHaveLength(2));
    expect(r.events).toContain("set-editor-mode");
    await r.client.shutdown();
  });

  it("surfaces startup failure and terminates the failed instance", async () => {
    const r = rig({
      init: async () => {
        throw Error("storage failed");
      },
    });
    await expect(r.client.ready()).rejects.toThrow("storage failed");
    expect(r.events).toContain("terminate");
    expect(r.errors).toHaveLength(1);
    expect(r.endpoint.onmessage).toBeNull();
  });

  it("rejects pending lifecycle work on Worker failure", async () => {
    const r = rig();
    await r.client.ready();
    const request = r.client.getDiagnostics();
    const assertion = expect(request).rejects.toThrow("crashed");
    r.endpoint.onerror?.({ message: "crashed", preventDefault: () => {} } as ErrorEvent);
    await assertion;
    expect(r.errors).toHaveLength(1);
    expect(r.endpoint.onmessage).toBeNull();
  });
});

it("retains a failed save fence and permits retry without terminating authority", async () => {
  let fail = true;
  const r = rig({
    flush: async () => {
      if (fail) throw Error("disk unavailable");
    },
  });
  await r.client.ready();
  await expect(r.client.shutdown()).rejects.toThrow("disk unavailable");
  expect(r.errors).toHaveLength(0);
  expect(r.events).not.toContain("destroy");
  expect(r.events).not.toContain("terminate");
  r.client.send({ type: "set-editor-mode", enabled: true });
  await vi.waitFor(() => expect(r.events).toContain("set-editor-mode"));
  fail = false;
  await r.client.flush();
  await r.client.shutdown();
  expect(r.events).toContain("destroy");
  expect(r.events).toContain("terminate");
});

it("times out a Worker that never reaches readiness", async () => {
  const endpoint: WorkerEndpoint = {
    postMessage: () => {},
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
    onmessageerror: null,
  };
  const client = new WorkerClientTransport(endpoint, { timeoutMs: 10 });
  await expect(client.ready()).rejects.toThrow("startup timed out");
  expect(endpoint.terminate).toHaveBeenCalledTimes(1);
});

it("does not revive a terminated Worker when shutdown rejects after a fatal transport error", async () => {
  const r = rig({ flush: () => new Promise<void>(() => {}) });
  await r.client.ready();
  const stopping = r.client.shutdown();
  await vi.waitFor(() => expect(r.events).toContain("flush"));
  const failed = expect(stopping).rejects.toThrow("worker crashed");
  r.endpoint.onerror?.({ message: "worker crashed", preventDefault() {} } as ErrorEvent);
  await failed;
  expect(r.client.getDebugInfo().transport).toContain("failed");
  expect(r.events).toContain("terminate");
});

it("terminates a silent Worker once, while hidden lifecycle time is exempt", async () => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "performance"],
  });
  try {
    const r = rig({ watchdogMs: 1000 });
    await r.client.ready();
    r.client.start();
    r.client.setHidden(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(r.errors).toHaveLength(0);
    r.client.setHidden(false);
    await vi.advanceTimersByTimeAsync(999);
    expect(r.errors).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(251);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.name).toBe("LocalServerHang");
    expect(r.events.filter((e) => e === "terminate")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(r.errors).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});

it("reports repeated residency failures once and retains the latest authority evidence", async () => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "performance"],
  });
  try {
    const r = rig({ watchdogMs: 1000 });
    await r.client.ready();
    r.client.start();
    await vi.advanceTimersByTimeAsync(250);
    const diagnostics = r.runtime.diagnostics();
    diagnostics.persistence = [
      {
        realmId: "test-world",
        loadedChunks: 3,
        transitioningPlayers: 1,
        residency: {
          failures: 2,
          states: { loading: 2, ready: 3, saving: 0, failed: 1 },
          lastError: "synthetic storage failure",
        },
      } as unknown as NonNullable<typeof diagnostics.persistence>[number],
    ];
    r.endpoint.onmessage?.({ data: { kind: "heartbeat", id: 1, diagnostics } } as MessageEvent);
    expect(r.faults).toHaveLength(1);
    expect(r.faults[0]?.kind).toBe("chunk-failure");
    expect(r.client.getFaultDiagnostics()).toMatchObject({
      realms: [
        {
          realmId: "test-world",
          loading: 2,
          failed: 1,
          failures: 2,
          lastError: "synthetic storage failure",
        },
      ],
    });
    await vi.advanceTimersByTimeAsync(250);
    r.endpoint.onmessage?.({ data: { kind: "heartbeat", id: 2, diagnostics } } as MessageEvent);
    expect(r.faults).toHaveLength(1);
    r.endpoint.onerror?.({ message: "test cleanup", preventDefault() {} } as ErrorEvent);
  } finally {
    vi.useRealTimers();
  }
});
