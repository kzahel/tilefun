import { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { predictInput } from "../client/predictInput.js";
import type { Entity } from "../entities/Entity.js";
import type { Movement } from "../input/ActionManager.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import { World } from "../world/World.js";
import { applyScenarioAppearance } from "./ScenarioRecipe.js";

/** A normal private replica/predictor, shared by single- and two-view labs. */
export class ScenarioReplica {
  readonly view = new RemoteStateView(new World());
  readonly predictor: PlayerPredictor;
  seq = 0;
  private resetReplica = true;
  constructor(
    private readonly template: Entity,
    gravity: number,
    private readonly actors: readonly Entity[] = [],
  ) {
    this.predictor = new PlayerPredictor(() => gravity);
    this.view.setPredictor(this.predictor);
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
    if (reset || this.resetReplica || this.predictor.player?.id !== player.id)
      this.predictor.reset(
        player,
        this.view.serverEntities.find((e) => e.id === player.parentId),
      );
    this.predictor.reconcile(
      player,
      this.view.lastProcessedInputSeq,
      this.view.world,
      this.view.props,
      this.view.serverEntities,
      this.view.mountEntityId,
      {
        serverTick: this.view.serverTick,
        ...(this.view.physicsState ? { physics: this.view.physicsState } : {}),
      },
    );
    this.resetReplica = false;
  }
  normalize(input: Movement): Movement {
    const length = input.relativeDriving ? 1 : Math.max(1, Math.hypot(input.dx, input.dy));
    return { ...input, dx: quantizeAxis(input.dx / length), dy: quantizeAxis(input.dy / length) };
  }
  predict(seq: number, movement: Movement) {
    this.view.tickAnimations(PHYSICS_DT);
    predictInput(
      this.predictor,
      seq,
      movement,
      PHYSICS_DT,
      this.view.world,
      this.view.props,
      this.view.entities,
    );
  }
  dispose() {
    this.predictor.clearPredicted();
    this.view.setPredictor(null);
  }
}
