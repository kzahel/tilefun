import type { FacadePiece } from "../generation/regional/BuildingRecipes.js";
import type { Prop, PropCollider } from "./Prop.js";

/**
 * Climbable, enterable tree house assembled from unedited Modern Exteriors
 * atlas crops. Outside, the assembled tree house (atlas 1328,96 144×176) is
 * drawn in three bands. Inside the cabin, its roof, walls and canopy cut away to
 * the bare deck from the matching base kit (1472,192) and a little camping
 * furniture; the ground band (ladder, tyre swing, trunk) is always drawn.
 *
 * Local coordinates are the composite's pixels: X across, Y down from its top
 * edge, measured on the ground. A point drawn at sprite row `sy` on the deck
 * lies at ground Y = sy + DECK_Z. The prop's feet are the composite's bottom
 * centre, so the composite occupies X ∈ [0, 144], Y ∈ [0, 176].
 */
export const TREE_HOUSE_WIDTH = 144;
export const TREE_HOUSE_HEIGHT = 176;
/** Deck height: just above the 22.5px jump apex, so the ladder is the way up. */
export const DECK_Z = 24;
const WALL_HEIGHT = 24;

/** Ground-plane rectangles in local composite coordinates. */
export const TREE_HOUSE_LAYOUT = {
  deck: { left: 32, top: 120, right: 112, bottom: 166 },
  ladder: { left: 35, top: 166, right: 51, bottom: 174 },
  room: { left: 34, top: 120, right: 96, bottom: 153 },
  door: { left: 64, right: 88 },
} as const;

function local(
  r: { left: number; top: number; right: number; bottom: number },
  extra: Partial<PropCollider>,
): PropCollider {
  return {
    offsetX: (r.left + r.right) / 2 - TREE_HOUSE_WIDTH / 2,
    offsetY: r.bottom - TREE_HOUSE_HEIGHT,
    width: r.right - r.left,
    height: r.bottom - r.top,
    ...extra,
  };
}

function wall(left: number, top: number, right: number, bottom: number): PropCollider {
  return local({ left, top, right, bottom }, { zBase: DECK_Z, zHeight: WALL_HEIGHT });
}

type CropDepth = { upright: number } | { floor: number };

/** Atlas crop placed by its top-left corner in local composite coordinates.
 * `depth` names the plane its pixels depict: an upright plane at local ground Y,
 * or a horizontal floor at a height. World depth otherwise assumes an upright
 * plane at the crop's bottom row. */
function crop(
  atlasX: number,
  atlasY: number,
  width: number,
  height: number,
  x: number,
  y: number,
  depth: CropDepth,
  view?: "outside" | "inside",
): FacadePiece {
  return {
    frameCol: atlasX / 16,
    frameRow: atlasY / 16,
    spriteWidth: width,
    spriteHeight: height,
    dx: x + width / 2 - TREE_HOUSE_WIDTH / 2,
    dy: y + height - TREE_HOUSE_HEIGHT,
    ...("floor" in depth
      ? { depthFloorZ: depth.floor }
      : { depthDy: depth.upright - TREE_HOUSE_HEIGHT }),
    ...(view ? { view } : {}),
  };
}

const { deck, ladder, room, door } = TREE_HOUSE_LAYOUT;

export function treeHouseWalls(): PropCollider[] {
  return [
    // Deck slab: too low beneath to walk under; its top is the cabin floor.
    local(deck, { zBase: 10, zHeight: DECK_Z - 10, walkableTop: true }),
    // Climbable column south of the porch.
    local(ladder, { zBase: 0, zHeight: DECK_Z, passable: true, ladder: true }),
    // Cabin volume for the roof cutaway; never solid.
    local(room, { zBase: DECK_Z, zHeight: 30, passable: true, room: true }),
    // Cabin walls, with a doorway onto the porch.
    wall(room.left - 2, room.top, room.right + 1, room.top + 3),
    wall(room.left - 2, room.top, room.left + 1, room.bottom),
    wall(room.right - 2, room.top, room.right + 1, room.bottom),
    wall(room.left - 2, room.bottom - 3, door.left, room.bottom),
    wall(door.right, room.bottom - 3, room.right + 1, room.bottom),
  ];
}

export function treeHouseParts(): FacadePiece[] {
  const floor = { floor: DECK_Z };
  /** Small furniture standing on the deck, bottom at sprite row `bottom`. */
  const onDeck = (atlasX: number, atlasY: number, h: number, x: number, bottom: number) =>
    crop(atlasX, atlasY, 16, h, x, bottom - h, { upright: bottom + DECK_Z }, "inside");
  // Unedited 16px bands of the composite, each with the plane its pixels depict,
  // so actors on the deck draw in front and ground grass stays beneath it.
  return [
    // Canopy and roof stand behind the deck's back edge.
    crop(1328, 96, 144, 96, 0, 0, { upright: deck.top }, "outside"),
    // Cabin front and deck band, drawn on the deck's floor plane.
    crop(1328, 192, 144, 48, 0, 96, floor, "outside"),
    // Inside: the matching bare deck band from the base kit, plus furniture.
    crop(1472, 192, 80, 48, 32, 96, floor, "inside"),
    onDeck(1872, 160, 32, 38, 126), // sleeping bag
    onDeck(1808, 96, 32, 58, 118), // backpack
    onDeck(1872, 128, 16, 80, 114), // lantern
    // Deck lip, ladder, trunk, tyre swing and bush, standing at the deck's front.
    crop(1328, 240, 144, 32, 0, 144, { upright: deck.bottom }),
  ];
}

/** Feet (`wx`, `wy`) are the composite's bottom centre. */
export function treeHouseProp(wx: number, wy: number): Prop {
  return {
    id: 0,
    type: "prop-tree-house",
    isProp: true,
    position: { wx, wy },
    // Depth at the deck's south edge, so a climber on the ladder draws in front.
    sortOffsetY: ladder.top - TREE_HOUSE_HEIGHT,
    sprite: {
      sheetKey: "me-complete",
      frameCol: 1328 / 16,
      frameRow: 96 / 16,
      spriteWidth: TREE_HOUSE_WIDTH,
      spriteHeight: TREE_HOUSE_HEIGHT,
      parts: treeHouseParts(),
    },
    collider: local(deck, {}),
    walls: treeHouseWalls(),
  };
}

/** World position of a local composite ground point for a tree house at feet (wx, wy). */
export function treeHousePoint(wx: number, wy: number, x: number, y: number) {
  return { wx: wx - TREE_HOUSE_WIDTH / 2 + x, wy: wy - TREE_HOUSE_HEIGHT + y };
}
