import { afterEach, beforeEach, expect, expectTypeOf, it, vi } from "vitest";
import type { ServerMessage } from "../shared/protocol.js";
import { RequestBroker } from "./RequestBroker.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("infers response types and handles synchronous replies without leaking timers", async () => {
  const broker = new RequestBroker((request) =>
    broker.receive({ type: "realm-list", requestId: request.requestId, realms: [] }),
  );
  const result = broker.send({ type: "list-realms", requestId: 1 });
  expectTypeOf(result).toEqualTypeOf<Promise<Extract<ServerMessage, { type: "realm-list" }>>>();
  await expect(result).resolves.toMatchObject({ realms: [] });
  expect(vi.getTimerCount()).toBe(0);
});

it("settles only the matching request and reports server errors", async () => {
  const broker = new RequestBroker(() => {});
  const a = broker.send({ type: "list-worlds", requestId: 1 });
  const b = broker.send({ type: "list-realms", requestId: 2 });
  const rejected = expect(b).rejects.toThrow("World unavailable");
  broker.receive({ type: "realm-list", requestId: 99, realms: [] });
  broker.receive({ type: "request-error", requestId: 2, message: "World unavailable" });
  broker.receive({ type: "world-list", requestId: 1, worlds: [] });
  await rejected;
  await expect(a).resolves.toMatchObject({ worlds: [] });
  expect(vi.getTimerCount()).toBe(0);
});

it("rejects responses that have the right ID but the wrong protocol type", async () => {
  const broker = new RequestBroker(() => {});
  const result = broker.send({ type: "list-worlds", requestId: 1 });
  const rejected = expect(result).rejects.toThrow("Unexpected response");
  broker.receive({ type: "realm-list", requestId: 1, realms: [] });
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});

it("times out lost requests and ignores late replies", async () => {
  const broker = new RequestBroker(() => {}, 50);
  const result = broker.send({ type: "list-realms", requestId: 1 });
  const rejected = expect(result).rejects.toThrow("Request timed out: list-realms");
  await vi.advanceTimersByTimeAsync(50);
  await rejected;
  broker.receive({ type: "realm-list", requestId: 1, realms: [] });
  expect(vi.getTimerCount()).toBe(0);
});

it("rejects outstanding calls on disconnect and allows calls after reconnection", async () => {
  const broker = new RequestBroker(() => {});
  const result = broker.send({ type: "list-realms", requestId: 1 });
  const rejected = expect(result).rejects.toThrow("Connection to server closed");
  broker.disconnect();
  await rejected;
  const next = broker.send({ type: "list-realms", requestId: 2 });
  broker.receive({ type: "realm-list", requestId: 2, realms: [] });
  await expect(next).resolves.toMatchObject({ realms: [] });
  expect(vi.getTimerCount()).toBe(0);
});

it("rejects all pending calls and future calls when destroyed", async () => {
  const broker = new RequestBroker(() => {});
  const a = expect(broker.send({ type: "list-realms", requestId: 1 })).rejects.toThrow("destroyed");
  const b = expect(broker.send({ type: "list-worlds", requestId: 2 })).rejects.toThrow("destroyed");
  broker.dispose();
  await Promise.all([a, b]);
  await expect(broker.send({ type: "list-worlds", requestId: 3 })).rejects.toThrow("destroyed");
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves the first call on duplicate IDs and cleans up transmission failures", async () => {
  const broker = new RequestBroker(() => {});
  const first = broker.send({ type: "list-realms", requestId: 1 });
  await expect(broker.send({ type: "list-worlds", requestId: 1 })).rejects.toThrow(
    "Duplicate request ID",
  );
  broker.receive({ type: "realm-list", requestId: 1, realms: [] });
  await expect(first).resolves.toMatchObject({ realms: [] });
  const broken = new RequestBroker(() => {
    throw new Error("Send failed");
  });
  await expect(broken.send({ type: "list-worlds", requestId: 1 })).rejects.toThrow("Send failed");
  expect(vi.getTimerCount()).toBe(0);
});
