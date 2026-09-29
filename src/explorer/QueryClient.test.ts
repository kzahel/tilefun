import { expect, it } from "vitest";
import { QUERY_LIMITS, type RegionalRequest } from "../generation/regional/RegionalPlanner.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { QueryClient } from "./QueryClient.js";
import type { WorkerRequest, WorkerResponse } from "./workerProtocol.js";

it("keeps only the latest pending request, rejects stale replies, and reaps the worker", () => {
  const messages: WorkerRequest[] = [];
  const replies: WorkerResponse[] = [];
  let terminated = false;
  const worker = {
    onmessage: null as ((event: MessageEvent<WorkerResponse>) => void) | null,
    postMessage: (message: WorkerRequest) => messages.push(message),
    terminate: () => {
      terminated = true;
    },
  };
  const client = new QueryClient(worker, (reply) => replies.push(reply));
  const request: RegionalRequest = {
    bounds: { minX: -10, minY: -10, maxX: 10, maxY: 10 },
    detail: "region",
    sampleStep: 4,
    limits: QUERY_LIMITS,
  };
  const world = regionalWorld(2026);
  client.submit(world, request);
  const first = messages.find((m) => m.type === "query");
  if (!first) throw new Error("Missing first query");
  for (let i = 0; i < 100; i++) client.submit(regionalWorld(i), request);
  expect(client.queued).toBe(2);
  expect(messages.filter((m) => m.type === "query")).toHaveLength(1);
  worker.onmessage?.({
    data: { type: "error", id: first.id, message: "obsolete" },
  } as MessageEvent<WorkerResponse>);
  expect(replies).toEqual([]);
  expect(client.stats.discarded).toBe(1);
  const latest = messages.filter((m) => m.type === "query").at(-1);
  expect(latest?.type === "query" && latest.world.seed).toBe(99);
  if (!latest) throw new Error("Missing latest query");
  client.invalidate();
  worker.onmessage?.({
    data: { type: "cancelled", id: latest.id },
  } as MessageEvent<WorkerResponse>);
  expect(client.queued).toBe(0);
  expect(client.stats.cancelled).toBe(1);
  client.dispose();
  expect(terminated).toBe(true);
  client.submit(world, request);
  expect(client.queued).toBe(0);
});
