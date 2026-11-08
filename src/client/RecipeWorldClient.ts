import { devicePacket, type SeatPress } from "../input/SeatComposer.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import type { LabAdminRequest, LabAdminResult } from "../scenarios/RecipeWorldProtocol.js";
import type { ScenarioCommand } from "../scenarios/ScenarioProtocol.js";
import {
  applyRecipeAppearances,
  normalizeLabMovement,
  type ScenarioRecipe,
  scenarioGravity,
} from "../scenarios/ScenarioRecipe.js";
import { DeviceSession } from "../session/DeviceSession.js";
import type { Movement } from "../shared/Movement.js";
import type { BufferedMessage, ServerMessage, VehicleHornMessage } from "../shared/protocol.js";
import { WorkerClientTransport, type WorkerEndpoint } from "../transport/WorkerClientTransport.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

export interface RecipeWorldOptions {
  allCars3d?: boolean;
  /** The Worker serving the recipe world; tests pass an in-process one. */
  worker?: () => WorkerEndpoint;
}

const recipeWorker = (): WorkerEndpoint =>
  new Worker(new URL("../scenarios/recipe-world.worker.ts", import.meta.url), { type: "module" });

/**
 * A Workshop lab's connection to its recipe world (226): the game's Worker
 * transport and replica, one predicted seat with the recipe's gravity, and the
 * lab instruments. The lab calls `update()` at the start of each tick, as
 * `GameClient` applies server state, then submits that tick's input.
 */
export class RecipeWorldClient {
  readonly device: DeviceSession;
  readonly predictor: PlayerPredictor;
  readonly ready: Promise<void>;
  /** Named recipe entities from the latest admin answer. */
  handles: Record<string, number> = {};
  /** The clock as of the latest admin answer. */
  clock: LabAdminResult["clock"] | undefined;
  /** The frames' server tick when that answer arrived. */
  private clockTick = 0;
  physicsDiagnostics: LabAdminResult["physics"];
  onHorn: ((message: VehicleHornMessage) => void) | undefined;
  /** A new world replaced the old one (open, reset, reload): drop world caches. */
  onWorldLoaded: (() => void) | undefined;
  private readonly transport: WorkerClientTransport;
  private seq = 0;
  private running = false;
  private controls = 0;
  private clockChanges = 0;
  private loaded = false;
  private closed = false;
  private failure: Error | undefined;
  private rangeKey = "";

  constructor(
    readonly recipe: ScenarioRecipe,
    options: RecipeWorldOptions = {},
  ) {
    const gravity = scenarioGravity(recipe);
    this.device = new DeviceSession(new RemoteStateView(new World()), options);
    this.predictor = this.device.startPrediction(new PlayerPredictor(() => gravity));
    this.transport = new WorkerClientTransport((options.worker ?? recipeWorker)(), {
      onError: (error) => this.fail(error),
    });
    this.transport.onMessage((message) => this.route(message));
    this.ready = this.open();
    void this.ready.catch(() => {});
  }

  private async open(): Promise<void> {
    await Promise.all([this.predictor.ready, this.transport.ready()]);
    await this.admin({ kind: "open", recipe: this.recipe }, true);
    this.transport.start();
    this.loaded = true;
  }

  get replica(): RemoteStateView {
    return this.device.replica;
  }

  /** A clock change or lab command is in flight; play input waits. */
  get busy(): boolean {
    return this.controls > 0 || this.clockChanges > 0;
  }

  private get accepting(): boolean {
    if (this.failure) throw this.failure;
    return this.loaded && !this.closed && this.running && !this.busy;
  }

  /** Start of a lab tick: take arrived state and rebuild prediction from it. */
  update(): void {
    if (this.failure) throw this.failure;
    const { replica } = this;
    if (!replica.pendingMessageCount) this.transport.pump();
    replica.applyPending();
    if (replica.stateAppliedThisTick) this.synchronize();
  }

  /** Clock intent; the authority, not render time, advances the world. */
  setRunning(running: boolean): void {
    if (this.failure) throw this.failure;
    if (this.closed || running === this.running) return;
    this.running = running;
    this.clockChanges++;
    void this.ready
      .then(() => this.admin({ kind: "clock", running }, true))
      .then(() => this.replica.resetPresentationClock(true))
      .catch((error) => this.fail(error))
      .finally(() => {
        this.clockChanges--;
      });
  }

  /** A hidden page stops the authority's loop and the watchdog, as in the game
   * (labs also pause the clock). */
  setHidden(hidden: boolean): void {
    this.transport.setHidden(hidden);
  }

  /** The area the lab's camera shows; sent when it changes. A paused world
   * streams it for inspection, a running one with the next input. */
  setVisibleRange(range: ChunkRange): void {
    const key = `${range.minCx},${range.minCy},${range.maxCx},${range.maxCy}`;
    if (this.closed || this.failure || !this.loaded || key === this.rangeKey) return;
    this.rangeKey = key;
    this.transport.send({ type: "visible-range", ...range });
  }

  /** Send and predict this tick's movement; false while the world is not
   * accepting play (loading, paused, busy). */
  submitInput(input: Movement, range?: ChunkRange): boolean {
    if (!this.accepting) return false;
    if (range) this.setVisibleRange(range);
    const movement = normalizeLabMovement(input),
      seq = ++this.seq;
    const { replica } = this;
    this.transport.send(devicePacket(seq, [{ body: replica.playerEntity.id, movement }]).input);
    replica.tickAnimations(PHYSICS_DT);
    this.device.predict(seq, movement, PHYSICS_DT);
    return true;
  }

  /** A horn, siren or throw press, ordered with the seat's movement. */
  submitPress(message: SeatPress): boolean {
    if (!this.accepting) return false;
    this.transport.send(message);
    return true;
  }

  async command(command: ScenarioCommand): Promise<void> {
    await this.control(() => this.admin({ kind: "command", command }, true));
  }

  /** One manual tick of a paused world. */
  async step(input: Movement, range?: ChunkRange): Promise<void> {
    if (this.running) throw Error("Pause before stepping");
    await this.control(async () => {
      await this.admin({ kind: "step", input, ...(range ? { range } : {}) }, true);
      this.seq = Math.max(this.seq, this.replica.lastProcessedInputSeq);
      this.replica.resetPresentationClock(true);
    });
  }

  /** Reopen the saved world, or restage the recipe with `reset`. */
  async reload(reset = false): Promise<void> {
    await this.control(() => this.admin({ kind: reset ? "reset" : "reload" }, true));
  }

  /** Physics timings and collision counters; play continues meanwhile. */
  async samplePhysicsDiagnostics(reset = false): Promise<LabAdminResult["physics"]> {
    await this.ready;
    await this.admin({ kind: "diagnostics", reset }, false);
    return this.physicsDiagnostics;
  }

  /** The clock runs on between answers: the authority's ticks advance with the
   * frames applied since the last one (a paused world's frames repeat its tick,
   * and a new world's frames count from its start, as its answer will). */
  getDiagnostics() {
    const { clock } = this;
    const since = this.replica.serverTick - this.clockTick;
    return {
      clock: clock && { running: clock.running, ticks: clock.ticks + since },
      channel: this.transport.channelDiagnostics(),
      bytesReceived: this.transport.bytesReceived,
    };
  }

  /** Release prediction and presentation; the Worker shuts down behind it. */
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.onHorn = this.onWorldLoaded = undefined;
    this.device.dispose();
    void this.transport.shutdown().catch(() => {});
  }

  private async control(run: () => Promise<unknown>): Promise<void> {
    this.controls++;
    try {
      await this.ready;
      await run();
    } finally {
      this.controls--;
    }
  }

  /** An admin answer follows its snapshot: apply that state before callers read
   * the replica, then rebuild prediction (restarting it after a fence). */
  private async admin(request: LabAdminRequest, reset: boolean): Promise<LabAdminResult> {
    const result = (await this.transport.admin(request)) as LabAdminResult;
    if (this.failure) throw this.failure;
    if (this.closed) throw Error("Recipe world closed");
    const { replica } = this;
    while (replica.pendingMessageCount) replica.applyPending();
    this.handles = result.handles;
    this.clock = result.clock;
    this.clockTick = replica.serverTick;
    if (result.physics) this.physicsDiagnostics = result.physics;
    this.synchronize(reset);
    return result;
  }

  private route(message: ServerMessage): void {
    if (message.type === "world-loaded") {
      // A new world (open, reset, reload): forget the old one, as a realm change
      // does. The authority streams the camera's last range into it.
      this.replica.clear();
      this.device.clearPresentation();
      this.onWorldLoaded?.();
    } else if (message.type === "vehicle-horn") this.onHorn?.(message);
    else if (message.type === "frame" || message.type.startsWith("sync-")) {
      // Prediction takes the recipe's gravity; the page's gravity scale stays put.
      if (message.type !== "sync-cvars") this.replica.bufferMessage(message as BufferedMessage);
    }
    // Recipe worlds have no doors, menus, chat or storage pressure to present.
  }

  private synchronize(reset = false): void {
    const { replica } = this;
    const player = replica.serverPlayerEntity;
    if (player.id === -1) return;
    applyRecipeAppearances(replica, this.recipe.player, this.recipe.actors);
    // Lab resets seat the player on its parent (the occupied vehicle or mount);
    // a cleared replica restarts prediction by itself.
    this.device.reconcile(reset, player.parentId);
  }

  /** Keep the first failure for the lab's next call and stop the Worker. */
  private fail(error: unknown): void {
    if (this.closed) return; // Work cut short by dispose is not a failure.
    this.failure ??= error instanceof Error ? error : new Error(String(error));
    void this.transport.shutdown().catch(() => {});
  }
}
