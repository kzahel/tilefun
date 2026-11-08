import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { Movement } from "../shared/Movement.js";
import type { World } from "../world/World.js";
import type { PlayerPredictor } from "./PlayerPredictor.js";
import type { SeatMovements } from "./SeatInputs.js";
/** Shared ordering: retain the exact submitted command before predicting it.
 * `seats` carries the device's other local seats under the same sequence (226). */
export function predictInput(
  predictor: PlayerPredictor,
  seq: number,
  movement: Movement,
  dt: number,
  world: World,
  props: readonly Prop[],
  entities: readonly Entity[],
  seats?: SeatMovements,
) {
  predictor.storeInput(seq, movement, dt, seats);
  predictor.update(dt, movement, world, props, entities);
}
