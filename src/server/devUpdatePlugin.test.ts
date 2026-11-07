import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { afterEach, expect, it, vi } from "vitest";
import {
  DEV_READY_MARKER,
  DevUpdateTracker,
  devUpdatePlugin,
  isPlayableChange,
} from "./devUpdatePlugin.js";

afterEach(() => vi.useRealTimers());

it("settles a batch, accepts an explicit completion, and immediately clears stale readiness", () => {
  vi.useFakeTimers();
  const notify = vi.fn();
  const tracker = new DevUpdateTracker(notify);
  tracker.changed();
  vi.advanceTimersByTime(4000);
  tracker.changed();
  vi.advanceTimersByTime(4000);
  expect(tracker.current.state).toBe("editing");
  vi.advanceTimersByTime(1000);
  expect(tracker.current.state).toBe("changed");
  tracker.ready();
  expect(tracker.current.state).toBe("ready");
  tracker.changed();
  expect(tracker.current.state).toBe("editing");
  tracker.ready();
  vi.advanceTimersByTime(10000);
  expect(tracker.current.state).toBe("ready");
  tracker.dispose();
});

it("ignores tests, documentation and private runtime records", () => {
  for (const path of [
    "src/main.ts",
    "src/ui/Menus.css",
    "public/assets/car.png",
    "public/data/art-catalog.json",
    "index.html",
    "vite.config.ts",
    "package-lock.json",
    "src\\main.ts",
  ])
    expect(isPlayableChange(path), path).toBe(true);
  for (const path of [
    "src/server/GameServer.test.ts",
    "tests/game.spec.ts",
    "docs/README.md",
    "AGENTS.md",
    "data/workshop/request.json",
    "playwright-report/index.html",
    "../elsewhere/src/main.ts",
  ])
    expect(isPlayableChange(path), path).toBe(false);
});

it("streams real watcher changes and marker writes, and cleans up connected streams on close", async () => {
  const root = await mkdtemp(join(tmpdir(), "tilefun-dev-updates-"));
  await mkdir(join(root, "src"));
  const server = await createServer({
    configFile: false,
    root,
    base: "/tilefun/",
    plugins: [devUpdatePlugin()],
    server: { host: "127.0.0.1", port: 0, hmr: false, ws: false },
    logLevel: "silent",
  });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing port");
    const response = await fetch(`http://127.0.0.1:${address.port}/tilefun/__dev-updates`);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    reader = response.body?.getReader();
    if (!reader) throw new Error("Missing stream");
    // Keep one pending read across attempts; a write made while the platform
    // watcher is still arming can be missed, so each step retries its write.
    let pending: Promise<ReadableStreamReadResult<Uint8Array>> | undefined;
    const nextState = async (state: string, act?: (attempt: number) => Promise<void>) => {
      let text = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        await act?.(attempt);
        const deadline = Date.now() + 1000;
        while (Date.now() < deadline || !act) {
          pending ??= reader?.read();
          const chunk = await Promise.race([
            pending,
            new Promise<undefined>((resolve) => setTimeout(resolve, deadline - Date.now())),
          ]);
          if (!chunk) break;
          pending = undefined;
          if (chunk.done) throw new Error("Unexpected stream close");
          text += new TextDecoder().decode(chunk.value);
          if (text.includes(`"state":"${state}"`)) return;
        }
      }
      throw new Error(`No ${state} update`);
    };
    await nextState("changed");
    const source = join(root, "src/main.ts");
    await nextState("editing", (n) => writeFile(source, `export const value = ${n};`));
    await nextState("ready", (n) => writeFile(join(root, DEV_READY_MARKER), `done ${n}`));
    await nextState("editing", (n) => writeFile(source, `export const value = ${100 + n};`));
  } finally {
    await server.close();
    await reader?.cancel();
    await rm(root, { recursive: true, force: true });
  }
}, 15000);
