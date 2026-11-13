import { describe, expect, it } from "vitest";
import type { Prop, PropCollider } from "../../entities/Prop.js";
import { forestRowProp, forestRowType } from "../../patterns/ForestThicket.js";
import {
  appendPropGeometry,
  blockingColliders,
  projectedUv,
  propForm,
  propImageFrame,
  propSlices,
  propSolids,
  propSurfaces,
  surfaceUnder,
  unlimitedWallHeight,
} from "./FirstPersonProps.js";
import { TriangleWriter } from "./FirstPersonTerrain.js";

function prop(
  sprite: Partial<Prop["sprite"]>,
  collider: PropCollider | null,
  walls: PropCollider[] | null = null,
): Prop {
  return {
    id: 1,
    type: "test",
    position: { wx: 100, wy: 200 },
    sprite: {
      sheetKey: "s",
      frameCol: 0,
      frameRow: 0,
      spriteWidth: 64,
      spriteHeight: 96,
      ...sprite,
    },
    collider,
    walls,
    isProp: true,
  };
}

const box = (width: number, height: number, extra: Partial<PropCollider> = {}): PropCollider => ({
  offsetX: 0,
  offsetY: 0,
  width,
  height,
  ...extra,
});

describe("first-person prop forms", () => {
  it("keeps narrow-bodied and bodiless props as billboards", () => {
    expect(propForm(prop({}, null))).toBe("billboard");
    expect(propForm(prop({ spriteWidth: 48 }, box(8, 6)))).toBe("billboard"); // tree trunk
    expect(propForm(prop({}, box(8, 8, { passable: true, ladder: true })))).toBe("billboard");
    expect(propForm(prop({}, box(60, 32)))).toBe("solid"); // building
  });

  it("draws walkable surfaces as solids even when passable", () => {
    const deck = box(32, 32, {
      passable: true,
      surface: { id: "d", spaceId: "s", z: 24, riseX: 0, riseY: 0, thickness: 4, connectsTo: [] },
    });
    expect(blockingColliders(prop({}, deck))).toHaveLength(1);
    expect(propForm(prop({}, deck))).toBe("solid");
    const [solid] = propSolids(prop({}, deck));
    expect(solid?.surface).toBe(true);
    expect(solid?.corners.slice(4).every((c) => c[2] === 24)).toBe(true);
    expect(solid?.corners.slice(0, 4).every((c) => c[2] === 20)).toBe(true);
  });

  it("derives an unlimited wall's height from the artwork above its footprint", () => {
    // Footprint top is 32px north of the feet; the 96px art implies a 64px wall.
    const building = prop({}, box(60, 32));
    const frame = propImageFrame(building);
    const [solid] = propSolids(building, frame);
    expect(solid && unlimitedWallHeight(building, solid.bounds, frame)).toBe(64);
    expect(solid?.corners[4]?.[2]).toBe(64);
    // Finite colliders keep their physical height.
    const [bench] = propSolids(prop({}, box(60, 10, { zHeight: 12, zBase: 2 })));
    expect(bench?.corners[0]?.[2]).toBe(2);
    expect(bench?.corners[4]?.[2]).toBe(14);
  });

  it("frames multi-piece facades by the union of their outside pieces", () => {
    const facade = prop(
      {
        parts: [
          { frameCol: 0, frameRow: 0, spriteWidth: 32, spriteHeight: 40, dx: -16, dy: 0 },
          { frameCol: 1, frameRow: 0, spriteWidth: 32, spriteHeight: 60, dx: 16, dy: 0 },
          {
            frameCol: 2,
            frameRow: 0,
            spriteWidth: 99,
            spriteHeight: 99,
            dx: 0,
            dy: 0,
            view: "inside",
          },
        ],
      },
      box(64, 20),
    );
    expect(propImageFrame(facade)).toEqual({ left: -32, top: -60, width: 64, height: 60 });
  });

  it("projects box corners to where the fixed view draws them", () => {
    const building = prop({}, box(64, 32));
    const frame = propImageFrame(building);
    // Feet (bottom centre) map to the bottom centre of the artwork.
    expect(projectedUv(building, frame, 0, 100, 200, 0)).toEqual([0.5, 1]);
    // The roof's north-west corner lands on the artwork's top-left.
    expect(projectedUv(building, frame, 0, 68, 168, 64)).toEqual([0, 0]);
    // Raised terrain lifts the artwork with the prop.
    expect(projectedUv(building, frame, 8, 100, 200, 8)).toEqual([0.5, 1]);
    // Points outside the artwork clamp instead of sampling neighbouring atlas cells.
    expect(projectedUv(building, frame, 0, 0, 400, -50)).toEqual([0, 1]);
  });

  it("wears the south face's artwork on every wall", () => {
    const flat = new TriangleWriter();
    const textured = { positions: [] as number[], uvs: [] as number[], colors: [] as number[] };
    // A 64×32 footprint, 64 tall: artwork 64 wide and 96 tall (32 of roof, 64 of wall).
    const building = prop({ spriteWidth: 64, spriteHeight: 96 }, box(64, 32, { zHeight: 64 }));
    appendPropGeometry({ flat, textured }, building, 0x808080, 0);
    expect(textured.positions.length / 18).toBe(5); // top, south, east, west, north
    expect(flat.vertexCount).toBe(0);
    const face = (index: number) => {
      const vertices: { x: number; y: number; z: number; u: number; v: number; grey: number }[] =
        [];
      for (let i = index * 6; i < index * 6 + 6; i++)
        vertices.push({
          x: textured.positions[i * 3] ?? 0,
          y: textured.positions[i * 3 + 1] ?? 0,
          z: textured.positions[i * 3 + 2] ?? 0,
          u: textured.uvs[i * 2] ?? 0,
          v: textured.uvs[i * 2 + 1] ?? 0,
          grey: textured.colors[i * 3] ?? 0,
        });
      return vertices;
    };
    const [, south, east, west, north] = [0, 1, 2, 3, 4].map(face);
    // Walls show only the wall rows of the artwork (below the roof's 32 rows).
    for (const wall of [south, east, west, north])
      for (const p of wall ?? []) expect(p.v).toBeCloseTo(p.z === 0 ? 1 : 1 / 3);
    // Side walls continue the south face around their south corner, pixel for pixel:
    // the east wall starts at the artwork's right edge and runs back 32 px.
    for (const p of east ?? []) expect(p.u).toBeCloseTo(p.y === 200 ? 1 : 0.5);
    for (const p of west ?? []) expect(p.u).toBeCloseTo(p.y === 200 ? 0 : 0.5);
    // The north wall repeats the south face unmirrored for a viewer facing it.
    for (const p of north ?? []) expect(p.u).toBeCloseTo(p.x === 68 ? 1 : 0);
    // Faces the sun never reaches are baked darker than those it lights.
    expect(north?.[0]?.grey).toBeLessThan(west?.[0]?.grey ?? 0);
    expect(west?.[0]?.grey).toBeLessThan(east?.[0]?.grey ?? 0);
    expect(south?.[0]?.grey).toBe(1);
    // A wall deeper than the picture is wide turns the picture round where it runs
    // out, as separate strips: a UV never interpolates across a turn.
    const deep = { positions: [] as number[], uvs: [] as number[], colors: [] as number[] };
    const wing = prop({ spriteWidth: 32, spriteHeight: 160 }, box(32, 80, { zHeight: 64 }));
    appendPropGeometry({ flat: new TriangleWriter(), textured: deep }, wing, 0x808080, 0);
    // Top, south, east in three strips (32 + 32 + 16 px), west in three, north.
    expect(deep.positions.length / 18).toBe(9);
    const eastStrips = [2, 3, 4].map((strip) => {
      const us = new Set<number>();
      const ys = new Set<number>();
      for (let i = strip * 6; i < strip * 6 + 6; i++) {
        us.add(Math.round((deep.uvs[i * 2] ?? 0) * 100) / 100);
        ys.add(deep.positions[i * 3 + 1] ?? 0);
      }
      return { us: [...us].sort(), ys: [...ys].sort((p, q) => p - q) };
    });
    expect(eastStrips).toEqual([
      { us: [0, 1], ys: [168, 200] },
      { us: [0, 1], ys: [136, 168] },
      { us: [0.5, 1], ys: [120, 136] }, // turned round again at the far edge
    ]);
    const plain = new TriangleWriter();
    appendPropGeometry({ flat: plain, textured: undefined }, prop({}, box(64, 32)), 0x808080, 0);
    expect(plain.vertexCount / 6).toBe(5);
  });

  it("dresses room walls on both sides and colours their ends per wall", () => {
    const flat = new TriangleWriter();
    const textured = { positions: [] as number[], uvs: [] as number[], colors: [] as number[] };
    const wall = prop({}, null, [box(64, 16, { zHeight: 64 })]);
    const sides: number[] = [];
    appendPropGeometry({ flat, textured }, wall, 0x808080, 0, undefined, {
      sideColor: () => {
        sides.push(1);
        return 0xff0000;
      },
    });
    expect(textured.positions.length / 18).toBe(2); // south and north
    expect(flat.vertexCount / 6).toBe(3); // top, east and west in the wall's colour
    expect(sides).toHaveLength(1);
    // The north face wears exactly the south face's rows of artwork.
    const vRows = (face: number) =>
      new Set(textured.uvs.slice(face * 12, face * 12 + 12).filter((_, i) => i % 2 === 1));
    expect(vRows(1)).toEqual(vRows(0));
    const colors = flat.finish().colors;
    expect(colors[0]).toBeGreaterThan(0);
    expect(colors[1]).toBe(0); // red, not the prop's grey
  });

  it("stands a forest row up as cards cut from its artwork", () => {
    const row = forestRowProp(forestRowType(1, 2), 1000, 500);
    if (!row) throw Error("missing forest row");
    expect(propForm(row)).toBe("cards");
    const slices = propSlices(row, (col, rowIndex) => ({ x: col * 16, y: rowIndex * 16 }));
    // A 48 px cap, two 128 px repeats cut in half, and a 32 px cap.
    expect(slices.map((s) => s.width)).toEqual([48, 64, 64, 64, 64, 32]);
    // Side by side they cover the artwork exactly, left to right.
    const frame = propImageFrame(row);
    let edge = row.position.wx + frame.left;
    for (const slice of slices) {
      expect(slice.x - slice.width / 2).toBeCloseTo(edge);
      edge += slice.width;
    }
    expect(edge).toBeCloseTo(row.position.wx + frame.left + frame.width);
    // The two halves of a repeat read neighbouring halves of the same sheet frame.
    expect(slices[2]?.sheetX).toBe((slices[1]?.sheetX ?? 0) + 64);
    expect(slices[3]?.sheetX).toBe(slices[1]?.sheetX);
    // Cards stand in the middle of the row's 48 px body; the shorter cap stands back.
    expect(slices[1]?.y).toBe(500 - 24);
    expect(slices[5]?.y).toBe(500 - 24 - 16);
    expect(slices[5]?.height).toBe(96);
  });

  it("finds the deck or ramp under a body", () => {
    const ramp = box(64, 32, {
      passable: true,
      surface: { id: "r", spaceId: "s", z: 0, riseX: 32, riseY: 0, thickness: 4, connectsTo: [] },
    });
    const [surface] = propSurfaces(prop({}, ramp));
    if (!surface) throw Error("missing surface");
    const middle = surfaceUnder(surface, 100, 190, 100);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(32);
    // Above the body's feet, or beside the surface: not its support.
    expect(surfaceUnder(surface, 100, 190, (middle ?? 0) - 1)).toBeUndefined();
    expect(surfaceUnder(surface, 300, 190, 100)).toBeUndefined();
    expect(propSurfaces(prop({}, box(64, 32)))).toHaveLength(0);
  });
});
