import type { GameContext } from "../core/GameScene.js";
import { ActionManager } from "../input/ActionManager.js";
import { controllerInput } from "../input/ControllerInput.js";
import { hostKeyMap, KEYBOARD_JOIN_KEY, seatKeyMap } from "../input/KeyboardSchemes.js";
import { ownsKeys } from "../input/KeyFocus.js";
import { eventCode } from "../input/KeyLabels.js";
import { PadActions } from "../input/PadActions.js";
import { EVERY_PAD, PadAssignment, type PadPool } from "../input/PadAssignment.js";
import { ActionSeatInput, type SeatInput } from "../input/SeatInput.js";
import { PlayScene } from "../scenes/PlayScene.js";
import { MAX_SEATS } from "../shared/protocol.js";
import { DEFAULT_CAR_DRIVING } from "../traffic/CarControls.js";

/** A seat whose pad disconnected during travel keeps asking to leave this many times. */
const LOST_PAD_RETRIES = 10;

/** Guests' characters in order, skipping any another seat already plays. */
const GUEST_MODELS = ["person1", "person2", "person3", "person4"] as const;

export function playerName(seat: number): string {
  return `Player ${seat + 1}`;
}

type Host = Pick<
  GameContext,
  | "actions"
  | "session"
  | "mainMenu"
  | "scenes"
  | "stateView"
  | "carDriving"
  | "inputBlocked"
  | "storagePaused"
  | "doorPresentation"
  | "sendRequest"
  | "takeRequestId"
>;

/** The controller collector whose pads the seats route (`controllerInput` on the page). */
interface Controller {
  seats: PadPool;
}

/**
 * The page's local players (226): guests join from the second keyboard scheme's
 * action key or a pad that seat 0 does not use, and leave from the world menu.
 * A keyboard guest plays the right-hand scheme while seat 0 keeps the rest of
 * the keyboard; a pad guest keeps its pad until it leaves or the pad disconnects.
 * Seat 0's controller and menus ignore guests' pads, except that a guest who opens
 * the menu drives it until it closes.
 */
export class LocalPlayers implements PadPool {
  private readonly pads = new PadAssignment();
  private readonly padInputs = new Map<number, PadActions>();
  private readonly joining = new Set<number>();
  private readonly models = new Map<number, string>();
  private readonly solo;
  private keyboardSeat: number | undefined;
  private readonly retries = new Set<ReturnType<typeof setTimeout>>();
  private destroyed = false;
  private sharedKeys = false;
  private uiPad: number | undefined;
  private wasUI = false;
  private readonly offs: (() => void)[];

  constructor(
    private readonly gc: Host,
    private readonly controller: Controller = controllerInput,
  ) {
    this.solo = gc.actions.getConfig();
    controller.seats = this;
    window.addEventListener("keydown", this.onKey);
    gc.mainMenu.seatActions = (add) => {
      for (const { label, run } of this.leaveActions()) add(label, run);
    };
    this.offs = [
      gc.session.seats.onChange(() => this.sync()),
      // Seat 0 opening a menu (its keys or its pad) drives that menu itself.
      gc.actions.on("toggle_menu", () => {
        this.uiPad = undefined;
      }),
    ];
  }

  /** Play is on top with nothing blocking the device's input. */
  private get joinable(): boolean {
    const { gc } = this;
    return (
      gc.scenes.current instanceof PlayScene &&
      !gc.inputBlocked &&
      !gc.storagePaused &&
      !gc.doorPresentation?.busy
    );
  }

  private get steering(): boolean {
    return (this.gc.carDriving ?? DEFAULT_CAR_DRIVING) === "steering";
  }

  /** One poll of every standard pad: seat assignment, guests' pads, then the pads
   * that drive seat 0 (or, in a guest's menu, that guest's pad alone). */
  pool(pads: Gamepad[], ui: boolean): Gamepad[] {
    // The opener's menu ends when it closes, or when its pad disconnects.
    if ((this.wasUI && !ui) || !pads.some((pad) => pad.index === this.uiPad))
      this.uiPad = undefined;
    this.wasUI = ui;
    const changes = this.pads.update(
      pads.map((pad) => {
        const pressed = pad.buttons.some((button) => button.pressed);
        return {
          index: pad.index,
          connected: pad.connected,
          pressed,
          active: pressed || pad.axes.some((axis) => Math.abs(axis) > 0.35),
        };
      }),
    );
    for (const seat of changes.lost) void this.leave(seat, LOST_PAD_RETRIES);
    for (const index of changes.joins) void this.joinPad(index);
    const away = typeof document !== "undefined" && (document.hidden || !document.hasFocus());
    for (const [index, actions] of this.padInputs)
      actions.poll(
        pads.find((pad) => pad.index === index),
        ui || away,
      );
    const opener = ui ? this.uiPad : undefined;
    if (opener !== undefined) return pads.filter((pad) => pad.index === opener);
    const excluded = this.pads.excluded(pads);
    return pads.filter((pad) => !excluded.has(pad.index));
  }

  /** Release the page's listeners; the device session releases guests' inputs. */
  destroy(): void {
    this.destroyed = true;
    for (const retry of this.retries) clearTimeout(retry);
    if (this.controller.seats === this) this.controller.seats = EVERY_PAD;
    window.removeEventListener("keydown", this.onKey);
    for (const off of this.offs) off();
    this.gc.mainMenu.seatActions = () => {};
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (eventCode(event) !== KEYBOARD_JOIN_KEY || event.repeat || event.ctrlKey || event.metaKey)
      return;
    if (this.keyboardSeat !== undefined || ownsKeys(event.target) || !this.joinable) return;
    const seat = this.freeSeat();
    if (seat === undefined) return;
    event.preventDefault(); // Firefox's Quick Find would take the joining slash
    // Attached during this keydown, the scheme does not also see the joining press.
    // Detaching it later resets the shared pad collector, as seat 0's blur does, so
    // seat 0's pad then waits for its buttons to be released.
    const keys = new ActionManager(seatKeyMap("right"));
    keys.disableGamepad();
    keys.attach();
    this.keyboardSeat = seat;
    void this.join(seat, new ActionSeatInput(keys, this.steering, () => keys.detach())).then(
      (joined) => {
        if (!joined && this.keyboardSeat === seat) this.keyboardSeat = undefined;
      },
    );
  };

  private async joinPad(index: number): Promise<void> {
    const seat = this.freeSeat();
    if (seat === undefined || !this.joinable) {
      this.pads.wait(index);
      return;
    }
    const actions = new PadActions(index);
    this.padInputs.set(index, actions);
    const off = actions.on("toggle_menu", () => this.openMenu(index));
    const input = new ActionSeatInput(actions, this.steering, () => {
      off();
      // A seat orphaned by a lost pad may leave after the pad joined again.
      if (this.padInputs.get(index) === actions) this.padInputs.delete(index);
    });
    if (await this.join(seat, input)) this.pads.assign(index, seat);
    else this.pads.wait(index);
  }

  /** Seat a guest; on failure its input set is released. */
  private async join(seat: number, input: SeatInput): Promise<boolean> {
    const { gc } = this;
    this.joining.add(seat);
    const taken = new Set([
      gc.stateView.playerEntity.playerModel ?? "player",
      ...this.models.values(),
    ]);
    const model = GUEST_MODELS.find((id) => !taken.has(id)) ?? "player";
    this.models.set(seat, model);
    try {
      await gc.session.seats.join((r) => gc.sendRequest(r), gc.takeRequestId(), seat, input, {
        displayName: playerName(seat),
        playerModel: model,
      });
      return true;
    } catch (error) {
      console.warn(`[tilefun] ${playerName(seat)} could not join: ${String(error)}`);
      input.dispose();
      return false;
    } finally {
      this.joining.delete(seat);
      this.sync();
    }
  }

  /** A refused leave (travel in progress) keeps the seat, as authority does; its
   * menu button stays to try again. A seat whose pad disconnected tries again
   * itself, once a second, `retries` times. */
  private async leave(seat: number, retries = 0): Promise<void> {
    const { gc } = this;
    const leaving = gc.session.seats.get(seat);
    if (this.destroyed || !leaving) return;
    try {
      await gc.session.seats.leave((r) => gc.sendRequest(r), gc.takeRequestId(), seat);
    } catch (error) {
      console.warn(`[tilefun] ${playerName(seat)} could not leave: ${String(error)}`);
      if (retries > 0) {
        // Only while the same guest holds the seat (not a new one that took its number).
        const retry = setTimeout(() => {
          this.retries.delete(retry);
          if (gc.session.seats.get(seat) === leaving) void this.leave(seat, retries - 1);
        }, 1000);
        this.retries.add(retry);
      }
    }
  }

  /** Guests are playing and something stops play: a menu, map or catalog over play,
   * or blocked input. Authority's pause follows (`set-debug`, every seat). */
  get paused(): boolean {
    const { gc } = this;
    return (
      gc.session.seats.list().length > 1 &&
      gc.scenes.has(PlayScene) &&
      (!(gc.scenes.current instanceof PlayScene) || !!gc.inputBlocked)
    );
  }

  /** A guest pad's menu button: the world menu opens with that pad driving it. */
  private openMenu(index: number): void {
    this.gc.actions.trigger("toggle_menu");
    this.uiPad = index;
  }

  /** Follow the device's seats, whatever changed them: seat 0's keys, pads and models. */
  private sync(): void {
    const { seats } = this.gc.session;
    for (const seat of [...this.models.keys()])
      if (!seats.get(seat) && !this.joining.has(seat)) {
        this.models.delete(seat);
        this.pads.release(seat);
        if (this.keyboardSeat === seat) this.keyboardSeat = undefined;
      }
    const shared = this.keyboardSeat !== undefined && !!seats.get(this.keyboardSeat);
    if (shared !== this.sharedKeys) {
      this.sharedKeys = shared;
      this.gc.actions.setConfig(shared ? hostKeyMap() : this.solo);
    }
  }

  private freeSeat(): number | undefined {
    const { seats } = this.gc.session;
    for (let seat = 1; seat < MAX_SEATS; seat++)
      if (!seats.get(seat) && !this.joining.has(seat)) return seat;
    return undefined;
  }

  private leaveActions(): { label: string; run: () => void }[] {
    const { mainMenu, session } = this.gc;
    return session.seats
      .list()
      .filter((seat) => seat.seat !== 0)
      .map(({ seat }) => ({
        label: `${playerName(seat)} leaves`,
        run: () =>
          void this.leave(seat).then(() => {
            if (mainMenu.visible) mainMenu.openPage("home");
          }),
      }));
  }
}
