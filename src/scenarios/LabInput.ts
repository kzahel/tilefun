import type { Entity } from "../entities/Entity.js";
import { ActionManager } from "../input/ActionManager.js";
import { controllerInput } from "../input/ControllerInput.js";
import { seatKeyMap, seatOnly } from "../input/KeyboardSchemes.js";
import {
  normalizesDiagonal,
  SeatComposer,
  type SeatTick,
  seatPresses,
  vehicleButtons,
} from "../input/SeatComposer.js";
import { TouchButtons } from "../input/TouchButtons.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import { DEFAULT_CAR_DRIVING } from "../traffic/CarControls.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";

/** Interim lab adapter (226 slice 2; the game view replaces it in slice 3): the
 * game's keys, pads, touch controls and seat composition on one lab canvas. */
export class LabInput {
  readonly actions: ActionManager;
  private readonly joystick: TouchJoystick;
  private readonly buttons: TouchButtons;
  private readonly seat = new SeatComposer();
  private jumped = false;
  private readonly off: (() => void)[];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    place: { enter?(): void; recover?(): void } = {},
    private readonly touchButtons = true,
  ) {
    // Play keys only, while focus is on the canvas (Tab and Escape stay with the page).
    const actions = new ActionManager(seatOnly(seatKeyMap("solo")), { root: canvas });
    this.actions = actions;
    this.joystick = new TouchJoystick(canvas);
    this.buttons = new TouchButtons(canvas);
    this.buttons.enabled = this.showButtons;
    this.joystick.claimedTouches = this.buttons.claimedTouches;
    actions.setTouchJoystick(this.joystick);
    actions.setTouchButtons(this.buttons);
    this.off = [
      actions.on("jump", () => (this.jumped = true)),
      actions.on("enter_place", () => place.enter?.()),
      actions.on("vehicle_recover", () => place.recover?.()),
    ];
    for (const part of [this.buttons, this.joystick, actions]) part.attach();
  }

  /** One device tick: movement plus horn, siren and throw presses. */
  tick(view: { playerEntity: Entity; entities: readonly Entity[] }, dt: number): SeatTick {
    if (document.activeElement === this.canvas)
      controllerInput.sample(navigator.getGamepads?.() ?? [], performance.now());
    const { actions, seat } = this;
    this.buttons.enabled = this.showButtons;
    const vehicle = occupiedVehicle(view.playerEntity, view.entities);
    if (seat.board(vehicle, actions.isHeld("vehicle_lights"), actions.isHeld("vehicle_style")))
      this.buttons.reset();
    Object.assign(this.buttons, vehicleButtons(vehicle));
    const steering = DEFAULT_CAR_DRIVING === "steering";
    const manual = actions.getMovement(normalizesDiagonal(vehicle, steering));
    const jumpPressed = this.jumped;
    this.jumped = false;
    const facing = view.playerEntity.sprite?.direction;
    const situation = { vehicle, locked: false, steering, joystick: true, facing };
    return seat.tick(
      { manual, steered: manual, ...seatPresses(actions), jumpPressed },
      situation,
      dt,
    );
  }

  /** A tick the lab did not play (paused, busy or scripted): presses and throw
   * releases made meanwhile must not fire on resume. */
  skip(): void {
    this.jumped = false;
    this.actions.consumeHornPress();
    this.seat.dropThrow();
  }

  /** Action buttons exist only on touch screens: never invisible mouse targets, and
   * desktop lab pixels stay unchanged. */
  private get showButtons(): boolean {
    return this.touchButtons && navigator.maxTouchPoints > 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.joystick.draw(ctx); // only while a finger steers
    this.buttons.draw(ctx); // only when enabled
  }

  dispose(): void {
    for (const off of this.off) off();
    for (const part of [this.actions, this.joystick, this.buttons]) part.detach();
  }
}
