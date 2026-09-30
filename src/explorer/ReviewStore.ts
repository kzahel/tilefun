import { descriptorKey, type GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";
import type { PreviewSettings } from "./PreviewSettings.js";
import type { Overlays, ViewState, visibleBounds } from "./ViewState.js";

export interface ReviewRecord {
  generation?: GenerationDescriptor;
  preview?: PreviewSettings;
  caseId: string;
  world: RegionalWorld;
  view: ViewState;
  bounds: ReturnType<typeof visibleBounds>;
  detail: string;
  overlays: Overlays;
  featureId: string | null;
  verdict: "approved" | "reported";
  note: string;
  location: string;
  createdAt: string;
}
interface ReviewIdentity {
  generation: GenerationDescriptor;
  world: RegionalWorld;
  preview: PreviewSettings;
  view: ViewState;
}

const REVIEW_KEY = "tilefun:regional-review:v1";

export function reviewKey(
  caseId: string,
  { generation, world, preview, view }: ReviewIdentity,
): string {
  return generation.type === "regional" &&
    generation.version === "regional-v1" &&
    preview.mode === "auto" &&
    view.zoom < preview.detailZoom
    ? `${world.generatorVersion}:${world.profile}:${world.seed}:${caseId}`
    : `${descriptorKey(generation)}:${preview.mode}:${preview.detailZoom}:${preview.radius}:${caseId}`;
}
/** Durable verdicts with a session-only fallback when browser storage is unavailable. */
export class ReviewStore {
  private readonly records: Record<string, ReviewRecord> = {};

  constructor(private readonly storage: () => Pick<Storage, "getItem" | "setItem">) {}

  load(): boolean {
    try {
      const stored: unknown = JSON.parse(this.storage().getItem(REVIEW_KEY) ?? "{}");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        for (const [key, record] of Object.entries(stored)) {
          if (
            record &&
            typeof record === "object" &&
            "world" in record &&
            "caseId" in record &&
            "verdict" in record &&
            record.world
          ) {
            this.records[key] = record as ReviewRecord;
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  get(key: string): ReviewRecord | undefined {
    return this.records[key];
  }

  record(key: string, record: ReviewRecord): boolean {
    this.records[key] = record;
    try {
      this.storage().setItem(REVIEW_KEY, JSON.stringify(this.records));
      return true;
    } catch {
      return false;
    }
  }

  forWorld(generation: GenerationDescriptor, world: RegionalWorld): ReviewRecord[] {
    return Object.values(this.records).filter((record) =>
      record.generation
        ? descriptorKey(record.generation) === descriptorKey(generation)
        : generation.type === "regional" &&
          record.world.seed === world.seed &&
          record.world.generatorVersion === world.generatorVersion &&
          record.world.profile === world.profile,
    );
  }
}
