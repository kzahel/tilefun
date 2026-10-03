import audit from "../../../docs/research/vehicle-source-audit.json" with { type: "json" };
import type { ArtRect } from "../../art/ArtCatalog.js";
import {
  type OutdoorAsset,
  type OutdoorMetadata,
  outdoorId,
  parseOutdoorMetadata,
} from "../outdoor/OutdoorCatalog.js";

export const VEHICLE_SOURCE = audit.source;
export const VEHICLE_DIRECTIONS = ["north", "east", "south", "west"] as const;
export type VehicleDirection = (typeof VEHICLE_DIRECTIONS)[number];
export interface VehicleView {
  id: string;
  vehicleId: string;
  name: string;
  direction: VehicleDirection;
  asset: OutdoorAsset;
  sourceRect: ArtRect;
  guidance: string;
}
/** Hand-selected review proposals in native world pixels, never gameplay defaults.
 * Each tuple is side length/depth, end width/length and physical height.
 * These measure ground space independently of image bounds and roof projection. */
const profiles = {
  compact: [56, 20, 24, 44, 24],
  bus: [104, 32, 38, 86, 40],
  car: [72, 24, 40, 56, 28],
  sedan: [72, 24, 26, 54, 24],
  police: [72, 24, 26, 54, 24],
  ambulance: [112, 36, 40, 82, 40],
  garbage: [116, 40, 40, 96, 48],
  fire: [132, 40, 52, 128, 48],
} as const;
function family(id: string): keyof typeof profiles {
  if (id.startsWith("compact-")) return "compact";
  if (id.startsWith("bus-")) return "bus";
  if (id.startsWith("unindexed-sedan-")) return "sedan";
  if (id === "police-car") return "police";
  if (id === "ambulance") return "ambulance";
  if (id.startsWith("garbage-")) return "garbage";
  if (id.startsWith("fire-")) return "fire";
  return "car";
}
function vehicleName(id: string) {
  return id
    .replace("unindexed-sedan-", "Sedan · ")
    .replace("sedan-12", "Car 12 · beige sedan")
    .replace("fire-truck-ladder-1", "Fire truck · stowed ladder")
    .replace("fire-truck-ladder-2", "Fire truck · raised ladder")
    .replaceAll("-", " ")
    .replace(/^./, (s) => s.toUpperCase());
}
export const VEHICLE_VIEWS: VehicleView[] = audit.variants.flatMap((v) =>
  VEHICLE_DIRECTIONS.map((direction) => {
    const frame = v.directions[direction],
      sourceRect = [...frame.rect] as ArtRect;
    // Preserve the original audit; new candidates clip the stray top row only.
    const trim = "preparationIssue" in frame ? 1 : 0;
    const rect: ArtRect = [
      sourceRect[0],
      sourceRect[1] + trim,
      sourceRect[2],
      sourceRect[3] - trim,
    ];
    const side = direction === "east" || direction === "west";
    const [length, depth, endWidth, endLength, height] = profiles[family(v.id)];
    const width = side ? length : endWidth;
    const groundLength = side ? depth : Math.min(endLength, rect[3] - 12);
    const zHeight = v.id === "fire-truck-ladder-2" ? 64 : height;
    const name = vehicleName(v.id);
    const metadata: OutdoorMetadata = {
      name: `${name} · ${direction}`,
      category: "vehicle",
      kind: "prop",
      tags: ["vehicle", family(v.id), "review proposal"],
      settings: ["road"],
      facing: direction,
      anchor: [
        rect[2] / 2,
        Math.min(
          rect[3],
          (frame.visualBounds[1] ?? 0) + (frame.visualBounds[3] ?? rect[3]) - trim - 3,
        ),
      ],
      footprint: [-width / 2, -groundLength, width, groundLength],
      colliders: [{ offsetX: 0, offsetY: 0, width, height: groundLength, zHeight }],
      depthOffset: -groundLength / 2,
    };
    return {
      id: `vehicle:${v.id}:${direction}`,
      vehicleId: v.id,
      name,
      direction,
      sourceRect,
      guidance: [
        "Check facing, wheel contact, ground box and body height. Values are proposals in native pixels (16 px = one tile).",
        ...(trim
          ? [
              "This candidate clips one stray top row from the audited source rectangle. Check the clean edge.",
            ]
          : []),
        ...(v.id === "fire-truck-ladder-2"
          ? [
              "Raised ladder: stationary equipment state. Check overhead clearance; not a driving pose.",
            ]
          : []),
      ].join(" "),
      asset: {
        id: outdoorId(rect),
        rect,
        // The candidate render uses the full exact crop, including transparent margins.
        visualBounds: [0, 0, rect[2], rect[3]],
        aliases: frame.indexKey
          ? [{ key: frame.indexKey, name: frame.indexKey, theme: "Vehicles" }]
          : [],
        metadata: parseOutdoorMetadata(metadata, rect),
        evidence: "candidate",
        runtimeTypes: [],
      },
    };
  }),
);

export function validateVehicleGeometry(value: unknown, rect: ArtRect): OutdoorMetadata {
  const metadata = parseOutdoorMetadata(value, rect);
  if (
    !metadata.footprint ||
    !metadata.colliders?.length ||
    metadata.kind !== "prop" ||
    metadata.category !== "vehicle"
  )
    throw new Error("Define the vehicle ground box and collision shape before saving.");
  if (metadata.colliders.some((c) => c.zHeight === undefined || c.zHeight <= 0))
    throw new Error("Every vehicle collision shape needs a positive physical height.");
  return metadata;
}
