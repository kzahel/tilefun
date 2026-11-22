import { Direction } from "../entities/Entity.js";
import {
  AXE,
  BALL,
  HAND_FRAME,
  HELD_SHEET,
  handItem,
  handUses,
  type ItemId,
  STICK,
} from "../inventory/Inventory.js";
import type { SpriteItem } from "./SceneItem.js";

/** Seconds one use pose lasts (a swing, throw, scatter or wave). */
export const USE_POSE_SECONDS = 0.32;

/** One frame of an avatar's hand: the held-items sheet cell and its offset. */
export interface HandFrame {
  readonly column: number;
  readonly row: number;
  /** Ground-plane offset from the carried position toward the facing, in world pixels. */
  readonly dx: number;
  readonly dy: number;
  /** Height above the carried position, in world pixels. */
  readonly lift: number;
  readonly flipX: boolean;
}

/** A body whose hand is posed: its entity id and replicated hand byte. */
export interface HandBody {
  readonly id: number;
  readonly hand?: number | undefined;
}

interface Seen {
  uses: number;
  start: number;
  /** Presentation time this body was last drawn, for pruning departed bodies. */
  drawn: number;
}
/** One clock for every caller: scene passes and the first-person HUD do not share a
 * time base, and a pose started on one base must not be timed on another. */
function clockSeconds(): number {
  return performance.now() / 1000;
}

/** Keyed by entity id: presentation hands out fresh entity objects each snapshot. */
const seen = new Map<number, Seen>();
const PRUNE_SIZE = 256;
const PRUNE_AFTER_SECONDS = 10;

/**
 * Seconds since this body's last counted use, or undefined when no pose plays.
 * A changed use counter starts the pose; the first sighting of a body does not,
 * so joining or streaming a player in never replays an old swing.
 */
function elapsedSinceUse(body: HandBody, now: number): number | undefined {
  const uses = handUses(body);
  const record = seen.get(body.id);
  if (!record) {
    if (seen.size >= PRUNE_SIZE)
      for (const [id, old] of seen) if (now - old.drawn > PRUNE_AFTER_SECONDS) seen.delete(id);
    seen.set(body.id, { uses, start: Number.NEGATIVE_INFINITY, drawn: now });
    return undefined;
  }
  record.drawn = now;
  if (record.uses !== uses) {
    record.uses = uses;
    record.start = now;
  }
  const elapsed = now - record.start;
  return elapsed >= 0 && elapsed < USE_POSE_SECONDS ? elapsed : undefined;
}

const SWINGS: ReadonlySet<ItemId> = new Set([STICK, AXE]);

/** Forward unit vector of a facing in world space. */
function forward(direction: Direction): { x: number; y: number } {
  switch (direction) {
    case Direction.Left:
      return { x: -1, y: 0 };
    case Direction.Right:
      return { x: 1, y: 0 };
    case Direction.Up:
      return { x: 0, y: -1 };
    default:
      return { x: 0, y: 1 };
  }
}

/**
 * What the hand shows now: the carried item, a use pose for it, or a waving
 * glove when an empty hand was used. Undefined for an empty, resting hand.
 */
export function handFrame(
  body: HandBody,
  direction: Direction,
  now = clockSeconds(),
): HandFrame | undefined {
  const item = handItem(body);
  const elapsed = elapsedSinceUse(body, now);
  const t = elapsed === undefined ? undefined : elapsed / USE_POSE_SECONDS;
  const ahead = forward(direction);
  // Tools point the way the avatar faces; corn and wood keep their carried art.
  const flipX = direction === Direction.Left && item !== undefined && item >= BALL;
  if (item === undefined) {
    if (t === undefined) return undefined;
    // A glove beside the head waggles side to side twice. Attachments stay within a
    // few pixels of the hand: the scene drops sprites lifted much higher.
    return {
      column: HAND_FRAME,
      row: 0,
      dx: 2 + Math.round(Math.sin(t * Math.PI * 4) * 2),
      dy: 0,
      lift: 3,
      flipX: false,
    };
  }
  const column = item - 1;
  if (t === undefined) return { column, row: 0, dx: 0, dy: 0, lift: 0, flipX };
  if (SWINGS.has(item)) {
    // Wind up behind, then sweep through in front.
    const through = t >= 0.35;
    // The follow-through stays in the hand: its art already reaches forward.
    const reach = through ? 0 : -1;
    return {
      column,
      row: through ? 2 : 1,
      dx: Math.round(ahead.x * reach),
      dy: Math.round(ahead.y * reach),
      lift: through ? 0 : 3,
      flipX,
    };
  }
  // Throws and scatters: a quick push forward and back.
  const push = Math.sin(t * Math.PI) * 5;
  return {
    column,
    row: 0,
    dx: Math.round(ahead.x * push),
    dy: Math.round(ahead.y * push),
    lift: 1,
    flipX,
  };
}

/**
 * The scene sprite for an avatar's hand (the carried item, its use pose or a
 * waving glove), beside the body at `pos`; undefined while riding or empty-handed.
 */
export function heldItemSprite(
  body: HandBody & { readonly parentId?: number | undefined },
  direction: Direction,
  pos: { readonly wx: number; readonly wy: number },
  sortKey: number,
  zOffset: number,
): SpriteItem | undefined {
  if (body.hand === undefined || body.parentId !== undefined) return undefined;
  const hand = handFrame(body, direction);
  if (!hand) return undefined;
  const handX = direction === Direction.Left ? -7 : direction === Direction.Right ? 7 : 5;
  const handY = direction === Direction.Up ? -2 : 2;
  return {
    kind: "sprite",
    sortKey: sortKey + 0.05,
    wx: pos.wx + handX + hand.dx,
    wy: pos.wy + handY + hand.dy,
    zOffset: zOffset + 7 + hand.lift,
    sheetKey: HELD_SHEET,
    frameCol: hand.column,
    frameRow: hand.row,
    spriteWidth: 8,
    spriteHeight: 8,
    flipX: hand.flipX,
    hasShadow: false,
    drawOffsetY: 0,
    shadowFeetWy: pos.wy,
    shadowWidth: 0,
    shadowTerrainZ: zOffset,
    flashHidden: false,
  };
}
