import type { Entity } from "../entities/Entity.js";
import type { JumpGravityOutcome, MovementPhysicsParams } from "./PlayerMovement.js";
import type { CreateMovementContextOptions } from "./SimulationEnvironment.js";

/** 0 preserves the existing solver; experimental hulls stay upright and unrotated. */
export type CharacterPhysicsMode = 0 | 1 | 2 | 3 | 4;
export const usesRealmPhysics = (mode: number | undefined) => mode === 3 || mode === 4;
export interface CharacterMotionSource extends CreateMovementContextOptions {
  pushBody?(before: Entity, after: Entity): void;
}
export interface CharacterMotionBackend {
  createWorld(): import("./rapier/PersistentCollisionWorld.js").PersistentCollisionWorld;
  step(
    entity: Entity,
    dt: number,
    physics: MovementPhysicsParams,
    source: CharacterMotionSource,
  ): JumpGravityOutcome;
}
let backend: CharacterMotionBackend | undefined;
let loading: Promise<void> | undefined;
export function characterPhysicsReady(mode: number): boolean {
  return mode === 0 || !!backend;
}
export function validateCharacterPhysics(mode: number): CharacterPhysicsMode {
  if (![0, 1, 2, 3, 4].includes(mode))
    throw Error(
      "Physics must be 0 legacy, 1/2 Rapier character box/capsule, or 3/4 Rapier realm box/capsule",
    );
  return mode as CharacterPhysicsMode;
}
export async function prepareCharacterPhysics(mode: number): Promise<void> {
  validateCharacterPhysics(mode);
  if (!mode || backend) return Promise.resolve();
  if (!loading)
    loading = import("./rapier/GameCharacterPhysics.js")
      .then(async ({ createGameCharacterPhysics }) => {
        backend = await createGameCharacterPhysics();
      })
      .catch((error) => {
        loading = undefined;
        throw error;
      });
  return loading;
}
export function stepCharacterPhysics(
  entity: Entity,
  dt: number,
  physics: MovementPhysicsParams,
  source: CharacterMotionSource,
): JumpGravityOutcome {
  if (!backend) throw Error("Experimental character physics has not initialized");
  if (usesRealmPhysics(physics.characterPhysics) && !source.collisionWorld)
    throw Error(
      "Exclusive realm physics requires its owning collision world; legacy fallback is forbidden",
    );
  return backend.step(entity, dt, physics, source);
}
export function createCollisionWorld() {
  if (!backend) throw Error("Rapier must initialize before creating a collision world");
  return backend.createWorld();
}
