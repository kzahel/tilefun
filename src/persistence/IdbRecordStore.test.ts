import { afterEach, expect, it, vi } from "vitest";
import { IdbRecordStore } from "./IdbRecordStore.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("waits for a terminated writer's delayed lock release without stealing it", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const db = { close: vi.fn() };
  vi.stubGlobal("indexedDB", {
    open: () => {
      const request = { result: db, onsuccess: undefined as (() => void) | undefined };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  });
  const request = vi.fn(
    (_name: string, options: LockOptions, callback: LockGrantedCallback<void>) => {
      expect(options).not.toHaveProperty("steal");
      expect(options).not.toHaveProperty("ifAvailable");
      return new Promise<void>((resolve, reject) => {
        options.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
        setTimeout(() => {
          void Promise.resolve(callback({ name: "test", mode: "exclusive" } as Lock)).then(
            () => resolve(),
            reject,
          );
        }, 2000);
      });
    },
  );
  vi.stubGlobal("navigator", { locks: { request } });
  const store = new IdbRecordStore("test");
  const opened = store.open();
  await vi.advanceTimersByTimeAsync(2000);
  await opened;
  expect(request).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  await store.close();
  expect(db.close).toHaveBeenCalledOnce();
});
it("still rejects an active competing writer after the bounded handoff deadline", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, options: LockOptions) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    },
  });
  const store = new IdbRecordStore("test");
  const rejected = expect(store.open()).rejects.toThrow(
    "World is already open in another authority",
  );
  await vi.advanceTimersByTimeAsync(5000);
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
  await store.close();
});
