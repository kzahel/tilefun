import type { Entity } from "../entities/Entity.js";
import type { JumpGravityOutcome, MovementPhysicsParams } from "./PlayerMovement.js";
import type { CreateMovementContextOptions } from "./SimulationEnvironment.js";

/** 0 preserves the existing solver; experimental hulls stay upright and unrotated. */
export type CharacterPhysicsMode = 0 | 1 | 2;
export interface CharacterMotionSource extends CreateMovementContextOptions {
  pushBody?(before: Entity, after: Entity): void;
}
export interface CharacterMotionBackend {
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
  if (mode !== 0 && mode !== 1 && mode !== 2)
    throw Error("Character physics must be 0 (legacy), 1 (Rapier box) or 2 (Rapier capsule)");
  return mode;
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
  return backend.step(entity, dt, physics, source);
}
