import type { Spritesheet } from "../assets/Spritesheet.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { createProp } from "../entities/PropFactories.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import type { StreetRect, StreetScene } from "../generation/regional/StreetRecipes.js";
import { Camera } from "../rendering/Camera.js";
import { CanvasRenderBackend } from "../rendering/CanvasRenderBackend.js";
import { drawCitySurfacePieces } from "../rendering/CitySurfaceRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import { collectSceneOrder } from "../rendering/RenderFrame.js";
import { composeStreetStarterSurface } from "../road/StreetStarterSurface.js";
import { World } from "../world/World.js";
import { reviewContext2D } from "./reviewCanvas.js";

/** Phase-0 furniture stage. Surfaces reuse the dense city composer; sprites and
 * collision use the game factories/renderer. This is not a district generator.
 */
export function drawStreetShowcase(
  canvas: HTMLCanvasElement,
  scene: StreetScene,
  sheet: Spritesheet,
  geometry: boolean,
) {
  const b = scene.bounds;
  canvas.width = (b.maxX - b.minX) * 2;
  canvas.height = (b.maxY - b.minY) * 2;
  const ctx = reviewContext2D(canvas);
  ctx.imageSmoothingEnabled = false;
  const camera = new Camera();
  camera.setViewport(canvas.width, canvas.height);
  camera.zoom = 2 / PIXEL_SCALE;
  camera.snapTo((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  const rect = (r: StreetRect) => {
    const { sx, sy } = camera.worldToScreen(r.minX, r.minY);
    return [sx, sy, (r.maxX - r.minX) * 2, (r.maxY - r.minY) * 2] as const;
  };
  ctx.fillStyle = "#20302a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCitySurfacePieces(ctx, sheet, composeStreetStarterSurface(b), b.minX, b.minY, 2);
  ctx.strokeStyle = "#d3cba7";
  ctx.lineWidth = 2;
  for (const bay of scene.parking) ctx.strokeRect(...rect(bay));
  const props = [{ type: scene.buildingType, wx: 0, wy: 0 }, ...scene.props].map((p, i) => ({
    ...createProp(p.type, p.wx, p.wy),
    id: i + 1,
  }));
  const renderer = new CanvasRenderBackend(ctx, new Map([["me-complete", sheet]]));
  const items = collectScene(
    [],
    props,
    new World(new FlatStrategy()),
    camera,
    camera.getVisibleChunkRange(),
    1,
    renderer,
    [],
    false,
  );
  renderer.submit(camera, { kind: "scene", items, order: collectSceneOrder(items, []) });
  renderer.dispose();
  if (geometry) {
    ctx.strokeStyle = "#8befb5";
    ctx.strokeRect(...rect(scene.walkway));
    ctx.strokeStyle = "#ffdb7c";
    ctx.strokeRect(...rect(scene.approach));
    ctx.strokeStyle = "#ff8f8f";
    for (const p of props)
      for (const c of p.walls ?? (p.collider ? [p.collider] : [])) {
        ctx.strokeRect(
          ...rect({
            minX: p.position.wx + c.offsetX - c.width / 2,
            maxX: p.position.wx + c.offsetX + c.width / 2,
            minY: p.position.wy + c.offsetY - c.height / 2,
            maxY: p.position.wy + c.offsetY + c.height / 2,
          }),
        );
      }
  }
  return { width: b.maxX - b.minX, height: b.maxY - b.minY, parts: items.length };
}
