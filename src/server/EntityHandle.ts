import { TILE_SIZE } from "../config/constants.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { GameplaySession } from "./PlayerSession.js";

const EMPTY_SET: ReadonlySet<string> = new Set();

export class EntityHandle {
  protected readonly entity: Entity;
  protected readonly entityManager: EntityManager;

  constructor(entity: Entity, entityManager: EntityManager) {
    this.entity = entity;
    this.entityManager = entityManager;
  }

  // --- Identity ---

  get id(): number {
    return this.entity.id;
  }
  get type(): string {
    return this.entity.type;
  }

  // --- Position ---

  get wx(): number {
    return this.entity.position.wx;
  }
  get wy(): number {
    return this.entity.position.wy;
  }
  get wz(): number {
    return this.entity.wz ?? 0;
  }

  setPosition(wx: number, wy: number): void {
    if (!this.alive) return;
    if (this.entityManager.canPlace?.(wx, wy) === false)
      throw new Error("Position is outside ready terrain.");
    delete this.entity.airMomentumX;
    delete this.entity.airMomentumY;
    this.entity.position.wx = wx;
    this.entity.position.wy = wy;
  }

  // --- Jump / Z velocity ---

  get jumpVZ(): number | undefined {
    return this.entity.jumpVZ;
  }

  setJumpVZ(vz: number): void {
    if (!this.alive) return;
    this.entity.jumpVZ = vz;
  }

  // --- Velocity ---

  get vx(): number {
    return this.entity.velocity?.vx ?? 0;
  }
  get vy(): number {
    return this.entity.velocity?.vy ?? 0;
  }
  get hasVelocity(): boolean {
    return this.entity.velocity !== null;
  }

  setVelocity(vx: number, vy: number): void {
    if (!this.alive) return;
    if (this.entity.velocity) {
      this.entity.velocity.vx = vx;
      this.entity.velocity.vy = vy;
    } else {
      this.entity.velocity = { vx, vy };
    }
  }

  clearVelocity(): void {
    if (!this.alive) return;
    this.entity.velocity = null;
  }

  // --- Tile position (derived) ---

  get tx(): number {
    return Math.floor(this.entity.position.wx / TILE_SIZE);
  }
  get ty(): number {
    return Math.floor(this.entity.position.wy / TILE_SIZE);
  }

  // --- Spatial ---

  distanceTo(other: EntityHandle): number {
    const dx = this.wx - other.wx;
    const dy = this.wy - other.wy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Tags ---

  addTag(tag: string): void {
    if (!this.alive) return;
    if (this.entity.tags?.has(tag)) return;
    if (!this.entity.tags) this.entity.tags = new Set();
    this.entity.tags.add(tag);
    this.entityManager.tagChangeHook?.onAdd(this.entity, tag);
  }

  removeTag(tag: string): void {
    if (!this.alive) return;
    if (!this.entity.tags?.has(tag)) return;
    this.entity.tags.delete(tag);
    this.entityManager.tagChangeHook?.onRemove(this.entity, tag);
  }

  hasTag(tag: string): boolean {
    return this.entity.tags?.has(tag) ?? false;
  }

  get tags(): ReadonlySet<string> {
    return this.entity.tags ?? EMPTY_SET;
  }

  // --- Attributes ---

  setAttribute(key: string, value: unknown): void {
    if (!this.alive) return;
    if (value === null || value === undefined) {
      this.entity.attributes?.delete(key);
      return;
    }
    if (!this.entity.attributes) this.entity.attributes = new Map();
    this.entity.attributes.set(key, value);
  }

  getAttribute(key: string): unknown {
    return this.entity.attributes?.get(key);
  }

  getAttributes(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (this.entity.attributes) {
      for (const [k, v] of this.entity.attributes) {
        result[k] = v;
      }
    }
    return result;
  }

  // --- Parent-child ---

  get parentId(): number | undefined {
    return this.entity.parentId;
  }

  setParent(parentId: number, offsetX = 0, offsetY = 0): void {
    if (!this.alive) return;
    if (
      ![offsetX, offsetY].every(Number.isFinite) ||
      Math.abs(offsetX) > 512 ||
      Math.abs(offsetY) > 512
    )
      throw new Error("Attachment offset exceeds its dependency budget.");
    let parent = this.entityManager.byId.get(parentId);
    if (!parent) throw new Error("Attachment target is not resident.");
    if (parent.type === "player" && this.entity.type !== "player")
      throw new Error("Persistent actors cannot attach to a transient player record.");
    const seen = new Set<number>([this.id]);
    while (parent) {
      if (seen.has(parent.id)) throw new Error("Cyclic attachment.");
      seen.add(parent.id);
      parent =
        parent.parentId === undefined ? undefined : this.entityManager.byId.get(parent.parentId);
    }
    if (seen.size > 32) throw new Error("Attachment chain is too deep.");
    const root = [...seen].at(-1);
    let groupSize = 0;
    for (const candidate of this.entityManager.entities) {
      let current: Entity | undefined = candidate;
      for (let depth = 0; current && depth < 64; depth++) {
        if (current.id === this.id && depth + seen.size > 32)
          throw new Error("Attachment chain is too deep.");
        if (current.id === root || current.id === this.id) {
          groupSize++;
          break;
        }
        current =
          current.parentId === undefined
            ? undefined
            : this.entityManager.byId.get(current.parentId);
      }
    }
    if (groupSize > 64) throw new Error("Attachment group is too large.");
    this.entity.parentId = parentId;
    this.entity.localOffsetX = offsetX;
    this.entity.localOffsetY = offsetY;
  }

  clearParent(): void {
    if (!this.alive) return;
    Reflect.set(this.entity, "parentId", undefined);
    Reflect.set(this.entity, "localOffsetX", undefined);
    Reflect.set(this.entity, "localOffsetY", undefined);
    this.entityManager.onMutation?.(this.entity);
  }

  // --- AI ---

  get aiState(): "idle" | "walking" | "chasing" | "following" | "ridden" | "scared" | null {
    return this.entity.wanderAI?.state ?? null;
  }

  setAIState(state: "idle" | "walking" | "chasing" | "following" | "ridden" | "scared"): void {
    if (!this.alive || !this.entity.wanderAI) return;
    this.entity.wanderAI.state = state;
  }

  get isFollowing(): boolean {
    return this.entity.wanderAI?.following ?? false;
  }

  setFollowing(following: boolean): void {
    if (!this.alive || !this.entity.wanderAI) return;
    this.entity.wanderAI.following = following;
  }

  setAIDirection(dx: number, dy: number): void {
    if (!this.alive || !this.entity.wanderAI) return;
    this.entity.wanderAI.dirX = dx;
    this.entity.wanderAI.dirY = dy;
  }

  setAITimer(seconds: number): void {
    if (!this.alive || !this.entity.wanderAI) return;
    this.entity.wanderAI.timer = seconds;
  }

  // --- Lifecycle ---

  remove(): void {
    if (!this.alive) return;
    this.entityManager.remove(this.entity.id);
  }

  get alive(): boolean {
    return this.entityManager.byId.get(this.id) === this.entity;
  }

  // --- Visual effects ---

  setFlashing(on: boolean): void {
    if (!this.alive) return;
    this.entity.flashHidden = on;
  }

  get deathTimer(): number | undefined {
    return this.entity.deathTimer;
  }

  setDeathTimer(seconds: number): void {
    if (!this.alive) return;
    this.entity.deathTimer = seconds;
  }
}

export class PlayerHandle extends EntityHandle {
  private readonly session: GameplaySession;

  constructor(entity: Entity, entityManager: EntityManager, session: GameplaySession) {
    super(entity, entityManager);
    this.session = session;
  }

  get gemsCollected(): number {
    return this.session.gemsCollected;
  }

  giveGems(n: number): void {
    if (!this.alive) return;
    this.session.gemsCollected += n;
  }

  loseGems(n: number): number {
    if (!this.alive) return 0;
    const actual = Math.min(n, this.session.gemsCollected);
    this.session.gemsCollected -= actual;
    return actual;
  }

  get isInvincible(): boolean {
    return this.session.invincibilityTimer > 0;
  }

  get invincibilityTimer(): number {
    return this.session.invincibilityTimer;
  }

  setInvincible(seconds: number): void {
    if (!this.alive) return;
    this.session.invincibilityTimer = seconds;
  }

  get knockbackVx(): number {
    return this.session.knockbackVx;
  }
  get knockbackVy(): number {
    return this.session.knockbackVy;
  }

  setKnockback(vx: number, vy: number): void {
    if (!this.alive) return;
    this.session.knockbackVx = vx;
    this.session.knockbackVy = vy;
  }

  knockback(fromWx: number, fromWy: number, speed: number): void {
    if (!this.alive) return;
    const dx = this.wx - fromWx;
    const dy = this.wy - fromWy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.session.knockbackVx = (dx / dist) * speed;
    this.session.knockbackVy = (dy / dist) * speed;
  }

  // --- Riding ---

  get mountId(): number | null {
    return this.session.mountId;
  }

  mount(target: EntityHandle): void {
    if (!this.alive) return;
    this.entity.parentId = target.id;
    this.entity.localOffsetX = 0;
    this.entity.localOffsetY = 0;
    this.entity.jumpZ = 10;
    delete this.entity.airMomentumX;
    delete this.entity.airMomentumY;
    Reflect.set(this.entity, "jumpVZ", undefined);
    this.entity.noShadow = true;
    this.session.mountId = target.id;
    if (target.aiState !== null) target.setAIState("ridden");
    target.setFollowing(false);
    this.setVelocity(0, 0);
    // Reset rider sprite to standing pose, facing mount direction
    if (this.entity.sprite) {
      this.entity.sprite.moving = false;
      this.entity.sprite.frameCol = 0;
      this.entity.sprite.animTimer = 0;
      const mountEntity = this.entityManager.entities.find((e) => e.id === target.id);
      if (mountEntity?.sprite) {
        this.entity.sprite.direction =
          mountEntity.wanderAI?.directional === false
            ? mountEntity.sprite.flipX
              ? Direction.Left
              : Direction.Right
            : mountEntity.sprite.direction;
        this.entity.sprite.frameRow = this.entity.sprite.direction;
      }
    }
  }

  dismount(): void {
    if (!this.alive || this.session.mountId === null) return;
    const mountEntity = this.entityManager.entities.find((e) => e.id === this.session.mountId);
    Reflect.set(this.entity, "parentId", undefined);
    Reflect.set(this.entity, "localOffsetX", undefined);
    Reflect.set(this.entity, "localOffsetY", undefined);
    this.entityManager.onMutation?.(this.entity);
    delete this.entity.noShadow;
    this.session.mountId = null;
    if (mountEntity) {
      if (mountEntity.wanderAI) {
        mountEntity.wanderAI.state = "idle";
        mountEntity.wanderAI.timer = 1.0;
      }
      if (mountEntity.velocity) {
        mountEntity.velocity.vx = 0;
        mountEntity.velocity.vy = 0;
      }
    }
  }
}
