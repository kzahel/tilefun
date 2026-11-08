import type { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { predictInput } from "../client/predictInput.js";
import type { SeatMovements } from "../client/SeatInputs.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { RenderBackend } from "../rendering/RenderFrame.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import type { Movement } from "../shared/Movement.js";
import type { View } from "./View.js";

/**
 * One simulated device (tactical 226): the world replica of one connection, the
 * predictor that replays its local seats, and the presentation every view of
 * the device shares (scene frame and mesh poses). Normally one per page; the
 * two-pane physics lab holds two. Seat 0 is today's only predicted seat.
 */
export class DeviceSession {
  readonly frame: SceneFrame;
  readonly views: View[] = [];
  private predictor: PlayerPredictor | null = null;

  constructor(
    readonly replica: RemoteStateView,
    options: { allCars3d?: boolean } = {},
  ) {
    this.frame = new SceneFrame({ allCars3d: options.allCars3d ?? false });
  }

  /** The active predictor, or null outside play. */
  get prediction(): PlayerPredictor | null {
    return this.predictor;
  }

  /** Begin predicting seat 0 against the replica, from its current server pose. */
  startPrediction(predictor = new PlayerPredictor()): PlayerPredictor {
    this.stopPrediction();
    this.predictor = predictor;
    this.replica.setPredictor(predictor);
    const player = this.replica.serverPlayerEntity;
    if (player.id !== -1) predictor.reset(player);
    return predictor;
  }

  /** Reattach the predictor after another scene detached it. */
  resumePrediction(): void {
    if (this.predictor) this.replica.setPredictor(this.predictor);
  }

  stopPrediction(): void {
    if (!this.predictor) return;
    this.replica.setPredictor(null);
    this.predictor = null;
  }

  /**
   * Rebuild prediction from the newest authoritative state: reset when asked
   * (no prediction yet, a door transition, a lab command) or when the server
   * player changed, then replay unacknowledged inputs. False without a predictor
   * or server player. `mountId` names the entity a reset seats the player on:
   * the game passes its gameplay mount, labs the player's parent (slice 5 joins
   * them on the parent rule).
   */
  reconcile(reset: boolean, mountId: number | undefined): boolean {
    const { predictor, replica } = this;
    const player = replica.serverPlayerEntity;
    if (!predictor || player.id === -1) return false;
    if (reset || !predictor.player || predictor.player.id !== player.id)
      predictor.reset(
        player,
        mountId === undefined ? undefined : replica.serverEntities.find((e) => e.id === mountId),
      );
    predictor.reconcile(
      player,
      replica.lastProcessedInputSeq,
      replica.world,
      replica.props,
      replica.serverEntities,
      replica.mountEntityId,
      {
        serverTick: replica.serverTick,
        ...(replica.physicsState ? { physics: replica.physicsState } : {}),
      },
    );
    return true;
  }

  /** Seat 0 exists and its room or terrain chunk is presentable. */
  seatWorldReady(terrain: Pick<RenderBackend, "isTerrainReady">): boolean {
    const { replica } = this;
    const p = replica.serverPlayerEntity;
    if (p.id === -1) return false;
    if (replica.interior) return !!replica.roomState;
    const cx = Math.floor(p.position.wx / CHUNK_SIZE_PX),
      cy = Math.floor(p.position.wy / CHUNK_SIZE_PX);
    return terrain.isTerrainReady(replica.world.chunks.get(cx, cy));
  }

  /** Store seat 0's command (with the device's other seats) and predict it. */
  predict(seq: number, movement: Movement, dt: number, coSeats?: SeatMovements): void {
    const { predictor, replica } = this;
    if (!predictor) return;
    predictInput(
      predictor,
      seq,
      movement,
      dt,
      replica.world,
      replica.props,
      replica.entities,
      coSeats,
    );
  }

  /** Forget presentation state on a world or realm change: the shared frame and
   * every view's observer-local slab fades. */
  clearPresentation(): void {
    this.frame.clear();
    for (const view of this.views) view.fades.clear();
  }

  /** Release presentation and prediction (session teardown). */
  dispose(): void {
    this.stopPrediction();
    this.clearPresentation();
    this.views.length = 0;
  }
}
