import { afterEach, expect, it, vi } from "vitest";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { World } from "../world/World.js";
import type { WorkerRequest, WorkerResponse } from "./workerProtocol.js";

afterEach(() => vi.unstubAllGlobals());
it.each(["classic", "island", "flat", "regional"] as const)(
  "the production explorer query handler emits all six exact %s buffers",
  async (choice) => {
    vi.resetModules();
    vi.stubGlobal("onmessage", null);
    let receive: (value: {
      message: WorkerResponse;
      transfer: Transferable[] | undefined;
    }) => void = () => {};
    const result = new Promise<{ message: WorkerResponse; transfer: Transferable[] | undefined }>(
      (resolve) => {
        receive = resolve;
      },
    );
    vi.stubGlobal("postMessage", (message: WorkerResponse, transfer?: Transferable[]) =>
      receive({ message, transfer }),
    );
    await import("./regional.worker.js");
    const generation = createDescriptor(choice, 2026);
    (globalThis as unknown as { onmessage: (event: { data: WorkerRequest }) => void }).onmessage({
      data: {
        type: "query",
        id: 1,
        world: generation,
        request: {
          bounds: { minX: -16, minY: 32, maxX: 0, maxY: 48 },
          detail: "region",
          sampleStep: 4,
          limits: { maxSamples: 24576, maxOwners: 144, maxFeatures: 432 },
        },
        exact: [{ cx: -1, cy: 2 }],
      },
    });
    const { message, transfer } = await result;
    expect(message.type).toBe("result");
    if (message.type !== "result") throw new Error(JSON.stringify(message));
    expect(message.id).toBe(1);
    expect(message.chunks).toHaveLength(1);
    const expected = new World(createGenerator(generation).terrain).getChunk(-1, 2);
    for (const field of [
      "subgrid",
      "terrain",
      "detail",
      "collision",
      "roadGrid",
      "heightGrid",
    ] as const) {
      const actual = message.chunks[0]?.data[field];
      expect(actual).toEqual(expected[field]);
      expect(transfer).toContain(actual?.buffer);
    }
  },
);
