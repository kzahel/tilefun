import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { RegionalRequest } from "../generation/regional/RegionalPlanner.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";
import type { WorkerRequest, WorkerResponse } from "./workerProtocol.js";

interface QueryWorker {
  postMessage(message: WorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
}

/** One active job plus one replaceable pending job, regardless of input rate. */
export class QueryClient {
  private serial = 0;
  private wanted = 0;
  private active: Extract<WorkerRequest, { type: "query" }> | null = null;
  private pending: Extract<WorkerRequest, { type: "query" }> | null = null;
  private disposed = false;
  readonly stats = { submitted: 0, cancelled: 0, discarded: 0, completed: 0 };

  constructor(
    private readonly worker: QueryWorker,
    private readonly receive: (response: WorkerResponse) => void,
  ) {
    worker.onmessage = ({ data }) => {
      if (this.disposed || this.active?.id !== data.id) return;
      this.active = null;
      if (data.type === "cancelled") this.stats.cancelled++;
      else if (data.id !== this.wanted) this.stats.discarded++;
      else {
        if (data.type === "result") this.stats.completed++;
        this.receive(data);
      }
      this.dispatch();
    };
  }

  get queued(): number {
    return Number(this.active !== null) + Number(this.pending !== null);
  }

  /** Invalidate immediately on navigation, before the debounced next request. */
  invalidate(): void {
    if (this.disposed) return;
    this.wanted = ++this.serial;
    this.pending = null;
    if (this.active) this.worker.postMessage({ type: "cancel", id: this.active.id });
  }

  submit(
    world: RegionalWorld | GenerationDescriptor,
    request: RegionalRequest,
    exact?: { cx: number; cy: number }[],
  ): void {
    if (this.disposed) return;
    this.invalidate();
    this.pending = { type: "query", id: this.wanted, world, request, ...(exact ? { exact } : {}) };
    this.dispatch();
  }

  private dispatch(): void {
    if (this.disposed || this.active || !this.pending) return;
    this.active = this.pending;
    this.pending = null;
    this.stats.submitted++;
    this.worker.postMessage(this.active);
  }

  dispose(): void {
    this.disposed = true;
    this.active = null;
    this.pending = null;
    this.worker.terminate();
  }
}
