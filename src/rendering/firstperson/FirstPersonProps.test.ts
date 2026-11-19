import { describe, expect, it } from "vitest";
import { type SpriteImage, Spritesheet } from "../../assets/Spritesheet.js";
import { getEntityAABB } from "../../entities/collision.js";
import type { Prop, PropCollider } from "../../entities/Prop.js";
import { createProp } from "../../entities/PropFactories.js";
import { DECK_Z, treeHouseProp } from "../../entities/TreeHouse.js";
import { jumpPlacements, jumpSlabProp } from "../../generation/regional/JumpProfiles.js";
import { forestRowProp, forestRowType } from "../../patterns/ForestThicket.js";
import { surfaceZAt } from "../../physics/SurfacePatch.js";
import { roadRailBridgeProp } from "../../railway/RoadRailBridge.js";
import { undergroundGarageRecipe } from "../../scenarios/UndergroundGarageRecipe.js";
import { roadDeckMarkings } from "../RoadDeckPresentation.js";
import { forestRowCards, forestTreeCards } from "./FirstPersonForest.js";
import {
  appendLeftover,
  appendPiecePlane,
  appendPropGeometry,
  blockingColliders,
  excavationCeilings,
  hasRoomViews,
  isOverheadDeck,
  projectedUv,
  propForm,
  propImageFrame,
  propPieces,
  propSolids,
  propSurfaces,
  solidSilhouettes,
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

  it("preserves the native forest composition and gives perspective trees roots inside its footprint", () => {
    const row = forestRowProp(forestRowType(1, 2), 1000, 500);
    if (!row) throw Error("missing forest row");
    const sheet = new Spritesheet({ width: 2816, height: 8224 } as SpriteImage, 16, 16);
    const cards = forestRowCards(row, 0, sheet);
    expect(cards.map((card) => card.width)).toEqual([48, 128, 128, 32]);
    // Side by side they cover the artwork exactly, left to right.
    const frame = propImageFrame(row);
    let edge = row.position.wx + frame.left;
    for (const card of cards) {
      expect(card.x - card.width / 2).toBe(edge);
      expect(card.y - card.height).toBe(row.position.wy + frame.top);
      edge += card.width;
    }
    expect(edge).toBe(row.position.wx + frame.left + frame.width);
    expect(cards.map((card) => card.sx)).toEqual([2448, 2512, 2512, 2656]);

    const trees = forestTreeCards(row, 1, 0, sheet);
    expect(trees.length).toBeGreaterThan(cards.length);
    expect(forestTreeCards(row, 1, 0, sheet)).toEqual(trees);
    const bands = blockingColliders(row).map((wall) => getEntityAABB(row.position, wall));
    for (const tree of trees) {
      expect(tree.sy).toBeLessThan(1600); // Whole tree art lives above the forest strips.
      expect(
        bands.some(
          (band) =>
            tree.x > band.left && tree.x < band.right && tree.y > band.top && tree.y < band.bottom,
        ),
      ).toBe(true);
    }
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

describe("walkable surfaces", () => {
  it("wear the fixed view's dirt colours and tile grid on motocross jumps", () => {
    // A sloped slab of the kicker.
    const jump = jumpPlacements("kicker", "e", 0, 0, "test")
      .map((p) => jumpSlabProp(p.propType, p.wx, p.wy))
      .find((p) => p?.collider?.surface?.riseX);
    const surface = jump?.collider?.surface;
    const [solid] = jump ? propSolids(jump) : [];
    if (!jump || !surface || !solid) throw Error("no sloped jump slab");
    const flat = new TriangleWriter();
    const lines = { positions: [] as number[], colors: [] as number[] };
    appendPropGeometry({ flat, textured: undefined, lines }, jump, 0x8a8a8a, 0);
    // The top is the sloped dirt colour (#a8784a) in linear light, not the grey.
    expect(flat.finish().colors[0]).toBeCloseTo(((0xa8 / 255 + 0.055) / 1.055) ** 2.4, 3);
    // A line every 16 px each way, edges included, on the plane.
    const { left, right, top, bottom } = solid.bounds;
    const count = Math.floor((right - left) / 16) + Math.floor((bottom - top) / 16) + 2;
    expect(lines.positions.length / 6).toBe(count);
    for (let i = 0; i < lines.positions.length; i += 3) {
      // Moved equally south and up: the same screen point, nearer the camera.
      const x = lines.positions[i] ?? 0,
        y = (lines.positions[i + 1] ?? 0) - 0.25,
        z = (lines.positions[i + 2] ?? 0) - 0.25;
      expect(z).toBeCloseTo(surfaceZAt(surface, solid.bounds, x, y), 4);
    }
  });
  it("wear the fixed view's asphalt and painted lines on road decks over rail", () => {
    const deck = roadRailBridgeProp("prop-road-rail-x-deck", 400, 300);
    const surface = deck?.collider?.surface;
    const [solid] = deck ? propSolids(deck) : [];
    if (!deck || !surface || !solid) throw Error("no road deck");
    const flat = new TriangleWriter();
    const lines = { positions: [] as number[], colors: [] as number[] };
    appendPropGeometry({ flat, textured: undefined, lines }, deck, 0x8a8a8a, 0);
    const { colors, positions } = flat.finish();
    const linear = (c: number) => ((c / 255 + 0.055) / 1.055) ** 2.4;
    // The top is the deck's asphalt at its height (rgb 128,134,139), not the grey.
    expect(colors[0]).toBeCloseTo(linear(128), 3);
    // Six faces, then one strip per painted line: edges, guard rails and centre dashes.
    const strips = roadDeckMarkings(deck.type, solid.bounds);
    expect(strips.length).toBeGreaterThan(5);
    expect(positions.length / 18).toBe(6 + strips.length);
    // The first strip lies on the deck, lifted toward the camera like the grid.
    const first = 6 * 18;
    for (let i = first; i < first + 18; i += 3)
      expect((positions[i + 2] ?? 0) - 0.25).toBeCloseTo(
        surfaceZAt(surface, solid.bounds, positions[i] ?? 0, (positions[i + 1] ?? 0) - 0.25),
        4,
      );
    // No tile grid on roads.
    expect(lines.positions).toHaveLength(0);
  });
});

describe("artwork outside a building's volumes", () => {
  it("lands every leftover corner on the fixed view's pixel: upright above the feet, flat below", () => {
    const hotel = createProp("prop-city-v1-hotel-3-roof-sign", 400, 300);
    const frame = propImageFrame(hotel);
    const holes = solidSilhouettes(hotel, frame, 0);
    if (!holes) throw Error("hotel has volumes");
    // One wall box: its silhouette is inside the artwork and leaves the sign above.
    expect(holes).toHaveLength(1);
    const [left, top, right, bottom] = holes[0] ?? [0, 0, 0, 0];
    expect(top).toBeGreaterThan(0);
    expect([left, right, bottom]).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    ]);
    const faces = { positions: [] as number[], uvs: [] as number[], colors: [] as number[] };
    appendLeftover(faces, hotel, frame, 0);
    expect(faces.positions.length).toBeGreaterThan(0);
    for (let i = 0, j = 0; i < faces.positions.length; i += 3, j += 2) {
      const x = faces.positions[i] ?? 0,
        y = faces.positions[i + 1] ?? 0,
        z = faces.positions[i + 2] ?? 0;
      // Lifted points move equally south and up: the same screen row.
      const u = faces.uvs[j] ?? 0,
        v = faces.uvs[j + 1] ?? 0;
      expect(x).toBeCloseTo(hotel.position.wx + frame.left + u * frame.width, 6);
      expect(y - z).toBeCloseTo(hotel.position.wy + frame.top + v * frame.height, 6);
      // Upright at the feet row, or lying on (just above) the ground south of it.
      if (y > hotel.position.wy) expect(z).toBeCloseTo(0.25, 6);
      else expect(y).toBe(hotel.position.wy);
    }
    // Walkable surfaces wear the surface look instead.
    const ramp = jumpPlacements("kicker", "e", 0, 0, "test")
      .map((p) => jumpSlabProp(p.propType, p.wx, p.wy))
      .find(Boolean);
    if (!ramp) throw Error("no ramp");
    expect(solidSilhouettes(ramp, propImageFrame(ramp), 0)).toBeUndefined();
  });
});

describe("room props on their planes (tree houses, top-down)", () => {
  const house = treeHouseProp(0, 200);
  const corners = (piece: Parameters<typeof appendPiecePlane>[2], elevation = 0) => {
    const faces = { positions: [] as number[], uvs: [] as number[], colors: [] as number[] };
    appendPiecePlane(faces, house, piece, elevation);
    return Array.from({ length: faces.positions.length / 3 }, (_, i) => ({
      x: faces.positions[i * 3] ?? NaN,
      y: faces.positions[i * 3 + 1] ?? NaN,
      z: faces.positions[i * 3 + 2] ?? NaN,
      v: faces.uvs[i * 2 + 1] ?? NaN,
    }));
  };

  it("has an inside picture and an outside one, sharing the ground band", () => {
    expect(hasRoomViews(house)).toBe(true);
    const outside = propPieces(house, "outside"),
      inside = propPieces(house, "inside");
    expect(outside).toHaveLength(3);
    expect(inside).toHaveLength(5);
    expect(outside.at(-1)).toBe(inside.at(-1));
  });

  it("lays a floor piece on its deck, every pixel where the fixed view draws it", () => {
    const deckBand = propPieces(house, "inside").find((p) => p.depthFloorZ !== undefined);
    if (!deckBand) throw Error("no deck band");
    const quad = corners(deckBand, 8);
    expect(quad.every((p) => p.z === 8 + DECK_Z)).toBe(true);
    // Screen row y − z runs from the piece's top to its bottom as v goes 0 → 1.
    for (const p of quad)
      expect(p.y - p.z).toBeCloseTo(
        200 - 8 + deckBand.dy - deckBand.spriteHeight + p.v * deckBand.spriteHeight,
      );
  });

  it("stands an upright piece at its plane, with rows below it lying in front", () => {
    // The ground band stands at the deck's front edge, above its own bottom row.
    const band = propPieces(house).at(-1);
    if (!band?.depthDy) throw Error("no ground band");
    const plane = 200 + band.depthDy;
    const quad = corners(band);
    const upright = quad.filter((p) => p.y === plane);
    const lying = quad.filter((p) => p.y !== plane);
    expect(upright).toHaveLength(6);
    expect(lying).toHaveLength(6);
    for (const p of upright)
      expect(p.y - p.z).toBeCloseTo(200 + band.dy - band.spriteHeight * (1 - p.v));
    // Lifted a quarter pixel along the view ray, as leftover art is.
    for (const p of lying) expect(p.z).toBe(0.25);
    expect(Math.max(...lying.map((p) => p.v))).toBe(1);
  });
});

describe("an excavation's roof", () => {
  it("is an overhead deck although it lies at ground level, so it fades over a body on the dug floor", () => {
    const props = undergroundGarageRecipe().props as Prop[];
    const ceilings = excavationCeilings(props);
    expect([...ceilings]).toEqual(["garage-roof"]);
    const overhead = props.filter((prop) => isOverheadDeck(prop, ceilings));
    expect(overhead.map((prop) => prop.collider?.surface?.id)).toEqual(["garage-roof"]);
    // Without the excavation under it, a ground-level slab hides nobody.
    expect(props.some((prop) => isOverheadDeck(prop))).toBe(false);
  });
});

describe("walls the fixed view never shows", () => {
  it("are marked so the top-down camera can drop them: a box's east, west and north, not its top and south", () => {
    const prop = createProp("prop-garden-fountain", 0, 0);
    const textured: { positions: number[]; uvs: number[]; colors: number[]; unseen?: number[] } = {
      positions: [],
      uvs: [],
      colors: [],
    };
    appendPropGeometry({ flat: new TriangleWriter(), textured, lines: undefined }, prop, 0, 0);
    // Top and south come first, six vertices each; every later vertex is unseen.
    const runs = textured.unseen ?? [];
    expect(runs[0]).toBe(12);
    let marked = 0;
    for (let i = 1; i < runs.length; i += 2) marked += runs[i] ?? 0;
    expect(marked).toBe(textured.positions.length / 3 - 12);
  });
});
