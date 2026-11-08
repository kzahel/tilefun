import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import type { LocalAuthority } from "../server/LocalServerRuntime.js";
import { ServerLoop } from "../server/ServerLoop.js";
import type { ClientMessage } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import {
  type LabAdminRequest,
  type LabAdminResult,
  labAdminRequest,
} from "./RecipeWorldProtocol.js";
import { ScenarioSession } from "./ScenarioSession.js";

/** The runtime's own connection; seat 0 of the lab's device. */
const LOCAL = "local";
/** Play messages a running world accepts from its seat. */
const PLAY = new Set<ClientMessage["type"]>([
  "player-input",
  "vehicle-horn",
  "vehicle-emergency",
  "throw-ball",
]);

/**
 * A Workshop lab's authority (226): one recipe world staged by
 * `ScenarioSession`, served by the game's `LocalServerRuntime`. Seat 0 is the
 * runtime's local connection and speaks the game protocol; lab instruments
 * arrive as admin requests, run one at a time and answer after a full snapshot.
 * The loop keeps beating while a lab is paused, so the client's watchdog sees a
 * live authority, but a paused world never advances.
 */
export class RecipeWorldAuthority implements LocalAuthority {
  completedTicks = 0;
  onLoopError: ((error: unknown) => void) | undefined;
  private session: ScenarioSession | undefined;
  private range: ChunkRange | undefined;
  private running = false;
  /** Simulated ticks since the world was staged (steps included). */
  private ticks = 0;
  /** Admin requests received and not yet answered; play waits for none of them. */
  private busy = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private readonly loop = new ServerLoop(
    () => this.tick(),
    (error) => this.onLoopError?.(error),
  );

  constructor(private readonly transport: IServerTransport) {
    transport.onMessage((id, message) => {
      if (id === LOCAL) this.receive(message);
    });
  }

  async init(): Promise<void> {}
  startLoop(): void {
    this.loop.start();
  }
  stopLoop(): void {
    this.loop.stop();
  }
  async settle(): Promise<void> {
    await this.tail;
  }
  async flushAsync(): Promise<void> {}
  async destroy(): Promise<void> {
    this.loop.stop();
    await this.tail;
    await this.session?.close();
    this.session = undefined;
  }

  admin(payload: unknown): Promise<LabAdminResult> {
    let request: LabAdminRequest;
    try {
      request = labAdminRequest(payload);
    } catch (error) {
      return Promise.reject(error);
    }
    // Reading diagnostics changes nothing, so play continues around it.
    const changes = request.kind !== "diagnostics";
    if (changes) this.busy++;
    const answer = this.tail.then(async () => {
      // Reset and reload destroy the world before staging it again.
      const replaces =
        request.kind === "reset" ||
        request.kind === "reload" ||
        (request.kind === "open" && !this.session);
      try {
        const session = await this.run(request);
        // Every new world, teleport or step keeps streaming what the camera shows.
        if (changes && this.range) await session.ready(this.range);
        session.publish();
        return {
          handles: { ...session.handles },
          clock: { running: this.running, ticks: this.ticks },
          ...(request.kind === "diagnostics"
            ? {
                physics: {
                  timings: performanceMetrics.snapshot(),
                  collision: session.realm.collisionDiagnostics,
                },
              }
            : {}),
        };
      } catch (error) {
        // Without a world nothing can run: that is the authority's failure.
        if (replaces) this.onLoopError?.(error);
        throw error;
      } finally {
        if (changes) this.busy--;
      }
    });
    this.tail = answer.catch(() => {});
    return answer;
  }

  private async run(request: LabAdminRequest): Promise<ScenarioSession> {
    if (request.kind === "open") {
      if (this.session) throw Error("Recipe world is already open");
      if (request.recipe.guest)
        throw Error("Two-seat recipes run on the scenario Worker until 226 slice 6");
      this.session = await ScenarioSession.create(request.recipe, {
        clientId: LOCAL,
        transport: this.transport,
      });
      this.announce(this.session);
      return this.session;
    }
    const session = this.session;
    if (!session) throw Error("Recipe world is not open");
    switch (request.kind) {
      case "clock":
        this.running = request.running;
        if (!this.running) session.discardInputs();
        break;
      case "step":
        if (this.running) throw Error("Pause the recipe world before stepping");
        await session.step(request.input, request.range ?? this.range);
        this.ticks++;
        break;
      case "command":
        await session.command(request.command);
        // Keep a lab's own view range only once the session has accepted it.
        if (request.command.kind === "view-range") this.range = request.command.range;
        break;
      case "reset":
      case "reload":
        await (request.kind === "reset" ? session.reset() : session.reload());
        this.ticks = 0;
        this.announce(session);
        break;
      case "diagnostics":
        if (request.reset) performanceMetrics.reset();
        break;
      default:
        request satisfies never;
    }
    return session;
  }

  /** A new world replaces the client's replica, as a realm change does in the game. */
  private announce(session: ScenarioSession): void {
    const { wx, wy } = session.player.player.position;
    this.transport.send(LOCAL, {
      type: "world-loaded",
      worldId: "scenario",
      cameraX: wx,
      cameraY: wy,
      cameraZoom: 1,
    });
  }

  private receive(message: ClientMessage): void {
    const session = this.session;
    if (message.type === "visible-range") {
      const { minCx, minCy, maxCx, maxCy } = message;
      this.range = { minCx, minCy, maxCx, maxCy };
      // A paused lab still streams what its camera inspects.
      if (!this.running && session) this.stream(session);
      return;
    }
    // Play is the seat's while its world runs; a paused or busy world drops it,
    // as the lab client stops sending.
    if (!PLAY.has(message.type) || !session || !this.running || this.busy) return;
    session.accept(message, this.range);
  }

  private stream(session: ScenarioSession): void {
    const range = this.range;
    this.tail = this.tail
      .then(async () => {
        if (this.session !== session || this.running) return;
        await session.ready(range);
        session.publish();
      })
      .catch((error) => this.onLoopError?.(error));
  }

  private tick(): void {
    this.completedTicks++;
    if (!this.session || !this.running || this.busy) return;
    // Per-connection backpressure is the Realm's (`canSend`), as in the game.
    this.session.tick(true);
    this.ticks++;
  }
}
