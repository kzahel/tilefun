import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameContext } from "../core/GameScene.js";
import { ActionManager } from "../input/ActionManager.js";
import { DEFAULT_ACTION_MAP } from "../input/ActionMap.js";
import { hostKeyMap } from "../input/KeyboardSchemes.js";
import { EVERY_PAD, type PadPool } from "../input/PadAssignment.js";
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

function harness() {
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
    visible: true,
    openPage: vi.fn(),
  };
  /** The world menu's guest buttons, as its home page adds them. */
  const leaveButtons = () => {
    const buttons: { label: string; run: () => void }[] = [];
    mainMenu.seatActions((label, run) => buttons.push({ label, run }));
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
  const players = new LocalPlayers(gc, controller);
  const key = (type: "keydown" | "keyup", code: string, target: unknown = null) => {
    const event = Object.assign(new Event(type), { code, key: "" });
    if (target) Object.defineProperty(event, "target", { value: target });
    window.dispatchEvent(event);
  };
  return {
    players,
    leaveButtons,
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
  it("scheme B's action key seats a guest on the right hand; seat 0 keeps the rest", async () => {
    const h = harness();
    const press = Object.assign(new Event("keydown", { cancelable: true }), { code: "Slash" });
    window.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true); // no browser Quick Find
    await settle();
    expect(h.requests).toEqual([
      { type: "join-seat", requestId: 1, seat: 1, displayName: "Player 2", playerModel: "person2" },
    ]);
    const guest = h.session.seats.get(1);
    expect(guest?.input).toBeTruthy();
    expect(h.actions.getConfig()).toEqual(hostKeyMap());
    // The joining press did not jump; the guest moves with the arrows, seat 0 does not.
    expect(guest?.input?.sample(false, undefined).jumpPressed).toBe(false);
    h.key("keydown", "ArrowUp");
    expect(guest?.input?.sample(false, undefined).manual).toMatchObject({ dx: 0, dy: -1 });
    expect(h.actions.getMovement().dy).toBe(0);
    h.key("keyup", "ArrowUp");
    // One keyboard guest only.
    h.key("keydown", "Slash");
    await settle();
    expect(h.requests).toHaveLength(1);
  });

  it("leaves from the menu: seat 0 gets its full map back and the scheme stops listening", async () => {
    const h = harness();
    h.key("keydown", "Slash");
    await settle();
    const input = h.session.seats.get(1)?.input;
    const [leave] = h.leaveButtons();
    expect(leave?.label).toBe("Player 2 leaves");
    leave?.run();
    await settle();
    expect(h.requests.at(-1)).toEqual({ type: "leave-seat", requestId: 2, seat: 1 });
    expect(h.session.seats.get(1)).toBeUndefined();
    expect(h.actions.getConfig()).toBe(DEFAULT_ACTION_MAP);
    expect(h.mainMenu.openPage).toHaveBeenCalledWith("home");
    h.key("keydown", "ArrowLeft");
    expect(input?.sample(false, undefined).manual.dx).toBe(0);
    expect(h.actions.getMovement().dx).toBe(-1);
    h.key("keyup", "ArrowLeft");
    // A new keyboard guest may join again.
    h.key("keydown", "Slash");
    await settle();
    expect(h.session.seats.get(1)).toBeTruthy();
  });

  it("joins wait for play: a blocked device, another scene or a refusal seat no one", async () => {
    const h = harness();
    h.state.blocked = true;
    h.key("keydown", "Slash");
    h.state.blocked = false;
    h.scenes.current = {}; // the editor or another scene
    const plain = Object.assign(new Event("keydown", { cancelable: true }), { code: "Slash" });
    window.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false); // refused: the key is left alone
    h.scenes.current = new PlayScene();
    h.key("keydown", "KeyQ"); // only scheme B's action key joins
    h.key("keydown", "Slash", { tagName: "INPUT", type: "text" }); // typing a slash
    await settle();
    expect(h.requests).toEqual([]);
    h.refuse(true);
    h.key("keydown", "Slash");
    await settle();
    expect(h.session.seats.list()).toHaveLength(1);
    expect(h.actions.getConfig()).toBe(DEFAULT_ACTION_MAP);
    h.key("keydown", "ArrowUp");
    expect(h.actions.getMovement().dy).toBe(-1);
    // The refused scheme stopped listening: nothing claims its own keys.
    const period = Object.assign(new Event("keydown", { cancelable: true }), { code: "Period" });
    window.dispatchEvent(period);
    expect(period.defaultPrevented).toBe(false);
    // A later press may join again.
    h.refuse(false);
    h.key("keydown", "Slash");
    await settle();
    expect(h.session.seats.get(1)).toBeTruthy();
  });

  it("a refused leave (travel in progress) keeps the guest and its button", async () => {
    const h = harness();
    h.key("keydown", "Slash");
    await settle();
    h.refuse(true);
    h.leaveButtons()[0]?.run();
    await settle();
    expect(h.session.seats.get(1)).toBeTruthy();
    expect(h.leaveButtons().map((b) => b.label)).toEqual(["Player 2 leaves"]);
    expect(h.actions.getConfig()).toEqual(hostKeyMap());
  });

  it("authority dropping the guest restores seat 0's keys", async () => {
    const h = harness();
    h.key("keydown", "Slash");
    await settle();
    h.session.seats.drop(1);
    expect(h.actions.getConfig()).toBe(DEFAULT_ACTION_MAP);
  });
});

describe("local players joining from pads (226)", () => {
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
    expect(h.actions.getConfig()).toBe(DEFAULT_ACTION_MAP); // pads leave the keyboard alone
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
      h.key("keydown", "Slash");
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
    h.key("keydown", "Slash");
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
    h.key("keydown", "Slash");
    await settle();
    expect(h.requests).toEqual([]);
  });
});
