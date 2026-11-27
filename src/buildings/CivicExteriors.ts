import type { BuildingExterior } from "./BuildingExteriors.js";
import { section as box } from "./BuildingSection.js";
import { farmhouse, terracedHouse } from "./HouseExteriors.js";

type Crop = BuildingExterior["siding"];
function body(siding: Crop, ...sections: BuildingExterior["sections"]): BuildingExterior {
  return { siding, sections };
}
const brick: Crop = [2196, 4152, 8, 16],
  pale: Crop = [806, 2592, 12, 24];
const timber: Crop = [2220, 3266, 12, 16];
const terrace = (i: number): BuildingExterior => ({
  sections: terracedHouse(i),
  siding: [(i === 1 ? 480 : 672) + 32, 7426, 54, 29],
  windowBand: { span: 65, top: 58, height: 35 },
});
const models: Record<string, BuildingExterior> = {
  "porch-house": {
    sections: farmhouse,
    siding: [157, 7375, 61, 31],
    windowBand: { span: 82, top: 62, height: 40 },
    porchWall: { front: -24, left: -55, right: 108, height: 50, crop: [105, 141, 138, 34] },
  },
  "terrace-ochre": terrace(1),
  "terrace-blue": terrace(2),
  victorian: body(
    [153, 8113, 34, 35],
    box(-122, -78, -155, -2, 128, { topRight: 164 }),
    box(-78, -34, -155, -2, 164, { topRight: 128 }),
    box(-35, 120, -165, -18, 119),
    box(-117, -39, -197, -117, 185, { topRight: 220 }),
    box(-78, -38, -197, -117, 220, { topRight: 185 }),
  ),
  salvage: body(timber, box(-45, 45, -42, -2, 49)),
  post: body(
    [2215, 5238, 35, 30],
    box(-63, 63, -98, 0, 105),
    box(-53, 55, -86, -53, 123, { base: 105 }),
  ),
  "postal-depot": body(
    [2343, 5446, 35, 30],
    box(-63, 63, -98, 0, 105),
    box(-53, 55, -86, -53, 123, { base: 105 }),
  ),
  // Two open sides under the drop-off roof. Posts and the roof use the same sections for physics.
  hospital: body(
    pale,
    box(-198, -75, -135, -65, 105),
    box(-72, 71, -162, -5, 168),
    box(72, 210, -149, -27, 130),
    box(-188, -87, -65, -16, 64, { base: 56 }),
    box(-188, -181, -22, -16, 56),
    box(-94, -87, -22, -16, 56),
  ),
  clinic: body(pale, box(-77, 77, -56, -6, 98)),
  // The first engine bay is open for 120 pixels behind the front beam.
  fire: body(
    brick,
    box(-124, -40, -111, -18, 120),
    box(-40, -26, -169, -48, 80),
    box(36, 120, -169, -48, 80),
    box(-26, 36, -169, -157, 80),
    box(-26, 36, -157, -48, 80, { base: 56 }),
  ),
  school: body(
    [2192, 2896, 16, 32],
    box(-187, -61, -147, -23, 133, { topRight: 149 }),
    box(-61, 62, -147, -23, 149, { topRight: 133 }),
    box(72, 185, -94, -22, 164),
    box(82, 175, -109, -49, 165, { topRight: 184 }),
  ),
  nursery: body(
    [1984, 3664, 16, 16],
    box(-63, -5, -62, 0, 47, { topRight: 57 }),
    box(-5, 63, -62, 0, 57, { topRight: 46 }),
  ),
};
export function civicExterior(type: string) {
  return type.startsWith("prop-city-civic-")
    ? models[type.slice("prop-city-civic-".length)]
    : undefined;
}
