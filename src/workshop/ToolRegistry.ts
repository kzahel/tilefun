import type { ReviewBatch, WorkshopTool } from "./WorkshopTypes.js";

export const WORKSHOP_TOOLS: WorkshopTool[] = [
  {
    id: "art",
    name: "Source art",
    description:
      "All source sheets, named slices and recorded uses. Select tiles and leave requests.",
    url: "art-workbench.html",
    mode: "source",
  },
  {
    id: "buildings",
    name: "Buildings",
    description: "Apartment, hotel and shop recipes, plus assembled frontage blocks.",
    url: "building-lab.html",
    mode: "review",
  },
  {
    id: "roads",
    name: "Roads & sidewalks",
    description:
      "Approved road foundation plus new curved curbs, refuge crossings and parking bays in the Road geometry batch.",
    url: "building-lab.html?run=surfaces",
    mode: "review",
  },
  {
    id: "districts",
    name: "Dense neighborhoods",
    description:
      "Real generated streets, buildings, pocket green and walking routes. Explore and play the same world.",
    url: "building-lab.html?run=districts",
    mode: "review",
  },
  {
    id: "streets",
    name: "Street furniture",
    description: "Meters, lamps, bins, seating, parking and a furnished sidewalk.",
    url: "building-lab.html?run=streets",
    mode: "review",
  },
  {
    id: "rooms",
    name: "Rooms & apartments",
    description:
      "Architecture, doorway joins, profiles and generated counterexamples. Exact render review with pins.",
    url: "interior-review.html",
    mode: "review",
  },
  {
    id: "motion",
    name: "Furniture movement",
    description:
      "Walk, jump and adjust placement and collision. Reviews apply to the exact scene settings.",
    url: "furniture-playtest.html",
    mode: "adapter",
  },
  {
    id: "indoor",
    name: "Room editor",
    description:
      "Edit semantic fixtures and atlas overrides. Browser-local documents with JSON export/import.",
    url: "interior-workbench.html",
    mode: "adapter",
  },
  {
    id: "explorer",
    name: "World explorer",
    description:
      "Choose generation and seed, inspect real tiles, and play here. Explorer judgments remain browser-local.",
    url: "world-explorer.html",
    mode: "adapter",
  },
  {
    id: "autotiles",
    name: "Terrain reference",
    description: "Compare the 26 Modern Exteriors terrain strips and transitions.",
    url: "assets/tilesets/me-autotile-viewer.html",
    mode: "adapter",
  },
  {
    id: "props",
    name: "Exterior catalogue",
    description: "Find named exterior sprites in the game editor.",
    url: "./?panel=props",
    mode: "link",
  },
  {
    id: "interiors",
    name: "Interior catalogue",
    description: "Browse furniture, room-builder tiles and layered home designs.",
    url: "./?panel=interiors",
    mode: "link",
  },
  {
    id: "tiger",
    name: "Tiger walk demo",
    description: "Compare Blender renders with authored pixel sprites and walk in four directions.",
    url: "demos/blender-tiger/",
    mode: "adapter",
  },
  {
    id: "characters",
    name: "Pixel characters",
    description: "Inspect the animated character roster and native pixel sizes.",
    url: "demos/pixel-characters/",
    mode: "adapter",
  },
];
export const CITY_BATCHES: ReviewBatch[] = [
  {
    id: "roads-geometry",
    name: "Road geometry",
    description:
      "Four new cases: curved curbs, pedestrian refuge, crossing approaches and parking bays.",
    toolId: "roads",
  },
  {
    id: "buildings",
    name: "Building recipes & blocks",
    description: "Existing apartment, hotel and storefront candidates.",
    toolId: "buildings",
  },
  {
    id: "roads",
    name: "Road foundation",
    description: "Nine source-backed streets, intersections and divider scenes.",
    toolId: "roads",
  },
  {
    id: "districts",
    name: "First dense neighborhood",
    description: "Three views of a regional-v5 neighborhood with connected door approaches.",
    toolId: "districts",
  },
  {
    id: "streets",
    name: "Street starter palette",
    description: "Six focused prop and placement scenes.",
    toolId: "streets",
  },
];
export function workshopHref(tool: string, query = ""): string {
  return `/tilefun/workshop.html#/tool/${encodeURIComponent(tool)}${query ? `?${query.replace(/^\?/, "")}` : ""}`;
}

export function reviewToolOwnsBatch(
  tool: string,
  batch: string,
  batches: readonly ReviewBatch[] = CITY_BATCHES,
) {
  return tool === "rooms"
    ? batch.startsWith("rooms-")
    : batch === tool || batches.some((b) => b.id === batch && b.toolId === tool);
}
