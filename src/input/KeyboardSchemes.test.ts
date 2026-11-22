import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionManager } from "./ActionManager.js";
import { DEFAULT_ACTION_MAP } from "./ActionMap.js";
import { controllerInput } from "./ControllerInput.js";
import { hostKeyMap, keyboardSide, SEAT_ACTIONS, seatKeyMap, seatOnly } from "./KeyboardSchemes.js";
import { acceptsGameKey, ownsKeys } from "./KeyFocus.js";

const keysOf = (map: { keys: string[] }[]) => new Set(map.flatMap((b) => b.keys));

describe("keyboard schemes", () => {
  it("older profiles default to the left side and labs keep the full map", () => {
    expect(keyboardSide(undefined)).toBe("left");
    expect(keyboardSide("right")).toBe("right");
    expect(seatKeyMap("solo")).toBe(DEFAULT_ACTION_MAP);
  });

  it("two sharing players get disjoint one-handed schemes covering every seat action", () => {
    const left = seatKeyMap("left");
    const right = seatKeyMap("right");
    for (const map of [left, right])
      expect(map.map((b) => b.action).sort()).toEqual([...SEAT_ACTIONS].sort());
    const leftKeys = keysOf(left);
    for (const key of keysOf(right)) expect(leftKeys.has(key), key).toBe(false);
    expect(leftKeys.has("KeyW") && keysOf(right).has("ArrowUp")).toBe(true);
    // A focused button keeps Enter.
    expect(leftKeys.has("Enter") || keysOf(right).has("Enter")).toBe(false);
  });

  it("a lab's seat-only map keeps play keys and leaves page keys to the page", () => {
    const lab = keysOf(seatOnly(seatKeyMap("solo")));
    for (const key of ["KeyW", "ArrowUp", "Space", "ShiftLeft", "KeyE", "KeyF", "KeyH"])
      expect(lab.has(key), key).toBe(true);
    for (const key of ["Tab", "Escape", "F3", "Backquote", "Digit1", "KeyG", "KeyV"])
      expect(lab.has(key), key).toBe(false);
  });

  it.each(["left", "right"] as const)("the %s host gets the same play keys as a guest", (side) => {
    const host = hostKeyMap(side);
    expect(seatOnly(host)).toEqual(seatKeyMap(side));
    for (const binding of DEFAULT_ACTION_MAP) {
      if (
        binding.action === "toggle_base_mode" ||
        SEAT_ACTIONS.some((action) => action === binding.action)
      )
        continue;
      expect(host).toContainEqual(binding);
    }
  });

  it("two managers on one keyboard each move only their own seat", () => {
    const left = new ActionManager(seatKeyMap("left"));
    const right = new ActionManager(seatKeyMap("right"));
    for (const manager of [left, right]) manager.disableGamepad();
    for (const code of ["KeyD", "ArrowUp"]) {
      left.pressKey(code);
      right.pressKey(code);
    }
    expect(left.getMovement()).toMatchObject({ dx: 1, dy: 0 });
    expect(right.getMovement()).toMatchObject({ dx: 0, dy: -1 });
  });
});

describe("keyboard focus rule", () => {
  const canvas = { tagName: "CANVAS" };
  const select = { tagName: "SELECT" };
  const outside = { tagName: "DIV" };
  const root = { contains: (node: unknown) => node === canvas || node === select };

  it("the game page takes every key; a lab only plain targets inside its root", () => {
    expect(acceptsGameKey(select)).toBe(true);
    expect(acceptsGameKey(canvas, root)).toBe(true);
    expect(acceptsGameKey(select, root)).toBe(false);
    expect(acceptsGameKey(outside, root)).toBe(false);
    expect(acceptsGameKey(null, root)).toBe(false);
  });

  it("form controls and editable text keep their keys", () => {
    for (const tag of ["BUTTON", "SELECT", "TEXTAREA", "A"])
      expect(ownsKeys({ tagName: tag }), tag).toBe(true);
    for (const type of ["text", "checkbox", "range"])
      expect(ownsKeys({ tagName: "INPUT", type }), type).toBe(true);
    expect(ownsKeys({ tagName: "INPUT", type: "hidden" })).toBe(false);
    expect(ownsKeys({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(ownsKeys({ tagName: "CANVAS" })).toBe(false);
  });
});

describe("lab-scoped action manager", () => {
  afterEach(() => {
    controllerInput.sample([], 0);
    vi.unstubAllGlobals();
  });

  function scoped() {
    const win = new EventTarget();
    const root = Object.assign(new EventTarget(), {
      tagName: "CANVAS",
      contains: (node: unknown) => node === root,
    });
    const doc = { activeElement: root as unknown, hidden: false, hasFocus: () => true };
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    const actions = new ActionManager(undefined, { root: root as unknown as HTMLElement });
    actions.attach();
    const key = (type: string, code: string, target: unknown = root) => {
      const event = Object.assign(new Event(type, { cancelable: true }), { code, key: "" });
      Object.defineProperty(event, "target", { value: target }); // as if bubbled from target
      win.dispatchEvent(event);
      return event;
    };
    return { win, root, doc, actions, key };
  }

  it("takes keys only from inside its root and releases them when focus leaves", () => {
    const { root, actions, key } = scoped();
    const press = key("keydown", "KeyD");
    expect(actions.getMovement().dx).toBe(1);
    expect(press.defaultPrevented).toBe(true);
    const fromSelect = key("keydown", "KeyW", { tagName: "SELECT" });
    expect(actions.isHeld("move_up")).toBe(false);
    expect(fromSelect.defaultPrevented).toBe(false);
    root.dispatchEvent(Object.assign(new Event("focusout"), { relatedTarget: null }));
    expect(actions.isHeld("move_right")).toBe(false);
  });

  it("ignores pads and pad commands while the lab is not focused", () => {
    const { doc, actions } = scoped();
    const pad = (axes: number[], buttons: number[] = []) =>
      ({
        connected: true,
        mapping: "standard",
        index: 0,
        axes,
        buttons: Array.from({ length: 17 }, (_, i) => ({
          pressed: buttons.includes(i),
          value: buttons.includes(i) ? 1 : 0,
        })),
      }) as unknown as Gamepad;
    const entered: number[] = [];
    actions.on("enter_place", () => entered.push(1));
    controllerInput.sample([pad([0, 0, 0, 0])], 0);
    controllerInput.sample([pad([1, 0, 0, 0], [3])], 16);
    expect(actions.getMovement().dx).toBe(1);
    expect(entered).toEqual([1]);
    doc.activeElement = { tagName: "BODY" };
    controllerInput.sample([pad([1, 0, 0, 0])], 32);
    controllerInput.sample([pad([1, 0, 0, 0], [3])], 48);
    expect(actions.getMovement().dx).toBe(0);
    expect(entered).toEqual([1]);
  });
});
