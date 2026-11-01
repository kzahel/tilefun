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
    const nextState = async (state: string) => {
      let text = "";
      while (!text.includes(`"state":"${state}"`)) {
        const chunk = await reader?.read();
        if (chunk?.done) throw new Error("Unexpected stream close");
        text += new TextDecoder().decode(chunk?.value);
      }
    };
    await nextState("changed");
    // Allow the platform watcher to finish its initial scan before creating files.
    if (!server.watcher.getWatched()[server.config.root])
      await new Promise<void>((resolve) => server.watcher.once("ready", resolve));
    await writeFile(join(root, "src/main.ts"), "export const value = 1;");
    await nextState("editing");
    await writeFile(join(root, DEV_READY_MARKER), "done");
    await nextState("ready");
    await writeFile(join(root, "src/main.ts"), "export const value = 2;");
    await nextState("editing");
  } finally {
    await server.close();
    await reader?.cancel();
    await rm(root, { recursive: true, force: true });
  }
}, 15000);
