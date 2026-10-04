import type { ActionName } from "../input/ActionMap.js";
import type { TerrainPreparationOptions } from "./RenderFrame.js";
import type { TerrainDrawOptions } from "./TerrainFrame.js";

/** Shared by keyboard, controls and benchmark workloads. Keep existing 1–4 bindings. */
export const ZOOM_PRESETS = [
  { key: "0", action: "zoom_0", zoom: 0.1, label: "Overview · 0.1×" },
  { key: "1", action: "zoom_1", zoom: 0.25, label: "Wide · ¼×" },
  { key: "2", action: "zoom_2", zoom: 0.5, label: "Half · ½×" },
  { key: "3", action: "zoom_3", zoom: 1, label: "Normal · 1×" },
  { key: "4", action: "zoom_4", zoom: 2, label: "Close · 2×" },
] as const satisfies readonly { key: string; action: ActionName; zoom: number; label: string }[];

export type TerrainPacing = "throughput" | "responsive";
export const TERRAIN_PACING: Record<
  TerrainPacing,
  {
    readonly label: string;
    readonly hint: string;
    readonly preparation: TerrainPreparationOptions;
    readonly drawing: TerrainDrawOptions;
  }
> = {
  throughput: {
    label: "Faster fill (default)",
    hint: "Fills terrain sooner; larger bursts of work.",
    preparation: { timeBudgetMs: 2, rowBudget: 128 },
    drawing: {},
  },
  responsive: {
    label: "Small batches (experimental)",
    hint: "Terrain can appear later while you move or zoom out.",
    preparation: { timeBudgetMs: 2, rowBudget: 2 },
    // Keep old complete imagery; don't repeatedly upload partial chunks.
    drawing: { readyOnly: true },
  },
};
