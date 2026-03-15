import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import {
  edgeHash,
  getElevation,
  isHSegmentActive,
  isVSegmentActive,
  type RoadGenParams,
} from "./RoadGenerator.js";

/** Seed offset so structure hashing is independent of road hashing. */
const STRUCTURE_SEED_OFFSET = 54321;
/** Probability that a qualifying intersection gets a settlement. */
const SETTLEMENT_PROBABILITY = 0.5;
/** Tiles of clearance from the road+sidewalk edge to the building anchor. */
const BUILDING_ROAD_CLEARANCE = 2;
/** Minimum elevation for structure placement (no water). */
const MIN_STRUCTURE_ELEVATION = 0.05;
/** Street furniture placed every N tiles along road edges. */
const FURNITURE_INTERVAL = 10;
/** Max street furniture items per road segment. */
const MAX_FURNITURE_PER_SEGMENT = 3;

// ── Settlement templates ──────────────────────────────────────────────────

interface SettlementProp {
  propType: string;
  /** Offset in world pixels from settlement anchor. */
  dx: number;
  dy: number;
}

interface SettlementTemplate {
  name: string;
  props: SettlementProp[];
  /** Footprint in world pixels (for spacing checks). */
  footprintW: number;
  footprintH: number;
}

/** Result: a concrete prop to place in the world. */
export interface StructurePlacement {
  propType: string;
  wx: number;
  wy: number;
}

// ── Building templates ────────────────────────────────────────────────────

const RESIDENTIAL_TEMPLATES: SettlementTemplate[] = [
  {
    name: "terraced-1",
    props: [
      { propType: "prop-terraced-house-1", dx: 0, dy: 0 },
      { propType: "prop-street-lamp", dx: -112, dy: 80 },
      { propType: "prop-mailbox", dx: 112, dy: 72 },
    ],
    footprintW: 256,
    footprintH: 280,
  },
  {
    name: "terraced-2",
    props: [
      { propType: "prop-terraced-house-2", dx: 0, dy: 0 },
      { propType: "prop-bench", dx: -104, dy: 80 },
      { propType: "prop-street-lamp", dx: 112, dy: 80 },
    ],
    footprintW: 256,
    footprintH: 280,
  },
  {
    name: "terraced-3",
    props: [
      { propType: "prop-terraced-house-3", dx: 0, dy: 0 },
      { propType: "prop-fire-hydrant", dx: -112, dy: 96 },
    ],
    footprintW: 256,
    footprintH: 296,
  },
  {
    name: "terraced-4",
    props: [
      { propType: "prop-terraced-house-4", dx: 0, dy: 0 },
      { propType: "prop-mailbox", dx: -104, dy: 72 },
      { propType: "prop-bench", dx: 100, dy: 80 },
    ],
    footprintW: 256,
    footprintH: 280,
  },
  {
    name: "terraced-5",
    props: [
      { propType: "prop-terraced-house-5", dx: 0, dy: 0 },
      { propType: "prop-street-lamp", dx: -112, dy: 80 },
    ],
    footprintW: 256,
    footprintH: 280,
  },
  {
    name: "terraced-6",
    props: [
      { propType: "prop-terraced-house-6", dx: 0, dy: 0 },
      { propType: "prop-bench", dx: 100, dy: 80 },
      { propType: "prop-fire-hydrant", dx: -100, dy: 80 },
    ],
    footprintW: 256,
    footprintH: 280,
  },
  {
    name: "country-house",
    props: [
      { propType: "prop-country-house", dx: 0, dy: 0 },
      { propType: "prop-oak-tree", dx: -180, dy: 20 },
      { propType: "prop-mailbox", dx: 160, dy: 80 },
    ],
    footprintW: 400,
    footprintH: 300,
  },
  {
    name: "japanese-house",
    props: [
      { propType: "prop-japanese-house", dx: 0, dy: 0 },
      { propType: "prop-street-lamp", dx: -140, dy: 60 },
    ],
    footprintW: 320,
    footprintH: 260,
  },
];

const PARK_TEMPLATES: SettlementTemplate[] = [
  {
    name: "fountain-park",
    props: [
      { propType: "prop-garden-fountain", dx: 0, dy: 0 },
      { propType: "prop-bench", dx: -48, dy: 64 },
      { propType: "prop-bench", dx: 48, dy: 64 },
      { propType: "prop-street-lamp", dx: -64, dy: -32 },
      { propType: "prop-street-lamp", dx: 64, dy: -32 },
    ],
    footprintW: 180,
    footprintH: 200,
  },
  {
    name: "picnic-area",
    props: [
      { propType: "prop-picnic-table", dx: 0, dy: 0 },
      { propType: "prop-bench", dx: -56, dy: 0 },
      { propType: "prop-oak-tree", dx: 48, dy: -48 },
    ],
    footprintW: 160,
    footprintH: 140,
  },
];

const CAMP_TEMPLATES: SettlementTemplate[] = [
  {
    name: "campsite-blue",
    props: [
      { propType: "prop-tent-blue", dx: 0, dy: 0 },
      { propType: "prop-picnic-table", dx: 80, dy: 16 },
      { propType: "prop-flower-red", dx: -56, dy: 32 },
    ],
    footprintW: 200,
    footprintH: 120,
  },
  {
    name: "campsite-green",
    props: [
      { propType: "prop-tent-green", dx: 0, dy: 0 },
      { propType: "prop-picnic-table", dx: -80, dy: 16 },
      { propType: "prop-oak-tree", dx: 64, dy: -40 },
    ],
    footprintW: 200,
    footprintH: 120,
  },
];

const ALL_TEMPLATES = [...RESIDENTIAL_TEMPLATES, ...PARK_TEMPLATES, ...CAMP_TEMPLATES];

/** Street furniture types placed along road edges. */
const STREET_FURNITURE: string[] = [
  "prop-street-lamp",
  "prop-bench",
  "prop-street-lamp",
  "prop-fire-hydrant",
  "prop-street-lamp",
  "prop-mailbox",
];

// ── Placement algorithm ───────────────────────────────────────────────────

/**
 * Count how many road segments connect at intersection (gx, gy).
 * Returns 0–4 (N, S, E, W segments).
 */
function countIntersectionSegments(
  gx: number,
  gy: number,
  seed: number,
  params: RoadGenParams,
  islandRadius: number,
): number {
  let count = 0;
  // East: horizontal segment starting at this intersection
  if (isHSegmentActive(gx, gy, seed, params, islandRadius)) count++;
  // West: horizontal segment ending at this intersection
  if (isHSegmentActive(gx - 1, gy, seed, params, islandRadius)) count++;
  // South: vertical segment starting at this intersection
  if (isVSegmentActive(gx, gy, seed, params, islandRadius)) count++;
  // North: vertical segment ending at this intersection
  if (isVSegmentActive(gx, gy - 1, seed, params, islandRadius)) count++;
  return count;
}

/**
 * Generate settlement props for a single road intersection.
 * Pure function — deterministic from inputs.
 */
function generateSettlement(
  gx: number,
  gy: number,
  seed: number,
  params: RoadGenParams,
  islandRadius: number,
): StructurePlacement[] {
  const segments = countIntersectionSegments(gx, gy, seed, params, islandRadius);
  if (segments < 2) return [];

  const sseed = seed + STRUCTURE_SEED_OFFSET;
  if (edgeHash(gx, gy, sseed) >= SETTLEMENT_PROBABILITY) return [];

  // Pick corner (NE=0, NW=1, SE=2, SW=3)
  const cornerIdx = Math.floor(edgeHash(gx, gy, sseed + 3) * 4);
  const dirX = cornerIdx & 1 ? -1 : 1;
  const dirY = cornerIdx & 2 ? 1 : -1;

  // Pick template
  const templateIdx = Math.floor(edgeHash(gx, gy, sseed + 1) * ALL_TEMPLATES.length);
  const template = ALL_TEMPLATES[templateIdx];
  if (!template) return [];

  // Compute anchor position: offset from intersection center into the chosen corner
  const roadHalfWidth =
    (params.width / 2 + params.sidewalkWidth + BUILDING_ROAD_CLEARANCE) * TILE_SIZE;
  const intersectionTx = gx * params.spacing;
  const intersectionTy = gy * params.spacing;
  const anchorWx = intersectionTx * TILE_SIZE + dirX * (roadHalfWidth + template.footprintW / 2);
  const anchorWy = intersectionTy * TILE_SIZE + dirY * (roadHalfWidth + template.footprintH / 2);

  // Elevation check at anchor
  const anchorTx = Math.floor(anchorWx / TILE_SIZE);
  const anchorTy = Math.floor(anchorWy / TILE_SIZE);
  if (getElevation(anchorTx, anchorTy, seed, islandRadius) < MIN_STRUCTURE_ELEVATION) return [];

  // Place all template props at the anchor
  const placements: StructurePlacement[] = [];
  for (const p of template.props) {
    placements.push({
      propType: p.propType,
      wx: anchorWx + p.dx,
      wy: anchorWy + p.dy,
    });
  }
  return placements;
}

/**
 * Generate street furniture along a single road segment.
 * Furniture is placed on the sidewalk edge at regular intervals.
 */
function generateSegmentFurniture(
  startTx: number,
  startTy: number,
  horizontal: boolean,
  segmentLength: number,
  seed: number,
  params: RoadGenParams,
  gx: number,
  gy: number,
): StructurePlacement[] {
  const fseed = seed + STRUCTURE_SEED_OFFSET + 100;
  // Only some segments get furniture
  if (edgeHash(gx, gy, fseed) > 0.4) return [];

  const placements: StructurePlacement[] = [];
  const offset = (params.width / 2 + params.sidewalkWidth + 1) * TILE_SIZE;
  // Which side of the road to place on (deterministic)
  const side = edgeHash(gx, gy, fseed + 1) < 0.5 ? 1 : -1;
  let placed = 0;

  for (
    let t = FURNITURE_INTERVAL;
    t < segmentLength && placed < MAX_FURNITURE_PER_SEGMENT;
    t += FURNITURE_INTERVAL
  ) {
    const furnitureIdx = Math.floor(
      edgeHash(gx * 100 + t, gy, fseed + 2) * STREET_FURNITURE.length,
    );
    const propType = STREET_FURNITURE[furnitureIdx];
    if (!propType) continue;

    let wx: number;
    let wy: number;
    if (horizontal) {
      wx = (startTx + t) * TILE_SIZE;
      wy = startTy * TILE_SIZE + side * offset;
    } else {
      wx = startTx * TILE_SIZE + side * offset;
      wy = (startTy + t) * TILE_SIZE;
    }
    placements.push({ propType, wx, wy });
    placed++;
  }
  return placements;
}

/**
 * Generate all structures for a chunk area.
 * Finds nearby road intersections and road segments, then generates settlements
 * and street furniture. Pure and deterministic.
 *
 * Returns intersection keys that were processed (for tracking) and prop placements.
 */
export function generateStructuresForChunk(
  cx: number,
  cy: number,
  seed: number,
  params: RoadGenParams,
  islandRadius: number,
  processedIntersections: ReadonlySet<string>,
): { placements: StructurePlacement[]; newIntersectionKeys: string[] } {
  const placements: StructurePlacement[] = [];
  const newKeys: string[] = [];

  const { spacing } = params;

  // Find grid intersections near this chunk (with generous margin)
  const baseTx = cx * CHUNK_SIZE;
  const baseTy = cy * CHUNK_SIZE;
  const margin = spacing; // check one full grid cell beyond chunk
  const minGx = Math.floor((baseTx - margin) / spacing);
  const maxGx = Math.ceil((baseTx + CHUNK_SIZE + margin) / spacing);
  const minGy = Math.floor((baseTy - margin) / spacing);
  const maxGy = Math.ceil((baseTy + CHUNK_SIZE + margin) / spacing);

  // Settlements at intersections
  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const key = `si:${gx},${gy}`;
      if (processedIntersections.has(key)) continue;
      newKeys.push(key);
      const settlement = generateSettlement(gx, gy, seed, params, islandRadius);
      placements.push(...settlement);
    }
  }

  // Street furniture along road segments near this chunk
  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const segKey = `sf:${gx},${gy}`;
      if (processedIntersections.has(segKey)) continue;
      newKeys.push(segKey);

      // Horizontal segment
      if (isHSegmentActive(gx, gy, seed, params, islandRadius)) {
        const furniture = generateSegmentFurniture(
          gx * spacing,
          gy * spacing,
          true,
          spacing,
          seed,
          params,
          gx,
          gy,
        );
        placements.push(...furniture);
      }

      // Vertical segment
      if (isVSegmentActive(gx, gy, seed, params, islandRadius)) {
        const furniture = generateSegmentFurniture(
          gx * spacing,
          gy * spacing,
          false,
          spacing,
          seed,
          params,
          gx * 1000 + 1,
          gy,
        );
        placements.push(...furniture);
      }
    }
  }

  return { placements, newIntersectionKeys: newKeys };
}
