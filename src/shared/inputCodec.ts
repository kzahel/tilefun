/**
 * Fixed-tick device input on the wire: one packet per device tick (226).
 *
 *   byte 0      0x81
 *   bytes 1-4   seq (uint32), shared by every seat on the device
 *   bytes 5-7   seat 0: dx, dy (int8, ±127) and flags
 *   then 4 bytes per other seat: seat (uint8), dx, dy and flags
 *
 * A single-seat packet keeps the original eight bytes. Little-endian.
 */

import { type ClientMessage, MAX_SEATS, type SeatMovement } from "./protocol.js";

export const TAG_PLAYER_INPUT = 0x81;

type PlayerInput = Extract<ClientMessage, { type: "player-input" }>;
type Controls = Omit<SeatMovement, "seat">;

const SEAT_ZERO_BYTES = 8;
const SEAT_BYTES = 4;

/** Analog [-1,1] as int8 [-127,127]: 0.8% precision, plenty for a joystick. */
function axis(value: number): number {
  return Math.round(Math.max(-1, Math.min(1, value)) * 127);
}

function writeControls(view: DataView, offset: number, m: Controls): void {
  view.setInt8(offset, axis(m.dx));
  view.setInt8(offset + 1, axis(m.dy));
  let flags = 0;
  if (m.sprinting) flags |= 0x01;
  if (m.jump) flags |= 0x02;
  if (m.jumpPressed) flags |= 0x04;
  if (m.reversing) flags |= 0x08;
  if (m.relativeDriving) flags |= 0x10;
  view.setUint8(offset + 2, flags);
}

function readControls(view: DataView, offset: number): Controls {
  const flags = view.getUint8(offset + 2);
  return {
    dx: view.getInt8(offset) / 127,
    dy: view.getInt8(offset + 1) / 127,
    sprinting: (flags & 0x01) !== 0,
    jump: (flags & 0x02) !== 0,
    ...((flags & 0x04) !== 0 ? { jumpPressed: true } : {}),
    ...((flags & 0x08) !== 0 ? { reversing: true } : {}),
    ...((flags & 0x10) !== 0 ? { relativeDriving: true } : {}),
  };
}

/** Another seat's number: 1 up to the device's last seat (seat 0 rides in the header). */
function otherSeat(seat: number): number {
  if (!Number.isInteger(seat) || seat < 1 || seat >= MAX_SEATS)
    throw Error(`Invalid input seat ${seat}`);
  return seat;
}

export function encodePlayerInput(msg: PlayerInput): ArrayBuffer {
  const seats = msg.seats ?? [];
  if (seats.length >= MAX_SEATS) throw Error("Too many seats in one input packet");
  const buf = new ArrayBuffer(SEAT_ZERO_BYTES + seats.length * SEAT_BYTES);
  const view = new DataView(buf);
  view.setUint8(0, TAG_PLAYER_INPUT);
  view.setUint32(1, msg.seq, true);
  writeControls(view, 5, msg);
  seats.forEach((seat, i) => {
    const offset = SEAT_ZERO_BYTES + i * SEAT_BYTES;
    view.setUint8(offset, otherSeat(seat.seat));
    writeControls(view, offset + 1, seat);
  });
  return buf;
}

export function decodePlayerInput(view: DataView): PlayerInput {
  const extra = (view.byteLength - SEAT_ZERO_BYTES) / SEAT_BYTES;
  if (!Number.isInteger(extra) || extra < 0 || extra >= MAX_SEATS)
    throw Error("Invalid fixed-tick input length");
  const seats: SeatMovement[] = [];
  for (let i = 0; i < extra; i++) {
    const offset = SEAT_ZERO_BYTES + i * SEAT_BYTES;
    seats.push({ seat: otherSeat(view.getUint8(offset)), ...readControls(view, offset + 1) });
  }
  return {
    type: "player-input",
    seq: view.getUint32(1, true),
    ...readControls(view, 5),
    ...(seats.length ? { seats } : {}),
  };
}
