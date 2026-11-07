import { describe, expect, it } from "vitest";
import type { Prop, PropCollider } from "../../entities/Prop.js";
import {
  appendPropGeometry,
  blockingColliders,
  projectedUv,
  propForm,
  propImageFrame,
  propSolids,
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

  it("textures the faces the fixed view shows and colours the rest", () => {
    const flat = new TriangleWriter();
    const textured = { positions: [] as number[], uvs: [] as number[] };
    appendPropGeometry({ flat, textured }, prop({}, box(64, 32)), 0x808080, 0);
    expect(textured.positions.length / 18).toBe(2); // top + south
    expect(flat.vertexCount / 6).toBe(3); // north, east, west
    const plain = new TriangleWriter();
    appendPropGeometry({ flat: plain, textured: undefined }, prop({}, box(64, 32)), 0x808080, 0);
    expect(plain.vertexCount / 6).toBe(5);
  });
});
