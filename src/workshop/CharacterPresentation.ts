import type { CharacterSettings } from "../characters/CharacterCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Camera } from "../rendering/Camera.js";
import { interpolatePosition, interpolateWz } from "../rendering/EntityInterpolation.js";
import type { OverlayFrame } from "../rendering/OverlayFrame.js";
import { CHARACTER_TEST_BLOCKS } from "../scenarios/CharacterRecipe.js";
import type { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";

/** Diagnostic geometry only. The host owns time, predicted poses and scene drawing. */
export function characterGrid(frame: OverlayFrame, { camera }: ScenarioPresentationHost) {
  for (let y = -112; y <= 96; y += 16) {
    const a = camera.worldToScreen(-144, y),
      b = camera.worldToScreen(144, y);
    frame.line(a.sx, a.sy, b.sx, b.sy, "#b7c9b1");
  }
  for (let x = -144; x <= 144; x += 16) {
    const a = camera.worldToScreen(x, -112),
      b = camera.worldToScreen(x, 96);
    frame.line(a.sx, a.sy, b.sx, b.sy, "#b7c9b1");
  }
}

function rect(
  frame: OverlayFrame,
  camera: Camera,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const p = camera.worldToScreen(x, y);
  frame.rect(p.sx, p.sy, w * camera.scale, h * camera.scale, "", color);
}

export function characterOverlay(
  frame: OverlayFrame,
  host: ScenarioPresentationHost,
  settings: CharacterSettings,
  showGeometry: boolean,
) {
  const { camera } = host;
  const font = `${4 * camera.scale}px sans-serif`;
  for (const b of CHARACTER_TEST_BLOCKS) {
    const p = camera.worldToScreen(b.x - b.w / 2, b.y + 7);
    frame.label(b.name, p.sx, p.sy, "#243529", font);
  }
  const r = camera.worldToScreen(-120, 14);
  frame.label("Current player", r.sx, r.sy, "#243529", font);
  if (!showGeometry) return;
  const actor = host.presentedPlayer;
  if (!actor.collider) return;
  const position = interpolatePosition(actor.position, actor.prevPosition, host.presentationAlpha);
  const z = interpolateWz(actor, host.presentationAlpha) ?? 0;
  const box = getEntityAABB(position, actor.collider);
  const s = settings;
  rect(frame, camera, position.wx - 16, position.wy - z - 32 + s.drawOffsetY, 32, 32, "#2675d8");
  rect(frame, camera, box.left, box.top - z, s.width, s.depth, "#159144");
  rect(frame, camera, box.left, box.top - z - s.physicalHeight, s.width, s.depth, "#d62f85");
  for (const x of [box.left, box.right])
    for (const y of [box.top, box.bottom])
      rect(frame, camera, x, y - z - s.physicalHeight, 0, s.physicalHeight, "#d62f85");
  rect(frame, camera, position.wx - 20, position.wy + s.sortOffsetY, 40, 0, "#9343ae");
  const p = camera.worldToScreen(position.wx, position.wy - z);
  frame.rect(p.sx - 3, p.sy - 3, 6, 6, "#f59d00");
  for (const prop of host.session.view.props) {
    if (!prop.sprite.sheetKey.startsWith("character-test-block-") || !prop.collider) continue;
    const b = getEntityAABB(prop.position, prop.collider);
    rect(frame, camera, b.left, b.top, b.right - b.left, b.bottom - b.top, "#bd4b2d");
  }
}
