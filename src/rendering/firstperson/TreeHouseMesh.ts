import type { Texture } from "three";
import type { Prop } from "../../entities/Prop.js";
import {
  DECK_Z,
  TREE_HOUSE_HEIGHT,
  TREE_HOUSE_LAYOUT,
  TREE_HOUSE_WIDTH,
} from "../../entities/TreeHouse.js";
import type { FirstPersonImages } from "./FirstPersonImages.js";
import type { TexturedTriangles } from "./FirstPersonProps.js";
import { Model, type Vertex } from "./SceneryMesh.js";

// UVs are in the original 144 × 176 Modern Exteriors tree-house composite.
function patch(l: number, t: number, r: number, b: number) {
  return [
    [l / 144, b / 176],
    [r / 144, b / 176],
    [r / 144, t / 176],
    [l / 144, t / 176],
  ] as const;
}
function crown(m: Model, x: number, y: number, z: number, r: number) {
  const point = (i: number, radius: number, height: number): Vertex => {
    const a = (i * Math.PI) / 4;
    return [x + radius * Math.cos(a), y + radius * 0.8 * Math.sin(a), z + height];
  };
  for (let i = 0; i < 8; i++) {
    const a = point(i, r, 0),
      b = point(i + 1, r, 0),
      c = point(i + 1, r * 0.58, r * 0.47),
      d = point(i, r * 0.58, r * 0.47);
    const leaves = patch(25 + (i % 3) * 6, 22, 45 + (i % 3) * 6, 39);
    m.face([a, b, c, d], i % 3 === 1 ? 0xffffff : 0xd9e4d1, leaves);
    m.face([c, d, [x, y, z + r * 0.57]], 0xffffff, leaves);
    m.face([a, b, [x, y, z - r * 0.55]], 0xb3c9ab, leaves);
  }
}

/** Build around the same deck, room doorway and ladder used by collision. */
export function treeHouseMesh(
  images: FirstPersonImages,
  prop: Prop,
  elevation: number,
  white: Texture,
  output: (source: { texture: Texture }) => TexturedTriangles | undefined,
) {
  const art = images.prop(prop, false),
    plain = output({ texture: white });
  if (!art || !plain) return;
  const textured = output(art);
  if (!textured) return;
  const m = new Model(prop, elevation, art, plain, textured);
  const lx = (x: number) => x - TREE_HOUSE_WIDTH / 2,
    ly = (y: number) => y - TREE_HOUSE_HEIGHT;
  const { room, deck, door, ladder } = TREE_HOUSE_LAYOUT;
  const planks = [0xa16d45, 0xb47d50, 0x98623d];
  m.box(-5, -47, 0, 16, 18, 86, 0x6b4a35);
  for (const x of [lx(deck.left) + 3, lx(deck.right) - 3]) {
    m.box(x, ly(deck.bottom) - 4, 0, 5, 5, DECK_Z, 0x805635);
  }
  for (let y = deck.top; y < deck.bottom; y += 4) {
    const wide = Math.min(4, deck.bottom - y);
    m.box(
      lx((deck.left + deck.right) / 2),
      ly(y + wide / 2),
      DECK_Z - 4,
      deck.right - deck.left,
      wide - 0.2,
      4,
      planks[Math.floor(y / 4) % 3] ?? 0xa16d45,
    );
  }
  for (let z = DECK_Z; z < DECK_Z + 24; z += 4) {
    const c = planks[(z / 4) % 3] ?? 0xa16d45;
    for (const [l, r] of [
      [room.left, door.left],
      [door.right, room.right],
    ] as const)
      m.box(lx((l + r) / 2), ly(room.bottom - 1), z, r - l, 2, 4, c);
    m.box(lx((room.left + room.right) / 2), ly(room.top + 1), z, room.right - room.left, 2, 4, c);
    for (const x of [room.left, room.right])
      m.box(lx(x), ly((room.top + room.bottom) / 2), z, 3, room.bottom - room.top, 4, c);
  }
  // The west front panel carries the cabin window from the source facade.
  m.panel(
    lx((room.left + door.left) / 2),
    ly(room.bottom) + 0.15,
    DECK_Z,
    door.left - room.left,
    24,
    [39 / 144, 106 / 176, 64 / 144, 127 / 176],
  );
  m.panel(
    lx((room.right + door.right) / 2),
    ly(room.bottom) + 0.15,
    DECK_Z,
    room.right - door.right,
    24,
    [68 / 144, 106 / 176, 78 / 144, 127 / 176],
  );
  m.face(
    [
      [lx(deck.left), ly(deck.top), 24.2],
      [lx(deck.right), ly(deck.top), 24.2],
      [lx(deck.right), ly(deck.bottom), 24.2],
      [lx(deck.left), ly(deck.bottom), 24.2],
    ],
    0xffffff,
    patch(34, 129, 88, 143),
  );
  const left = lx(room.left) - 3,
    right = lx(room.right) + 3,
    mid = (left + right) / 2;
  const n = ly(room.top) - 4,
    s = ly(room.bottom) + 4;
  for (const x of [left, right])
    m.face(
      [
        [x, n, 49],
        [x, s, 49],
        [mid, s, 63],
        [mid, n, 63],
      ],
      x === left ? 0xd8c3b0 : 0xffffff,
      patch(53, 85, 88, 101),
    );
  for (const y of [s, n])
    m.face(
      [
        [left, y, 49],
        [right, y, 49],
        [mid, y, 63],
      ],
      0xac7851,
    );
  const ladderX = lx((ladder.left + ladder.right) / 2),
    ladderY = ly(ladder.top) + 1;
  for (const dx of [-7, 7]) m.box(ladderX + dx, ladderY, 0, 2, 3, DECK_Z + 3, 0xa9784b);
  for (let z = 3; z <= DECK_Z; z += 5) m.box(ladderX, ladderY + 0.5, z, 14, 2, 2, 0xd5a870);
  crown(m, -41, -36, 62, 20);
  crown(m, -27, -57, 78, 28);
  crown(m, 18, -58, 82, 29);
  crown(m, -4, -57, 95, 24);
}
