import { expect, it, vi } from "vitest";
import type { FaultReport } from "./FaultReport.js";
import { FAULT_OUTBOX_KEY, FaultReporter } from "./FaultReporter.js";

function fixture() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const send = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
  const context: FaultReport["context"] = {
    mode: "local-worker",
    worldId: "world",
    generation: "{}",
    x: 1,
    y: 2,
    serverTick: 45,
    hidden: false,
  };
  const options = {
    storage,
    fetch: send,
    context: () => context,
    build: "test",
    browser: "test browser",
  };
  return { options, send, data, make: () => new FaultReporter(options) };
}
it("persists before upload, survives reload, and removes only matching server acknowledgments", async () => {
  const f = fixture(),
    r = f.make();
  r.event("request:join-realm");
  r.capture("fatal", new Error("synthetic crash"));
  await vi.waitFor(() => expect(f.send).toHaveBeenCalledTimes(1));
  await r.flush();
  const report = JSON.parse(f.data.get(FAULT_OUTBOX_KEY) ?? "[]")[0];
  expect(report.events[0].type).toBe("request:join-realm");
  expect(report.context.serverTick).toBe(45);
  f.send.mockResolvedValue(new Response(JSON.stringify({ saved: true, id: "wrong" })));
  const reloaded = f.make();
  await reloaded.flush();
  expect(JSON.parse(f.data.get(FAULT_OUTBOX_KEY) ?? "[]")).toHaveLength(1);
  f.send.mockResolvedValue(new Response(JSON.stringify({ saved: true, id: report.id })));
  await reloaded.flush();
  expect(JSON.parse(f.data.get(FAULT_OUTBOX_KEY) ?? "[]")).toEqual([]);
});
it("deduplicates repeated faults and bounds events, reports and unicode payloads", async () => {
  const f = fixture(),
    r = f.make();
  for (let i = 0; i < 100; i++) r.event(`request:${i}`);
  for (let i = 0; i < 100; i++) r.capture("request-timeout", new Error("same"));
  for (let i = 0; i < 20; i++) {
    const e = new Error(`fault ${i}`);
    e.stack = "😀".repeat(10000);
    r.capture("fatal", e);
  }
  await r.flush();
  const reports = JSON.parse(f.data.get(FAULT_OUTBOX_KEY) ?? "[]");
  expect(reports).toHaveLength(8);
  expect(reports[0].events).toHaveLength(24);
  for (const report of reports)
    expect(new TextEncoder().encode(JSON.stringify(report)).length).toBeLessThan(32000);
});
it("uploads despite storage denial and never throws when diagnostics fail", async () => {
  const f = fixture();
  f.options.storage.getItem = () => {
    throw Error("denied");
  };
  f.options.storage.setItem = () => {
    throw Error("quota");
  };
  const r = f.make();
  expect(() => r.capture("fatal", new Error("crash"))).not.toThrow();
  await vi.waitFor(() => expect(f.send).toHaveBeenCalled());
  f.options.context = () => {
    throw Error("no context");
  };
  expect(() => r.capture("fatal", "another crash")).not.toThrow();
});

it("preserves a second tab's outbox when either tab captures or acknowledges a report", async () => {
  const f = fixture(),
    first = f.make(),
    second = f.make();
  first.capture("fatal", "first tab");
  second.capture("fatal", "second tab");
  await vi.waitFor(() => expect(f.send).toHaveBeenCalledTimes(2));
  const pending = JSON.parse(f.data.get(FAULT_OUTBOX_KEY) ?? "[]");
  expect(pending).toHaveLength(2);
  f.send.mockImplementation(async (_url, init) => {
    const report = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ saved: true, id: report.id }));
  });
  await first.flush();
  await second.flush();
  expect(JSON.parse(f.data.get(FAULT_OUTBOX_KEY) ?? "[]")).toHaveLength(0);
});

it("retains the original failure when the client context is unavailable or non-finite", async () => {
  const f = fixture();
  f.options.context = () => {
    throw Error("client initialization failed");
  };
  const r = f.make();
  r.capture("fatal", new Error("original initialization failure"));
  await vi.waitFor(() => expect(f.send).toHaveBeenCalled());
  expect(JSON.parse(f.data.get(FAULT_OUTBOX_KEY) ?? "[]")[0]).toMatchObject({
    message: "original initialization failure",
    context: { mode: "unknown" },
  });
});

it("repairs a corrupt outbox so new offline reports can still survive reload", async () => {
  const f = fixture();
  f.data.set(FAULT_OUTBOX_KEY, "{broken");
  const r = f.make();
  r.capture("fatal", new Error("offline after corrupt outbox"));
  await vi.waitFor(() => expect(f.send).toHaveBeenCalled());
  const pending = JSON.parse(f.data.get(FAULT_OUTBOX_KEY) ?? "[]");
  expect(pending).toHaveLength(1);
  expect(pending[0].message).toBe("offline after corrupt outbox");
});
