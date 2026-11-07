import { CHUNK_SIZE_PX, ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { updatePlayerSpriteFromInput } from "../entities/Player.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { PhysicsScene } from "../physics/PhysicsScene.js";
import type { MotionIntent } from "../physics/PhysicsState.js";
import { playerMotionIntent, vehicleMotionIntent } from "../physics/PlayerControls.js";
import type { Movement } from "../shared/Movement.js";
import { vehicleLinks } from "../traffic/VehicleLinks.js";
import { isWildlife } from "../wildlife/WildlifeKinds.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import { handlePlayerStepOutcome, updateLastSafePosition } from "./RealmRiding.js";

type PhysicsRealm = Pick<
  Realm,
  | "world"
  | "propManager"
  | "entityManager"
  | "railways"
  | "vehicleRegistry"
  | "vehicles"
  | "records"
>;

export function isEntityOnWater(world: World, entity: Entity): boolean {
  const tx = Math.floor(entity.position.wx / TILE_SIZE);
  const ty = Math.floor(entity.position.wy / TILE_SIZE);
  return (
    (world.getCollisionIfLoaded(tx, ty) & CollisionFlag.Water) !== 0 &&
    (entity.wz ?? 0) <= world.getHeightAt(tx, ty) * ELEVATION_PX + 0.15
  );
}

/**
 * The realm's shared physics scene: environment bindings, per-tick stepping
 * and the player outcomes read back from each step.
 */
export class RealmPhysics {
  scene: PhysicsScene | undefined;
  private participants: Entity[] = [];

  constructor(private readonly realm: PhysicsRealm) {}

  private readonly geometryVersion = (cx: number, cy: number) => {
    const chunk = this.realm.world.getChunkIfLoaded(cx, cy);
    return {
      identity: chunk,
      revision: `${chunk?.revision}:${chunk?.visualRevision}:${chunk?.physicsRevision}:${this.realm.propManager.revision}`,
    };
  };

  private environment() {
    return {
      getCollision: (x: number, y: number) => this.realm.world.getCollisionIfLoaded(x, y),
      getHeight: (x: number, y: number) => this.realm.world.getHeightAt(x, y),
      queryProps: (bounds: { left: number; top: number; right: number; bottom: number }) =>
        this.realm.propManager.getPropsInChunkRange(
          Math.floor(bounds.left / CHUNK_SIZE_PX),
          Math.floor(bounds.top / CHUNK_SIZE_PX),
          Math.floor(bounds.right / CHUNK_SIZE_PX),
          Math.floor(bounds.bottom / CHUNK_SIZE_PX),
        ),
      geometryVersion: this.geometryVersion,
    };
  }

  /** Replace the scene for a freshly loaded world. */
  async reset(): Promise<void> {
    this.scene?.dispose();
    this.scene = await PhysicsScene.create();
    this.participants = [];
  }

  dispose(): void {
    this.scene?.dispose();
    this.scene = undefined;
    this.participants = [];
  }

  canPlaceTrain(
    cars: readonly Entity[],
    poses: readonly { x: number; y: number; angle: number }[],
  ): boolean {
    return this.scene?.canPlaceTrain(cars, poses, this.environment()) ?? false;
  }

  recoverVehicle(id: number): void {
    if (!this.scene) throw Error("Physics is not ready.");
    this.scene.recoverVehicle(id);
  }

  /** Integrate one shared-physics step for the admitted entities. */
  step(
    active: Entity[],
    activeSessions: readonly PlayerSession[],
    controls: ReadonlyMap<number, Movement>,
    controlTicks: ReadonlyMap<number, number>,
    gravity: number,
  ) {
    const { entityManager } = this.realm;
    const players = activeSessions.map((s) => s.player);
    const intents = entityManager.collectMotionIntents(active, PHYSICS_DT, (x, y) =>
      this.realm.world.getCollisionIfLoaded(x, y),
    );
    for (const [id, intent] of this.realm.railways?.plan() ?? []) intents.set(id, intent);
    const wasAirborne = new Set(players.filter((p) => p.jumpVZ !== undefined).map((p) => p.id));
    for (const [id, intent] of this.realm.vehicleRegistry?.traffic.plan(
      active,
      this.scene?.physicsTick ?? 0,
    ) ?? [])
      intents.set(id, intent);
    this.addControlIntents(intents, activeSessions, controls, controlTicks);
    const participants = active.filter(
      (e) => entityManager.byId.get(e.id) === e && !e.tags?.has("passage"),
    );
    const scene = this.scene;
    if (!scene) throw Error("Realm physics is not initialized");
    this.participants = participants;
    // Couplings publish resident partner IDs before the scene builds their joints.
    if (this.realm.vehicleRegistry) vehicleLinks(this.realm.vehicleRegistry).tick();
    scene.synchronize(participants);
    scene.step(intents, this.environment(), gravity);
    this.realm.railways?.finish();
    return { scene, participants, wasAirborne };
  }

  private addControlIntents(
    intents: Map<number, MotionIntent>,
    activeSessions: readonly PlayerSession[],
    controls: ReadonlyMap<number, Movement>,
    controlTicks: ReadonlyMap<number, number>,
  ): void {
    for (const session of activeSessions) {
      const movement = controls.get(session.player.id);
      if (!movement) continue;
      const vehicle = this.realm.vehicles.get(session);
      const mount =
        session.gameplaySession.mountId === null
          ? undefined
          : this.realm.entityManager.byId.get(session.gameplaySession.mountId);
      const controlled = vehicle ?? mount ?? session.player;
      intents.set(controlled.id, {
        ...(vehicle ? vehicleMotionIntent(vehicle, movement) : playerMotionIntent(movement)),
        controlUntil: (this.scene?.physicsTick ?? 0) + (controlTicks.get(session.player.id) ?? 0),
      });
      // Facing/animation is intent-derived; readback publishes physical velocity.
      if (!vehicle) updatePlayerSpriteFromInput(session.player, movement);
    }
  }

  /** Read back the step and resolve each player's landing/water outcome. */
  finish(
    participants: Entity[],
    activeSessions: readonly PlayerSession[],
    wasAirborne: ReadonlySet<number>,
    scene: PhysicsScene,
  ): void {
    const { world, entityManager } = this.realm;
    const players = activeSessions.map((s) => s.player);
    const getHeight = (x: number, y: number) => this.realm.world.getHeightAt(x, y);
    const onWater = (entity: Entity) => isEntityOnWater(this.realm.world, entity);
    entityManager.finishPhysics(participants, players, PHYSICS_DT, (x, y) =>
      world.getCollisionIfLoaded(x, y),
    );
    for (const session of activeSessions) {
      const p = session.player;
      updateLastSafePosition(session, onWater);
      const supportId = scene.bodyState(p.id)?.supportId;
      const support = this.realm.entityManager.byId.get(supportId ?? -1);
      handlePlayerStepOutcome(
        this.realm,
        session,
        {
          landed: wasAirborne.has(p.id) && p.jumpVZ === undefined,
          groundZ: p.groundZ ?? 0,
          enteredWater: p.jumpVZ === undefined && onWater(p),
          endedGrounded: p.jumpVZ === undefined,
          ...(support && isWildlife(support) ? { wildlifeContactId: support.id } : {}),
        },
        getHeight,
      );
    }
  }

  /**
   * A paused/manual publication may follow boarding, exit or an explicit edit
   * before the next clock tick. Refresh membership/edits without integrating,
   * so entity baselines and numerical physics describe the same bodies.
   */
  synchronizeForPublication(sessions: Iterable<PlayerSession>): void {
    const { entityManager, vehicles } = this.realm;
    const admitted = new Map(this.participants.map((e) => [e.id, e]));
    for (const session of sessions) {
      if (session.retired || session.transitioning) continue;
      for (const e of [
        session.player,
        vehicles.get(session),
        entityManager.byId.get(session.gameplaySession.mountId ?? -1),
      ])
        if (e) admitted.set(e.id, e);
    }
    this.scene?.synchronize(
      [...admitted.values()].filter(
        (e) => entityManager.byId.get(e.id) === e && !e.tags?.has("passage"),
      ),
    );
  }
}
