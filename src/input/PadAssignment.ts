/**
 * Standard gamepads to local seats, by `Gamepad.index` (tactical 226). Seat 0
 * keeps the first pad it uses (a button or the stick), as single player does.
 * Any other pad's button press asks to join a guest seat; a joined guest keeps
 * its pad until it leaves or the pad disconnects. A pad whose press was refused,
 * or whose guest left, must be released before it can ask again.
 */
export interface PadState {
  index: number;
  connected: boolean;
  /** Any button is pressed this poll. */
  pressed: boolean;
  /** A button or a deflected stick: enough for seat 0 to claim the pad. */
  active: boolean;
}

/** Chooses the pads that drive seat 0 and its menus from every standard pad, seeing
 * them all first (226: the page's seat assignment). */
export interface PadPool {
  pool(pads: Gamepad[], ui: boolean, now: number): Gamepad[];
}
/** Single player, labs and tests: every pad drives seat 0. */
export const EVERY_PAD: PadPool = { pool: (pads) => pads };

export interface PadChanges {
  /** Pads asking to join a guest seat, now pending (answer with `assign` or `wait`). */
  readonly joins: number[];
  /** Guest seats whose pad disconnected. */
  readonly lost: number[];
}

export class PadAssignment {
  private host: number | undefined;
  private readonly guests = new Map<number, number>();
  private readonly pending = new Set<number>();
  private readonly waiting = new Set<number>();

  /** Seat 0's pad, once it has used one. */
  get hostPad(): number | undefined {
    return this.host;
  }

  /** The guest seat a pad drives. */
  seatOf(index: number): number | undefined {
    return this.guests.get(index);
  }

  /** The pad a guest seat plays on. */
  padOf(seat: number): number | undefined {
    for (const [index, owner] of this.guests) if (owner === seat) return index;
    return undefined;
  }

  /** Apply one poll of pad states. */
  update(pads: readonly PadState[]): PadChanges {
    const connected = new Map(pads.filter((pad) => pad.connected).map((pad) => [pad.index, pad]));
    const lost: number[] = [];
    if (this.host !== undefined && !connected.has(this.host)) this.host = undefined;
    for (const [index, seat] of this.guests)
      if (!connected.has(index)) {
        this.guests.delete(index);
        lost.push(seat);
      }
    for (const index of this.pending) if (!connected.has(index)) this.pending.delete(index);
    for (const index of this.waiting) {
      const pad = connected.get(index);
      if (!pad?.pressed) this.waiting.delete(index);
    }
    const joins: number[] = [];
    // A pad pressed in the poll where seat 0 claims its own (a pad listed twice, or
    // two pads pressed at once) must be released before it can ask to join.
    const claiming = this.host === undefined;
    for (const pad of [...connected.values()].sort((a, b) => a.index - b.index)) {
      if (!this.free(pad.index)) continue;
      if (this.host === undefined) {
        if (pad.active) this.host = pad.index;
      } else if (pad.pressed && claiming) this.waiting.add(pad.index);
      else if (pad.pressed) {
        this.pending.add(pad.index);
        joins.push(pad.index);
      }
    }
    return { joins, lost };
  }

  /** The pad's guest joined `seat`. */
  assign(index: number, seat: number): void {
    this.pending.delete(index);
    this.waiting.delete(index);
    this.guests.set(index, seat);
  }

  /** Refused, failed or left: the pad must be released before it asks again. */
  wait(index: number): void {
    this.pending.delete(index);
    for (const [pad] of this.guests) if (pad === index) this.guests.delete(pad);
    this.waiting.add(index);
  }

  /** A guest seat is gone (left or dropped): its pad waits for release. */
  release(seat: number): void {
    const index = this.padOf(seat);
    if (index !== undefined) this.wait(index);
  }

  /** Pads seat 0's controller must ignore: every pad but its own once it has one,
   * otherwise guests' and joining pads (an unclaimed pad may still become its own). */
  excluded(pads: readonly { index: number }[]): Set<number> {
    if (this.host !== undefined)
      return new Set(pads.map((pad) => pad.index).filter((index) => index !== this.host));
    return new Set([...this.guests.keys(), ...this.pending, ...this.waiting]);
  }

  private free(index: number): boolean {
    return (
      index !== this.host &&
      !this.guests.has(index) &&
      !this.pending.has(index) &&
      !this.waiting.has(index)
    );
  }
}
