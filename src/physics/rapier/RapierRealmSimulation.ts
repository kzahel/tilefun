import { createBall } from "../../entities/Ball.js";
import type { Entity } from "../../entities/Entity.js";
import { updatePlayerFromInput } from "../../entities/Player.js";
import { tickSpriteAnimation } from "../../entities/spriteAnimation.js";
import type { PlayerSession } from "../../server/PlayerSession.js";
import type { Realm } from "../../server/Realm.js";
import type { RealmSimulationOwner } from "../../server/RealmSimulationOwner.js";
import { PLAYER_FOOT_OFFSET, PLAYER_RADIUS } from "./BridgeFixture.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";
import { PHYSICS_PIXELS_PER_METRE } from "./RapierScenarioRecipe.js";
import { initRapier, PHYSICS_DT, RapierWorld } from "./RapierWorld.js";

/** One temporary Realm owns the backend; the normal solver never also steps it. */
export class RapierRealmSimulation implements RealmSimulationOwner {
  readonly backend: RapierWorld;
  private readonly actors = new Map<number, Entity>();
  private disposed = false;
  constructor(sections: number, backend?: RapierWorld) {
    this.backend = backend ?? new RapierWorld(sections);
  }

  step(dt: number, sessions: readonly PlayerSession[], realm: Realm): void {
    if (sessions.length !== 1 || Math.abs(dt - PHYSICS_DT) > 1e-6)
      throw Error("Rapier proof requires one controlled player at 60 Hz");
    const session = sessions[0];
    if (!session) return;
    // One fixed input per tick; retain ordered commands during latency/stalls.
    // Wider backlog admission and independent environment substeps need a later policy.
    const input = session.inputQueue.shift();
    this.backend.step({
      x: input?.dx ?? 0,
      z: input?.dy ?? 0,
      jump: input?.jump ?? this.backend.motor().jumpHeld,
    });
    if (input) session.lastProcessedInputSeq = input.seq;
    updatePlayerFromInput(
      session.player,
      { dx: input?.dx ?? 0, dy: input?.dy ?? 0, jump: input?.jump ?? false, sprinting: false },
      PHYSICS_DT,
    );
    tickSpriteAnimation(session.player, dt);
    this.sync(realm, session);
  }

  sync(realm: Realm, session: PlayerSession, guest?: PlayerSession): void {
    const poses = this.backend.poses(),
      scale = PHYSICS_PIXELS_PER_METRE;
    const motor = this.backend.motor();
    session.lastJumpHeld = motor.jumpHeld;
    if (!motor.jumpHeld) session.jumpConsumed = false;
    else if (motor.verticalSpeed > 0) session.jumpConsumed = true;
    const existing = new Set<number>();
    for (let i = 0; i < poses.length; i += POSE_STRIDE) {
      const id = poses[i] ?? 0;
      existing.add(id);
      const controlled = id === 0 ? session : id === -1 ? guest : undefined;
      const half = controlled
        ? { x: PLAYER_RADIUS, y: PLAYER_FOOT_OFFSET, z: PLAYER_RADIUS }
        : this.backend.halfExtents(id);
      let actor = controlled ? controlled.player : this.actors.get(id);
      if (!actor) {
        actor = createBall(0, 0);
        actor.tags = new Set();
        actor.collider = {
          offsetX: 0,
          offsetY: 0,
          width: 2 * half.x * scale,
          height: 2 * half.z * scale,
          physicalHeight: 2 * half.y * scale,
          solid: true,
          clientSolid: true,
        };
        realm.entityManager.spawn(actor);
        this.actors.set(id, actor);
      }
      actor.prevPosition = { ...actor.position };
      actor.prevWz = actor.wz ?? 0;
      actor.position.wx = (poses[i + 1] ?? 0) * scale;
      actor.position.wy = (poses[i + 3] ?? 0) * scale;
      actor.wz = ((poses[i + 2] ?? 0) - half.y) * scale;
      actor.groundZ = actor.wz;
      if (controlled) {
        const motor = this.backend.motorFor(id === 0 ? 0 : 1);
        controlled.lastJumpHeld = motor.jumpHeld;
        if (!motor.jumpHeld) controlled.jumpConsumed = false;
        else if (motor.verticalSpeed > 0) controlled.jumpConsumed = true;
        actor.groundZ = this.backend.supportHeight(id === 0 ? 0 : 1) * scale;
        actor.jumpZ = Math.max(0, actor.wz - actor.groundZ);
        if (motor.grounded) delete actor.jumpVZ;
        else actor.jumpVZ = motor.verticalSpeed * scale;
        actor.jumpInputState =
          (controlled.jumpConsumed ? 1 : 0) | (controlled.lastJumpHeld ? 2 : 0);
      }
      if (actor.velocity) {
        actor.velocity.vx = (poses[i + 8] ?? 0) * scale;
        actor.velocity.vy = (poses[i + 10] ?? 0) * scale;
      }
      realm.entityManager.spatialHash.update(actor);
      realm.records?.changed(actor);
    }
    for (const [id, actor] of this.actors)
      if (!existing.has(id)) {
        realm.entityManager.remove(actor.id);
        this.actors.delete(id);
      }
  }
  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.backend.dispose();
    }
  }
}

export async function createRapierRealmSimulation(sections: number) {
  await initRapier();
  return new RapierRealmSimulation(sections);
}
