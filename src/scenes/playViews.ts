import type { GameContext } from "../core/GameScene.js";
import { cssRegion } from "../input/ViewRect.js";
import { projectWorld } from "../rendering/Projection.js";
import { layoutViews } from "../rendering/ViewLayout.js";
import { seatBody } from "../session/SeatFocus.js";
import type { View } from "../session/View.js";
import { drawPlayerMarkers } from "../ui/PlayerMarkers.js";
import { renderFirstPerson } from "./firstPersonPlay.js";

/**
 * Play's split-screen views (226): one view per seat, laid out each tick. Seat 0's
 * view keeps the play scene's own paths (its visible range, tap destination, touch
 * controls and first person); guests' views get their range in their envelope, their
 * own hit feedback and a badge.
 */

const GUEST_HIT_SHAKE = 6;

/** Lay the views out for this tick and start each camera's step. */
export function beginViewTick(gc: GameContext): readonly View[] {
  const views = gc.session.layoutViews(gc.canvas.width, gc.canvas.height, true);
  for (const view of views) {
    view.camera.savePrev();
    view.camera.zoom = gc.debugPanel.zoom * view.zoomScale;
  }
  // Seat 0's touch controls and gestures stay inside its view (the whole canvas alone).
  const touch = views.length > 1 ? cssRegion(gc.canvas, gc.view.region) : null;
  gc.touchJoystick.region = gc.touchButtons.region = touch;
  if (gc.touchPinch) gc.touchPinch.region = touch;
  return views;
}

/** After the predicted step: guests' cameras follow and send their ranges (none
 * until the guest's body is streamed, so no range goes around the world origin). */
export function followGuestViews(gc: GameContext): void {
  for (const view of gc.session.views) {
    if (view.seat === 0 || !seatBody(gc.session, view.seat)) continue;
    view.policy.tick(view.camera, gc.session);
    const range = view.camera.getVisibleChunkRange();
    const key = `${range.minCx},${range.minCy},${range.maxCx},${range.maxCy}`;
    if (key === view.rangeKey) continue;
    view.rangeKey = key;
    gc.transport.send({
      type: "seat",
      seat: view.seat,
      message: {
        type: "visible-range",
        minCx: range.minCx,
        minCy: range.minCy,
        maxCx: range.maxCx,
        maxCy: range.maxCy,
      },
    });
  }
}

/** Guests' own feedback from their seat's sync: a hit shakes that seat's view and
 * sounds, as gem pickups do (spatial sound stays at seat 0, the one listener). */
export class GuestFeedback {
  private readonly last = new Map<number, { gems: number; hit: number }>();

  update(gc: GameContext, sound: (kind: "hit" | "gem") => void): void {
    const seen = new Set<number>();
    for (const view of gc.session.views) {
      if (view.seat === 0) continue;
      const sync = gc.stateView.seats.session(view.seat, gc.stateView.serverTick);
      if (!sync) continue;
      seen.add(view.seat);
      const last = this.last.get(view.seat);
      if (last && sync.invincibilityTimer > 0 && last.hit === 0) {
        view.camera.shake(GUEST_HIT_SHAKE);
        sound("hit");
      }
      if (last && sync.gemsCollected > last.gems) sound("gem");
      this.last.set(view.seat, { gems: sync.gemsCollected, hit: sync.invincibilityTimer });
    }
    for (const seat of this.last.keys()) if (!seen.has(seat)) this.last.delete(seat);
  }
}

/** Every camera's shake decays once per tick. */
export function endViewTick(gc: GameContext): void {
  for (const view of gc.session.views) view.camera.updateShake();
}

/** Display frame: place every view's interpolated camera. */
export function presentViews(gc: GameContext, alpha: number): void {
  for (const view of gc.session.views) view.policy.present(view.camera, gc.session, alpha);
}

export function restoreViews(gc: GameContext): void {
  for (const view of gc.session.views) view.camera.restoreActual();
}

/** First person draws only while one seat plays. */
export function renderSoloFirstPerson(gc: GameContext, alpha: number): boolean {
  if (gc.session.views.length > 1) {
    gc.firstPerson?.hideView();
    return false;
  }
  return renderFirstPerson(gc, alpha);
}

/** Each view's overlays inside its region: player markers (partners marked, the
 * view's own player not) and, in split screen, each seat's badge. A 2×2 grid with
 * three players shows how to join in its empty corner. */
export function drawViewOverlays(gc: GameContext, alpha: number): void {
  const { ctx, session } = gc;
  const split = session.views.length > 1;
  if (session.views.length === 3) drawJoinHint(gc);
  for (const view of session.views) {
    const { x, y, width, height } = view.region;
    ctx.save();
    try {
      if (split) {
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        ctx.translate(x, y);
      }
      const own = view.seat === 0 ? gc.stateView.playerEntity.id : seatEntityId(gc, view.seat);
      drawPlayerMarkers({ ctx, camera: view.camera, stateView: gc.stateView }, alpha, own);
      if (split) drawSeatBadge(gc, view);
      if (view.seat !== 0) drawSeatPrompts(gc, view);
    } finally {
      ctx.restore();
    }
  }
}

export const JOIN_HINT = "Press / or a controller button to join";

function drawJoinHint(gc: GameContext): void {
  const empty = layoutViews("4", gc.canvas.width, gc.canvas.height)[3]?.region;
  if (!empty) return;
  const { ctx } = gc;
  ctx.save();
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#c9d4cc";
  ctx.fillText(JOIN_HINT, empty.x + empty.width / 2, empty.y + empty.height / 2, empty.width - 24);
  ctx.restore();
}

function seatEntityId(gc: GameContext, seat: number): number {
  return gc.stateView.seats.entities.get(seat) ?? -1;
}

/** A seat's name and gems at the top right of its view (below the page's map button
 * when the view touches the page's top right corner). */
function drawSeatBadge(gc: GameContext, view: View): void {
  const { ctx } = gc;
  const gems =
    view.seat === 0
      ? gc.stateView.gemsCollected
      : (gc.stateView.seats.session(view.seat, gc.stateView.serverTick)?.gemsCollected ?? 0);
  const label = `Player ${view.seat + 1}`;
  const count = gems.toLocaleString();
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(label).width + ctx.measureText(count).width;
  const width = textWidth + 24 + 20 + 12;
  const cornered = view.region.y === 0 && view.region.x + view.region.width >= gc.canvas.width;
  const left = view.region.width - width - 8;
  const top = cornered ? 60 : 8;
  ctx.fillStyle = "#14251eef";
  ctx.strokeStyle = "#c9a857";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(left, top, width, 32, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4f5ec";
  ctx.fillText(label, left + 10, top + 16);
  const iconX = left + 10 + ctx.measureText(label).width + 10;
  if (gc.gemSpriteCanvas) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(gc.gemSpriteCanvas, 0, 0, 16, 16, iconX, top + 6, 20, 20);
  }
  ctx.fillStyle = "#ffe38a";
  ctx.fillText(count, iconX + 24, top + 16);
}

/** A guest's place prompts at the bottom of its view, nearest the player last
 * (seat 0's are page controls inside its view). */
function drawSeatPrompts(gc: GameContext, view: View): void {
  const lines = gc.session.seats.get(view.seat)?.prompts ?? [];
  if (!lines.length) return;
  const { ctx } = gc;
  ctx.font = "15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const centre = view.region.width / 2;
  let top = view.region.height - 16 - lines.length * 36;
  for (const line of lines) {
    const width = Math.min(view.region.width - 24, ctx.measureText(line).width + 24);
    ctx.fillStyle = "#243a32ee";
    ctx.strokeStyle = "#c5d3b6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(centre - width / 2, top, width, 30, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line, centre, top + 15, width - 16);
    top += 36;
  }
}

/** Draw seat 0's own overlays inside its view's region (clipped in split screen). */
export function inHostView(gc: GameContext, draw: () => void): void {
  if (gc.session.views.length < 2) {
    draw();
    return;
  }
  const { ctx } = gc;
  const { x, y, width, height } = gc.view.region;
  ctx.save();
  try {
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.translate(x, y);
    draw();
  } finally {
    ctx.restore();
  }
}

/** Seat 0's tap or hold destination, in its view. */
export function drawTapDestination(gc: GameContext): void {
  inHostView(gc, () => drawDestination(gc));
}

function drawDestination(gc: GameContext): void {
  const controller = gc.tapMovement;
  const target = controller?.target ?? (controller?.blockedFade ? controller.blockedTarget : null);
  if (!target) {
    delete gc.canvas.dataset.tapDestination;
    return;
  }
  const p = projectWorld(gc.camera, target.wx, target.wy, target.wz);
  gc.canvas.dataset.tapDestination = JSON.stringify({
    ...target,
    ...p,
    active: !!controller?.target,
  });
  const ctx = gc.ctx;
  ctx.save();
  ctx.globalAlpha = controller?.target ? 1 : (controller?.blockedFade ?? 0) / 0.4;
  ctx.strokeStyle = controller?.target ? "#ffe38a" : "#ffb694";
  ctx.lineWidth = 3;
  ctx.fillStyle = "rgba(255,227,138,0.25)";
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
