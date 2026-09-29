import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { OverviewResult } from "../generation/Overview.js";
import type { Bounds, RegionalRequest } from "../generation/regional/RegionalPlanner.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";
import type { StructurePlacement } from "../generation/StructureGenerator.js";
import type { InspectionSnapshot } from "../persistence/WorldInspection.js";
import type { ChunkData } from "../world/ChunkData.js";

export type WorkerRequest =
  | {
      type: "query";
      id: number;
      world: RegionalWorld | GenerationDescriptor;
      request: RegionalRequest;
      exact?: { cx: number; cy: number }[];
      footprint?: Bounds;
      snapshot?: InspectionSnapshot;
    }
  | { type: "cancel"; id: number };

export type WorkerResponse =
  | {
      type: "result";
      id: number;
      result: OverviewResult;
      chunks: { cx: number; cy: number; data: ChunkData }[];
      terrainMs: number;
      placements: StructurePlacement[];
      computeMs: number;
      elapsedMs: number;
      finishedAt: number;
    }
  | { type: "cancelled"; id: number }
  | { type: "error"; id: number; message: string };
