import type { ScenarioRequest, ScenarioResponse } from "./ScenarioProtocol.js";
import { ScenarioSession } from "./ScenarioSession.js";
/** Ordered request lifecycle, also exercised without a browser in tests. */
export class ScenarioWorkerHost {
  private session: ScenarioSession | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  request(request: ScenarioRequest): Promise<ScenarioResponse> {
    const result = this.tail.then(async (): Promise<ScenarioResponse> => {
      try {
        if (request.kind === "open") {
          await this.session?.close();
          this.session = await ScenarioSession.create(request.recipe);
        } else {
          const session = this.session;
          if (!session) throw new Error("Scenario is not open");
          switch (request.kind) {
            case "step":
              await session.step(request.input, request.dt, request.range);
              break;
            case "command":
              await session.command(request.command);
              break;
            case "reload":
              await session.reload();
              break;
            case "close":
              await session.close();
              this.session = undefined;
              break;
          }
        }
        return {
          id: request.id,
          frames: this.session?.frames() ?? [],
          handles: { ...this.session?.handles },
        };
      } catch (error) {
        return { id: request.id, frames: [], handles: {}, error: String(error) };
      }
    });
    this.tail = result;
    return result;
  }
}
