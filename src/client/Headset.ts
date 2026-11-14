import type { GameContext } from "../core/GameScene.js";
import { controllerInput } from "../input/ControllerInput.js";
import { padFocus } from "../input/PadAssignment.js";
import { directionHeading } from "../rendering/firstperson/FirstPersonCamera.js";
import { PlayScene } from "../scenes/PlayScene.js";
import { XrControl } from "./XrControl.js";

export type { XrControl } from "./XrControl.js";

/** The page's parts a headset session takes over while it lasts. */
interface HeadsetPage {
  readonly loop: { start(): void; stop(): void; externalTick(nowMs: number): void };
  /** Seat 0's pad pool: a session adds its controllers to it. */
  readonly pads: { headset: (() => Gamepad | undefined) | null };
  /** Lay the page out again after a session. */
  resize(): void;
}

/**
 * Play in a headset for the page's game (252): builds the control over the
 * game context, hands it to the context as `gc.xr`, and asks the browser
 * whether it has a headset. Menus list the modes once it answers.
 */
export function createHeadset(gc: GameContext, page: HeadsetPage): XrControl | undefined {
  const { firstPerson } = gc;
  if (!firstPerson) return undefined;
  const xr = new XrControl({
    output: gc.view3d?.xr,
    loop: page.loop,
    firstPerson,
    controller: {
      set headset(pad: (() => Gamepad | undefined) | null) {
        page.pads.headset = pad;
        // A session holds the page's focus: pads and play input stay live.
        padFocus.headset = !!pad;
      },
      // The page's own poll stops with its frames; the session's frames poll.
      poll: (now) =>
        controllerInput.sample(
          typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [],
          now,
        ),
    },
    playing: () =>
      gc.scenes.current instanceof PlayScene && !gc.inputBlocked && !gc.mainMenu.visible,
    heading() {
      const sprite = gc.stateView.playerEntity.sprite;
      return sprite ? directionHeading(sprite.direction) : undefined;
    },
    restored() {
      page.resize();
      // The menu that ended the session opened before it knew: list the way to
      // stay on the page beside Resume.
      if (xr.resume && gc.mainMenu.visible) gc.mainMenu.openPage("home");
    },
  });
  gc.xr = xr;
  // A pause ended the session; the click or key that resumes play is the user
  // gesture the next session needs. Checked once that gesture's own handlers
  // have closed the menu.
  const resume = () => {
    if (xr.resume) setTimeout(() => xr.resumeInPlay(), 0);
  };
  window.addEventListener("click", resume, true);
  window.addEventListener("keydown", resume, true);
  void xr.detect();
  return xr;
}
