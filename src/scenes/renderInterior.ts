import { PIXEL_SCALE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import { CachedInteriorRenderer } from "../interiors/CachedInteriorRenderer.js";
import {
  furnitureAsset,
  INTERIOR_FLOOR,
  INTERIOR_WALL_TYPE,
} from "../interiors/GameplayInterior.js";
import { compileGameplayRoom, initialRoom } from "../interiors/GameplayRoom.js";
import { Camera } from "../rendering/Camera.js";
import { drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import type { ParticleItem } from "../rendering/SceneItem.js";

let lastKey = "";
let renderer: CachedInteriorRenderer | null = null;
let lastAtlas: CanvasImageSource | null = null;
const nativeCamera = new Camera();
nativeCamera.zoom = 1 / PIXEL_SCALE;

/** Same wall/furniture renderer; actors come from the production scene collector. */
export function renderInterior(gc: GameContext, alpha: number, particles: ParticleItem[]): void {
  const identity = gc.stateView.interior;
  if (!identity) return;
  const atlas = gc.sheets.get("modern-interiors");
  if (!atlas) return;
  const preview = gc.editorMode.getRoomPreview();
  const state = gc.stateView.roomState;
  const key = JSON.stringify([identity, preview?.room?.plan.rows ?? state]);
  if (key !== lastKey || atlas.image !== lastAtlas) {
    // Realm identity arrives before the room baseline. Render its versioned
    // initial layout until the authoritative saved/edited plan is available.
    const room = preview?.room ?? compileGameplayRoom(identity, state ?? initialRoom(identity));
    const shell = room;
    renderer = new CachedInteriorRenderer(
      atlas.image,
      shell.map,
      shell.plan,
      !room.legacy ? room.furnitureFloor : INTERIOR_FLOOR,
      !room.legacy,
    );
    lastAtlas = atlas.image;
    lastKey = key;
  }
  if (!renderer) return;
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
    gc.doorPresentation?.entities(gc.stateView.entities, gc.realmId ?? null) ??
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
    gc.sceneFrame,
  );
  const actors = items.map((item, index) => ({
    id: `actor:${index}`,
    depth: item.sortKey,
    draw: (ctx: CanvasRenderingContext2D) =>
      drawScene2D(ctx, nativeCamera, [item], gc.sheets, undefined, false, gc.tileRenderer),
  }));
  const origin = gc.camera.worldToScreen(0, 0);
  gc.ctx.save();
  gc.ctx.translate(origin.sx, origin.sy);
  gc.ctx.scale(gc.camera.scale, gc.camera.scale);
  try {
    renderer.draw(gc.ctx, placements, actors);
  } finally {
    gc.ctx.restore();
    gc.sceneFrame.release();
  }
}
