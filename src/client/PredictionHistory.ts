import type { Entity } from "../entities/Entity.js";

type Point = { x: number; y: number; z: number };

/** Past-tick agreement needs position only. Bounded records never retain entities,
 * components or replay state; a retired point can be reused immediately. */
export class PredictionHistory {
  private readonly points = new Map<number, Point>();
  constructor(private readonly capacity: number) {}

  clear() {
    this.points.clear();
  }

  remember(tick: number, player: Entity) {
    let point = this.points.get(tick);
    if (!point && this.points.size >= this.capacity) {
      const oldest = this.points.keys().next().value;
      if (oldest !== undefined) {
        point = this.points.get(oldest);
        this.points.delete(oldest);
      }
    }
    point ??= { x: 0, y: 0, z: 0 };
    point.x = player.position.wx;
    point.y = player.position.wy;
    point.z = player.wz ?? 0;
    this.points.set(tick, point);
  }

  distance(tick: number, player: Entity): number | undefined {
    const point = this.points.get(tick);
    return point
      ? Math.hypot(
          point.x - player.position.wx,
          point.y - player.position.wy,
          point.z - (player.wz ?? 0),
        )
      : undefined;
  }
}
