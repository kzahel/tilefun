import { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import type { Entity } from "../entities/Entity.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { DeviceSession } from "../session/DeviceSession.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import type { Movement } from "../shared/Movement.js";
import { World } from "../world/World.js";
import { applyScenarioAppearance } from "./ScenarioRecipe.js";

/** A lab seat's device session (226): the game's replica, predictor and shared
 * presentation, with recipe appearances. Single- and two-view labs share it. */
export class ScenarioReplica {
  readonly session: DeviceSession;
  readonly predictor: PlayerPredictor;
  seq = 0;
  private resetReplica = true;
  constructor(
    private readonly template: Entity,
    gravity: number,
    private readonly actors: readonly Entity[] = [],
    options: { allCars3d?: boolean } = {},
  ) {
    this.session = new DeviceSession(new RemoteStateView(new World()), options);
    this.predictor = this.session.startPrediction(new PlayerPredictor(() => gravity));
  }
  get view(): RemoteStateView {
    return this.session.replica;
  }
  clear() {
    this.view.clear();
    this.resetReplica = true;
  }
  synchronize(reset = false) {
    const player = this.view.serverPlayerEntity;
    if (player.id === -1) return;
    applyScenarioAppearance(player, this.template);
    for (const entity of this.view.serverEntities) {
      const template = this.actors.find((actor) => actor.type === entity.type);
      if (template) applyScenarioAppearance(entity, template);
    }
    // Lab resets seat the player on its parent (the occupied vehicle or mount).
    this.session.reconcile(reset || this.resetReplica, player.parentId);
    this.resetReplica = false;
  }
  normalize(input: Movement): Movement {
    const length = input.relativeDriving ? 1 : Math.max(1, Math.hypot(input.dx, input.dy));
    return { ...input, dx: quantizeAxis(input.dx / length), dy: quantizeAxis(input.dy / length) };
  }
  predict(seq: number, movement: Movement) {
    this.view.tickAnimations(PHYSICS_DT);
    this.session.predict(seq, movement, PHYSICS_DT);
  }
  dispose() {
    this.session.dispose();
  }
}
