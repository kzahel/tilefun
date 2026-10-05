import { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { predictInput } from "../client/predictInput.js";
import type { Movement } from "../input/ActionManager.js";
import { decodeServerMessage, quantizeAxis, quantizeInputDtMs } from "../shared/binaryCodec.js";
import type { BufferedMessage } from "../shared/protocol.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { World } from "../world/World.js";
import type { ScenarioCommand, ScenarioRequest, ScenarioResponse } from "./ScenarioProtocol.js";
import { applyScenarioAppearance, type ScenarioRecipe, scenarioPhysics } from "./ScenarioRecipe.js";

type Request = ScenarioRequest extends infer R
  ? R extends ScenarioRequest
    ? Omit<R, "id">
    : never
  : never;
/** Reusable lab client: Worker authority, ordinary binary replica and production prediction. */
export class ScenarioClient {
  readonly view = new RemoteStateView(new World());
  readonly predictor: PlayerPredictor;
  readonly ready: Promise<void>;
  handles: Record<string, number> = {};
  traffic: ScenarioResponse["traffic"];
  private worker = new Worker(new URL("./scenario.worker.ts", import.meta.url), { type: "module" });
  private pending = new Map<
    number,
    { resolve: () => void; reject: (e: Error) => void; reset: boolean }
  >();
  private id = 0;
  private seq = 0;
  private inFlight = 0;
  private controls = 0;
  private closed = false;
  private loaded = false;
  private failure: Error | undefined;
  constructor(readonly recipe: ScenarioRecipe) {
    const physics = scenarioPhysics(recipe.physics);
    this.predictor = new PlayerPredictor(
      () => physics,
      () => 1,
    );
    this.view.setPredictor(this.predictor);
    this.worker.onmessage = (event: MessageEvent<ScenarioResponse>) => {
      const response = event.data,
        pending = this.pending.get(response.id);
      this.pending.delete(response.id);
      if (response.error) {
        pending?.reject(new Error(response.error));
        return;
      }
      if (pending?.reset) this.view.clear();
      this.handles = response.handles;
      this.traffic = response.traffic;
      for (const packet of response.frames) {
        const message = decodeServerMessage(packet);
        // Lab settings are session-scoped; never write the page's global CVars.
        if (
          message.type !== "sync-cvars" &&
          (message.type === "frame" || message.type.startsWith("sync-"))
        ) {
          this.view.applyMessage(message as BufferedMessage);
        }
      }
      const player = this.view.serverPlayerEntity;
      if (player.id !== -1) {
        applyScenarioAppearance(player, this.recipe.player);
        if (pending?.reset || !this.predictor.player || this.predictor.player.id !== player.id)
          this.predictor.reset(player);
        else
          this.predictor.reconcile(
            player,
            this.view.lastProcessedInputSeq,
            this.view.world,
            this.view.props,
            this.view.serverEntities,
            this.view.mountEntityId,
            this.view.simulationTime !== undefined
              ? { simulationTime: this.view.simulationTime }
              : undefined,
          );
      }
      pending?.resolve();
    };
    this.worker.onerror = (event) => this.fail(new Error(event.message));
    this.ready = this.request({ kind: "open", recipe }).then(() => {
      this.loaded = true;
    });
    void this.ready.catch(() => {});
  }
  private fail(error: Error) {
    this.failure = error;
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
  private request(request: Request): Promise<void> {
    if (this.closed) return Promise.reject(new Error("Scenario is closed"));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        reset: request.kind === "reload" || request.kind === "reset",
      });
      this.worker.postMessage({ ...request, id });
    });
  }
  /** Bounded outstanding commands prevent a hidden/sluggish tab accumulating simulation debt. */
  step(input: Movement, dt = 1 / 60, range?: ChunkRange): boolean {
    if (this.failure) throw this.failure;
    if (!this.loaded || this.closed || this.controls > 0 || this.inFlight >= 6) return false;
    const length = Math.max(1, Math.hypot(input.dx, input.dy));
    const movement = {
      ...input,
      dx: quantizeAxis(input.dx / length),
      dy: quantizeAxis(input.dy / length),
    };
    const seconds = quantizeInputDtMs(Math.min(dt, 0.1) * 1000) / 1000;
    if (!seconds) return false;
    this.view.tickAnimations(seconds);
    predictInput(
      this.predictor,
      ++this.seq,
      movement,
      seconds,
      this.view.world,
      this.view.props,
      this.view.entities,
    );
    this.inFlight++;
    void this.request({ kind: "step", input: movement, dt: seconds, ...(range ? { range } : {}) })
      .catch((e) => this.fail(e))
      .finally(() => this.inFlight--);
    return true;
  }
  async command(command: ScenarioCommand) {
    this.controls++;
    try {
      await this.ready;
      await this.request({ kind: "command", command });
      this.predictor.reset(this.view.serverPlayerEntity);
    } finally {
      this.controls--;
    }
  }
  async reload(reset = false) {
    this.controls++;
    try {
      await this.ready;
      await this.request({ kind: reset ? "reset" : "reload" });
      this.seq = 0;
      this.predictor.reset(this.view.serverPlayerEntity);
    } finally {
      this.controls--;
    }
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.worker.terminate();
    this.worker.onmessage = this.worker.onerror = null;
    this.fail(new Error("Scenario disposed"));
    this.view.setPredictor(null);
  }
}
