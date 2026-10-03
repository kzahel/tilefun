import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { Movement } from "../input/ActionManager.js";
import type { World } from "../world/World.js";
import type { PlayerPredictor } from "./PlayerPredictor.js";
/** Shared ordering: retain the exact submitted command before predicting it. */
export function predictInput(
  predictor: PlayerPredictor,
  seq: number,
  movement: Movement,
  dt: number,
  world: World,
  props: readonly Prop[],
  entities: readonly Entity[],
) {
  predictor.storeInput(seq, movement, dt);
  predictor.update(dt, movement, world, props, entities);
}
