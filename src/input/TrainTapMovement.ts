/** A completed tap starts a direction; repeating it stops. Manual input overrides the latch. */
export class TrainTapMovement {
  direction: -1 | 0 | 1 = 0;
  tap(side: -1 | 1): void {
    this.direction = this.direction === side ? 0 : side;
  }
  cancel(): void {
    this.direction = 0;
  }
}
