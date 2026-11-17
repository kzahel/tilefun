import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { Spritesheet } from "../../assets/Spritesheet.js";
import { Direction } from "../../entities/Entity.js";
import type { SpriteItem } from "../SceneItem.js";
import type { PageRegion } from "../View3dHost.js";
import {
  actorBillboard,
  type Billboard,
  CardArrays,
  type CardPages,
  MovingCards,
  RecentPages,
  StaticCards,
} from "./FirstPersonBillboards.js";
import { shadeMaterial } from "./FirstPersonMaterials.js";

const oak = { name: "oak" } as unknown as CanvasImageSource,
  pine = { name: "pine" } as unknown as CanvasImageSource;

/** A sheet frame at (40, 16), 32 × 48, on a card 32 wide and 48 tall. */
const card = (image: CanvasImageSource, x: number, extra: Partial<Billboard> = {}): Billboard => ({
  image,
  sx: 40,
  sy: 16,
  sw: 32,
  sh: 48,
  x,
  y: 20,
  z: 5,
  width: 32,
  height: 48,
  ...extra,
});

/** An atlas that gives every page of every image its own 512-texel region. */
function atlas(pageSize = 512) {
  const regions = new Map<string, PageRegion>();
  const asked: string[] = [];
  let epoch = 0;
  const pages: CardPages = {
    pageSize,
    page(image, x, y) {
      const key = `${(image as unknown as { name: string }).name} ${x},${y} #${epoch}`;
      asked.push(key);
      let region = regions.get(key);
      if (!region) {
        region = { layer: regions.size, x: 100, y: 200, width: pageSize, height: pageSize };
        regions.set(key, region);
      }
      return region;
    },
  };
  return {
    pages,
    asked,
    /** A restored context: every page gets a new place. */
    forget: () => {
      epoch++;
    },
  };
}

const rounded = (values: Float32Array) => [...values].map((v) => Math.round(v * 10) / 10);

describe("an actor's card", () => {
  const sheet = new Spritesheet({ width: 64, height: 64 } as unknown as HTMLCanvasElement, 16, 16);
  const actor = {
    wx: 100,
    wy: 100,
    zOffset: 0,
    drawOffsetY: 0,
    frameCol: 1,
    frameRow: Direction.Left,
    facing: Direction.Left,
    spriteWidth: 16,
    spriteHeight: 16,
    flipX: false,
  } as SpriteItem;
  const row = (b: Billboard) => b.sy / 16;

  it("shows the side that faces a first-person eye", () => {
    // Seen from the east, an actor facing west (left) shows its back.
    expect(row(actorBillboard(actor, sheet, { x: 200, y: 100 }, new Set()))).toBe(Direction.Up);
    // Seen from the south it is the row the fixed view draws.
    expect(row(actorBillboard(actor, sheet, { x: 100, y: 200 }, new Set()))).toBe(Direction.Left);
  });

  it("shows its drawn row to the top-down camera wherever it stands", () => {
    for (const wx of [-500, 100, 900])
      expect(row(actorBillboard({ ...actor, wx }, sheet, "south", new Set()))).toBe(Direction.Left);
  });
});

it("keeps a supported room actor in front of furniture without moving its pixels", () => {
  const sheet = new Spritesheet({ width: 64, height: 64 } as unknown as HTMLCanvasElement, 16, 16);
  const actor = {
    wx: 64,
    wy: 70,
    zOffset: 12,
    sortKey: 90.001,
    drawOffsetY: 0,
    frameCol: 0,
    frameRow: 1,
    spriteWidth: 16,
    spriteHeight: 16,
  } as SpriteItem;
  const ordinary = actorBillboard(actor, sheet, "south", new Set());
  const supported = actorBillboard(actor, sheet, "south", new Set(), true);
  expect(supported.y).toBeCloseTo(actor.sortKey);
  expect(supported.y - supported.z).toBeCloseTo(ordinary.y - ordinary.z);
  expect(supported.x).toBe(ordinary.x);
  expect(supported.height).toBe(ordinary.height);
});

describe("an actor drawn below its standing point", () => {
  const sheet = new Spritesheet({ width: 64, height: 64 } as unknown as HTMLCanvasElement, 16, 16);
  const rabbit = {
    wx: 100,
    wy: 100,
    zOffset: 4,
    drawOffsetY: 6,
    frameCol: 0,
    frameRow: 0,
    spriteWidth: 16,
    spriteHeight: 16,
    flipX: false,
  } as SpriteItem;

  it("hangs its card from the standing height, with the rows under it below zero", () => {
    const billboard = actorBillboard(rabbit, sheet, "south", new Set());
    expect(billboard.z).toBe(4);
    const arrays = new CardArrays(1);
    expect(arrays.push(billboard, atlas().pages)).toBe(true);
    // Every vertex stands at the feet; the artwork spans 6 below to 10 above,
    // so the top-down material can tell the rows that go over the ground.
    expect([...arrays.centres].filter((_, i) => i % 3 === 2)).toEqual([4, 4, 4, 4]);
    expect([...arrays.corners]).toEqual([-8, -6, 8, -6, 8, 10, -8, 10]);
  });
});

describe("first-person cards", () => {
  it("writes each card as a foot centre, corner offsets and its place in the atlas", () => {
    const arrays = new CardArrays(1);
    expect(arrays.push(card(oak, 10), atlas().pages)).toBe(true);
    expect(arrays.count).toBe(1);
    // Every vertex carries the same centre; the eye's direction is not baked in.
    expect([...arrays.centres]).toEqual([10, 20, 5, 10, 20, 5, 10, 20, 5, 10, 20, 5]);
    // Bottom-left, bottom-right, top-right, top-left: (across, up).
    expect([...arrays.corners]).toEqual([-16, 0, 16, 0, 16, 48, -16, 48]);
    // Atlas texels: the page's corner plus the frame's place in the page, with rows
    // counted from the page's bottom (512 − 16 = 496 for the frame's top row).
    expect(rounded(arrays.pages)).toEqual([
      ...[140, 648, 0], // bottom-left: frame left, frame bottom (512 − 64 = 448)
      ...[172, 648, 0],
      ...[172, 696, 0], // top-right: frame right, frame top
      ...[140, 696, 0],
    ]);
  });

  it("mirrors a flipped card: its left edge shows the artwork's right edge", () => {
    const arrays = new CardArrays(1);
    arrays.push(card(oak, 10, { flipX: true }), atlas().pages);
    expect([...arrays.corners]).toEqual([-16, 0, 16, 0, 16, 48, -16, 48]);
    const us = rounded(arrays.pages).filter((_, i) => i % 3 === 0);
    expect(us).toEqual([172, 140, 140, 172]);
  });

  it("writes artwork that crosses a page boundary as one quad per page", () => {
    // 64-texel pages: the 32 × 48 frame at (40, 16) covers x 40–72 and y 16–64,
    // so it crosses the boundary at x = 64 only.
    const arrays = new CardArrays(1);
    const { pages, asked } = atlas(64);
    expect(arrays.push(card(oak, 0), pages)).toBe(true);
    expect(asked).toEqual(["oak 0,0 #0", "oak 64,0 #0"]);
    expect(arrays.count).toBe(2);
    const corners = [...arrays.corners];
    // Left part: 24 of the 32 texels; right part: the other 8. Both full height.
    expect(corners.slice(0, 8)).toEqual([-16, 0, 8, 0, 8, 48, -16, 48]);
    expect(corners.slice(8, 16)).toEqual([8, 0, 16, 0, 16, 48, 8, 48]);
    // The right part starts at its own page's left edge, in the second page's layer.
    const right = rounded(arrays.pages).slice(12, 24);
    expect([right[0], right[2], right[3]]).toEqual([100, 1, 108]);
  });

  it("counts rows from the bottom of a page shorter than a full page", () => {
    // A sheet's last page: 64 texels wide, 20 tall, at (300, 700) in its layer.
    const short: CardPages = {
      pageSize: 64,
      page: () => ({ layer: 4, x: 300, y: 700, width: 64, height: 20 }),
    };
    const arrays = new CardArrays(1);
    arrays.push(card(oak, 0, { sx: 8, sy: 64 + 4, sw: 16, sh: 12 }), short);
    expect(arrays.count).toBe(1);
    // The frame's top row is 4 texels down the 20-row page: 700 + 20 − 4.
    expect(rounded(arrays.pages)).toEqual([
      ...[308, 704, 4],
      ...[324, 704, 4],
      ...[324, 716, 4],
      ...[308, 716, 4],
    ]);
  });

  it("splits a mirrored card with each part on the far side", () => {
    const arrays = new CardArrays(1);
    arrays.push(card(oak, 0, { flipX: true }), atlas(64).pages);
    expect(arrays.count).toBe(2);
    const corners = [...arrays.corners];
    // The artwork's left 24 texels are now the card's right 24, and still read
    // the first page; within each part the edges are swapped too.
    expect(corners.slice(0, 8)).toEqual([-8, 0, 16, 0, 16, 48, -8, 48]);
    expect(corners.slice(8, 16)).toEqual([-16, 0, -8, 0, -8, 48, -16, 48]);
    const pages = rounded(arrays.pages);
    expect([pages[0], pages[3], pages[2]]).toEqual([164, 140, 0]);
    expect([pages[12], pages[15], pages[14]]).toEqual([108, 100, 1]);
  });

  it("does not ask for another page over a rounding error", () => {
    // A forest row's slices have fractional edges: 130 / 3 × 3 lands 3e-14 past 64 + 130.
    const { pages, asked } = atlas(64);
    const arrays = new CardArrays(1);
    const width = 130 / 3;
    const sx = 64 - 2 * width + 64 * 2; // the third slice ends on the boundary at 192
    arrays.push(
      card(oak, 0, { sx: sx + 2 * width - width, sy: 0, sw: width + 3e-14, sh: 16 }),
      pages,
    );
    expect(asked.every((key) => !key.startsWith("oak 192,"))).toBe(true);
    // And a page size of zero (pages not begun) writes nothing instead of looping.
    expect(new CardArrays(1).push(card(oak, 0), new RecentPages())).toBe(false);
  });

  it("leaves a card out when a page it needs is not in the atlas", () => {
    const arrays = new CardArrays(1);
    const full: CardPages = {
      pageSize: 64,
      page: (_i, x) => (x ? undefined : atlas().pages.page(oak, 0, 0)),
    };
    expect(arrays.push(card(oak, 0), full)).toBe(false);
    expect(arrays.count).toBe(0); // nothing half-written
    expect(arrays.push(card(oak, 0, { sw: 0 }), atlas().pages)).toBe(false);
  });

  it("draws every moving card in one mesh, growing as the crowd does", () => {
    const parent = new THREE.Group();
    const moving = new MovingCards(parent, new THREE.MeshBasicMaterial());
    const { pages } = atlas();
    moving.begin();
    moving.end();
    expect(moving.mesh.visible).toBe(false);
    moving.begin();
    for (let i = 0; i < 100; i++) moving.push(card(i % 2 ? oak : pine, i), pages);
    moving.end();
    expect(parent.children).toHaveLength(1);
    expect(moving.count).toBe(100);
    expect(moving.mesh.visible).toBe(true);
    expect(moving.mesh.geometry.drawRange.count).toBe(600);
    expect(moving.mesh.geometry.getAttribute("cardPage").count).toBeGreaterThanOrEqual(400);
    // A smaller frame reuses the buffers.
    const geometry = moving.mesh.geometry;
    moving.begin();
    moving.push(card(oak, 1), pages);
    moving.end();
    expect(moving.mesh.geometry).toBe(geometry);
    expect(geometry.drawRange.count).toBe(6);
    // A bigger crowd outgrows them: the mesh gets buffers that hold every card.
    moving.begin();
    for (let i = 0; i < 300; i++) moving.push(card(oak, i), pages);
    moving.end();
    expect(moving.mesh.geometry).not.toBe(geometry);
    expect(moving.mesh.geometry.drawRange.count).toBe(1800);
    expect(moving.mesh.geometry.getAttribute("position").count).toBeGreaterThanOrEqual(1200);
    expect(moving.mesh.geometry.index?.count).toBeGreaterThanOrEqual(1800);
    expect(moving.mesh.geometry.getAttribute("position").getX(299 * 4)).toBe(299);
  });

  it("asks the host once for a run of cards on the same page", () => {
    const { pages, asked } = atlas();
    const recent = new RecentPages();
    recent.begin(pages);
    const arrays = new CardArrays(4);
    for (const image of [oak, oak, oak, pine]) arrays.push(card(image, 0), recent);
    expect(asked).toEqual(["oak 0,0 #0", "pine 0,0 #0"]);
    // The next frame asks again: asking is what keeps a page resident.
    recent.begin(pages);
    arrays.push(card(pine, 0), recent);
    expect(asked).toHaveLength(3);
  });

  it("merges every chunk's standing cards into one mesh, with the sun's copy", () => {
    const parent = new THREE.Group(),
      casters = new THREE.Group();
    const cards = new StaticCards(
      parent,
      new THREE.MeshBasicMaterial(),
      casters,
      new THREE.MeshBasicMaterial(),
    );
    const { pages } = atlas();
    cards.set("0,0", [card(oak, 1), card(pine, 2), card(oak, 3)], pages);
    cards.set("1,0", [card(oak, 4)], pages);
    expect(cards.flush()).toBe(true);
    expect(cards.count).toBe(4);
    expect(parent.children).toHaveLength(1);
    expect(cards.mesh.geometry.drawRange.count).toBe(24);
    // The sun's copy shares the same buffers.
    expect(casters.children).toHaveLength(1);
    expect(cards.caster?.geometry).toBe(cards.mesh.geometry);
    // Nothing changed: nothing is rebuilt, so the sun's map stays valid.
    expect(cards.flush()).toBe(false);
    cards.delete("0,0");
    expect(cards.flush()).toBe(true);
    expect(cards.count).toBe(1);
    cards.delete("1,0");
    cards.flush();
    expect(cards.mesh.visible).toBe(false);
    expect(cards.caster?.visible).toBe(false);
    cards.dispose();
    expect(parent.children).toHaveLength(0);
    expect(casters.children).toHaveLength(0);
  });

  it("keeps standing cards' pages resident and rewrites them when the atlas moves a page", () => {
    const cards = new StaticCards(new THREE.Group(), new THREE.MeshBasicMaterial());
    const { pages, asked, forget } = atlas();
    cards.set("0,0", [card(oak, 1), card(oak, 2)], pages);
    cards.set("1,0", [card(pine, 3)], pages);
    cards.flush();
    const layers = () =>
      rounded(cards.mesh.geometry.getAttribute("cardPage").array as Float32Array).filter(
        (_, i) => i % 3 === 2,
      );
    expect(new Set(layers())).toEqual(new Set([0, 1]));
    // Every frame asks for each chunk's pages once, and nothing is rebuilt.
    asked.length = 0;
    cards.keep(pages);
    expect(asked).toEqual(["oak 0,0 #0", "pine 0,0 #0"]);
    expect(cards.flush()).toBe(false);
    // The atlas forgot its pages: the same cards are written against the new places.
    forget();
    cards.keep(pages);
    expect(cards.flush()).toBe(true);
    expect(cards.count).toBe(3);
    expect(new Set(layers())).toEqual(new Set([2, 3]));
    cards.keep(pages);
    expect(cards.flush()).toBe(false);
  });

  it("edits the built-in shader where its anchors still exist", () => {
    const atlasUniform = { value: null };
    const material = shadeMaterial(new THREE.MeshBasicMaterial({ alphaTest: 0.5 }), {
      card: { value: new THREE.Vector2(1, 0) },
      cardArt: atlasUniform,
    });
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    };
    const compile = vi.fn(material.onBeforeCompile);
    compile(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      undefined as unknown as THREE.WebGLRenderer,
    );
    expect(shader.uniforms.cardAtlas).toBe(atlasUniform);
    expect(shader.vertexShader).toContain("attribute vec3 cardPage;");
    expect(shader.vertexShader).toContain("vCardPage = cardPage;");
    expect(shader.vertexShader).toContain("cardRight * corner.x");
    expect(shader.fragmentShader).toContain("diffuseColor *= cardArt();");
    // The artwork's alpha is in place before three.js's own alpha test.
    expect(shader.fragmentShader.indexOf("diffuseColor *= cardArt();")).toBeLessThan(
      shader.fragmentShader.indexOf("#include <alphatest_fragment>"),
    );
  });
});
