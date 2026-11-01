import { updatePlayerFromInput } from "../../entities/Player.js";
import { tickSpriteAnimation } from "../../entities/spriteAnimation.js";
import { ScenarioSession } from "../../scenarios/ScenarioSession.js";
import { PlayerSession } from "../../server/PlayerSession.js";
import type { Realm } from "../../server/Realm.js";
import type { RealmSimulationOwner } from "../../server/RealmSimulationOwner.js";
import { decodeClientMessage, encodeServerMessage } from "../../shared/binaryCodec.js";
import type { PairSnapshot } from "./FullWorldPredictor.js";
import { NEUTRAL, type PairScenario, type PhysicsSeat, setupPair } from "./PhysicsScenarios.js";
import { RapierRealmSimulation } from "./RapierRealmSimulation.js";
import { rapierScenarioRecipe } from "./RapierScenarioRecipe.js";
import { initRapier, PHYSICS_DT, type PhysicsInput, RapierWorld } from "./RapierWorld.js";

export interface ScheduledPhysicsInput {
  seat: PhysicsSeat;
  tick: number;
  buffer: ArrayBuffer;
}
export interface PairFrame {
  snapshot: PairSnapshot;
  poses: Float32Array;
  frames: [ArrayBuffer[], ArrayBuffer[]];
  tickMs: number;
  lateInputs: number;
}
export interface PairAuthorityPort {
  step(inputs: ScheduledPhysicsInput[]): Promise<PairFrame>;
  close(): Promise<void>;
}
class PairOwner implements RealmSimulationOwner {
  readonly adapter: RapierRealmSimulation;
  readonly inputs: [PhysicsInput, PhysicsInput] = [{ ...NEUTRAL }, { ...NEUTRAL }];
  constructor(scene: PairScenario) {
    const world = new RapierWorld(2, 0);
    setupPair(world, scene);
    this.adapter = new RapierRealmSimulation(2, world);
  }
  step(dt: number, sessions: readonly PlayerSession[], realm: Realm) {
    if (Math.abs(dt - PHYSICS_DT) > 1e-6 || sessions.length !== 2)
      throw Error("Pair proof requires two players and fixed 60 Hz");
    for (const seat of [0, 1] as const) {
      const session = sessions[seat];
      if (!session) throw Error("Missing pair session");
      const input = session.inputQueue.shift();
      if (input) {
        this.inputs[seat] = { x: input.dx, z: input.dy, jump: input.jump };
        session.lastProcessedInputSeq = input.seq;
      }
      updatePlayerFromInput(
        session.player,
        {
          dx: this.inputs[seat].x,
          dy: this.inputs[seat].z,
          jump: this.inputs[seat].jump,
          sprinting: false,
        },
        dt,
      );
      tickSpriteAnimation(session.player, dt);
    }
    this.adapter.backend.step(...this.inputs);
    const host = sessions[0],
      guest = sessions[1];
    if (host && guest) this.adapter.sync(realm, host, guest);
  }
  dispose() {
    this.adapter.dispose();
  }
}
/** Temporary two-player Realm, shared by the Worker and deterministic runner.
 * Tick-addressed input admission is experimental; the game wire codec stays normal. */
export class PairAuthority implements PairAuthorityPort {
  private scheduled = new Map<number, ScheduledPhysicsInput[]>();
  private lateInputs = 0;
  private constructor(
    readonly session: ScenarioSession,
    readonly guest: PlayerSession,
    private readonly owner: PairOwner,
  ) {}
  static async create(scene: PairScenario) {
    await initRapier();
    const owner = new PairOwner(scene);
    const session = await ScenarioSession.create(rapierScenarioRecipe(2), async () => owner);
    try {
      const guest = new PlayerSession("physics-guest");
      guest.editorEnabled = false;
      await session.realm.addPlayer(guest);
      guest.player.wanderAI = null;
      delete guest.player.routeAI;
      guest.player.collider = structuredClone(session.player.player.collider);
      owner.adapter.sync(session.realm, session.player, guest);
      await session.realm.ensureReady(guest.visibleRange);
      return new PairAuthority(session, guest, owner);
    } catch (error) {
      await session.close();
      throw error;
    }
  }
  frame(publish = true): PairFrame {
    const world = this.owner.adapter.backend;
    return {
      snapshot: {
        state: world.snapshot(),
        inputs: structuredClone(this.owner.inputs),
        ack: [this.session.player.lastProcessedInputSeq, this.guest.lastProcessedInputSeq],
      },
      poses: world.poses(),
      frames: publish
        ? [
            this.session.frames(),
            this.session.realm.replicate(this.guest.clientId).map(encodeServerMessage),
          ]
        : [[], []],
      tickMs: 0,
      lateInputs: this.lateInputs,
    };
  }
  async step(commands: ScheduledPhysicsInput[]) {
    const began = performance.now(),
      current = this.owner.adapter.backend.motor().tick;
    for (const command of commands) {
      if (command.seat !== 0 && command.seat !== 1) throw Error("Invalid seat");
      if (!Number.isSafeInteger(command.tick) || command.tick > current + 64)
        throw Error("Input outside admission window");
      if (command.tick <= current) {
        this.lateInputs++;
        continue;
      }
      const queued = this.scheduled.get(command.tick) ?? [];
      // One command per participant per physics tick.
      if (!queued.some((other) => other.seat === command.seat)) queued.push(command);
      this.scheduled.set(command.tick, queued);
    }
    for (const command of this.scheduled.get(current + 1) ?? []) {
      const message = decodeClientMessage(command.buffer);
      if (message.type !== "player-input" || message.seq !== command.tick)
        throw Error("Input tick/sequence mismatch");
      const player = command.seat === 0 ? this.session.player : this.guest;
      this.session.realm.handleMessage(player.clientId, player, message);
    }
    this.scheduled.delete(current + 1);
    this.session.tick(PHYSICS_DT);
    // Delta baselines advance only when the frame will actually be delivered.
    const frame = this.frame((current + 1) % 2 === 0);
    frame.tickMs = performance.now() - began;
    return frame;
  }
  async close() {
    this.scheduled.clear();
    await this.session.close();
  }
}
