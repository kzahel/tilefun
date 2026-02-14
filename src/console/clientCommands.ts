import type { GameContext } from "../core/GameScene.js";
import type { ConsoleEngine } from "./ConsoleEngine.js";

export function registerClientCommands(engine: ConsoleEngine, gc: GameContext): void {
  engine.commands.register({
    name: "noclip",
    description: "Toggle fly-through-walls mode",
    args: [],
    category: "cl",
    execute: (_args, out) => {
      const current = gc.debugPanel.noclip;
      // Toggle by programmatically clicking the checkbox
      // We set the internal state directly through the debug panel
      gc.debugPanel.setNoclip(!current);
      out(`Noclip: ${!current ? "ON" : "OFF"}`);
    },
  });

  engine.commands.register({
    name: "invisibility",
    description: "Toggle entity-ignore-player mode (entities won't chase/follow)",
    args: [],
    category: "cl",
    execute: (_args, out) => {
      const cv = engine.cvars.get("invisibility");
      if (cv) {
        cv.set(!cv.get());
        out(`Invisibility: ${cv.get() ? "ON" : "OFF"}`);
      } else {
        out("Invisibility cvar not found");
      }
    },
  });

  engine.commands.register({
    name: "debug",
    description: "Toggle debug overlay panel",
    args: [],
    category: "cl",
    execute: (_args, out) => {
      gc.debugEnabled = !gc.debugEnabled;
      gc.debugPanel.visible = gc.debugEnabled;
      out(`Debug overlay: ${gc.debugEnabled ? "ON" : "OFF"}`);
    },
  });

  engine.commands.register({
    name: "giant",
    description: "Scale player sprite to 2x size",
    args: [],
    category: "fun",
    execute: (_args, out) => {
      const cv = engine.cvars.get("fun_playerscale");
      if (cv) {
        cv.set(cv.get() === 2 ? 1 : 2);
        out(`Player scale: ${cv.get()}x`);
      }
    },
  });

  engine.commands.register({
    name: "tiny",
    description: "Scale player sprite to 0.5x size",
    args: [],
    category: "fun",
    execute: (_args, out) => {
      const cv = engine.cvars.get("fun_playerscale");
      if (cv) {
        cv.set(cv.get() === 0.5 ? 1 : 0.5);
        out(`Player scale: ${cv.get()}x`);
      }
    },
  });

  engine.commands.register({
    name: "disco",
    description: "Toggle rainbow hue cycling on canvas",
    args: [],
    category: "fun",
    execute: (_args, out) => {
      const cv = engine.cvars.get("fun_disco");
      if (cv) {
        cv.set(!cv.get());
        out(`Disco mode: ${cv.get() ? "ON" : "OFF"}`);
      }
    },
  });

  engine.commands.register({
    name: "earthquake",
    description: "Trigger screen shake effect",
    args: [{ name: "intensity", type: "number", optional: true }],
    category: "fun",
    execute: (args, out) => {
      const intensity = (args.intensity as number | undefined) ?? 8;
      gc.camera.shake(intensity);
      out(`Earthquake! intensity=${intensity}`);
    },
  });

  // Register fun cvars used by commands above
  engine.cvars.register<boolean>({
    name: "invisibility",
    description: "Entities ignore the player",
    type: "boolean",
    defaultValue: false,
    category: "fun",
  });

  engine.cvars.register<number>({
    name: "fun_playerscale",
    description: "Player sprite scale multiplier",
    type: "number",
    defaultValue: 1,
    min: 0.25,
    max: 4,
    category: "fun",
  });

  engine.cvars.register<boolean>({
    name: "fun_disco",
    description: "Rainbow hue cycling effect",
    type: "boolean",
    defaultValue: false,
    category: "fun",
  });
}
