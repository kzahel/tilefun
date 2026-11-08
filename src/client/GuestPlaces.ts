import type { ClientSeat } from "../session/ClientSeat.js";
import type { DeviceSession } from "../session/DeviceSession.js";
import {
  type DoorChoice,
  type DoorRequest,
  DoorWalk,
  doorChoice,
  type PlaceView,
  type VehicleChoice,
  type VehicleRequest,
  vehicleChoice,
} from "../ui/PlacePrompts.js";
import type { DoorPresentation } from "./DoorPresentation.js";

/** Client state guests' place controls read (seat 0's place controls host). */
export interface GuestPlacesHost {
  readonly session: Pick<DeviceSession, "seats" | "replica" | "prediction">;
  readonly doorPresentation: Pick<DoorPresentation, "busy" | "begin" | "cancel">;
  readonly playing: boolean;
  readonly overlayOpen: boolean;
  readonly inputBlocked: boolean;
  readonly storagePaused: boolean;
  clearPlayInput(sendNeutral?: boolean): void;
  request(message: DoorRequest | VehicleRequest, seat: number): Promise<unknown>;
}

/** A guest's own body as its place choices read it: predicted where the predictor
 * publishes it, its authoritative pose for doorways, and the shared world. */
export function guestPlaceView(
  session: GuestPlacesHost["session"],
  seat: number,
): PlaceView | undefined {
  const { replica } = session;
  const id = replica.seats.entities.get(seat);
  const own = replica.serverEntities.find((e) => e.id === id);
  if (!own) return undefined;
  const { wx, wy } = own.position;
  return {
    playerEntity: session.prediction?.publishedBody(own.id).body ?? own,
    entities: replica.entities,
    props: replica.props,
    editorEnabled: replica.editorEnabled,
    interior: replica.interior,
    serverPlayerPosition: own.wz === undefined ? { wx, wy } : { wx, wy, wz: own.wz },
  };
}

/**
 * One guest's place controls (226): seat 0's vehicle and door choices for the
 * guest's own body, pressed with its own enter and equipment keys (or pad
 * buttons), shown in its view (`ClientSeat.prompts`) with its device's labels.
 * Requests go in its envelope. Boarding stops only this seat; a door takes the
 * whole device through, under the device veil, as seat 0's does.
 */
class GuestPlace {
  private readonly walk = new DoorWalk();
  private vehicle: VehicleChoice | null = null;
  private door: DoorChoice | null = null;
  private busy = false;
  private status = "";
  private targetKey = "";
  private readonly offs: (() => void)[];

  constructor(
    readonly seat: ClientSeat,
    private readonly host: GuestPlacesHost,
  ) {
    const { input } = seat;
    this.offs = input
      ? [
          input.on("enter_place", () => this.enter()),
          input.on("vehicle_recover", () => this.equip()),
        ]
      : [];
  }

  /** `ready`: startup is done and the device's room or terrain is presentable. */
  update(dt: number, ready: boolean): void {
    const { host, seat } = this;
    const view = guestPlaceView(host.session, seat.seat);
    if (!view) {
      this.walk.reset();
      this.vehicle = this.door = null;
      seat.prompts = [];
      return;
    }
    const busy = host.doorPresentation.busy;
    this.vehicle = vehicleChoice(view, ready && host.playing);
    const doorAllowed =
      !this.vehicle.request && !this.vehicle.equipment && ready && !host.overlayOpen;
    this.door = doorChoice(view, doorAllowed);
    const walking = seat.composer.lastMovement;
    if (this.walk.update(view, this.door, doorAllowed, busy || host.inputBlocked, walking, dt))
      this.goThrough(true);
    const key = this.vehicle.key || (this.door.request ? JSON.stringify(this.door.request) : "");
    if (key !== this.targetKey) {
      this.status = "";
      this.targetKey = key;
    }
    seat.prompts = this.prompts();
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.seat.prompts = [];
  }

  /** The vehicle prompt claims the key ahead of the door, as seat 0's does. */
  private enter(): void {
    const { host } = this;
    if (!host.playing || host.inputBlocked) return;
    const request = this.vehicle?.request;
    if (!request) {
      this.goThrough(false);
      return;
    }
    if (!this.vehicleLocked) this.board(request);
  }

  private equip(): void {
    const { host } = this;
    const equipment = this.vehicle?.equipment;
    if (host.playing && !host.inputBlocked && equipment && !this.vehicleLocked)
      this.board(equipment.request);
  }

  private get vehicleLocked(): boolean {
    const { host } = this;
    return this.busy || host.doorPresentation.busy || host.inputBlocked || host.storagePaused;
  }

  /** Only this seat stops: its held keys and its next command. */
  private board(request: VehicleRequest): void {
    this.seat.clear();
    this.seat.cancel();
    const key = this.targetKey;
    this.run(request).then(
      () => {
        if (request.type === "call-train" && this.targetKey === key)
          this.status = "Poof! Your train is here.";
      },
      (error) => {
        if (this.targetKey === key) this.status = String(error);
      },
    );
  }

  /** The device goes through together; a walk keeps the last directional input
   * for the authority's approach check, so no still command goes first. */
  private goThrough(walkThrough: boolean): void {
    const { host } = this;
    const request = this.door?.request;
    if (!request || this.busy || host.doorPresentation.busy) return;
    host.clearPlayInput(!walkThrough);
    if (walkThrough) host.doorPresentation.begin();
    this.run({ ...request, ...(walkThrough ? { walkThrough: true } : {}) }).catch((error) => {
      host.doorPresentation.cancel();
      this.status = String(error);
    });
  }

  private async run(request: DoorRequest | VehicleRequest): Promise<void> {
    this.busy = true;
    this.status = "";
    try {
      await this.host.request(request, this.seat.seat);
    } finally {
      this.busy = false;
    }
  }

  /** Each line with this seat's own key or button ("Drive car · '", "Enter shop · Y"). */
  private prompts(): string[] {
    const hint = (action: "enter_place" | "vehicle_recover") => {
      const label = this.seat.input?.hint(action) ?? "";
      return label ? ` · ${label}` : "";
    };
    const lines: string[] = [];
    const { vehicle, door } = this;
    if (vehicle?.equipment) lines.push(`${vehicle.equipment.label}${hint("vehicle_recover")}`);
    if (vehicle?.request) lines.push(`${vehicle.label}${hint("enter_place")}`);
    else if (door?.request) lines.push(`${door.label}${hint("enter_place")}`);
    if (this.status) lines.push(this.status);
    return lines;
  }
}

/** Every guest's place controls, made and released as guests join and leave. */
export class GuestPlaces {
  private readonly places = new Map<number, GuestPlace>();
  private readonly off: () => void;

  constructor(private readonly host: GuestPlacesHost) {
    this.off = host.session.seats.onChange(() => this.sync());
    this.sync();
  }

  update(dt: number, ready: boolean): void {
    for (const place of this.places.values()) place.update(dt, ready);
  }

  destroy(): void {
    this.off();
    for (const place of this.places.values()) place.dispose();
    this.places.clear();
  }

  private sync(): void {
    const { seats } = this.host.session;
    for (const [seat, place] of this.places)
      if (seats.get(seat) !== place.seat) {
        place.dispose();
        this.places.delete(seat);
      }
    for (const seat of seats.list())
      if (seat.seat !== 0 && !this.places.has(seat.seat))
        this.places.set(seat.seat, new GuestPlace(seat, this.host));
  }
}
