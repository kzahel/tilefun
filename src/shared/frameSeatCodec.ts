/**
 * The seat list of a (connection, realm) frame on the wire (226): an optional trailing
 * extension after the physics snapshot, so a frame without one keeps its exact bytes.
 *
 *   byte 0     seat count (1 to MAX_SEATS)
 *   then 5 bytes per seat: seat (uint8, below MAX_SEATS, ascending) and entity id (uint32)
 */

import { type FrameSeat, MAX_SEATS } from "./protocol.js";

const SEAT_BYTES = 5;

function validSeats(seats: readonly FrameSeat[]): boolean {
  return (
    seats.length >= 1 &&
    seats.length <= MAX_SEATS &&
    seats.every(
      (s, i) =>
        Number.isInteger(s.seat) &&
        s.seat >= 0 &&
        s.seat < MAX_SEATS &&
        (i === 0 || s.seat > (seats[i - 1]?.seat ?? MAX_SEATS)) &&
        Number.isInteger(s.entityId) &&
        s.entityId >= 0 &&
        s.entityId <= 0xffff_ffff,
    )
  );
}

export function frameSeatBytes(seats?: readonly FrameSeat[]): number {
  return seats ? 1 + seats.length * SEAT_BYTES : 0;
}

export function writeFrameSeats(view: DataView, offset: number, seats?: readonly FrameSeat[]) {
  if (!seats) return offset;
  if (!validSeats(seats)) throw Error("Invalid frame seat list");
  view.setUint8(offset++, seats.length);
  for (const { seat, entityId } of seats) {
    view.setUint8(offset, seat);
    view.setUint32(offset + 1, entityId, true);
    offset += SEAT_BYTES;
  }
  return offset;
}

/** The seat list if the frame has one, and the offset after it. */
export function readFrameSeats(view: DataView, offset: number): [FrameSeat[] | undefined, number] {
  if (offset === view.byteLength) return [undefined, offset];
  const count = view.getUint8(offset++);
  if (offset + count * SEAT_BYTES > view.byteLength)
    throw Error("Invalid trailing frame seat list length");
  const seats: FrameSeat[] = [];
  for (let i = 0; i < count; i++, offset += SEAT_BYTES)
    seats.push({ seat: view.getUint8(offset), entityId: view.getUint32(offset + 1, true) });
  if (!validSeats(seats)) throw Error("Invalid trailing frame seat list");
  return [seats, offset];
}
