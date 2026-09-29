import { PIXEL_SCALE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import { drawFurnishedInterior } from "../interiors/FurnishedInterior.js";
import {
  furnitureAsset,
  INTERIOR_FLOOR,
  INTERIOR_WALL_TYPE,
  interiorPlan,
} from "../interiors/GameplayInterior.js";
import { Camera } from "../rendering/Camera.js";
import { drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import type { ParticleItem } from "../rendering/SceneItem.js";

let lastKey = "";
let shell: ReturnType<typeof interiorPlan> | null = null;
const nativeCamera = new Camera();
nativeCamera.zoom = 1 / PIXEL_SCALE;

/** Same wall/furniture renderer; actors come from the production scene collector. */
export function renderInterior(gc: GameContext, alpha: number, particles: ParticleItem[]): void {
  const identity = gc.stateView.interior;
  if (!identity) return;
  const atlas = gc.sheets.get("modern-interiors");
  if (!atlas) return;
  const key = JSON.stringify(identity);
  if (key !== lastKey) {
    shell = interiorPlan(identity);
    lastKey = key;
  }
  if (!shell) return;
  const placements = gc.stateView.props.flatMap((prop) => {
    const asset = furnitureAsset(prop.type);
    return asset
      ? [
          {
            id: `furniture-${prop.id}`,
            asset,
            x: prop.position.wx,
            y: prop.position.wy,
          },
        ]
      : [];
  });
  const drawProps = new Set(
    gc.stateView.props
      .filter((p) => p.type !== INTERIOR_WALL_TYPE && !furnitureAsset(p.type))
      .map((p) => p.id),
  );
  const items = collectScene(
    gc.stateView.entities,
    gc.stateView.props,
    gc.stateView.world,
    gc.camera,
    gc.camera.getVisibleChunkRange(),
    alpha,
    gc.tileRenderer,
    particles,
    false,
    undefined,
    drawProps,
  );
  const actors = items.map((item, index) => ({
    id: `actor:${index}`,
    depth: item.sortKey,
    draw: (ctx: CanvasRenderingContext2D) =>
      drawScene2D(ctx, nativeCamera, [item], gc.sheets, undefined),
  }));
  const origin = gc.camera.worldToScreen(0, 0);
  gc.ctx.save();
  gc.ctx.translate(origin.sx, origin.sy);
  gc.ctx.scale(gc.camera.scale, gc.camera.scale);
  drawFurnishedInterior(
    gc.ctx,
    atlas.image,
    shell.map,
    shell.plan,
    placements,
    actors,
    INTERIOR_FLOOR,
  );
  gc.ctx.restore();
}
