import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { OverviewResult } from "../generation/Overview.js";
import type { RegionalRequest } from "../generation/regional/RegionalPlanner.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";
import type { ChunkData } from "../world/ChunkData.js";

export type WorkerRequest =
  | {
      type: "query";
      id: number;
      world: RegionalWorld | GenerationDescriptor;
      request: RegionalRequest;
      exact?: { cx: number; cy: number }[];
    }
  | { type: "cancel"; id: number };

export type WorkerResponse =
  | {
      type: "result";
      id: number;
      result: OverviewResult;
      chunks: { cx: number; cy: number; data: ChunkData }[];
      terrainMs: number;
      computeMs: number;
      elapsedMs: number;
      finishedAt: number;
    }
  | { type: "cancelled"; id: number }
  | { type: "error"; id: number; message: string };
