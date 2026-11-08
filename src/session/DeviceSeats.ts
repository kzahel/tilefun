import type { Entity } from "../entities/Entity.js";
import { devicePacket, type SeatSample, type SeatSituation } from "../input/SeatComposer.js";
import { NEUTRAL_MOVEMENT, neutralSample, type SeatInput } from "../input/SeatInput.js";
import type { ClientMessage } from "../shared/protocol.js";
import type { RequestMessage, RequestResponse } from "../shared/requests.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";
import { ClientSeat } from "./ClientSeat.js";

/** One seat's devices and situation for a device tick. */
export interface SeatFrame {
  seat: ClientSeat;
  sample: SeatSample;
  situation: SeatSituation;
}

/** Sends a typed request and resolves with its reply. */
export type Requester = <R extends RequestMessage>(request: R) => Promise<RequestResponse<R>>;

/** The replica as guest composition reads it. */
export interface SeatWorld {
  readonly seats: { readonly entities: ReadonlyMap<number, number> };
  readonly serverEntities: readonly Entity[];
}

/**
 * A device's local players (226): seat 0 always, and guests that join and leave
 * the live connection. Guests share seat 0's input sequence and travel with it.
 */
export class DeviceSeats {
  private readonly bySeat = new Map<number, ClientSeat>([[0, new ClientSeat(0)]]);

  /** Seat 0, sampled by the play scene. */
  get host(): ClientSeat {
    return this.bySeat.get(0) as ClientSeat;
  }

  get(seat: number): ClientSeat | undefined {
    return this.bySeat.get(seat);
  }

  /** Every seat, seat 0 first. */
  list(): ClientSeat[] {
    return [...this.bySeat.values()].sort((a, b) => a.seat - b.seat);
  }

  /** Join a guest with its input set once authority seats it. */
  async join(
    request: Requester,
    requestId: number,
    seat: number,
    input: SeatInput,
    options: { displayName?: string; playerModel?: string } = {},
  ): Promise<ClientSeat> {
    if (seat < 1 || this.bySeat.has(seat)) throw new Error("That seat is taken.");
    await request({ type: "join-seat", requestId, seat, ...options });
    const joined = new ClientSeat(seat, input);
    this.bySeat.set(seat, joined);
    return joined;
  }

  /** A guest leaves the device (from its menu). */
  async leave(request: Requester, requestId: number, seat: number): Promise<void> {
    if (seat < 1 || !this.bySeat.has(seat)) throw new Error("That player is not playing.");
    await request({ type: "leave-seat", requestId, seat });
    this.drop(seat);
  }

  /** Forget a guest: it left, or authority dropped it. Seat 0 stays. */
  drop(seat: number): void {
    const left = seat === 0 ? undefined : this.bySeat.get(seat);
    if (!left) return;
    left.input?.dispose();
    this.bySeat.delete(seat);
  }

  /** Forget every guest and release its input set (session teardown). */
  dispose(): void {
    for (const seat of this.list()) this.drop(seat.seat);
  }

  /** Every seat starts afresh, as a new play scene does. */
  restart(): void {
    for (const seat of this.bySeat.values()) seat.restart();
  }

  /** Each guest's devices and situation; a guest without devices stands still. */
  guestFrames(world: SeatWorld, locked: boolean): SeatFrame[] {
    return this.list()
      .filter((seat) => seat.seat !== 0)
      .map((seat) => {
        const id = world.seats.entities.get(seat.seat);
        const body = world.serverEntities.find((e) => e.id === id);
        const vehicle = body && occupiedVehicle(body, world.serverEntities);
        const input = seat.input;
        seat.composer.board(
          vehicle,
          input?.held("vehicle_lights") ?? false,
          input?.held("vehicle_style") ?? false,
        );
        const sample = input?.sample(locked, vehicle) ?? neutralSample();
        const steering = input?.steering ?? false;
        const facing = body?.sprite?.direction;
        return { seat, sample, situation: { vehicle, locked, steering, joystick: false, facing } };
      });
  }

  /** Clear every seat's input (lost focus, a hidden page, pausing play, menus, travel). */
  clear(): void {
    for (const seat of this.bySeat.values()) seat.clear();
  }

  /** Forget held horns and sirens; returns the guests' horn releases (seat 0's is the
   * play scene's own, sent bare as before). */
  stopHorns(): ClientMessage[] {
    const releases: ClientMessage[] = [];
    for (const seat of this.list()) {
      seat.composer.stop();
      if (seat.seat !== 0) releases.push(seat.address({ type: "vehicle-horn", active: false }));
    }
    return releases;
  }

  /** One still command for every seat, sent at once: off cadence, so prediction does
   * not store it, and a hidden page may never tick again to send it. */
  neutralPacket(seq: number): ClientMessage {
    return devicePacket(
      seq,
      this.list().map((seat) => ({ seat: seat.seat, movement: NEUTRAL_MOVEMENT })),
    ).input;
  }
}
