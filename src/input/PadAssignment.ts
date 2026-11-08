/**
 * Standard gamepads to local seats, by `Gamepad.index` (tactical 226). With one
 * seat every pad drives it, as today. With several seats a pad joins the lowest
 * free seat on its first button press and keeps it until it disconnects; pads
 * beyond the seat count stay unassigned. Seats a keyboard scheme already owns
 * can be excluded.
 */
export interface PadState {
  index: number;
  connected: boolean;
  /** Any button is pressed this frame (sticks alone never join). */
  pressed: boolean;
}

export class PadAssignment {
  private readonly owners = new Map<number, number>();

  constructor(
    private readonly seats: number,
    private readonly reserved: ReadonlySet<number> = new Set(),
  ) {}

  /** Apply one frame of pad states; returns pad index → seat. */
  update(pads: readonly PadState[]): ReadonlyMap<number, number> {
    const connected = new Set(pads.filter((pad) => pad.connected).map((pad) => pad.index));
    for (const index of this.owners.keys()) if (!connected.has(index)) this.owners.delete(index);
    if (this.seats === 1) {
      this.owners.clear();
      for (const index of connected) this.owners.set(index, 0);
      return this.owners;
    }
    for (const pad of [...pads].sort((a, b) => a.index - b.index)) {
      if (!pad.connected || !pad.pressed || this.owners.has(pad.index)) continue;
      const seat = this.freeSeat();
      if (seat !== undefined) this.owners.set(pad.index, seat);
    }
    return this.owners;
  }

  seatOf(index: number): number | undefined {
    return this.owners.get(index);
  }

  private freeSeat(): number | undefined {
    const taken = new Set(this.owners.values());
    for (let seat = 0; seat < this.seats; seat++)
      if (!taken.has(seat) && !this.reserved.has(seat)) return seat;
    return undefined;
  }
}
