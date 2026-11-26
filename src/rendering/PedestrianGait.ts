import type { PositionComponent } from "../entities/Entity.js";

interface Step {
  x: number;
  y: number;
  time: number;
  phase: number;
}

/** View-local travel for visible actors. IDs survive borrowed replica objects and draw-order changes. */
export class PedestrianGait {
  private last = new Map<number, Step>();
  private current = new Map<number, Step>();

  begin() {
    [this.last, this.current] = [this.current, this.last];
    this.current.clear();
  }

  sample(id: number, position: PositionComponent, time: number, moving: boolean, stride: number) {
    const step = this.current.get(id) ?? this.last.get(id);
    let phase = 0;
    if (moving && step) {
      const distance = Math.hypot(position.wx - step.x, position.wy - step.y);
      const elapsed = time - step.time;
      // A pause, teleport or visibility gap establishes the next ground contact.
      if (elapsed >= 0 && elapsed <= 0.25 && distance < stride)
        phase = (step.phase + (elapsed > 0 ? distance / stride : 0)) % 1;
    }
    const next = step ?? { x: 0, y: 0, time, phase };
    next.x = position.wx;
    next.y = position.wy;
    next.time = time;
    next.phase = phase;
    this.current.set(id, next);
    return phase;
  }
}
