import { TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { GameplaySession } from "./GameplaySimulation.js";

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

  setPosition(wx: number, wy: number): void {
    if (!this.alive) return;
    this.entity.position.wx = wx;
    this.entity.position.wy = wy;
  }

  // --- Velocity ---

  get vx(): number {
    return this.entity.velocity?.vx ?? 0;
  }
  get vy(): number {
    return this.entity.velocity?.vy ?? 0;
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

  // --- AI ---

  get aiState(): "idle" | "walking" | "chasing" | "following" | null {
    return this.entity.wanderAI?.state ?? null;
  }

  setAIState(state: "idle" | "walking" | "chasing" | "following"): void {
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
    return this.entityManager.entities.includes(this.entity);
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

  setInvincible(seconds: number): void {
    if (!this.alive) return;
    this.session.invincibilityTimer = seconds;
  }

  knockback(fromWx: number, fromWy: number, speed: number): void {
    if (!this.alive) return;
    const dx = this.wx - fromWx;
    const dy = this.wy - fromWy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.session.knockbackVx = (dx / dist) * speed;
    this.session.knockbackVy = (dy / dist) * speed;
  }
}
