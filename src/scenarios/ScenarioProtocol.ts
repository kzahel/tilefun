import type { Entity } from "../entities/Entity.js";
import type { Movement } from "../input/ActionManager.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";
export type ScenarioCommand =
  | { kind: "teleport"; position: Entity["position"]; z?: number }
  | { kind: "traffic-position"; roof: boolean }
  | { kind: "traffic-settings"; speed?: number; gap?: number };
export type ScenarioRequest = { id: number } & (
  | { kind: "open"; recipe: ScenarioRecipe }
  | { kind: "step"; input: Movement; dt: number; range?: ChunkRange }
  | { kind: "command"; command: ScenarioCommand }
  | { kind: "reload" }
  | { kind: "close" }
);
export type ScenarioResponse = {
  id: number;
  frames: ArrayBuffer[];
  handles: Record<string, number>;
  error?: string;
};
