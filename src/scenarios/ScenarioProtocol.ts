import type { Entity } from "../entities/Entity.js";
import type { Movement } from "../input/ActionManager.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";
export type ScenarioCommand =
  | { kind: "enter-vehicle"; entityId: number }
  | { kind: "exit-vehicle" }
  | { kind: "view-range"; range: ChunkRange }
  | { kind: "teleport"; position: Entity["position"]; z?: number }
  | { kind: "traffic-position"; roof: boolean }
  | { kind: "train-position"; roof: boolean; carriage?: number }
  | { kind: "traffic-settings"; speed?: number; gap?: number };
export type ScenarioRequest = { id: number } & (
  | { kind: "open"; recipe: ScenarioRecipe; mode?: "manual" | "realtime" }
  | { kind: "clock"; running: boolean }
  | { kind: "step"; input: Movement; dt: number; range?: ChunkRange }
  | { kind: "command"; command: ScenarioCommand }
  | { kind: "reload" }
  | { kind: "reset" }
  | { kind: "close" }
);
export type ScenarioResponse = {
  id: number;
  frames: ArrayBuffer[];
  handles: Record<string, number>;
  traffic?: { speed: number; waiting: string; count: number };
  error?: string;
  clock?: { mode: "manual" | "realtime"; running: boolean; ticks: number };
};

/** Production channel transfers/counts every binary packet, including snapshots
 * delivered independently of a client request. The response fences its frames. */
export type ScenarioPacket = { buffer?: ArrayBuffer } & (
  | { type: "request"; request: ScenarioRequest }
  | { type: "input"; buffer: ArrayBuffer; range?: ChunkRange }
  | { type: "reset" }
  | { type: "frame"; buffer: ArrayBuffer }
  | { type: "response"; response: Omit<ScenarioResponse, "frames"> }
);
