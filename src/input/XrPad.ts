/**
 * A headset's two controllers as one standard gamepad (tactical 252), so they
 * drive seat 0 through the bindings every controller uses. Headset controllers
 * never appear in `navigator.getGamepads()`; a session's input sources carry
 * them, one per hand, in the `xr-standard` layout:
 *
 * | Source | Buttons | Axes |
 * | --- | --- | --- |
 * | either hand | 0 trigger, 1 grip, 3 stick press, 4 lower face (A/X), 5 upper face (B/Y) | 2, 3 stick |
 */

/** The virtual pad's `Gamepad.index`, clear of the browser's own. */
export const XR_PAD_INDEX = 64;

/** What is read of a session's input source. */
export interface XrPadSource {
  readonly handedness: string;
  readonly gamepad?:
    | {
        readonly mapping: string;
        readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
        readonly axes: readonly number[];
      }
    | null
    | undefined;
}

/**
 * Standard pad button ← hand and `xr-standard` button. Play's bindings
 * (`ControllerBindings`): 0 jump, 2 throw, 3 enter a place, 5 horn, 6 reverse,
 * 7 sprint, 9 menu, 13 recover a vehicle. The upper right face button pauses,
 * which ends the session: menus are HTML and show on the page. The left grip is
 * left free (button 4 opens the editor, which a headset does not show).
 */
export const XR_PAD_BUTTONS: Readonly<Record<number, readonly ["left" | "right", number]>> = {
  0: ["right", 4],
  2: ["left", 4],
  3: ["left", 5],
  5: ["right", 1],
  6: ["left", 0],
  7: ["right", 0],
  9: ["right", 5],
  10: ["left", 3],
  11: ["right", 3],
  13: ["left", 3],
};

const RELEASED = { pressed: false, touched: false, value: 0 };

/**
 * The controllers as a standard pad for this poll: the left stick moves, the
 * right stick is the look stick. Undefined while no hand holds a controller
 * with the `xr-standard` layout (hands, a sleeping controller).
 */
export function xrPad(sources: Iterable<XrPadSource>, now: number): Gamepad | undefined {
  const hands: { left?: XrPadSource["gamepad"]; right?: XrPadSource["gamepad"] } = {};
  for (const source of sources) {
    if (source.gamepad?.mapping !== "xr-standard") continue;
    if (source.handedness === "left" || source.handedness === "right")
      hands[source.handedness] ??= source.gamepad;
  }
  if (!hands.left && !hands.right) return undefined;
  const buttons = Array.from({ length: 17 }, () => RELEASED);
  for (const [index, [hand, button]] of Object.entries(XR_PAD_BUTTONS)) {
    const from = hands[hand]?.buttons[button];
    if (from)
      buttons[Number(index)] = { pressed: from.pressed, touched: from.pressed, value: from.value };
  }
  const axis = (hand: "left" | "right", index: number) => hands[hand]?.axes[index] ?? 0;
  const pad = {
    id: "Headset controllers",
    index: XR_PAD_INDEX,
    connected: true,
    mapping: "standard",
    timestamp: now,
    buttons,
    axes: [axis("left", 2), axis("left", 3), axis("right", 2), axis("right", 3)],
  };
  return pad as unknown as Gamepad;
}
