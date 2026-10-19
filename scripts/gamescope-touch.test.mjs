import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { it } from "node:test";

const { startGamescopeTouch } = createRequire(import.meta.url)("../desktop/gamescope-touch.cjs");
it("requests native contacts for its own focused app and restores Steam policy on blur and exit", () => {
  const watcher = new EventEmitter();
  watcher.stdout = new EventEmitter();
  watcher.kill = () => {
    watcher.killed = true;
  };
  const calls = [];
  const stop = startGamescopeTouch(123, {
    platform: "linux",
    env: { DISPLAY: ":1" },
    launch: (name, args) => {
      assert.equal(name, "xprop");
      assert.deepEqual(args.slice(0, 2), ["-display", ":0"]);
      return watcher;
    },
    run: (name, args) => {
      assert.equal(name, "gamescopectl");
      calls.push(args[1]);
    },
  });
  const line = (s) => watcher.stdout.emit("data", `${s}\n`);
  line("GAMESCOPE_FOCUSABLE_WINDOWS(CARDINAL) = 11, 444, 123, 22, 769, 456");
  line("GAMESCOPE_FOCUSED_APP(CARDINAL) = 769");
  line("STEAM_TOUCH_CLICK_MODE(CARDINAL) = 1");
  assert.deepEqual(calls, ["1"]);
  line("GAMESCOPE_FOCUSED_APP(CARDINAL) = 444");
  assert.equal(calls.at(-1), "4");
  // Steam's late policy update must not discard multi-touch for the game.
  line("STEAM_TOUCH_CLICK_MODE(CARDINAL) = 1");
  assert.deepEqual(calls.slice(-2), ["4", "4"]);
  watcher.stdout.emit("data", "GAMESCOPE_FOCUSED_APP(CARD");
  watcher.stdout.emit("data", "INAL) = 769\n");
  assert.equal(calls.at(-1), "1");
  line("GAMESCOPE_FOCUSED_APP(CARDINAL) = 444");
  stop();
  stop();
  assert.deepEqual(calls.slice(-2), ["4", "1"]);
  assert.equal(watcher.killed, true);
});
it("does not configure touch outside an X11 Linux session", () => {
  const launch = () => {
    throw Error("Unexpected X11 command");
  };
  startGamescopeTouch(123, { platform: "darwin", env: { DISPLAY: ":0" }, launch })();
  startGamescopeTouch(123, { platform: "linux", env: {}, launch })();
});
