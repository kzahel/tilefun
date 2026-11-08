import { SeatComposer } from "../input/SeatComposer.js";
import type { SeatInput } from "../input/SeatInput.js";
import type { ClientMessage } from "../shared/protocol.js";

/**
 * One local player on a device (226): its seat on the connection, its input
 * composition and, for a guest, its input set. Seat 0 is sampled by the play
 * scene; a guest's messages travel in its seat envelope.
 */
export class ClientSeat {
  /** Replaced when a new play scene starts the seat afresh. */
  composer = new SeatComposer();
  private jumpLatched = false;
  private cancelled = false;

  constructor(
    readonly seat: number,
    readonly input: SeatInput | null = null,
  ) {}

  /** A jump pressed between ticks (a tap shorter than a tick still jumps). */
  latchJump(): void {
    this.jumpLatched = true;
  }

  takeJump(): boolean {
    const pressed = this.jumpLatched;
    this.jumpLatched = false;
    return pressed;
  }

  /** This seat stops on its next command (a hit while walking to a destination),
   * without an extra sequence that would also stop the device's other seats. */
  cancel(): void {
    this.composer.cancel();
    this.jumpLatched = false;
    this.cancelled = true;
  }

  /** Whether the next command must be neutral; reading it consumes the cancel. */
  takeCancel(): boolean {
    const cancelled = this.cancelled;
    this.cancelled = false;
    return cancelled;
  }

  /** Forget movement, jump and throw state and the input set's held keys (play
   * stopped: focus lost, a hidden page, pausing, menus or travel). */
  clear(): void {
    this.composer.cancel();
    this.jumpLatched = false;
    this.input?.clear();
  }

  /** Start afresh, as a new play scene does. */
  restart(): void {
    this.composer = new SeatComposer();
    this.jumpLatched = this.cancelled = false;
  }

  /** A message from this seat: seat 0 sends bare, a guest in its envelope. */
  address(message: ClientMessage): ClientMessage {
    return this.seat === 0 ? message : { type: "seat", seat: this.seat, message };
  }
}
