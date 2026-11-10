import { CHUNK_SIZE_PX, ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { isNapping } from "../entities/naps.js";
import { updatePlayerSpriteFromInput } from "../entities/Player.js";
import { groundMaterialAt } from "../physics/GroundMaterial.js";
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
  /** Actors held out of that step: see RealmNaps. */
  private napping: Entity[] = [];
  /** The scene synchronize pass that admitted `participants`. */
  private stepPass = -1;

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
      groundMaterial: (wx: number, wy: number, wz: number) =>
        groundMaterialAt(this.realm.world, wx, wy, wz),
    };
  }

  /** Replace the scene for a freshly loaded world. */
  async reset(): Promise<void> {
    this.scene?.dispose();
    this.scene = await PhysicsScene.create();
    this.participants = this.napping = [];
    this.stepPass = -1;
  }

  dispose(): void {
    this.scene?.dispose();
    this.scene = undefined;
    this.participants = this.napping = [];
    this.stepPass = -1;
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
    napping: Entity[],
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
    this.napping = napping;
    // Couplings publish resident partner IDs before the scene builds their joints.
    if (this.realm.vehicleRegistry) vehicleLinks(this.realm.vehicleRegistry).tick();
    this.stepPass = scene.synchronize(participants, undefined, napping);
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
    const live = (e: Entity) => entityManager.byId.get(e.id) === e && !e.tags?.has("passage");
    const admitted = this.participants.filter(live);
    // Seats may have boarded, left or mounted since the step admitted its bodies.
    let ids: Map<number, number> | undefined;
    for (const session of sessions) {
      if (session.retired || session.transitioning) continue;
      for (const e of [
        session.player,
        vehicles.get(session),
        entityManager.byId.get(session.gameplaySession.mountId ?? -1),
      ]) {
        if (!e || !live(e) || this.scene?.admitted(e, this.stepPass)) continue;
        ids ??= new Map(admitted.map((member, index) => [member.id, index]));
        const index = ids.get(e.id);
        if (index === undefined) ids.set(e.id, admitted.push(e) - 1);
        else admitted[index] = e;
      }
    }
    // A nap disturbed since the step (an explicit edit) is admitted like any other body.
    const held: Entity[] = [];
    for (const e of this.napping) if (live(e)) (isNapping(e) ? held : admitted).push(e);
    this.scene?.synchronize(admitted, undefined, held);
  }
}
