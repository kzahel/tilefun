import { createGenerator } from "../generation/Generator.js";
import { normalizeGeneration, overviewSteps } from "../generation/Overview.js";
import { Chunk } from "../world/Chunk.js";
import { chunkData, chunkDataTransfers } from "../world/ChunkData.js";
import type { WorkerRequest, WorkerResponse } from "./workerProtocol.js";

const port = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
};
let active: { id: number; cancelled: boolean } | null = null;

async function run(message: Extract<WorkerRequest, { type: "query" }>): Promise<void> {
  const job = { id: message.id, cancelled: false };
  active = job;
  const start = performance.now();
  let computeMs = 0;
  try {
    const query = overviewSteps(message.world, message.request);
    while (!job.cancelled) {
      const sliceStart = performance.now();
      let step = query.next();
      while (!step.done && performance.now() - sliceStart < 4) step = query.next();
      computeMs += performance.now() - sliceStart;
      if (step.done) {
        const result = step.value;
        const chunks: Extract<WorkerResponse, { type: "result" }>["chunks"] = [];
        let terrainMs = 0;
        if (message.exact?.length) {
          if (
            message.exact.length > 81 ||
            message.exact.some(
              (c) =>
                !Number.isInteger(c.cx) ||
                !Number.isInteger(c.cy) ||
                Math.abs(c.cx) > 2 ** 19 ||
                Math.abs(c.cy) > 2 ** 19,
            )
          )
            throw new Error("Exact query exceeds supported chunk bounds.");
          const generator = createGenerator(normalizeGeneration(message.world));
          for (const coordinate of message.exact) {
            if (job.cancelled) break;
            const terrainStart = performance.now();
            const chunk = new Chunk();
            generator.terrain.generate(chunk, coordinate.cx, coordinate.cy);
            chunks.push({ ...coordinate, data: chunkData(chunk) });
            terrainMs += performance.now() - terrainStart;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
        }
        if (job.cancelled) {
          port.postMessage({ type: "cancelled", id: message.id });
          return;
        }
        port.postMessage(
          {
            type: "result",
            id: message.id,
            result,
            chunks,
            terrainMs,
            computeMs,
            elapsedMs: performance.now() - start,
            finishedAt: performance.timeOrigin + performance.now(),
          },
          [
            result.elevation.buffer,
            result.moisture.buffer,
            result.cover.buffer,
            ...chunks.flatMap((c) => chunkDataTransfers(c.data)),
          ],
        );
        return;
      }
      // Give cancellation messages an opportunity to run, even during a long query.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    port.postMessage({ type: "cancelled", id: message.id });
  } catch (error) {
    port.postMessage({
      type: "error",
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (active === job) active = null;
  }
}

port.onmessage = ({ data }) => {
  if (data.type === "cancel") {
    if (active?.id === data.id) active.cancelled = true;
  } else if (!active) {
    void run(data);
  } else {
    port.postMessage({
      type: "error",
      id: data.id,
      message: "Only one active regional query is allowed.",
    });
  }
};
