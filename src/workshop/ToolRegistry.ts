import { CITY_REVIEW_RUNS } from "../art/CityReviewRuns.js";
import type { ReviewBatch, WorkshopTool } from "./WorkshopTypes.js";

export const WORKSHOP_TOOLS: WorkshopTool[] = [
  {
    id: "car-projection",
    name: "Car projection lab",
    description:
      "Orbit a car built from sprite artwork and fitted 3D surfaces. Compare the source view and approved collision box.",
    url: "workshop.html#/tool/car-projection",
    mode: "adapter",
  },
  {
    id: "railways",
    name: "Railway previews",
    description:
      "Review rail patterns, five trains in all four directions, station plans and structure studies for railway expansion.",
    url: "workshop.html#/tool/railways",
    mode: "review",
  },
  {
    id: "traffic",
    name: "Traffic playground",
    description:
      "Gentle traffic on generated roads. Test stopping, roof riding, turns and jumping off.",
    url: "workshop.html#/tool/traffic",
    mode: "source",
  },
  {
    id: "character-lab",
    name: "Character lab",
    description:
      "Walk the six new characters. Tune feet, collision bounds, height, depth and animation; save exact review settings.",
    url: "workshop.html#/tool/character-lab",
    mode: "review",
  },
  {
    id: "vehicles",
    name: "Vehicles",
    description:
      "Review cars, buses and service trucks in four directions. Adjust ground bounds, physical height and placement; walk around each proposal.",
    url: "workshop.html#/tool/vehicles",
    mode: "review",
  },
  {
    id: "patterns",
    name: "Pattern studio",
    description:
      "Draw rooms, horizontal fenced trees, terrain and city surfaces on real tiles. Shared semantic rules, gesture previews, history and portable drafts.",
    url: "workshop.html#/tool/patterns",
    mode: "source",
  },
  {
    id: "outdoor",
    name: "Outdoor assets",
    description:
      "Semantic Modern Exteriors families, atlas coverage, editable placement geometry and shared asset review.",
    url: "workshop.html#/tool/outdoor",
    mode: "source",
  },
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
    id: "car-projection",
    name: "Car projection experiment",
    description: "Exploratory 3D proxy; no approval or gameplay promotion.",
    toolId: "car-projection",
  },
  ...[
    { id: "rail-patterns", name: "Railway track patterns" },
    { id: "rail-trains", name: "Trains · directional motion" },
    { id: "rail-plans", name: "Railway stations & route plans" },
    { id: "rail-structures", name: "Railway bridge & tunnel studies" },
  ].map((b) => ({
    ...b,
    description:
      "Isolated railway studies. The first horizontal blue-train service is now in current regional worlds.",
    toolId: "railways",
  })),
  {
    id: "character-lab",
    name: "Character movement & geometry",
    description:
      "Six authored 32px character proposals. Validate motion, alignment and physical geometry before gameplay integration.",
    toolId: "character-lab",
  },
  {
    id: "vehicles",
    name: "Vehicle geometry",
    description:
      "180 directional sprite and geometry proposals across 45 vehicle sets and equipment states.",
    toolId: "vehicles",
  },
  {
    id: "patterns",
    name: "Fenced tree pattern kit",
    description:
      "Five source-backed cap/repeat, erase/split and independent-row cases. Candidate art and ground footprint shared with the game brush.",
    toolId: "patterns",
  },
  ...Object.entries(CITY_REVIEW_RUNS).map(([id, r]) => ({
    id,
    name: r.name,
    description: `One ${r.version} neighborhood, with zoom shortcuts and location notes. Shared with the explorer and game.`,
    toolId: "districts",
  })),
  {
    id: "commercial",
    name: "Commercial streets & parking",
    description:
      "One playable regional-v6 neighborhood with shops, crossings and parking. Zoom shortcuts retain earlier crop history.",
    toolId: "districts",
  },
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
    description: "One regional-v5 neighborhood with connected door approaches and zoom shortcuts.",
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
