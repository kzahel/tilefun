import { ServerLoop } from "../server/ServerLoop.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { ScenarioRequest, ScenarioResponse } from "./ScenarioProtocol.js";
import { ScenarioSession } from "./ScenarioSession.js";

/** One authority owner: manual tests or the production real-time clock. */
export class ScenarioWorkerHost {
  private session: ScenarioSession | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  private mode: "manual" | "realtime" = "manual";
  private running = false;
  private ticks = 0;
  private failed = false;
  private readonly loop: ServerLoop;

  constructor(
    private readonly publish: (response: ScenarioResponse) => void = () => {},
    private readonly writable: () => boolean = () => true,
  ) {
    this.loop = new ServerLoop(
      (dt) => {
        const session = this.session;
        if (!session) return;
        const canPublish = this.writable();
        const frames = session.tick(dt, canPublish);
        this.ticks++;
        // Realm does not advance replica baselines while output is backpressured.
        if (frames.length) this.publish(this.response(0, frames));
      },
      undefined,
      (error) => this.fail(error),
    );
  }

  private fail(error: unknown) {
    this.failed = true;
    this.running = false;
    this.loop.stop();
    this.publish({ id: 0, frames: [], handles: {}, error: String(error) });
  }

  input(buffer: ArrayBuffer, range?: ChunkRange): void {
    this.tail = this.tail
      .then(() => {
        if (this.failed || this.mode !== "realtime" || !this.running) return;
        this.session?.input(buffer, range);
      })
      .catch((error) => this.fail(error));
  }

  private response(id: number, frames: ArrayBuffer[]): ScenarioResponse {
    const car = this.session?.realm.traffic?.states.get(this.session.handles.car ?? -1);
    return {
      id,
      frames,
      handles: { ...this.session?.handles },
      clock: { mode: this.mode, running: this.running, ticks: this.ticks },
      ...(car
        ? {
            traffic: {
              speed: car.speed,
              waiting: car.waiting,
              count: this.session?.realm.traffic?.states.size ?? 0,
            },
          }
        : {}),
    };
  }

  request(request: ScenarioRequest): Promise<ScenarioResponse> {
    const result = this.tail.then(async (): Promise<ScenarioResponse> => {
      // Commands may await storage/streaming. Never tick a partially replaced world.
      this.loop.stop();
      try {
        if (this.failed && request.kind !== "close" && request.kind !== "open")
          throw new Error("Scenario authority failed");
        if (request.kind === "open") {
          this.running = false;
          await this.session?.close();
          this.session = undefined;
          this.mode = request.mode ?? "manual";
          this.ticks = 0;
          this.session = await ScenarioSession.create(request.recipe);
          this.failed = false;
        } else {
          const session = this.session;
          if (!session) throw new Error("Scenario is not open");
          switch (request.kind) {
            case "clock":
              if (this.mode !== "realtime") throw new Error("Manual scenario has no running clock");
              this.running = request.running;
              if (!this.running) session.discardInputs();
              break;
            case "step":
              if (this.running) throw new Error("Pause authority before manual stepping");
              await session.step(request.input, request.dt, request.range);
              this.ticks++;
              break;
            case "command":
              await session.command(request.command);
              break;
            case "reset":
              await session.reset();
              this.ticks = 0;
              break;
            case "reload":
              await session.reload();
              this.ticks = 0;
              break;
            case "close":
              this.running = false;
              await session.close();
              this.session = undefined;
              break;
          }
        }
        return this.response(request.id, this.session?.frames() ?? []);
      } catch (error) {
        // These operations may already have destroyed/replaced the old Realm.
        // A failed replacement cannot safely resume an automatic clock.
        if (request.kind === "open" || request.kind === "reload" || request.kind === "reset") {
          this.failed = true;
          this.running = false;
        }
        return { id: request.id, frames: [], handles: {}, error: String(error) };
      } finally {
        if (!this.failed && this.session && this.running) this.loop.start();
      }
    });
    this.tail = result;
    return result;
  }
}
