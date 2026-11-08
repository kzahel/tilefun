import type { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { predictInput } from "../client/predictInput.js";
import type { SeatMovements } from "../client/SeatInputs.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { RenderBackend } from "../rendering/RenderFrame.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import type { Movement } from "../shared/Movement.js";
import { DeviceSeats } from "./DeviceSeats.js";
import { SeatViews } from "./SeatViews.js";
import type { View } from "./View.js";

/**
 * One simulated device (tactical 226): the world replica of one connection, the
 * predictor that replays its local seats, and the presentation every view of
 * the device shares (scene frame and mesh poses). Normally one per page; the
 * two-pane physics lab holds two. One predictor replays every local seat: seat 0
 * as its primary body and the guests as co-seats from the stream's seat list.
 */
export class DeviceSession {
  readonly frame: SceneFrame;
  readonly views: View[] = [];
  /** The device's local players: seat 0 and any guests (226). */
  readonly seats = new DeviceSeats();
  private predictor: PlayerPredictor | null = null;
  /** Split screen: one view per seat, when the device has seat 0's own view. */
  private readonly seatViews: SeatViews | null;

  constructor(
    readonly replica: RemoteStateView,
    options: { allCars3d?: boolean; view?: View } = {},
  ) {
    this.frame = new SceneFrame({ allCars3d: options.allCars3d ?? false });
    this.seatViews = options.view ? new SeatViews(this.seats, options.view) : null;
    if (options.view) this.views.push(options.view);
  }

  /** Lay the views out over the canvas: one per seat in play (226), seat 0's alone
   * otherwise. Without seat views (labs) the views keep their regions. */
  layoutViews(width: number, height: number, split: boolean): readonly View[] {
    if (!this.seatViews) return this.views;
    const views = this.seatViews.layout(width, height, split);
    this.views.splice(0, this.views.length, ...views);
    return views;
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
   * player changed, then replay unacknowledged inputs with every seat's body
   * from the stream's seat list. False without a predictor or server player. A
   * reset seats the player on its parent (vehicle or mount), as the frame shows.
   */
  reconcile(reset: boolean): boolean {
    const { predictor, replica } = this;
    const player = replica.serverPlayerEntity;
    if (!predictor || player.id === -1) return false;
    if (reset || !predictor.player || predictor.player.id !== player.id)
      predictor.reset(
        player,
        replica.serverEntities.find((e) => e.id === player.parentId),
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
        seats: replica.seats.entities,
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

  /** Store seat 0's command (with the other seats' movement by seat) and predict it. */
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

  /** Forget presentation state on a world or realm change: the shared frame,
   * every view's observer-local slab fades, and guests' sent visible ranges and
   * camera easing (they snap to their seat in the new world; seat 0's camera is
   * placed by the message router). */
  clearPresentation(): void {
    this.frame.clear();
    for (const view of this.views) {
      view.fades.clear();
      view.rangeKey = undefined;
      if (view.seat !== 0) view.camera.requestSnap();
    }
  }

  /** Release presentation, prediction and the guests' input sets (session teardown). */
  dispose(): void {
    this.seats.dispose();
    this.stopPrediction();
    this.clearPresentation();
    this.views.length = 0;
  }
}
