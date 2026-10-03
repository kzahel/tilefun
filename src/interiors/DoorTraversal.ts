import type { PositionComponent } from "../entities/Entity.js";

export const DOOR_WALK_MS = 400;
export const DOOR_FADE_MS = 180;
export interface DoorMotion {
  type: "door-motion";
  phase: "depart" | "arrive";
  actorId: number;
  actorClientId: string;
  realmId: string;
  self: boolean;
  from: PositionComponent;
  to: PositionComponent;
  duration: number;
  /** Optional exact facade animation, independent of the building's frozen art. */
  overlay?: { wx: number; wy: number; kind: "butcher" };
}
export function atDoorThreshold(
  position: PositionComponent,
  door: PositionComponent,
  entering: boolean,
  approachSlack = 0,
) {
  const forward = entering ? door.wy - position.wy : position.wy - door.wy;
  return Math.abs(position.wx - door.wx) <= 8 && forward >= -12 - approachSlack && forward <= 12;
}
export function towardDoor(dx: number, dy: number, entering: boolean) {
  return (
    Number.isFinite(dx) &&
    Number.isFinite(dy) &&
    Math.abs(dx) < 0.5 &&
    (entering ? dy < -0.5 : dy > 0.5)
  );
}

/** A fresh approach is required after spawn, realm changes, or any attempted trip. */
export class DoorApproach {
  private blocked = new Set<string>();
  private initialized = false;
  private intentTime = 0;
  private candidate = "";
  reset() {
    this.initialized = false;
    this.blocked.clear();
    this.intentTime = 0;
    this.candidate = "";
  }
  update(
    nearby: readonly string[],
    threshold: string | null,
    toward: boolean,
    dt: number,
  ): boolean {
    if (!this.initialized) {
      for (const key of nearby) this.blocked.add(key);
      this.initialized = true;
    }
    for (const key of this.blocked) if (!nearby.includes(key)) this.blocked.delete(key);
    if (!threshold || !toward || this.blocked.has(threshold)) {
      this.intentTime = 0;
      this.candidate = "";
      return false;
    }
    if (this.candidate !== threshold) this.intentTime = 0;
    this.candidate = threshold;
    this.intentTime += Math.min(dt, 0.05);
    if (this.intentTime < 0.1) return false;
    this.blocked.add(threshold);
    this.intentTime = 0;
    return true;
  }
}
