import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameContext } from "../core/GameScene.js";
import { ActionManager } from "../input/ActionManager.js";
import { hostKeyMap, type KeyboardSide } from "../input/KeyboardSchemes.js";
import { EVERY_PAD, type PadPool } from "../input/PadAssignment.js";
import { XR_PAD_INDEX } from "../input/XrPad.js";
import { PlayScene } from "../scenes/PlayScene.js";
import { DeviceSession } from "../session/DeviceSession.js";
import type { RequestMessage } from "../shared/requests.js";
import type { RemoteStateView } from "./ClientStateView.js";
import { LocalPlayers } from "./LocalPlayers.js";

function gamepad(index: number, buttons: number[] = [], axes = [0, 0, 0, 0]): Gamepad {
  return {
    connected: true,
    mapping: "standard",
    index,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i) })),
  } as unknown as Gamepad;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness(side: KeyboardSide = "left") {
  const requests: RequestMessage[] = [];
  let refuse = false;
  const session = new DeviceSession({} as RemoteStateView);
  const actions = new ActionManager();
  actions.disableGamepad();
  actions.attach();
  const menus: number[] = [];
  actions.on("toggle_menu", () => menus.push(1));
  const mainMenu = {
    seatActions: (_add: (label: string, run: () => void) => void) => {},
    localKeyboardHelp: () => "",
    localPlayerActions: (_add: (label: string, run: () => void, disabled?: boolean) => void) => {},
    visible: true,
    openPage: vi.fn(),
    onClose: vi.fn(),
  };
  /** The world menu's guest buttons, as its home page adds them. */
  const leaveButtons = () => {
    const buttons: { label: string; run: () => void }[] = [];
    mainMenu.seatActions((label, run) => buttons.push({ label, run }));
    return buttons;
  };
  const localButtons = () => {
    const buttons: { label: string; run: () => void; disabled: boolean }[] = [];
    mainMenu.localPlayerActions((label, run, disabled) =>
      buttons.push({ label, run, disabled: disabled ?? false }),
    );
    return buttons;
  };
  const state = { blocked: false };
  const controller: { seats: PadPool } = { seats: EVERY_PAD };
  let nextId = 1;
  const scenes: { current: unknown } = { current: new PlayScene() };
  const gc = {
    actions,
    session,
    mainMenu,
    scenes,
    stateView: { playerEntity: { id: 1, playerModel: "person1" } },
    carDriving: "steering",
    get inputBlocked() {
      return state.blocked;
    },
    storagePaused: false,
    doorPresentation: { busy: false },
    sendRequest: async (request: RequestMessage) => {
      requests.push(request);
      if (refuse) throw new Error("Join a world before adding players.");
      return {};
    },
    takeRequestId: () => nextId++,
  } as unknown as GameContext;
  const players = new LocalPlayers(gc, side, controller);
  const key = (type: "keydown" | "keyup", code: string, target: unknown = null) => {
    const event = Object.assign(new Event(type), { code, key: "" });
    if (target) Object.defineProperty(event, "target", { value: target });
    window.dispatchEvent(event);
  };
  return {
    players,
    leaveButtons,
    localButtons,
    addKeyboard: () =>
      localButtons()
        .find(({ label }) => label.endsWith("(keyboard)"))
        ?.run(),
    session,
    actions,
    mainMenu,
    requests,
    menus,
    state,
    scenes,
    controller,
    key,
    refuse: (value: boolean) => {
      refuse = value;
    },
    poll: (pads: Gamepad[], ui = false) => controller.seats.pool(pads, ui, 0).map((p) => p.index),
  };
}

beforeEach(() => vi.stubGlobal("window", new EventTarget()));
afterEach(() => vi.unstubAllGlobals());

describe("local players joining from the keyboard (226)", () => {
  it("the Multiplayer menu joins one keyboard guest and offers leave/rejoin there", async () => {
    const h = harness();
    h.state.blocked = true; // Menu actions work while gameplay input is blocked.
    const [screen, add] = h.localButtons();
    expect(screen?.label).toBe("Use shared screen");
    screen?.run();
    expect(h.session.sharedScreen).toBe(true);
    expect(h.localButtons()[0]?.label).toBe("Use split screen");
    expect(add?.label).toBe("Add Player 2 (keyboard)");
    add?.run();
    add?.run(); // A repeated activation cannot add another keyboard guest.
    await settle();
    expect(h.mainMenu.onClose).toHaveBeenCalled();
    expect(h.requests).toHaveLength(1);
    expect(h.session.seats.get(1)?.input).toBeTruthy();
    expect(h.actions.getConfig()).toEqual(hostKeyMap("left"));
    const [, leave] = h.localButtons();
    expect(leave?.label).toBe("Player 2 leaves");
    leave?.run();
    await settle();
    expect(h.session.seats.get(1)).toBeUndefined();
    expect(h.actions.getConfig()).toEqual(hostKeyMap("left"));
    expect(h.mainMenu.openPage).toHaveBeenLastCalledWith("multiplayer");
    expect(h.localButtons()[1]?.label).toBe("Add Player 2 (keyboard)");
  });

  it("Slash jumps for a right-side host, and a menu join gives the guest the left side", async () => {
    const h = harness("right");
    const jump = vi.fn();
    h.actions.on("jump", jump);
    h.key("keydown", "Slash");
    h.key("keyup", "Slash");
    expect(jump).toHaveBeenCalledOnce();
    expect(h.requests).toEqual([]);
    h.addKeyboard();
    await settle();
    expect(h.requests).toEqual([
      { type: "join-seat", requestId: 1, seat: 1, displayName: "Player 2", playerModel: "person2" },
    ]);
    const guest = h.session.seats.get(1);
    expect(guest?.input).toBeTruthy();
    expect(h.actions.getConfig()).toEqual(hostKeyMap("right"));
    expect(guest?.input?.sample(false, undefined).jumpPressed).toBe(false);
    h.key("keydown", "ArrowUp");
    h.key("keydown", "KeyA");
    h.key("keydown", "Space");
    h.key("keydown", "Slash");
    expect(h.actions.getMovement()).toMatchObject({ dx: 0, dy: -1 });
    expect(jump).toHaveBeenCalledTimes(2);
    expect(guest?.input?.sample(false, undefined)).toMatchObject({
      manual: { dx: -1, dy: 0 },
      jumpPressed: true,
    });
    expect(h.requests).toHaveLength(1);
  });

  it("leaving releases the guest's keys while the host keeps its chosen side", async () => {
    const h = harness("right");
    h.addKeyboard();
    await settle();
    const input = h.session.seats.get(1)?.input;
    const [leave] = h.leaveButtons();
    expect(leave?.label).toBe("Player 2 leaves");
    leave?.run();
    await settle();
    expect(h.requests.at(-1)).toEqual({ type: "leave-seat", requestId: 2, seat: 1 });
    expect(h.session.seats.get(1)).toBeUndefined();
    expect(h.actions.getConfig()).toEqual(hostKeyMap("right"));
    expect(h.mainMenu.openPage).toHaveBeenCalledWith("home");
    h.key("keydown", "ArrowLeft");
    expect(input?.sample(false, undefined).manual.dx).toBe(0);
    expect(h.actions.getMovement().dx).toBe(-1);
    h.key("keyup", "ArrowLeft");
    h.addKeyboard();
    await settle();
    expect(h.session.seats.get(1)).toBeTruthy();
  });

  it("a menu join needs play and can be retried after a refusal", async () => {
    const h = harness();
    h.scenes.current = {}; // the editor or another scene
    h.addKeyboard();
    h.scenes.current = new PlayScene();
    expect(h.requests).toEqual([]);
    h.refuse(true);
    h.addKeyboard();
    await settle();
    expect(h.session.seats.list()).toHaveLength(1);
    expect(h.actions.getConfig()).toEqual(hostKeyMap("left"));
    h.key("keydown", "KeyW");
    expect(h.actions.getMovement().dy).toBe(-1);
    // The refused scheme stopped listening: nothing claims its own keys.
    const period = Object.assign(new Event("keydown", { cancelable: true }), { code: "Period" });
    window.dispatchEvent(period);
    expect(period.defaultPrevented).toBe(false);
    h.refuse(false);
    h.addKeyboard();
    await settle();
    expect(h.session.seats.get(1)).toBeTruthy();
  });

  it("a refused leave (travel in progress) keeps the guest and its button", async () => {
    const h = harness();
    h.addKeyboard();
    await settle();
    h.refuse(true);
    h.leaveButtons()[0]?.run();
    await settle();
    expect(h.session.seats.get(1)).toBeTruthy();
    expect(h.leaveButtons().map((b) => b.label)).toEqual(["Player 2 leaves"]);
    expect(h.actions.getConfig()).toEqual(hostKeyMap("left"));
  });

  it("an explicit side change swaps both maps and clears held keys and pending jump", async () => {
    const h = harness();
    h.addKeyboard();
    await settle();
    const guest = h.session.seats.get(1)?.input;
    h.key("keydown", "KeyW");
    h.key("keydown", "Slash");
    h.players.keyboardSide = "right";
    expect(h.actions.getMovement()).toMatchObject({ dx: 0, dy: 0, jump: false });
    expect(guest?.sample(false, undefined)).toMatchObject({ jumpPressed: false });
    expect(guest?.hint("jump")).toBe("Space");
    h.session.seats.drop(1);
    expect(h.actions.hint("jump")).toBe("/");
    expect(h.localButtons()[1]?.label).toBe("Add Player 2 (keyboard)");
  });
});

describe("local players joining from pads (226)", () => {
  it("a headset's controllers stay with seat 0, whichever pad it already plays on (252)", async () => {
    const h = harness();
    expect(h.poll([gamepad(0, [0])])).toEqual([0]); // pad 0 is seat 0's
    // Another pad's press would ask to join; the headset's pad never does.
    h.players.headset = () => gamepad(XR_PAD_INDEX, [0]);
    expect(h.poll([gamepad(0)])).toEqual([0, XR_PAD_INDEX]);
    await settle();
    expect(h.requests).toEqual([]);
    expect(h.session.seats.list().map((s) => s.seat)).toEqual([0]);
    // It drives seat 0 before any other pad was used, and leaves with its session.
    const fresh = harness();
    fresh.players.headset = () => gamepad(XR_PAD_INDEX, [0]);
    expect(fresh.poll([])).toEqual([XR_PAD_INDEX]);
    fresh.players.headset = null;
    expect(fresh.poll([])).toEqual([]);
  });

  it("seat 0 keeps its pad; another pad's press joins and drives only its guest", async () => {
    const h = harness();
    expect(h.poll([gamepad(0, [0]), gamepad(1)])).toEqual([0]); // pad 0 is now seat 0's alone
    expect(h.poll([gamepad(0), gamepad(1, [], [0, -1, 0, 0])])).toEqual([0]); // others are not
    h.poll([gamepad(0), gamepad(1, [0])]);
    await settle();
    expect(h.requests).toEqual([
      { type: "join-seat", requestId: 1, seat: 1, displayName: "Player 2", playerModel: "person2" },
    ]);
    const guest = h.session.seats.get(1);
    h.poll([gamepad(0), gamepad(1, [0], [1, 0, 0, 0])]); // still holding the joining press
    expect(guest?.input?.sample(false, undefined).manual.dx).toBe(0);
    h.poll([gamepad(0), gamepad(1, [], [1, 0, 0, 0])]);
    expect(guest?.input?.sample(false, undefined).manual.dx).toBe(1);
    expect(h.actions.getConfig()).toEqual(hostKeyMap("left")); // pads leave the keyboard alone
    // Two more pads pressing at once join the next two seats with distinct characters.
    h.poll([gamepad(0), gamepad(1), gamepad(2, [9]), gamepad(3, [0])]);
    await settle();
    expect(h.requests.slice(1)).toMatchObject([
      { seat: 2, playerModel: "person3" },
      { seat: 3, playerModel: "person4" },
    ]);
    expect(h.session.seats.list().map((s) => s.seat)).toEqual([0, 1, 2, 3]);
  });

  it("a guest's menu button opens the menu, which only that pad drives until it closes", async () => {
    const h = harness();
    h.poll([gamepad(0, [0]), gamepad(1)]);
    h.poll([gamepad(0), gamepad(1, [0])]);
    await settle();
    h.poll([gamepad(0), gamepad(1)]);
    h.poll([gamepad(0), gamepad(1, [9])]);
    expect(h.menus).toEqual([1]);
    expect(h.poll([gamepad(0), gamepad(1, [9])], true)).toEqual([1]);
    expect(h.poll([gamepad(0), gamepad(1)], false)).toEqual([0]);
    // The opener's pad disconnecting hands the menu back to seat 0's pad.
    h.poll([gamepad(0), gamepad(1)]);
    h.poll([gamepad(0), gamepad(1, [9])]);
    expect(h.poll([gamepad(0)], true)).toEqual([0]);
    h.poll([gamepad(0)], false);
    // Once the guest's menu closed, a menu opened another way (the map, Options) is seat 0's.
    expect(h.poll([gamepad(0), gamepad(1)], true)).toEqual([0]);
    // Seat 0 opening a menu drives it itself, even right after a guest's press.
    h.poll([gamepad(0), gamepad(1)]);
    h.poll([gamepad(0), gamepad(1, [9])]);
    h.actions.trigger("toggle_menu");
    expect(h.poll([gamepad(0), gamepad(1)], true)).toEqual([0]);
  });

  it("a disconnected pad leaves its seat; a pad that left must be released first", async () => {
    const h = harness();
    h.poll([gamepad(0, [0]), gamepad(1)]);
    h.poll([gamepad(0), gamepad(1, [0])]);
    await settle();
    h.poll([gamepad(0)]);
    await settle();
    expect(h.requests.at(-1)).toMatchObject({ type: "leave-seat", seat: 1 });
    expect(h.session.seats.get(1)).toBeUndefined();
    h.poll([gamepad(0), gamepad(1, [0])]);
    await settle();
    expect(h.session.seats.get(1)).toBeTruthy();
    h.leaveButtons()[0]?.run();
    await settle();
    h.poll([gamepad(0), gamepad(1, [0])]); // the press that chose "leave" is still down
    await settle();
    expect(h.session.seats.get(1)).toBeUndefined();
    h.poll([gamepad(0), gamepad(1)]);
    h.poll([gamepad(0), gamepad(1, [0])]);
    await settle();
    expect(h.session.seats.get(1)).toBeTruthy();
  });

  it("a pad lost during travel keeps asking to leave, and its seat cannot stop a new pad", async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      h.poll([gamepad(0, [0]), gamepad(1)]);
      h.poll([gamepad(0), gamepad(1, [0])]);
      await vi.advanceTimersByTimeAsync(0);
      h.refuse(true); // travelling: authority refuses the leave
      h.poll([gamepad(0)]);
      await vi.advanceTimersByTimeAsync(0);
      expect(h.session.seats.get(1)).toBeTruthy();
      // The pad comes back and joins a new seat; the orphan still holds seat 1.
      h.refuse(false);
      h.poll([gamepad(0), gamepad(1, [0])]);
      await vi.advanceTimersByTimeAsync(0);
      expect(h.session.seats.list().map((s) => s.seat)).toEqual([0, 1, 2]);
      // The retry removes the orphan without unhooking the new guest's pad.
      await vi.advanceTimersByTimeAsync(1000);
      expect(h.session.seats.list().map((s) => s.seat)).toEqual([0, 2]);
      const guest = h.session.seats.get(2);
      h.poll([gamepad(0), gamepad(1)]);
      h.poll([gamepad(0), gamepad(1, [], [1, 0, 0, 0])]);
      expect(guest?.input?.sample(false, undefined).manual.dx).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a retry never removes a new guest that took the seat", async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      h.poll([gamepad(0, [0]), gamepad(1)]);
      h.poll([gamepad(0), gamepad(1, [0])]);
      await vi.advanceTimersByTimeAsync(0);
      h.refuse(true);
      h.poll([gamepad(0)]); // lost during travel: the leave is refused and retried
      await vi.advanceTimersByTimeAsync(0);
      // It leaves from the menu meanwhile, and a keyboard guest takes its number.
      h.refuse(false);
      h.leaveButtons()[0]?.run();
      await vi.advanceTimersByTimeAsync(0);
      h.addKeyboard();
      await vi.advanceTimersByTimeAsync(0);
      const newcomer = h.session.seats.get(1);
      expect(newcomer).toBeTruthy();
      await vi.advanceTimersByTimeAsync(1000);
      expect(h.session.seats.get(1)).toBe(newcomer);
    } finally {
      vi.useRealTimers();
    }
  });

  it("no retry runs after the page's players are destroyed", async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      h.poll([gamepad(0, [0]), gamepad(1), gamepad(2)]);
      h.poll([gamepad(0), gamepad(1, [0]), gamepad(2)]);
      await vi.advanceTimersByTimeAsync(0);
      h.poll([gamepad(0), gamepad(1), gamepad(2, [0])]);
      await vi.advanceTimersByTimeAsync(0);
      h.refuse(true);
      h.poll([gamepad(0)]); // two pads lost during travel: two retry chains
      await vi.advanceTimersByTimeAsync(0);
      h.players.destroy();
      const sent = h.requests.length;
      h.refuse(false);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(h.requests).toHaveLength(sent);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the device pauses while guests play and a scene covers play or input is blocked", async () => {
    const h = harness();
    expect(h.players.paused).toBe(false);
    h.addKeyboard();
    await settle();
    const play = h.scenes.current;
    const stack = [play];
    Object.assign(h.scenes, { has: () => stack.includes(play) });
    expect(h.players.paused).toBe(false);
    h.scenes.current = {}; // the world menu or map over play
    expect(h.players.paused).toBe(true);
    stack.length = 0; // the editor replaced play
    expect(h.players.paused).toBe(false);
    stack.push(play);
    h.scenes.current = play;
    h.state.blocked = true;
    expect(h.players.paused).toBe(true);
  });

  it("presses outside play are refused until released; destroy releases the page", async () => {
    const h = harness();
    h.poll([gamepad(0, [0]), gamepad(1)]);
    h.state.blocked = true;
    h.poll([gamepad(0), gamepad(1, [0])]);
    await settle();
    h.state.blocked = false;
    h.poll([gamepad(0), gamepad(1, [0])]);
    await settle();
    expect(h.requests).toEqual([]);
    h.players.destroy();
    expect(h.controller.seats).toBe(EVERY_PAD);
    h.addKeyboard();
    await settle();
    expect(h.requests).toEqual([]);
  });
});
