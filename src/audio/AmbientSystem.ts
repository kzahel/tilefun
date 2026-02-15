import type { Entity } from "../entities/Entity.js";
import type { Camera } from "../rendering/Camera.js";
import type { AudioManager } from "./AudioManager.js";

const CRACKLE_KEYS = ["crackle_00", "crackle_01", "crackle_02"] as const;

/** How often (in seconds) each campfire plays a crackle pop. */
const CRACKLE_INTERVAL_MIN = 0.3;
const CRACKLE_INTERVAL_MAX = 1.2;
/** Max distance (world px) at which a campfire is audible. */
const MAX_AUDIBLE_DISTANCE = 200;
const MAX_VOLUME = 0.12;
const MAX_PAN = 0.5;

interface CampfireState {
  timer: number;
  lastVariant: number;
}

/**
 * Plays ambient sounds for entities in the world.
 * Currently: campfire crackle pops at random intervals with spatial audio.
 */
export class AmbientSystem {
  private campfires = new Map<number, CampfireState>();

  constructor(
    private audio: AudioManager,
    private getCamera: () => Camera,
    private getPlayerEntity: () => Entity,
  ) {}

  update(dt: number, entities: readonly Entity[]): void {
    if (!this.audio.ready) return;

    const liveIds = new Set<number>();

    for (const entity of entities) {
      if (entity.type !== "campfire") continue;

      liveIds.add(entity.id);
      let state = this.campfires.get(entity.id);
      if (!state) {
        state = { timer: randomInterval(), lastVariant: -1 };
        this.campfires.set(entity.id, state);
      }

      state.timer -= dt;
      if (state.timer <= 0) {
        state.timer = randomInterval();
        this.playCrackle(entity, state);
      }
    }

    for (const id of this.campfires.keys()) {
      if (!liveIds.has(id)) this.campfires.delete(id);
    }
  }

  private playCrackle(entity: Entity, state: CampfireState): void {
    const spatial = this.computeSpatial(entity);
    if (!spatial) return;

    const idx = pickVariant(CRACKLE_KEYS.length, state.lastVariant);
    state.lastVariant = idx;

    const key = CRACKLE_KEYS[idx];
    if (!key) return;
    const buffer = this.audio.getBuffer(key);
    if (!buffer) return;

    this.audio.playOneShot({
      buffer,
      volume: spatial.volume,
      pitch: 0.6 + Math.random() * 0.5,
      pan: spatial.pan,
    });
  }

  private computeSpatial(entity: Entity): { volume: number; pan: number } | null {
    const player = this.getPlayerEntity();
    const dx = entity.position.wx - player.position.wx;
    const dy = entity.position.wy - player.position.wy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MAX_AUDIBLE_DISTANCE) return null;

    const distFactor = 1 - dist / MAX_AUDIBLE_DISTANCE;
    const volume = MAX_VOLUME * distFactor;

    const camera = this.getCamera();
    const screen = camera.worldToScreen(entity.position.wx, entity.position.wy);
    const centerX = camera.viewportWidth / 2;
    const normalizedX = camera.viewportWidth > 0 ? (screen.sx - centerX) / (centerX || 1) : 0;
    const pan = Math.max(-MAX_PAN, Math.min(MAX_PAN, normalizedX * MAX_PAN));

    return { volume, pan };
  }
}

function randomInterval(): number {
  return CRACKLE_INTERVAL_MIN + Math.random() * (CRACKLE_INTERVAL_MAX - CRACKLE_INTERVAL_MIN);
}

function pickVariant(count: number, lastIdx: number): number {
  if (count <= 1) return 0;
  let idx: number;
  do {
    idx = Math.floor(Math.random() * count);
  } while (idx === lastIdx);
  return idx;
}
