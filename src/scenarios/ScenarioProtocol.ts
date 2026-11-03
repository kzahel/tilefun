import type { Entity } from "../entities/Entity.js";
import type { Movement } from "../input/ActionManager.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";
export type ScenarioCommand =
  | { kind: "call-train"; benchId: number; seat?: 0 | 1 }
  | { kind: "place-entity"; entityType: string; position: Entity["position"] }
  | { kind: "throw-ball"; dirX: number; dirY: number; force: number }
  | { kind: "vehicle-horn"; active: boolean }
  | { kind: "vehicle-emergency"; action: "toggle" | "style" }
  | { kind: "enter-vehicle"; entityId: number; seat?: 0 | 1 }
  | { kind: "exit-vehicle"; seat?: 0 | 1 }
  | { kind: "recover-vehicle"; entityId: number; seat?: 0 | 1 }
  | { kind: "view-range"; range: ChunkRange }
  | { kind: "teleport"; position: Entity["position"]; z?: number };
export type ScenarioRequest = { id: number } & (
  | { kind: "open"; recipe: ScenarioRecipe; mode?: "manual" | "realtime" }
  | { kind: "clock"; running: boolean }
  | { kind: "step"; input: Movement; range?: ChunkRange }
  | { kind: "command"; command: ScenarioCommand }
  | { kind: "reload" }
  | { kind: "diagnostics"; reset?: boolean }
  | { kind: "reset" }
  | { kind: "close" }
);
export type ScenarioResponse = {
  physicsDiagnostics?: {
    timings: import("../diagnostics/PerformanceMetrics.js").PerformanceSnapshot;
    collision: import("../server/Realm.js").Realm["collisionDiagnostics"];
  };
  id: number;
  frames: ArrayBuffer[];
  guestFrames?: ArrayBuffer[];
  handles: Record<string, number>;
  error?: string;
  clock?: { mode: "manual" | "realtime"; running: boolean; ticks: number };
};

/** Production channel transfers/counts every binary packet, including snapshots
 * delivered independently of a client request. The response fences its frames. */
export type ScenarioPacket = { buffer?: ArrayBuffer } & (
  | { type: "request"; request: ScenarioRequest }
  | { type: "input"; buffer: ArrayBuffer; range?: ChunkRange; seat?: 0 | 1 }
  | { type: "reset" }
  | { type: "frame"; buffer: ArrayBuffer; seat?: 0 | 1 }
  | { type: "response"; response: Omit<ScenarioResponse, "frames" | "guestFrames"> }
);
