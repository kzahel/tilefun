import { required } from "../art/ArtCatalog.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import { carriagePose, headingFrame, type RailAlignment } from "./RailPath.js";
import source from "./RailwaySource.json" with { type: "json" };

export const CURVE_TRAIN = "train-curve-proof-v1";
export const CURVE_TYPES: readonly string[] = [
  `${CURVE_TRAIN}:rear`,
  CURVE_TRAIN,
  `${CURVE_TRAIN}:front`,
];
export const CURVE_TRAIN_DEF: EntityDef = {
  sprite: {
    sheetKey: CURVE_TRAIN,
    spriteWidth: 192,
    spriteHeight: 192,
    drawOffsetY: 96,
    frameCount: 1,
    frameDuration: 1000,
  },
  collider: {
    offsetX: 0,
    offsetY: 12,
    width: 160,
    height: 24,
    physicalHeight: 44,
    clientSolid: true,
  },
  wanderAI: null,
  hasVelocity: true,
  noShadow: true,
};
export const CURVE_TRAIN_DEFS: Record<string, EntityDef> = Object.fromEntries(
  CURVE_TYPES.map((type) => [
    type,
    { ...CURVE_TRAIN_DEF, sprite: { ...required(CURVE_TRAIN_DEF.sprite), sheetKey: type } },
  ]),
);
export function isCurveTrain(e: { type: string }): boolean {
  return CURVE_TYPES.some((t) => t === e.type);
}
/** The consist's two physical ends keep their identity on reversal. Select a
 * native pose by the increasing path tangent, not the current travel velocity. */
export function curveTrainView(type: string, frame: number) {
  const index = CURVE_TYPES.indexOf(type);
  if (index < 0) return undefined;
  const quadrant = Math.floor((frame + 32) / 64) % 4;
  const vertical = quadrant % 2 === 1;
  const part =
    index === 1
      ? "Middle"
      : vertical
        ? (index === 2) === (quadrant === 1)
          ? "Front"
          : "Back"
        : (index === 2) === (quadrant === 0)
          ? "Right"
          : "Left";
  const name = vertical ? `Train_Blue_${part}_Down` : `Exterior_Train_Blue_${part}`;
  const sprite = required(
    (source.sprites as Record<string, { rect: number[]; bounds: number[] }>)[name],
  );
  const [left, top, right, bottom] = sprite.bounds;
  return {
    name,
    vertical,
    x: required(sprite.rect[0]) + required(left),
    y: required(sprite.rect[1]) + required(top),
    width: required(right) - required(left),
    height: required(bottom) - required(top),
  };
}
/** Smooth spacing between the native horizontal/vertical lengths. Cardinal
 * straights assemble exactly; the sprite pose itself intentionally snaps. */
export function curveOffsets(alignment: RailAlignment, distance: number): number[] {
  const length = (d: number, end: number) => {
    const a = alignment.sample(d).angle,
      c = Math.cos(a),
      s = Math.sin(a);
    return c * c * (end ? 148 + 12 * c * end : 160) + s * s * (end ? 126 + 17 * s * end : 112);
  };
  return [-1, 0, 1].map((end) => {
    let offset = end * 154;
    for (let i = 0; i < 4; i++)
      offset = (end * (length(distance, 0) + length(distance + offset, end))) / 2;
    return offset;
  });
}
/** Replicas derive the native cardinal footprint from the replicated heading row. */
export function applyCurveTrainFacing(e: Entity): void {
  if (!isCurveTrain(e) || !e.sprite || !e.collider) return;
  const view = required(curveTrainView(e.type, e.sprite.frameRow));
  e.collider.width = view.width;
  e.collider.height = view.vertical ? view.height : 24;
  e.collider.offsetY = e.collider.height / 2;
}
export function createCurveTrain(alignment: RailAlignment, distance: number): Entity[] {
  return curveOffsets(alignment, distance).map((offset, i) => {
    const p = carriagePose(alignment, distance + offset),
      type = required(CURVE_TYPES[i]);
    const e: Entity = {
      id: 0,
      type,
      position: { wx: p.x, wy: p.y },
      velocity: { vx: 0, vy: 0 },
      sprite: {
        ...required(CURVE_TRAIN_DEFS[type]?.sprite),
        frameRow: headingFrame(p.angle),
        frameCol: 0,
        animTimer: 0,
        direction: Direction.Right,
        moving: false,
      },
      collider: { ...required(CURVE_TRAIN_DEF.collider) },
      wanderAI: null,
      noShadow: true,
      wz: 0,
      groundZ: 0,
    };
    applyCurveTrainFacing(e);
    return e;
  });
}
