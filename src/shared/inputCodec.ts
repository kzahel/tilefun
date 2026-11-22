/**
 * Fixed-tick device input on the wire: one packet per device tick (226).
 *
 *   byte 0      0x81, or 0x82 with shared-screen dimensions
 *   bytes 1-4   seq (uint32), shared by every seat on the device
 *   bytes 5-7   seat 0: dx, dy (int8, ±127) and flags
 *   0x82 only   shared-screen X and Y spread (two uint16)
 *   then 4 bytes per other seat: seat (uint8), dx, dy and flags
 *
 * A single-seat packet keeps the original eight bytes. Little-endian.
 */

import { excavatorActionFromId, excavatorActionId } from "./ExcavatorInput.js";
import { type ClientMessage, MAX_SEATS, type SeatMovement } from "./protocol.js";
import { normalizeSharedScreenSpan } from "./SharedScreenSpan.js";

export const TAG_PLAYER_INPUT = 0x81;
export const TAG_SHARED_SCREEN_INPUT = 0x82;

type PlayerInput = Extract<ClientMessage, { type: "player-input" }>;
type Controls = Omit<SeatMovement, "seat">;

const SEAT_ZERO_BYTES = 8;
const SEAT_BYTES = 4;
const LEGACY_SHARED_SCREEN = 0x40; // Mode bit in older clients' host controls.
const SPAN_BYTES = 4;

/** Analog [-1,1] as int8 [-127,127]: 0.8% precision, plenty for a joystick. */
function axis(value: number): number {
  return Math.round(Math.max(-1, Math.min(1, value)) * 127);
}

function writeControls(view: DataView, offset: number, m: Controls): void {
  // Work-arm control and driving axes are mutually exclusive.
  if (m.excavatorAction) {
    view.setUint8(offset, excavatorActionId(m.excavatorAction));
    view.setUint8(offset + 2, 0x20);
    return;
  }
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
  if (flags & 0x20) {
    const excavatorAction = excavatorActionFromId(view.getUint8(offset));
    return {
      dx: 0,
      dy: 0,
      sprinting: false,
      jump: false,
      ...(excavatorAction && { excavatorAction }),
    };
  }
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
  const span =
    msg.sharedScreen && msg.sharedScreen !== true
      ? normalizeSharedScreenSpan(msg.sharedScreen)
      : undefined;
  const header = SEAT_ZERO_BYTES + (span ? SPAN_BYTES : 0);
  const buf = new ArrayBuffer(header + seats.length * SEAT_BYTES);
  const view = new DataView(buf);
  view.setUint8(0, span ? TAG_SHARED_SCREEN_INPUT : TAG_PLAYER_INPUT);
  view.setUint32(1, msg.seq, true);
  writeControls(view, 5, msg);
  if (msg.sharedScreen === true) view.setUint8(7, view.getUint8(7) | LEGACY_SHARED_SCREEN);
  if (span) {
    view.setUint16(SEAT_ZERO_BYTES, span.x, true);
    view.setUint16(SEAT_ZERO_BYTES + 2, span.y, true);
  }
  seats.forEach((seat, i) => {
    const offset = header + i * SEAT_BYTES;
    view.setUint8(offset, otherSeat(seat.seat));
    writeControls(view, offset + 1, seat);
  });
  return buf;
}

export function decodePlayerInput(view: DataView): PlayerInput {
  if (view.byteLength < SEAT_ZERO_BYTES) throw Error("Invalid fixed-tick input length");
  const hasSpan = view.getUint8(0) === TAG_SHARED_SCREEN_INPUT;
  const header = SEAT_ZERO_BYTES + (hasSpan ? SPAN_BYTES : 0);
  const extra = (view.byteLength - header) / SEAT_BYTES;
  if (!Number.isInteger(extra) || extra < 0 || extra >= MAX_SEATS)
    throw Error("Invalid fixed-tick input length");
  const seats: SeatMovement[] = [];
  for (let i = 0; i < extra; i++) {
    const offset = header + i * SEAT_BYTES;
    seats.push({ seat: otherSeat(view.getUint8(offset)), ...readControls(view, offset + 1) });
  }
  const sharedScreen = hasSpan
    ? normalizeSharedScreenSpan({
        x: view.getUint16(SEAT_ZERO_BYTES, true),
        y: view.getUint16(SEAT_ZERO_BYTES + 2, true),
      })
    : (view.getUint8(7) & LEGACY_SHARED_SCREEN) !== 0;
  return {
    type: "player-input",
    seq: view.getUint32(1, true),
    ...readControls(view, 5),
    ...(sharedScreen ? { sharedScreen } : {}),
    ...(seats.length ? { seats } : {}),
  };
}
