import type { Model, Vertex } from "./SceneryMesh.js";

// Keep the aisles and doorway visible through a half-glazed pitched roof.
// The side rails line up with the authority's two narrow greenhouse walls.
export function glasshouse(m: Model) {
  const metal = 0x566778,
    light = 0xa0d6d2;
  for (const x of [-59, 59]) {
    m.box(x, -32, 0, 5, 67, 5, metal);
    m.box(x, -32, 43, 4, 67, 4, metal);
    m.box(x, -32, 24, 3, 67, 2, metal);
    for (const y of [-64, -32, 0]) m.box(x, y, 0, 4, 4, 48, metal);
  }
  m.box(0, -64, 25, 118, 3, 3, metal);
  m.box(0, -32, 72, 4, 70, 4, metal);
  for (const side of [-1, 1]) {
    const at = (x: number, y: number): Vertex => [x * side, y, 74 - (26 * x) / 60];
    for (const y of [-66, -33, 0])
      m.face([at(0, y), at(60, y), at(60, y + 3), at(0, y + 3)], metal);
    // Reflections and glazing bars use strips so the player sees the planting through the roof.
    for (const x of [14, 32, 49])
      m.face([at(x, -64), at(x + 2, -64), at(x + 2, 0), at(x, 0)], light);
  }
}

export function dropOffCanopy(m: Model) {
  for (const x of [-53, 53]) for (const y of [-66, -4]) m.box(x, y, 0, 4, 4, 60, 0xc4c6cd);
  m.box(0, -34, 60, 112, 68, 5, 0x637994);
  m.box(0, 0, 59, 112, 3, 6, 0xd0e9eb);
  m.box(0, 1, 61, 22, 2, 3, 0x368ba6);
}
