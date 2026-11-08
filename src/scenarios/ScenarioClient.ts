import type { SeatPress } from "../input/SeatComposer.js";
import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import type { Movement } from "../shared/Movement.js";
import type { BufferedMessage, VehicleHornMessage } from "../shared/protocol.js";
import { type ChannelEnvelope, OrderedWorkerChannel } from "../transport/OrderedWorkerChannel.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { OrderedLatency } from "./OrderedLatency.js";
import type {
  ScenarioCommand,
  ScenarioPacket,
  ScenarioRequest,
  ScenarioResponse,
} from "./ScenarioProtocol.js";
import { type ScenarioRecipe, scenarioGravity } from "./ScenarioRecipe.js";
import { ScenarioReplica } from "./ScenarioReplica.js";

type Request = ScenarioRequest extends infer R
  ? R extends ScenarioRequest
    ? Omit<R, "id">
    : never
  : never;

/** Reusable live client: independently clocked Worker authority and production
 * binary transport, replica, prediction and bounded decode. */
export class ScenarioClient {
  readonly host: ScenarioReplica;
  readonly guest: ScenarioReplica | undefined;
  get view() {
    return this.host.view;
  }
  get predictor() {
    return this.host.predictor;
  }
  /** Seat 0's device session (replica, prediction and shared presentation). */
  get device() {
    return this.host.session;
  }
  private readonly guestInputs = new OrderedLatency<ScenarioPacket>((packet) => {
    try {
      this.channel.send(packet);
    } catch (error) {
      this.fail(error);
    }
  });
  private readonly guestFrames = new OrderedLatency<ScenarioPacket>((packet) => {
    try {
      this.consumeFrame(packet);
    } catch (error) {
      this.fail(error);
    }
  });
  setNetwork(rtt: number, jitter = 0) {
    if (![rtt, jitter].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000))
      throw Error("Invalid simulated network delay");
    this.guestInputs.delayMs = this.guestFrames.delayMs = rtt / 2;
    this.guestInputs.jitterMs = this.guestFrames.jitterMs = jitter;
  }
  readonly ready: Promise<void>;
  onHorn?: (message: VehicleHornMessage) => void;
  handles: Record<string, number> = {};
  physicsDiagnostics: ScenarioResponse["physicsDiagnostics"];
  async samplePhysicsDiagnostics(reset = false) {
    await this.request({ kind: "diagnostics", reset });
    return this.physicsDiagnostics;
  }
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
  private controls = 0;
  private clockChanges = 0;
  private running = false;
  private receivedFrame = false;
  private closed = false;
  private loaded = false;
  private failure: Error | undefined;

  constructor(
    readonly recipe: ScenarioRecipe,
    options: { allCars3d?: boolean } = {},
  ) {
    const gravity = scenarioGravity(recipe);
    this.host = new ScenarioReplica(recipe.player, gravity, recipe.actors, options);
    if (recipe.guest)
      this.guest = new ScenarioReplica(recipe.guest, gravity, recipe.actors, options);
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
    this.ready = Promise.all([
      this.predictor.ready,
      this.guest?.predictor.ready,
      this.request({ kind: "open", recipe, mode: "realtime" }),
    ]).then(() => {
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
      if (this.receivedFrame) {
        this.receivedFrame = false;
        this.synchronizePrediction();
      }
    } catch (error) {
      this.fail(error);
    }
  }
  private consume(packet: ScenarioPacket) {
    if (packet.type === "reset") {
      this.guestFrames.flush();
      this.host.clear();
      this.guest?.clear();
    } else if (packet.type === "frame") {
      if (packet.seat === 1) this.guestFrames.push(packet, packet.buffer.byteLength);
      else this.consumeFrame(packet);
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
      if (response.id > 0) {
        this.guestInputs.flush();
        this.guestFrames.flush();
      }
      this.handles = response.handles;
      if (response.physicsDiagnostics) this.physicsDiagnostics = response.physicsDiagnostics;
      this.clock = response.clock;
      if (response.id > 0) this.synchronizePrediction();
      pending?.resolve();
    } else throw new Error("Unexpected scenario authority packet");
  }
  private consumeFrame(packet: ScenarioPacket) {
    if (packet.type !== "frame") throw Error("Expected frame packet");
    const replica = packet.seat === 1 ? this.guest : this.host;
    if (!replica) throw Error("Unexpected guest frame");
    const message = decodeServerMessage(packet.buffer);
    if (message.type === "vehicle-horn") this.onHorn?.(message);
    if (
      message.type !== "sync-cvars" &&
      (message.type === "frame" || message.type.startsWith("sync-"))
    )
      replica.view.applyMessage(message as BufferedMessage);
    if (message.type === "frame") {
      if (packet.seat === 1) replica.synchronize();
      else this.receivedFrame = true;
    }
  }
  private synchronizePrediction(reset = false) {
    this.host.synchronize(reset);
    if (reset) this.guest?.synchronize(true);
  }
  private fail(reason: unknown) {
    if (this.failure) return;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.failure = error;
    clearTimeout(this.pumpTimer);
    this.guestInputs.close();
    this.guestFrames.close();
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
        // Admit all earlier inputs before a clock/edit/replacement fence.
        this.guestInputs.flush();
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
    if (!running) this.guestInputs.flush();
    this.running = running;
    this.clockChanges++;
    void this.ready
      .then(() => this.request({ kind: "clock", running }))
      .then(() => {
        this.view.resetPresentationClock(true);
        this.guest?.view.resetPresentationClock(true);
        this.synchronizePrediction(true);
      })
      .catch((error) => this.fail(error))
      .finally(() => {
        this.clockChanges--;
      });
    this.schedulePump();
  }

  private get accepting(): boolean {
    if (this.failure) throw this.failure;
    return this.loaded && !this.closed && this.running && !this.busy && this.channel.writable;
  }

  private sendInput(seat: 0 | 1, buffer: ArrayBuffer, range?: ChunkRange): void {
    const packet: ScenarioPacket = { type: "input", seat, buffer, ...(range ? { range } : {}) };
    if (seat === 1) this.guestInputs.push(packet, packet.buffer.byteLength);
    else this.channel.send(packet);
  }

  /** Submit/predict input only. Realm advances on its own ServerLoop cadence. */
  submitInput(input: Movement, range?: ChunkRange, seat: 0 | 1 = 0): boolean {
    if (!this.accepting) return false;
    const replica = seat === 1 ? this.guest : this.host;
    if (!replica) throw Error("No guest in this scenario");
    const movement = replica.normalize(input),
      seq = ++replica.seq;
    this.sendInput(seat, encodeClientMessage({ type: "player-input", ...movement, seq }), range);
    replica.predict(seq, movement);
    return true;
  }

  /** A horn, siren or throw press, ordered with the seat's movement commands. */
  submitPress(message: SeatPress, seat: 0 | 1 = 0): boolean {
    if (!this.accepting) return false;
    if (seat === 1 && !this.guest) throw Error("No guest in this scenario");
    this.sendInput(seat, encodeClientMessage(message));
    return true;
  }
  async command(command: ScenarioCommand) {
    this.controls++;
    this.schedulePump();
    try {
      await this.ready;
      await this.request({ kind: "command", command });
      this.synchronizePrediction(true);
    } finally {
      this.controls--;
    }
  }
  async step(input: Movement, range: ChunkRange) {
    if (this.running) throw new Error("Pause before stepping");
    this.controls++;
    this.schedulePump();
    try {
      await this.ready;
      await this.request({ kind: "step", input, range });
      this.host.seq = Math.max(this.host.seq, this.view.lastProcessedInputSeq);
      this.view.resetPresentationClock(true);
      this.synchronizePrediction(true);
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
      this.host.seq = 0;
      if (this.guest) this.guest.seq = 0;
      this.synchronizePrediction(true);
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
    this.host.dispose();
    this.guest?.dispose();
  }
}
