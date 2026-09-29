import type { RegionalRequest, RegionalResult } from "../generation/regional/RegionalPlanner.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";

export type WorkerRequest =
  | { type: "query"; id: number; world: RegionalWorld; request: RegionalRequest }
  | { type: "cancel"; id: number };

export type WorkerResponse =
  | {
      type: "result";
      id: number;
      result: RegionalResult;
      computeMs: number;
      elapsedMs: number;
      finishedAt: number;
    }
  | { type: "cancelled"; id: number }
  | { type: "error"; id: number; message: string };
