import type { AABB } from "../entities/collision.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { getMaterialForPropType } from "../entities/PropFactories.js";
import type { Camera } from "../rendering/Camera.js";
import { worldToTile } from "../world/types.js";
import type { World } from "../world/World.js";
import type { AudioManager } from "./AudioManager.js";
import {
  getSurfaceAtTile,
  IMPACT_VARIANTS,
  JUMP_VARIANTS,
  MaterialType,
  SURFACE_VARIANTS,
  type SurfaceType,
  surfaceToMaterial,
} from "./SurfaceType.js";

/** Per-entity footstep tracking (external to entity objects since they're new each frame). */
interface FootstepState {
  walkTimer: number;
  lastVariant: number;
  wasMoving: boolean;
  wasAirborne: boolean;
}

/** Entity types that produce footstep sounds. */
function hasFootsteps(type: string): boolean {
  return type === "player" || type.startsWith("person") || type === "chicken" || type === "cow";
}

const PLAYER_VOLUME = 0.35;
const NPC_MAX_VOLUME = 0.15;
const JUMP_VOLUME = 0.25;
const LANDING_VOLUME = 0.4;
const MAX_AUDIBLE_DISTANCE = 300;
const MAX_PAN = 0.5;

/** Reference weight (adult human) — sqrt(weight/REF) gives the volume factor. */
const REFERENCE_WEIGHT = 70;
/** Default weight if entity has none set. */
const DEFAULT_WEIGHT = 70;
/** Minimum weight factor (very light creatures are still faintly audible). */
const MIN_WEIGHT_FACTOR = 0.08;
/** Maximum weight factor (heavy creatures don't clip). */
const MAX_WEIGHT_FACTOR = 1.5;

/** Compute a volume/pitch multiplier from entity weight. sqrt curve feels natural. */
function weightFactor(weight: number): number {
  const raw = Math.sqrt(weight / REFERENCE_WEIGHT);
  return Math.max(MIN_WEIGHT_FACTOR, Math.min(MAX_WEIGHT_FACTOR, raw));
}

/** Pitch offset from weight — heavier = lower, lighter = higher. */
function weightPitchOffset(weight: number): number {
  // At 70kg: 0, at 2kg: +0.08, at 500kg: -0.06
  return -0.03 * Math.log2(weight / REFERENCE_WEIGHT);
}

export class FootstepSystem {
  private states = new Map<number, FootstepState>();

  constructor(
    private audio: AudioManager,
    private getWorld: () => World,
    private getCamera: () => Camera,
    private getPlayerEntity: () => Entity,
    private getProps: () => readonly Prop[],
  ) {}

  update(dt: number, entities: readonly Entity[]): void {
    if (!this.audio.ready) return;

    const liveIds = new Set<number>();

    for (const entity of entities) {
      if (!entity.sprite || !hasFootsteps(entity.type)) continue;

      liveIds.add(entity.id);
      let state = this.states.get(entity.id);
      if (!state) {
        state = { walkTimer: 0, lastVariant: -1, wasMoving: false, wasAirborne: false };
        this.states.set(entity.id, state);
      }

      const airborne = entity.jumpVZ !== undefined;

      // Detect jump launch (grounded → airborne)
      if (!state.wasAirborne && airborne) {
        this.triggerJump(entity);
      }

      // Detect landing (airborne → grounded)
      if (state.wasAirborne && !airborne) {
        this.triggerLanding(entity, state);
      }
      state.wasAirborne = airborne;

      // Skip footsteps while airborne
      if (airborne) {
        state.wasMoving = entity.sprite.moving;
        continue;
      }

      if (!entity.sprite.moving) {
        state.walkTimer = 0;
        state.wasMoving = false;
        continue;
      }

      // Half walk cycle = one footstep (2 foot contacts per full cycle)
      const halfCycleMs = (entity.sprite.frameDuration * entity.sprite.frameCount) / 2;

      if (!state.wasMoving) {
        // Just started moving — play immediately
        state.walkTimer = 0;
        state.wasMoving = true;
        this.triggerStep(entity, state);
        continue;
      }

      state.wasMoving = true;
      state.walkTimer += dt * 1000;

      if (state.walkTimer >= halfCycleMs) {
        state.walkTimer -= halfCycleMs;
        this.triggerStep(entity, state);
      }
    }

    // Prune state for despawned entities
    for (const id of this.states.keys()) {
      if (!liveIds.has(id)) this.states.delete(id);
    }
  }

  private triggerStep(entity: Entity, state: FootstepState): void {
    const spatial = this.computeSpatial(entity);
    if (!spatial) return;

    const surface = this.getSurface(entity);
    const variants = SURFACE_VARIANTS[surface];
    const idx = this.pickVariant(variants.length, state.lastVariant);
    state.lastVariant = idx;

    const key = variants[idx];
    if (!key) return;
    const buffer = this.audio.getBuffer(key);
    if (!buffer) return;

    const w = entity.weight ?? DEFAULT_WEIGHT;
    const pitch = 1 + (Math.random() - 0.5) * 0.15 + weightPitchOffset(w);
    this.audio.playOneShot({
      buffer,
      volume: spatial.volume * weightFactor(w),
      pitch,
      pan: spatial.pan,
    });
  }

  private triggerJump(entity: Entity): void {
    const spatial = this.computeSpatial(entity);
    if (!spatial) return;

    const idx = Math.floor(Math.random() * JUMP_VARIANTS.length);
    const key = JUMP_VARIANTS[idx];
    if (!key) return;
    const buffer = this.audio.getBuffer(key);
    if (!buffer) return;

    const w = entity.weight ?? DEFAULT_WEIGHT;
    this.audio.playOneShot({
      buffer,
      volume: spatial.volume * weightFactor(w) * (JUMP_VOLUME / PLAYER_VOLUME),
      pitch: 1 + (Math.random() - 0.5) * 0.1 + weightPitchOffset(w),
      pan: spatial.pan,
    });
  }

  private triggerLanding(entity: Entity, state: FootstepState): void {
    const spatial = this.computeSpatial(entity);
    if (!spatial) return;

    const material = this.getLandingMaterial(entity);
    const variants = IMPACT_VARIANTS[material];
    const idx = this.pickVariant(variants.length, state.lastVariant);
    state.lastVariant = idx;

    const key = variants[idx];
    if (!key) return;
    const buffer = this.audio.getBuffer(key);
    if (!buffer) return;

    const w = entity.weight ?? DEFAULT_WEIGHT;
    this.audio.playOneShot({
      buffer,
      volume: spatial.volume * weightFactor(w) * (LANDING_VOLUME / PLAYER_VOLUME),
      pitch: 0.85 + (Math.random() - 0.5) * 0.1 + weightPitchOffset(w),
      pan: spatial.pan,
    });
  }

  /** Determine landing material: check walkable prop surfaces first, then fall back to terrain. */
  private getLandingMaterial(entity: Entity): MaterialType {
    if (entity.collider) {
      const aabb = getEntityAABB(entity.position, entity.collider);
      const propMaterial = this.findPropMaterialUnder(aabb);
      if (propMaterial !== undefined) return propMaterial;
    }
    const surface = this.getSurface(entity);
    return surfaceToMaterial(surface);
  }

  /** Find the material of the highest walkable prop surface overlapping an AABB. */
  private findPropMaterialUnder(aabb: AABB): MaterialType | undefined {
    const props = this.getProps();
    let bestZ: number | undefined;
    let bestType: string | undefined;

    for (const prop of props) {
      const colliders = prop.walls ?? (prop.collider ? [prop.collider] : []);
      for (const c of colliders) {
        if (!c.walkableTop || c.zHeight === undefined) continue;
        const topZ = (c.zBase ?? 0) + c.zHeight;
        if (aabbsOverlap(aabb, getEntityAABB(prop.position, c))) {
          if (bestZ === undefined || topZ > bestZ) {
            bestZ = topZ;
            bestType = prop.type;
          }
        }
      }
    }

    if (bestType !== undefined) {
      return getMaterialForPropType(bestType) ?? MaterialType.Soft;
    }
    return undefined;
  }

  private getSurface(entity: Entity): SurfaceType {
    const { tx, ty } = worldToTile(entity.position.wx, entity.position.wy);
    const world = this.getWorld();
    const tileId = world.getTerrainIfLoaded(tx, ty);
    const roadType = world.getRoadAt(tx, ty);
    return getSurfaceAtTile(tileId as number, roadType);
  }

  private computeSpatial(entity: Entity): { volume: number; pan: number } | null {
    const player = this.getPlayerEntity();
    const isPlayer = entity.id === player.id;

    if (isPlayer) {
      return { volume: PLAYER_VOLUME, pan: 0 };
    }

    // Scale max audible distance by weight — light creatures are only audible close up
    const w = entity.weight ?? DEFAULT_WEIGHT;
    const wf = weightFactor(w);
    const maxDist = MAX_AUDIBLE_DISTANCE * wf;

    const dx = entity.position.wx - player.position.wx;
    const dy = entity.position.wy - player.position.wy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) return null;

    const distFactor = 1 - dist / maxDist;
    const volume = NPC_MAX_VOLUME * distFactor;

    const camera = this.getCamera();
    const screen = camera.worldToScreen(entity.position.wx, entity.position.wy);
    const centerX = camera.viewportWidth / 2;
    const normalizedX = camera.viewportWidth > 0 ? (screen.sx - centerX) / (centerX || 1) : 0;
    const pan = Math.max(-MAX_PAN, Math.min(MAX_PAN, normalizedX * MAX_PAN));

    return { volume, pan };
  }

  /** Pick a random variant index, avoiding the last one played. */
  private pickVariant(count: number, lastIdx: number): number {
    if (count <= 1) return 0;
    let idx: number;
    do {
      idx = Math.floor(Math.random() * count);
    } while (idx === lastIdx);
    return idx;
  }
}
