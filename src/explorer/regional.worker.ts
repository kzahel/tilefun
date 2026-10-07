import {
  createPreviewGenerator as createGenerator,
  previewOverviewSteps as overviewSteps,
} from "../art/CityReviewArchive.js";
import { actorPlacements } from "../generation/ActorPlacements.js";
import { deriveTerrain } from "../generation/deriveTerrain.js";
import { descriptorKey } from "../generation/GenerationDescriptor.js";
import { normalizeGeneration } from "../generation/Overview.js";
import type { StructurePlacement } from "../generation/StructureGenerator.js";
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
    if (
      message.snapshot &&
      descriptorKey(message.snapshot.generation) !==
        descriptorKey(normalizeGeneration(message.world))
    )
      throw new Error("Saved world identity differs from the preview.");
    if (message.landscape && message.snapshot)
      throw new Error("Landscape previews cannot overlay saved worlds");
    const query = overviewSteps(message.world, message.request, message.landscape);
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
          const generator = createGenerator(normalizeGeneration(message.world), message.landscape);
          for (const coordinate of message.exact) {
            if (job.cancelled) break;
            const terrainStart = performance.now();
            const chunk = new Chunk();
            generator.terrain.generate(chunk, coordinate.cx, coordinate.cy);
            const saved = message.snapshot?.chunks.find(
              (c) => c.cx === coordinate.cx && c.cy === coordinate.cy,
            );
            if (saved) {
              if (
                saved.subgrid.length !== 1089 ||
                saved.roadGrid.length !== 256 ||
                saved.heightGrid.length !== 256
              )
                throw new Error("Invalid saved chunk buffers.");
              chunk.subgrid.set(saved.subgrid);
              chunk.roadGrid.set(saved.roadGrid);
              chunk.heightGrid.set(saved.heightGrid);
              deriveTerrain(chunk);
            }
            chunks.push({ ...coordinate, data: chunkData(chunk) });
            terrainMs += performance.now() - terrainStart;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
        }
        const placements = new Map<string, StructurePlacement>();
        if (message.footprint) {
          const b = message.footprint;
          if (
            !Object.values(b).every(Number.isFinite) ||
            b.maxX <= b.minX ||
            b.maxY <= b.minY ||
            b.maxX - b.minX > 160 ||
            b.maxY - b.minY > 160
          )
            throw new Error("Exact placement footprint exceeds its cap.");
          const generator = createGenerator(normalizeGeneration(message.world), message.landscape);
          for (let cy = Math.floor(b.minY / 16); cy <= Math.floor(b.maxY / 16); cy++) {
            for (let cx = Math.floor(b.minX / 16); cx <= Math.floor(b.maxX / 16); cx++) {
              for (const p of generator.placements(cx, cy, new Set()).placements) {
                const id = p.featureId ?? `classic:${p.propType}:${p.wx}:${p.wy}`;
                placements.set(id, { ...p, featureId: id });
                if (placements.size > (message.landscape ? 2048 : 512))
                  throw new Error("Exact placement count exceeds its cap.");
              }
            }
            if (job.cancelled) break;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
        }
        const actors = new Map(
          (message.footprint
            ? actorPlacements(
                createGenerator(normalizeGeneration(message.world), message.landscape),
                message.footprint,
              )
            : []
          ).map((a) => [a.featureId, a]),
        );
        for (const id of message.snapshot?.deleted ?? []) actors.delete(id);
        for (const [i, a] of (message.snapshot?.actors ?? []).entries()) {
          const id = a.proceduralId ?? `saved-actor:${i}:${a.type}:${a.wx}:${a.wy}`;
          actors.set(id, { featureId: id, type: a.type, wx: a.wx, wy: a.wy, route: [] });
        }
        for (const id of message.snapshot?.deleted ?? []) placements.delete(id);
        for (const [i, p] of (message.snapshot?.props ?? []).entries()) {
          const id = p.proceduralId ?? `saved:${i}:${p.type}:${p.wx}:${p.wy}`;
          placements.set(id, { featureId: id, propType: p.type, wx: p.wx, wy: p.wy });
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
            placements: [...placements.values()],
            actors: [...actors.values()],
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
