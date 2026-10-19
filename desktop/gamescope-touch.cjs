const { execFile, spawn } = require("node:child_process");

// Gamescope defaults non-Steam games to single mouse clicks. Request native
// contacts only while this process owns the focused app; Steam keeps its policy
// for its menus and every other game. Never write Steam's durable configuration.
function startGamescopeTouch(
  pid,
  { platform = process.platform, env = process.env, launch = spawn, run = execFile } = {},
) {
  if (platform !== "linux" || !env.DISPLAY) return () => {};
  // Steam's primary Xwayland owns the Gamescope focus properties. The game can
  // be on a secondary Xwayland, so preserve the host and select display zero.
  const display = env.DISPLAY.replace(/:\d+(?:\.\d+)?$/, ":0");
  let ownApp;
  let focusedApp;
  let steamMode;
  let applied;
  let buffer = "";
  let stopped = false;
  const watcher = launch(
    "xprop",
    [
      "-display",
      display,
      "-spy",
      "-root",
      "GAMESCOPE_FOCUSABLE_WINDOWS",
      "GAMESCOPE_FOCUSED_APP",
      "STEAM_TOUCH_CLICK_MODE",
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  const apply = (mode) => {
    if (mode === undefined || mode === applied) return;
    applied = mode;
    run("gamescopectl", ["touch_click_mode", String(mode)], { timeout: 2000 }, () => {});
  };
  watcher.stdout.on("data", (data) => {
    if (stopped) return;
    buffer += data;
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const match = line.match(
        /^(GAMESCOPE_FOCUSABLE_WINDOWS|GAMESCOPE_FOCUSED_APP|STEAM_TOUCH_CLICK_MODE)\(CARDINAL\) = ([\d, ]+)$/,
      );
      if (!match) continue;
      const values = match[2].split(",").map(Number);
      if (match[1] === "GAMESCOPE_FOCUSABLE_WINDOWS") {
        ownApp = undefined;
        for (let i = 0; i + 2 < values.length; i += 3)
          if (values[i + 2] === pid) ownApp = values[i + 1];
      } else if (match[1] === "GAMESCOPE_FOCUSED_APP") focusedApp = values[0];
      else {
        steamMode = values[0];
        // Steam may reset the mode after its focus notification. Reapply once
        // for that property event; gamescopectl does not change the X property.
        applied = undefined;
      }
      apply(ownApp !== undefined && focusedApp === ownApp ? 4 : steamMode);
    }
  });
  watcher.on("error", () => {}); // Ordinary Linux desktops need no Gamescope tools.
  return () => {
    if (stopped) return;
    stopped = true;
    watcher.kill();
    apply(steamMode);
  };
}
module.exports = { startGamescopeTouch };
