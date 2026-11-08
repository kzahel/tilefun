import { devicePacket, type SeatTick } from "../input/SeatComposer.js";
import { neutralSample } from "../input/SeatInput.js";
import type { Movement } from "../shared/Movement.js";
import type { ClientMessage } from "../shared/protocol.js";
import type { SeatFrame } from "./DeviceSeats.js";

/** One device tick's messages and what prediction replays. */
export interface DeviceTick {
  /** Every seat's presses that precede the movement packet, each in its seat's envelope. */
  before: ClientMessage[];
  /** One packet with every seat's command under the device's sequence. */
  input: ClientMessage;
  after: ClientMessage[];
  /** Seat 0's composed tick (its movement and presses). */
  host: SeatTick;
  /** The other seats' movement keyed by seat, for the predictor. */
  coSeats: Map<number, Movement> | undefined;
}

/**
 * Compose one device tick (226): every seat's command shares `seq`; a locked
 * seat's sample is already still, and a cancelled seat's command is still on
 * this tick. `frames` start with seat 0.
 */
export function composeDeviceTick(
  frames: readonly SeatFrame[],
  seq: number,
  dt: number,
): DeviceTick {
  const before: ClientMessage[] = [],
    after: ClientMessage[] = [],
    commands: { seat: number; movement: Movement }[] = [];
  let host: SeatTick | undefined;
  for (const { seat, sample, situation } of frames) {
    const tick = seat.composer.tick(
      seat.takeCancel() ? neutralSample(sample) : sample,
      situation,
      dt,
    );
    host ??= tick;
    before.push(...tick.before.map((press) => seat.address(press)));
    after.push(...tick.after.map((press) => seat.address(press)));
    commands.push({ seat: seat.seat, movement: tick.movement });
  }
  const packet = devicePacket(seq, commands);
  if (!host) throw new Error("A device tick starts with seat 0");
  return { before, input: packet.input, after, host, coSeats: packet.coSeats };
}
