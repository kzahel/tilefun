import { required } from "../art/ArtCatalog.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import { carriagePose, headingFrame, type RailAlignment } from "./RailPath.js";

export const CURVE_TRAIN = "train-curve-proof-v1";
export const CURVE_OFFSETS = [-112, 0, 112] as const;
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
    offsetY: 14,
    width: 96,
    height: 28,
    physicalHeight: 40,
    clientSolid: true,
  },
  wanderAI: null,
  hasVelocity: true,
  noShadow: true,
};
/** The replicated orientation row selects one of 256 procedural heading frames.
 * Authority and replicas derive the same conservative body envelope from that row. */
export function applyCurveTrainFacing(e: Entity): void {
  if (e.type !== CURVE_TRAIN || !e.sprite || !e.collider) return;
  const angle = (e.sprite.frameRow * Math.PI) / 128;
  const c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  e.collider.width = c * 96 + s * 28;
  e.collider.height = s * 96 + c * 28;
  e.collider.offsetY = e.collider.height / 2;
}
export function createCurveTrain(alignment: RailAlignment, distance: number): Entity[] {
  return CURVE_OFFSETS.map((offset) => {
    const p = carriagePose(alignment, distance + offset);
    const e: Entity = {
      id: 0,
      type: CURVE_TRAIN,
      position: { wx: p.x, wy: p.y },
      velocity: { vx: 0, vy: 0 },
      sprite: {
        ...required(CURVE_TRAIN_DEF.sprite),
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
