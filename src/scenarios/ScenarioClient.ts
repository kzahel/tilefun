import { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { predictInput } from "../client/predictInput.js";
import type { Movement } from "../input/ActionManager.js";
import {
  decodeServerMessage,
  encodeClientMessage,
  quantizeAxis,
  quantizeInputDtMs,
} from "../shared/binaryCodec.js";
import type { BufferedMessage } from "../shared/protocol.js";
import { type ChannelEnvelope, OrderedWorkerChannel } from "../transport/OrderedWorkerChannel.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { World } from "../world/World.js";
import type {
  ScenarioCommand,
  ScenarioPacket,
  ScenarioRequest,
  ScenarioResponse,
} from "./ScenarioProtocol.js";
import { applyScenarioAppearance, type ScenarioRecipe, scenarioPhysics } from "./ScenarioRecipe.js";

type Request = ScenarioRequest extends infer R
  ? R extends ScenarioRequest
    ? Omit<R, "id">
    : never
  : never;

/** Reusable live client: independently clocked Worker authority and production
 * binary transport, replica, prediction and bounded decode. */
export class ScenarioClient {
  readonly view = new RemoteStateView(new World());
  readonly predictor: PlayerPredictor;
  readonly ready: Promise<void>;
  handles: Record<string, number> = {};
  traffic: ScenarioResponse["traffic"];
  clock: ScenarioResponse["clock"];
  private worker = new Worker(new URL("./scenario.worker.ts", import.meta.url), { type: "module" });
  private channel = new OrderedWorkerChannel<ScenarioPacket>((message, transfer) =>
    this.worker.postMessage(message, transfer),
  );
  private pending = new Map<
    number,
    {
      resolve: () => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      fatal: boolean;
    }
  >();
  private pumpTimer: ReturnType<typeof setTimeout> | undefined;
  private id = 0;
  private seq = 0;
  private controls = 0;
  private clockChanges = 0;
  private running = false;
  private resetReplica = false;
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
    this.worker.onmessage = (event: MessageEvent<ChannelEnvelope<ScenarioPacket>>) => {
      try {
        this.channel.receive(event.data);
        this.schedulePump();
      } catch (error) {
        this.fail(error);
      }
    };
    this.worker.onerror = (event) => this.fail(new Error(event.message));
    this.worker.onmessageerror = () =>
      this.fail(new Error("Could not decode scenario Worker message"));
    this.ready = this.request({ kind: "open", recipe, mode: "realtime" }).then(() => {
      this.loaded = true;
    });
    void this.ready.catch(() => {});
  }

  get busy() {
    return this.controls > 0 || this.clockChanges > 0;
  }
  private get autoPump() {
    return !this.loaded || !this.running || this.busy;
  }
  private schedulePump() {
    if (
      this.closed ||
      this.failure ||
      !this.autoPump ||
      !this.channel.pending ||
      this.pumpTimer !== undefined
    )
      return;
    this.pumpTimer = setTimeout(() => {
      this.pumpTimer = undefined;
      this.pump();
      this.schedulePump();
    }, 0);
  }
  pump() {
    if (this.closed || this.failure) return;
    try {
      this.channel.pump((packet) => this.consume(packet));
    } catch (error) {
      this.fail(error);
    }
  }
  private consume(packet: ScenarioPacket) {
    if (packet.type === "reset") {
      this.view.clear();
      this.resetReplica = true;
    } else if (packet.type === "frame") {
      const message = decodeServerMessage(packet.buffer);
      // Lab settings stay scoped; never change the page's global CVars.
      if (
        message.type !== "sync-cvars" &&
        (message.type === "frame" || message.type.startsWith("sync-"))
      )
        this.view.applyMessage(message as BufferedMessage);
    } else if (packet.type === "response") {
      const response = packet.response,
        pending = this.pending.get(response.id);
      if (pending) clearTimeout(pending.timer);
      this.pending.delete(response.id);
      if (response.error) {
        if (pending) pending.reject(new Error(response.error));
        if (!pending || pending.fatal) this.fail(new Error(response.error));
        return;
      }
      this.handles = response.handles;
      this.traffic = response.traffic;
      this.clock = response.clock;
      const player = this.view.serverPlayerEntity;
      if (player.id !== -1) {
        applyScenarioAppearance(player, this.recipe.player);
        if (this.resetReplica || !this.predictor.player || this.predictor.player.id !== player.id)
          this.predictor.reset(
            player,
            this.view.serverEntities.find((e) => e.id === player.parentId),
          );
        else
          this.predictor.reconcile(
            player,
            this.view.lastProcessedInputSeq,
            this.view.world,
            this.view.props,
            this.view.serverEntities,
            this.view.mountEntityId,
            this.view.simulationTime !== undefined
              ? {
                  simulationTime: this.view.simulationTime,
                  expectedInputDt: this.view.tickMs / 1000,
                }
              : undefined,
          );
      }
      this.resetReplica = false;
      pending?.resolve();
    } else throw new Error("Unexpected scenario authority packet");
  }
  private fail(reason: unknown) {
    if (this.failure) return;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.failure = error;
    clearTimeout(this.pumpTimer);
    this.channel.close();
    this.worker.terminate();
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }
  private request(request: Request): Promise<void> {
    if (this.closed || this.failure)
      return Promise.reject(this.failure ?? new Error("Scenario is closed"));
    if (this.pending.size >= 32) return Promise.reject(new Error("Too many scenario controls"));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail(new Error(`Scenario ${request.kind} timed out`)),
        30000,
      );
      this.pending.set(id, {
        resolve,
        reject,
        timer,
        fatal: request.kind === "open" || request.kind === "reload" || request.kind === "reset",
      });
      try {
        this.channel.send({ type: "request", request: { ...request, id } });
      } catch (error) {
        this.fail(error);
      }
      this.schedulePump();
    });
  }

  /** Lifecycle clock intent; it never derives authority time from render deltas. */
  setRunning(running: boolean) {
    if (this.failure) throw this.failure;
    if (this.closed || running === this.running) return;
    this.running = running;
    this.clockChanges++;
    void this.ready
      .then(() => this.request({ kind: "clock", running }))
      .then(() => {
        this.view.resetPresentationClock(true);
        this.predictor.reset(
          this.view.serverPlayerEntity,
          this.view.serverEntities.find((e) => e.id === this.view.serverPlayerEntity.parentId),
        );
      })
      .catch((error) => this.fail(error))
      .finally(() => {
        this.clockChanges--;
      });
    this.schedulePump();
  }

  /** Submit/predict input only. Realm advances on its own ServerLoop cadence. */
  submitInput(input: Movement, dt = 1 / 60, range?: ChunkRange): boolean {
    if (this.failure) throw this.failure;
    if (!this.loaded || this.closed || !this.running || this.busy || !this.channel.writable)
      return false;
    const length = Math.max(1, Math.hypot(input.dx, input.dy));
    const movement = {
      ...input,
      dx: quantizeAxis(input.dx / length),
      dy: quantizeAxis(input.dy / length),
    };
    const seconds = quantizeInputDtMs(Math.min(dt, 0.1) * 1000) / 1000;
    if (!seconds) return false;
    const seq = ++this.seq;
    this.channel.send({
      type: "input",
      buffer: encodeClientMessage({ type: "player-input", ...movement, seq, dtMs: seconds * 1000 }),
      ...(range ? { range } : {}),
    });
    this.view.tickAnimations(seconds);
    predictInput(
      this.predictor,
      seq,
      movement,
      seconds,
      this.view.world,
      this.view.props,
      this.view.entities,
    );
    return true;
  }
  async command(command: ScenarioCommand) {
    this.controls++;
    this.schedulePump();
    try {
      await this.ready;
      await this.request({ kind: "command", command });
      this.predictor.reset(
        this.view.serverPlayerEntity,
        this.view.serverEntities.find((e) => e.id === this.view.serverPlayerEntity.parentId),
      );
    } finally {
      this.controls--;
    }
  }
  async reload(reset = false) {
    this.controls++;
    this.schedulePump();
    try {
      await this.ready;
      await this.request({ kind: reset ? "reset" : "reload" });
      this.seq = 0;
      this.predictor.reset(
        this.view.serverPlayerEntity,
        this.view.serverEntities.find((e) => e.id === this.view.serverPlayerEntity.parentId),
      );
    } finally {
      this.controls--;
    }
  }
  getDiagnostics() {
    return { clock: this.clock, channel: this.channel.diagnostics() };
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.fail(new Error("Scenario disposed"));
    this.worker.onmessage = this.worker.onerror = this.worker.onmessageerror = null;
    this.view.setPredictor(null);
  }
}
