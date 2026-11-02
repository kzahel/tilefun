/** Current authority interval / prediction command only. Passive displacement is
 * accounted separately from voluntary velocity, so it cannot feed the next motor.
 */
export class CharacterMotionBudget {
  private bodies = new Map<
    number,
    {
      ownTime: number;
      passiveTime: number;
      speed: number;
      x: number;
      y: number;
      peers: Map<number, number>;
    }
  >();
  clear() {
    this.bodies.clear();
  }
  admit(id: number, x: number, y: number, dt: number, speed: number, own: boolean, sourceId = id) {
    const state = this.bodies.get(id) ?? {
      ownTime: 0,
      passiveTime: 0,
      speed: 0,
      x: 0,
      y: 0,
      peers: new Map<number, number>(),
    };
    if (own) state.ownTime += dt;
    else {
      const time = (state.peers.get(sourceId) ?? 0) + dt;
      state.peers.set(sourceId, time);
      state.passiveTime = Math.max(state.passiveTime, time);
    }
    state.speed = Math.max(state.speed, speed);
    this.bodies.set(id, state);
    const radius = state.speed * Math.max(state.ownTime, state.passiveTime);
    const a = x * x + y * y,
      b = 2 * (state.x * x + state.y * y),
      c = state.x * state.x + state.y * state.y - radius * radius;
    let fraction = 1;
    if (a > 0 && a + b + c > 1e-8)
      fraction = Math.max(
        0,
        Math.min(1, (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a)),
      );
    return { x: x * fraction, y: y * fraction };
  }
  record(id: number, x: number, y: number) {
    const state = this.bodies.get(id);
    if (state) {
      state.x += x;
      state.y += y;
    }
  }
}
