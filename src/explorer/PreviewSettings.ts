import {
  createDescriptor,
  type GenerationDescriptor,
  resolveDescriptor,
} from "../generation/GenerationDescriptor.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { locationUrl, type Overlays, parseLocation, type ViewState } from "./ViewState.js";

export interface PreviewSettings {
  mode: "auto" | "map" | "tiles" | "coverage";
  detailZoom: number;
  radius: number;
  sampleBudget: number;
}
export const DEFAULT_PREVIEW: PreviewSettings = {
  mode: "auto",
  detailZoom: 12,
  radius: 2,
  sampleBudget: 24576,
};
export function validatePreview(value: PreviewSettings): PreviewSettings {
  if (
    !["auto", "map", "tiles", "coverage"].includes(value.mode) ||
    !Number.isFinite(value.detailZoom) ||
    value.detailZoom < 2 ||
    value.detailZoom > 32 ||
    !Number.isInteger(value.radius) ||
    value.radius < 1 ||
    value.radius > 3 ||
    !Number.isInteger(value.sampleBudget) ||
    value.sampleBudget < 1024 ||
    value.sampleBudget > 24576
  )
    throw new Error("Unsupported preview settings.");
  return { ...value };
}
export function explorerUrl(
  base: string,
  generation: GenerationDescriptor,
  view: ViewState,
  overlays: Overlays,
  preview: PreviewSettings,
): string {
  const url = new URL(
    locationUrl(
      base,
      regionalWorld(generation.type === "regional" ? generation.seed : 2026),
      view,
      overlays,
    ),
  );
  url.searchParams.set("generation", JSON.stringify(resolveDescriptor(generation)));
  url.searchParams.set("mode", preview.mode);
  url.searchParams.set("detailZoom", String(preview.detailZoom));
  url.searchParams.set("radius", String(preview.radius));
  url.searchParams.set("budget", String(preview.sampleBudget));
  return url.href;
}
export function parseExplorerLocation(base: string): {
  generation: GenerationDescriptor;
  view: ViewState;
  overlays: Overlays;
  preview: PreviewSettings;
} {
  const url = new URL(base);
  const serialized = url.searchParams.get("generation");
  const generation = serialized ? resolveDescriptor(JSON.parse(serialized)) : null;
  if (generation) {
    // Old query identity is an alias only; the complete descriptor is authoritative.
    url.searchParams.set("seed", "2026");
    url.searchParams.set("version", "regional-v1");
    url.searchParams.set("profile", "temperate-v1");
  }
  const old = parseLocation(url.href);
  const preview = validatePreview({
    mode: (url.searchParams.get("mode") ?? DEFAULT_PREVIEW.mode) as PreviewSettings["mode"],
    detailZoom: Number(url.searchParams.get("detailZoom") ?? DEFAULT_PREVIEW.detailZoom),
    radius: Number(url.searchParams.get("radius") ?? DEFAULT_PREVIEW.radius),
    sampleBudget: Number(url.searchParams.get("budget") ?? DEFAULT_PREVIEW.sampleBudget),
  });
  return {
    generation: generation ?? createDescriptor("regional", old.world.seed),
    view: old.view,
    overlays: old.overlays,
    preview,
  };
}
