import { PIXEL_SCALE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import type { Entity } from "../entities/Entity.js";
import { interpolatePosition, interpolateWz } from "../rendering/EntityInterpolation.js";
import { projectWorld } from "../rendering/Projection.js";
import type { RenderView } from "../rendering/RenderFrame.js";

const INSET = 28;
const COLORS = ["#7dd3fc", "#c4b5fd", "#fcd34d", "#86efac", "#fda4af"] as const;

export interface PlayerMarker {
  id: number;
  name: string;
  x: number;
  y: number;
  /** Radians clockwise from right. Visible players get a downward pointer. */
  angle: number;
  offscreen: boolean;
}

/** Read the same displayed poses/projection as the bodies, without changing game state. */
export function collectPlayerMarkers(
  view: RenderView,
  entities: readonly Entity[],
  localPlayerId: number,
  names: Readonly<Record<number, string>>,
  alpha: number,
): PlayerMarker[] {
  const { viewportWidth: width, viewportHeight: height } = view;
  if (width <= INSET * 2 || height <= INSET * 2) return [];
  const scale = PIXEL_SCALE * view.zoom;
  const markers: PlayerMarker[] = [];
  for (const entity of entities) {
    if (entity.type !== "player" || entity.id === localPlayerId) continue;
    const pos = interpolatePosition(entity.position, entity.prevPosition, alpha);
    const screen = projectWorld(view, pos.wx, pos.wy, interpolateWz(entity, alpha) ?? 0);
    const bottom = screen.sy + (entity.sprite?.drawOffsetY ?? 0) * scale;
    const top = bottom - (entity.sprite?.spriteHeight ?? 32) * scale;
    const halfWidth = ((entity.sprite?.spriteWidth ?? 32) * scale) / 2;
    const offscreen =
      screen.sx + halfWidth < 0 || screen.sx - halfWidth > width || bottom < 0 || top > height;
    let x = Math.max(INSET, Math.min(width - INSET, screen.sx));
    let y = Math.max(INSET, Math.min(height - INSET, top - 16));
    let angle = Math.PI / 2;
    if (offscreen) {
      const dx = screen.sx - width / 2;
      const dy = (top + bottom) / 2 - height / 2;
      // Intersect the center-to-player ray with an inset viewport rectangle.
      const t = Math.min(
        dx === 0 ? Number.POSITIVE_INFINITY : (width / 2 - INSET) / Math.abs(dx),
        dy === 0 ? Number.POSITIVE_INFINITY : (height / 2 - INSET) / Math.abs(dy),
      );
      x = width / 2 + dx * t;
      y = height / 2 + dy * t;
      angle = Math.atan2(dy, dx);
    }
    markers.push({ id: entity.id, name: names[entity.id] ?? "Player", x, y, angle, offscreen });
  }
  return markers;
}

/** Platform HUD overlay shared by Canvas and GPU gameplay, including the editor. */
export function drawPlayerMarkers(
  gc: Pick<GameContext, "ctx" | "camera" | "stateView" | "xrActive">,
  alpha: number,
): void {
  if (gc.xrActive) return;
  const { camera: view, stateView } = gc;
  const markers = collectPlayerMarkers(
    view,
    stateView.entities,
    stateView.playerEntity.id,
    stateView.playerNames,
    alpha,
  );
  if (markers.length === 0) return;
  const ctx = gc.ctx;
  ctx.save();
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const marker of markers) {
    const color = COLORS[Math.abs(marker.id) % COLORS.length] ?? COLORS[0];
    ctx.globalAlpha = marker.offscreen ? 0.8 : 0.95;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.rotate(marker.angle);
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(15, 23, 42, 0.65)";
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    const name = marker.name.length > 16 ? `${marker.name.slice(0, 15)}…` : marker.name;
    const labelWidth = Math.min(ctx.measureText(name).width, 100) + 12;
    const labelX = Math.max(
      labelWidth / 2 + 6,
      Math.min(
        view.viewportWidth - labelWidth / 2 - 6,
        marker.x - (marker.offscreen ? Math.cos(marker.angle) * (labelWidth / 2 + 16) : 0),
      ),
    );
    const labelY = marker.offscreen
      ? Math.max(12, Math.min(view.viewportHeight - 12, marker.y - Math.sin(marker.angle) * 22))
      : marker.y - 17;
    ctx.fillStyle = "rgba(15, 23, 42, 0.58)";
    ctx.beginPath();
    ctx.roundRect(labelX - labelWidth / 2, labelY - 9, labelWidth, 18, 6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(name, labelX, labelY, 100);
  }
  ctx.restore();
}
