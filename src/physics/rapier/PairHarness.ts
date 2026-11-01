import { RemoteStateView } from "../../client/ClientStateView.js";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
} from "../../shared/binaryCodec.js";
import type { BufferedMessage } from "../../shared/protocol.js";
import { World } from "../../world/World.js";
import { FullWorldPredictor } from "./FullWorldPredictor.js";
import type { PairAuthorityPort, PairFrame, ScheduledPhysicsInput } from "./PairAuthority.js";
import { PhysicsLink } from "./PhysicsLink.js";
import { NEUTRAL, type PairScenario, type PhysicsSeat, pairInput } from "./PhysicsScenarios.js";
import { PHYSICS_DT, type PhysicsInput } from "./RapierWorld.js";

export interface PairConfiguration {
  scene: PairScenario;
  rtt: number;
  jitter: number;
  seed: number;
}
/** Same fixture, input scripts, codecs, links and predictor in browser and Node.
 * A single explicit coordinator clock makes pause/step and seeded reruns repeatable.
 * Live mode paces these ticks in real time; Worker execution remains asynchronous. */
export class PairHarness {
  readonly clients = [new FullWorldPredictor(0), new FullWorldPredictor(1)] as const;
  readonly replicas = [new RemoteStateView(new World()), new RemoteStateView(new World())] as const;
  readonly lead: [number, number];
  private up: [PhysicsLink<ScheduledPhysicsInput>, PhysicsLink<ScheduledPhysicsInput>];
  private down: [PhysicsLink<PairFrame>, PhysicsLink<PairFrame>];
  readonly received: [PairFrame | undefined, PairFrame | undefined] = [undefined, undefined];
  tick = 0;
  latest: PairFrame;
  script = true;
  controlled: PhysicsSeat = 0;
  desired: PhysicsInput = NEUTRAL;
  private closed = false;
  private busy = false;
  constructor(
    readonly config: PairConfiguration,
    private authority: PairAuthorityPort,
    initial: PairFrame,
  ) {
    this.latest = initial;
    this.lead = [2, Math.ceil((config.rtt / 2 + config.jitter) / (PHYSICS_DT * 1000)) + 2];
    this.up = [
      new PhysicsLink(0, 0, config.seed),
      new PhysicsLink(config.rtt / 2, config.jitter, config.seed + 1),
    ];
    this.down = [
      new PhysicsLink(0, 0, config.seed + 2),
      new PhysicsLink(config.rtt / 2, config.jitter, config.seed + 3),
    ];
    for (const seat of [0, 1] as const) {
      // Connection bootstrap is an explicit baseline; later delivery is delayed.
      this.consume(seat, initial);
      for (let step = 1; step <= this.lead[seat]; step++) this.clients[seat].advance(step, NEUTRAL);
    }
  }
  private consume(seat: PhysicsSeat, frame: PairFrame) {
    this.clients[seat].receive(frame.snapshot);
    this.received[seat] = frame;
    for (const buffer of frame.frames[seat]) {
      const message = decodeServerMessage(buffer);
      if (message.type.startsWith("sync-") || message.type === "frame")
        this.replicas[seat].applyMessage(message as BufferedMessage);
    }
  }
  async step() {
    if (this.closed || this.busy) throw Error("Pair clock requires serial steps");
    this.busy = true;
    try {
      const now = ++this.tick * PHYSICS_DT * 1000;
      const commands: ScheduledPhysicsInput[] = [];
      for (const seat of [0, 1] as const) {
        const client = this.clients[seat],
          target = this.tick + this.lead[seat];
        // Explicit recovery can rebase prediction. Fill the bounded lead again.
        while (client.tick < target) {
          const tick = client.tick + 1;
          const input =
            !this.script && seat === this.controlled
              ? this.desired
              : this.script
                ? pairInput(this.config.scene, seat, tick)
                : NEUTRAL;
          const buffer = encodeClientMessage({
            type: "player-input",
            seq: tick,
            dx: input.x,
            dy: input.z,
            jump: input.jump,
            sprinting: false,
            dtMs: PHYSICS_DT * 1000,
          });
          const decoded = decodeClientMessage(buffer);
          if (decoded.type !== "player-input") throw Error("Invalid pair input");
          client.advance(tick, { x: decoded.dx, z: decoded.dy, jump: decoded.jump });
          this.up[seat].push(now, { seat, tick, buffer }, buffer.byteLength);
        }
        commands.push(...this.up[seat].drain(now));
      }
      const frame = await this.authority.step(commands);
      if (this.closed) return;
      this.latest = frame;
      if (this.tick % 2 === 0) {
        const bytes =
          frame.snapshot.state.bytes.byteLength +
          frame.poses.byteLength +
          frame.frames.flat().reduce((sum, buffer) => sum + buffer.byteLength, 0);
        for (const seat of [0, 1] as const) this.down[seat].push(now, frame, bytes);
      }
      for (const seat of [0, 1] as const)
        for (const delivered of this.down[seat].drain(now)) this.consume(seat, delivered);
    } finally {
      this.busy = false;
    }
  }
  get queued() {
    return (
      this.up.reduce((sum, link) => sum + link.pending, 0) +
      this.down.reduce((sum, link) => sum + link.pending, 0)
    );
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    for (const link of [...this.up, ...this.down]) link.clear();
    for (const client of this.clients) client.dispose();
    await this.authority.close();
  }
}
