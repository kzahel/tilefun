import { RemoteStateView } from "../../client/ClientStateView.js";
import { nextInputSequence, observeInputSequence } from "../../client/InputSequence.js";
import {
  decodeServerMessage,
  encodeClientMessage,
  quantizeAxis,
} from "../../shared/binaryCodec.js";
import type { BufferedMessage } from "../../shared/protocol.js";
import {
  type ChannelEnvelope,
  OrderedWorkerChannel,
} from "../../transport/OrderedWorkerChannel.js";
import type { IClientTransport } from "../../transport/Transport.js";
import { World } from "../../world/World.js";
import { OrderedLatency } from "./OrderedLatency.js";
import type { PhysicsPacket } from "./PhysicsProtocol.js";
import { RapierPredictor } from "./RapierPredictor.js";
import {
  initRapier,
  PHYSICS_DT,
  type PhysicsDiagnostics,
  type PhysicsInput,
  type PhysicsMotorState,
} from "./RapierWorld.js";

export class PhysicsLabClient {
  private readonly worker = new Worker(new URL("./physics.worker.ts", import.meta.url), {
    type: "module",
  });
  private readonly channel = new OrderedWorkerChannel<PhysicsPacket>((message, transfer) =>
    this.worker.postMessage(message, transfer),
  );
  private readonly up = new OrderedLatency<PhysicsPacket>((packet) => {
    if (!this.closed) this.channel.send(packet);
  });
  private readonly down = new OrderedLatency<PhysicsPacket>((packet) => {
    if (!this.closed) this.consume(packet);
  });
  readonly view = new RemoteStateView(new World());
  readonly predictor: RapierPredictor;
  private readonly transport: IClientTransport;
  private closed = false;
  private loaded = false;
  private paused = false;
  private controlPending = false;
  private pumpTimer: ReturnType<typeof setTimeout> | undefined;
  private desired: PhysicsInput = { x: 0, z: 0, jump: false };
  private accumulator = 0;
  private last = 0;
  private authority: PhysicsMotorState | undefined;
  recoveries = 0;
  lastSequence = 0;
  private roundTripMs = 0;
  showPrediction = true;

  constructor(
    sections: number,
    private readonly frame: (poses: Float32Array, diagnostics: PhysicsDiagnostics) => void,
    private readonly status: (status: string) => void,
  ) {
    this.predictor = new RapierPredictor(sections);
    this.transport = {
      send: (message) => {
        const buffer = encodeClientMessage(message);
        this.send({ type: "input", buffer });
      },
      onMessage: () => {},
      close: () => this.dispose(),
    };
    this.worker.onmessage = (event: MessageEvent<ChannelEnvelope<PhysicsPacket>>) => {
      if (this.closed) return;
      try {
        this.channel.receive(event.data);
        this.pump();
      } catch (error) {
        this.fail(String(error));
      }
    };
    this.worker.onerror = (event) => this.fail(event.message);
    void initRapier()
      .then(() => {
        if (!this.closed) this.channel.send({ type: "open", sections });
      })
      .catch((error) => this.fail(String(error)));
  }
  private consume(packet: PhysicsPacket): void {
    if (packet.type === "engine") {
      const message = decodeServerMessage(packet.buffer);
      if (
        [
          "frame",
          "sync-room",
          "sync-session",
          "sync-invincibility",
          "sync-chunks",
          "sync-props",
          "sync-cvars",
          "sync-player-names",
          "sync-editor-cursors",
        ].includes(message.type)
      )
        this.view.applyMessage(message as BufferedMessage);
    } else if (packet.type === "frame") {
      if (
        this.authority &&
        (packet.motor.epoch < this.authority.epoch ||
          (packet.motor.epoch === this.authority.epoch && packet.motor.tick <= this.authority.tick))
      )
        return;
      const poses = new Float32Array(packet.buffer),
        now = performance.now();
      const reset = this.authority?.epoch !== packet.motor.epoch;
      this.authority = packet.motor;
      this.predictor.receive({ ack: packet.ack, motor: packet.motor, poses }, now);
      observeInputSequence(this.transport, packet.ack);
      if (reset) {
        this.controlPending = false;
        this.accumulator = 0;
        this.last = now;
      }
      this.loaded = true;
      this.frame(poses, packet.diagnostics);
      this.status("Running");
      const maxPending = Math.ceil((this.roundTripMs + 200) / 1000 / PHYSICS_DT) + 8;
      if (!reset && !this.controlPending && this.predictor.diagnostics.pending > maxPending) {
        this.recoveries++;
        this.send({ type: "resync" });
      }
    } else if (packet.type === "error") this.fail(packet.message);
  }
  advance(now: number): void {
    if (this.closed) return;
    const elapsed = this.last ? Math.max(0, (now - this.last) / 1000) : 0;
    this.last = now;
    if (!this.loaded || this.paused || this.controlPending) {
      this.accumulator = 0;
      return;
    }
    if (elapsed > 0.25) {
      this.recoveries++;
      this.accumulator = 0;
      this.send({ type: "resync" });
      return;
    }
    this.accumulator += elapsed;
    let steps = 0;
    while (this.accumulator >= PHYSICS_DT && steps++ < 4) {
      const seq = nextInputSequence(this.transport, this.predictor.diagnostics.ack);
      this.lastSequence = seq;
      const input = {
        x: quantizeAxis(this.desired.x),
        z: quantizeAxis(this.desired.z),
        jump: this.desired.jump,
      };
      this.predictor.submit(seq, input, now);
      this.transport.send({
        type: "player-input",
        seq,
        dx: input.x,
        dy: input.z,
        jump: input.jump,
        sprinting: false,
        dtMs: 17,
      });
      this.accumulator -= PHYSICS_DT;
    }
    this.predictor.drain();
    if (this.predictor.diagnostics.status === "history-gap") this.send({ type: "resync" });
  }
  get motor() {
    return this.showPrediction ? this.predictor.motor : this.authority;
  }
  get authorityMotor() {
    return this.authority;
  }
  get predictedPlatformY() {
    return this.showPrediction ? this.predictor.platformY : undefined;
  }
  get queued() {
    return this.up.pending + this.down.pending;
  }
  setLatency(roundTripMs: number, jitterMs = 0): void {
    this.roundTripMs = Math.max(0, Math.min(500, roundTripMs));
    this.up.delayMs = this.down.delayMs = Math.max(0, Math.min(500, roundTripMs)) / 2;
    this.up.jitterMs = this.down.jitterMs = Math.max(0, Math.min(50, jitterMs));
  }
  private pump(): void {
    if (this.closed) return;
    this.channel.pump((packet) => this.down.push(packet, packet.buffer?.byteLength ?? 0));
    if (this.channel.pending && this.pumpTimer === undefined)
      this.pumpTimer = setTimeout(() => {
        this.pumpTimer = undefined;
        try {
          this.pump();
        } catch (error) {
          this.fail(String(error));
        }
      }, 0);
  }
  private fail(message: string) {
    this.status(`Failed: ${message}`);
    this.dispose();
  }
  send(packet: PhysicsPacket) {
    if (this.closed) return;
    if (packet.type === "pause") {
      this.paused = packet.paused;
      this.controlPending = true;
    }
    if (packet.type === "teleport" || packet.type === "resync") this.controlPending = true;
    try {
      this.up.push(packet, packet.buffer?.byteLength ?? 0);
    } catch (error) {
      this.fail(String(error));
    }
  }
  input(input: PhysicsInput) {
    this.desired = input;
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.pumpTimer);
    this.up.close();
    this.down.close();
    this.worker.terminate();
    this.channel.close();
    this.predictor.dispose();
  }
}
