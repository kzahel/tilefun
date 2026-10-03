import { describe, expect, it, vi } from "vitest";
import { type LocalAuthority, LocalServerRuntime } from "../server/LocalServerRuntime.js";
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
  } = {},
) {
  const events: string[] = [];
  const errors: Error[] = [];
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
      transport.onMessage((_id, message: ClientMessage) => events.push(message.type));
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
          void runtime.init(message.metrics).then(
            () => deliver({ kind: "ready" }),
            (error) => runtime.fail(error),
          );
        else if (message.kind === "batch" || message.kind === "credit") runtime.receive(message);
      });
    },
    terminate: () => events.push("terminate"),
  };
  const client = new WorkerClientTransport(endpoint, {
    onError: (error) => errors.push(error),
    timeoutMs: 1000,
  });
  return { client, endpoint, runtime, serverTransport, events, errors, authority };
}

describe("local server Worker lifecycle", () => {
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

it("fails a save fence explicitly rather than acknowledging lost edits", async () => {
  const r = rig({
    flush: async () => {
      throw Error("disk unavailable");
    },
  });
  await r.client.ready();
  await expect(r.client.shutdown()).rejects.toThrow("disk unavailable");
  expect(r.errors).toHaveLength(1);
  expect(r.events).not.toContain("destroy");
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
