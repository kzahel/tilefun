import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import { DOOR_FADE_MS, type DoorMotion } from "../interiors/DoorTraversal.js";
import type { SceneItem } from "../rendering/SceneItem.js";

interface Motion {
  event: DoorMotion;
  start: number;
}
/** Cosmetic motion never moves the authoritative or predicted player into a wall. */
export class DoorPresentation {
  private motions = new Map<string, Motion>();
  private own: Motion | null = null;
  private deadline = 0;
  private waiting = false;
  private readonly veil = document.createElement("div");
  busy = false;
  constructor() {
    this.veil.style.cssText =
      "position:fixed;inset:0;background:black;opacity:0;pointer-events:none;z-index:79";
    this.veil.dataset.doorFade = "true";
    document.body.append(this.veil);
  }
  begin(now = performance.now()) {
    this.busy = true;
    this.deadline = now + 30000;
  }
  receive(event: DoorMotion, now = performance.now()) {
    const motion = { event, start: now };
    this.motions.set(event.actorClientId, motion);
    if (event.self) {
      this.begin(now);
      this.own = motion;
      this.waiting = event.phase === "arrive";
    }
  }
  update(realmId: string | null, ready: boolean, now = performance.now()) {
    if (this.busy && now > this.deadline) this.cancel();
    let opacity = 0;
    const own = this.own;
    if (own) {
      if (this.waiting && ready && realmId === own.event.realmId) {
        own.start = now;
        this.waiting = false;
      }
      const elapsed = now - own.start;
      if (own.event.phase === "depart")
        opacity = Math.min(1, Math.max(0, (elapsed - own.event.duration) / DOOR_FADE_MS));
      else if (this.waiting) opacity = 1;
      else {
        opacity = Math.max(0, 1 - elapsed / DOOR_FADE_MS);
        if (elapsed >= own.event.duration + DOOR_FADE_MS) {
          this.own = null;
          this.busy = false;
        }
      }
    }
    this.veil.style.opacity = String(opacity);
    this.veil.dataset.stage = this.waiting
      ? "loading"
      : (this.own?.event.phase ?? (this.busy ? "pending" : "idle"));
    for (const [key, motion] of this.motions) {
      if (motion === this.own) continue;
      if (now - motion.start > motion.event.duration + DOOR_FADE_MS + 300) this.motions.delete(key);
    }
  }
  entities(
    entities: readonly Entity[],
    realmId: string | null,
    now = performance.now(),
  ): readonly Entity[] {
    if (!this.motions.size) return entities;
    return entities.map((entity) => {
      const motion = [...this.motions.values()].find(
        (m) => m.event.realmId === realmId && m.event.actorId === entity.id,
      );
      if (!motion || (motion === this.own && this.waiting)) return entity;
      const { event, start } = motion;
      const t = Math.min(1, Math.max(0, (now - start) / event.duration));
      if (event.phase === "arrive" && t >= 1) return entity;
      const position = {
        wx: event.from.wx + (event.to.wx - event.from.wx) * t,
        wy: event.from.wy + (event.to.wy - event.from.wy) * t,
      };
      const direction = event.to.wy < event.from.wy ? Direction.Up : Direction.Down;
      return {
        ...entity,
        position,
        prevPosition: position,
        sprite: entity.sprite
          ? {
              ...entity.sprite,
              direction,
              frameRow: direction,
              moving: t < 1,
              frameCol:
                Math.floor((now - start) / entity.sprite.frameDuration) % entity.sprite.frameCount,
            }
          : null,
      };
    });
  }
  appendOverlays(items: SceneItem[], realmId: string | null, now = performance.now()) {
    const doors = new Map<string, { wx: number; wy: number; frame: number }>();
    for (const motion of this.motions.values()) {
      const { event, start } = motion;
      if (event.realmId !== realmId || !event.overlay) continue;
      const elapsed = now - start;
      const closing = elapsed > event.duration + DOOR_FADE_MS;
      const frame = closing
        ? Math.min(13, 7 + Math.floor((elapsed - event.duration - DOOR_FADE_MS) / 40))
        : event.phase === "arrive"
          ? 6
          : Math.min(6, Math.floor(elapsed / 40));
      const key = `${event.overlay.wx}:${event.overlay.wy}`;
      const prior = doors.get(key);
      // Any traveller still using the door keeps it open for everyone.
      if (!prior || (frame <= 6 && (prior.frame > 6 || frame > prior.frame)))
        doors.set(key, { ...event.overlay, frame });
    }
    for (const door of doors.values())
      items.push({
        kind: "sprite",
        sortKey: door.wy + 0.1,
        wx: door.wx,
        wy: door.wy,
        zOffset: 0,
        sheetKey: "door-butcher-v1",
        frameCol: door.frame,
        frameRow: 0,
        spriteWidth: 16,
        spriteHeight: 32,
        flipX: false,
        drawOffsetY: 0,
        hasShadow: false,
        shadowFeetWy: door.wy,
        shadowWidth: 0,
        shadowTerrainZ: 0,
        flashHidden: false,
      });
    if (doors.size) items.sort((a, b) => a.sortKey - b.sortKey);
  }
  cancel() {
    this.busy = false;
    this.own = null;
    this.waiting = false;
    this.motions.clear();
    this.veil.style.opacity = "0";
  }
  destroy() {
    this.cancel();
    this.veil.remove();
  }
}
