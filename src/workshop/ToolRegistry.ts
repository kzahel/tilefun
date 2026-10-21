import { CITY_REVIEW_RUNS } from "../art/CityReviewRuns.js";
import type { ReviewBatch, WorkshopTool } from "./WorkshopTypes.js";

export const WORKSHOP_TOOLS: WorkshopTool[] = [
  {
    id: "car-transporter",
    name: "Car transporter playground",
    description:
      "Drive a real car up the loading ramp, secure it and carry it with the shared game controls.",
    url: "workshop.html?geometry=transporter#/tool/world-geometry",
    mode: "link",
  },
  {
    id: "towing",
    name: "Tow truck playground",
    description: "Attach, tow and release a real parked car with the shared game controls.",
    url: "workshop.html?geometry=towing#/tool/world-geometry",
    mode: "link",
  },
  {
    id: "truck-bed",
    name: "Truck bed playground",
    description: "Walk and jump inside a dump-truck bed, ride along and inspect clipping geometry.",
    url: "workshop.html?geometry=truck-bed#/tool/world-geometry",
    mode: "link",
  },
  {
    id: "original-vehicles",
    name: "Original vehicle review",
    description:
      "Inspect new vehicle families at game scale, including rotating wheels and fender coverage.",
    url: "demos/original-vehicles/index.html",
    mode: "link",
  },
  {
    id: "vehicle-bake",
    name: "Red coupe low-poly review",
    description:
      "Compare the preferred pixel art with textured low-poly models, budgets and rolling wheels.",
    url: "demos/vehicle-bake/index.html",
    mode: "link",
  },
  {
    id: "vehicle-style-study",
    name: "Sports car style study",
    description: "Compare detailed renders, toon shading, guided pixel finishing and simple paint.",
    url: "demos/vehicle-style-study/index.html",
    mode: "link",
  },
  {
    id: "parking-lab",
    name: "Parking lot lab",
    description:
      "Big shopping-center parking, smaller town lots and long-bay patterns with native tiles and parked cars.",
    url: "workshop.html#/tool/parking-lab",
    mode: "review",
  },
  {
    id: "authored-trains",
    name: "Authored train models",
    description:
      "Inspect the active blue train's retained carriage comparisons, curves, joins and reversal.",
    url: "assets/models/trains/review/blue-v3/",
    mode: "link",
  },
  {
    id: "authored-vehicles",
    name: "Authored vehicle models",
    description:
      "Inspect retained sprite/model comparisons, additional angles and flashing lights for emergency vehicles.",
    url: "assets/models/vehicles/review/",
    mode: "link",
  },
  {
    id: "world-geometry",
    name: "World geometry lab",
    description:
      "Walk a raised deck or descend into an underground garage; inspect shared physics, spaces and cutaway visibility.",
    url: "workshop.html#/tool/world-geometry",
    mode: "source",
  },
  {
    id: "renderer-lab",
    name: "Renderer comparison",
    description:
      "Compare the shared sprite scene on Canvas and GPU, and inspect experimental mesh bodies.",
    url: "renderer-lab.html",
    mode: "source",
  },
  {
    id: "car-projection",
    name: "Car projection lab",
    description:
      "Orbit a car built from sprite artwork and fitted 3D surfaces. Compare the source view and approved collision box.",
    url: "workshop.html#/tool/car-projection",
    mode: "adapter",
  },
  {
    id: "animal-browser",
    name: "Animal browser & AI playground",
    description:
      "Search animals, sort by date, preview their animations and watch real hunting and wildlife behavior.",
    url: "workshop.html?geometry=nature-tiger&landscape=balanced#/tool/world-geometry",
    mode: "link",
  },
  {
    id: "wildlife-v2",
    name: "Wildlife pilots",
    description:
      "Fresh animal drafts with elevated-view guides, scene comparisons and continuous playback.",
    url: "demos/wildlife-v2/",
    mode: "link",
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
    id: "families",
    name: "Asset families",
    description:
      "Large contact sheets of cabinets, trees and scrapyard pieces, with short descriptions and shared notes.",
    url: "workshop.html#/tool/families?family=cabinets",
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
    id: "original-vehicles",
    name: "Original vehicle review",
    description:
      "New vehicle families awaiting owner appearance review before gameplay activation.",
    toolId: "original-vehicles",
  },
  {
    id: "vehicle-bake",
    name: "Red coupe low-poly review",
    description:
      "Actual low-poly GLB style and budget experiments; other vehicle families await owner agreement.",
    toolId: "vehicle-bake",
  },
  {
    id: "vehicle-style-study",
    name: "Sports car style study",
    description:
      "Four original sports-car authoring experiments; offline inspection without promotion.",
    toolId: "vehicle-style-study",
  },
  {
    id: "authored-trains",
    name: "Authored train models",
    description:
      "Exact retained blue carriage and moving-art evidence; reviewed v3 models are active in GPU + meshes.",
    toolId: "authored-trains",
  },
  {
    id: "authored-vehicles",
    name: "Authored vehicle models",
    description:
      "Exact retained model comparisons for owner inspection; production art approval remains pending.",
    toolId: "authored-vehicles",
  },
  {
    id: "world-geometry",
    name: "World geometry proof",
    description: "Schematic engine experiment; no art promotion or approval action.",
    toolId: "world-geometry",
  },
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
  {
    id: "parking-visits",
    name: "Shopping trips & parking",
    description:
      "Playable shopping visits with reserved bays, pedestrians and at most two car maneuvers.",
    toolId: "parking-lab",
  },
  {
    id: "parking-patterns",
    name: "Parking lots & shopping center",
    description: "Three native-tile layout studies with parked-car scale references.",
    toolId: "parking-lab",
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
