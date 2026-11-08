import type { PerformanceSnapshot } from "../diagnostics/PerformanceMetrics.js";
import type { Realm } from "../server/Realm.js";
import type { Movement } from "../shared/Movement.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { ScenarioCommand } from "./ScenarioProtocol.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

/**
 * Lab instruments (226): requests a Workshop lab sends its recipe-world
 * authority beside the game protocol. They travel on the local host channel in
 * order with the lab's game messages; only the recipe-world authority answers
 * them, and each answer follows a full snapshot of the world it describes.
 */
export type LabAdminRequest =
  | { kind: "open"; recipe: ScenarioRecipe }
  /** Run or pause the world clock; a paused world never advances. */
  | { kind: "clock"; running: boolean }
  /** One manual tick with this movement (paused worlds only). */
  | { kind: "step"; input: Movement; range?: ChunkRange }
  | { kind: "command"; command: ScenarioCommand }
  /** Restage the recipe from scratch. */
  | { kind: "reset" }
  /** Save and reopen the current world. */
  | { kind: "reload" }
  | { kind: "diagnostics"; reset?: boolean };

export interface LabAdminResult {
  /** Named recipe entities (parked vehicles, seats) in the current world. */
  handles: Record<string, number>;
  /** Clock intent and simulated ticks since the world was staged. */
  clock: { running: boolean; ticks: number };
  /** Physics timings and collision counters (diagnostics requests). */
  physics?: { timings: PerformanceSnapshot; collision: Realm["collisionDiagnostics"] };
}

const KINDS = new Set<string>([
  "open",
  "clock",
  "step",
  "command",
  "reset",
  "reload",
  "diagnostics",
]);

/** The authority's reading of an admin payload. Fields are checked where they
 * are used (`ScenarioSession` validates recipes, commands and inputs). */
export function labAdminRequest(value: unknown): LabAdminRequest {
  const kind = (value as { kind?: unknown } | null)?.kind;
  if (typeof kind !== "string" || !KINDS.has(kind)) throw Error("Unknown lab request");
  return value as LabAdminRequest;
}
