import { CAMERA_LERP } from "../config/constants.js";
import type { GameContext, GameScene } from "../core/GameScene.js";
import { renderDebugOverlay, renderEntities, renderWorld } from "./renderWorld.js";

/**
 * Play mode scene.
 * Handles: player movement input, camera follow, gem HUD, touch joystick.
 */
export class PlayScene implements GameScene {
  readonly transparent = false;

  onEnter(gc: GameContext): void {
    gc.touchJoystick.attach();
    if (gc.editorButton) gc.editorButton.textContent = "Edit";

    // Tell server we're in play mode
    if (!gc.serialized && gc.server) {
      gc.server.getLocalSession().editorEnabled = false;
    }
    gc.transport.send({ type: "set-editor-mode", enabled: false });
  }

  onExit(gc: GameContext): void {
    gc.touchJoystick.detach();
  }

  onResume(gc: GameContext): void {
    gc.touchJoystick.attach();
  }

  onPause(gc: GameContext): void {
    gc.touchJoystick.detach();
  }

  update(dt: number, gc: GameContext): void {
    // Debug panel state
    gc.camera.zoom = gc.debugPanel.zoom;
    if (gc.debugPanel.consumeBaseModeChange() || gc.debugPanel.consumeConvexChange()) {
      if (gc.serialized) {
        gc.transport.send({ type: "invalidate-all-chunks" });
      } else if (gc.server) {
        gc.server.invalidateAllChunks();
      }
    }

    if (gc.serialized) {
      gc.transport.send({
        type: "set-debug",
        paused: gc.debugPanel.paused,
        noclip: gc.debugPanel.noclip,
      });
    } else if (gc.server) {
      const session = gc.server.getLocalSession();
      session.debugPaused = gc.debugPanel.paused;
      session.debugNoclip = gc.debugPanel.noclip;
    }

    // Player movement input
    const movement = gc.actions.getMovement();
    gc.transport.send({
      type: "player-input",
      dx: movement.dx,
      dy: movement.dy,
      sprinting: movement.sprinting,
    });

    // Server tick + camera follow + chunk loading
    if (gc.serialized) {
      gc.camera.follow(
        gc.stateView.playerEntity.position.wx,
        gc.stateView.playerEntity.position.wy,
        CAMERA_LERP,
      );
      if (gc.debugPanel.observer && gc.camera.zoom !== 1) {
        const savedZoom = gc.camera.zoom;
        gc.camera.zoom = 1;
        gc.sendVisibleRange();
        gc.camera.zoom = savedZoom;
      } else {
        gc.sendVisibleRange();
      }
    } else if (gc.server) {
      const session = gc.server.getLocalSession();
      session.visibleRange = gc.camera.getVisibleChunkRange();
      gc.server.tick(dt);

      gc.camera.follow(
        gc.stateView.playerEntity.position.wx,
        gc.stateView.playerEntity.position.wy,
        CAMERA_LERP,
      );

      session.cameraX = gc.camera.x;
      session.cameraY = gc.camera.y;
      session.cameraZoom = gc.camera.zoom;

      if (gc.debugPanel.observer && gc.camera.zoom !== 1) {
        const savedZoom = gc.camera.zoom;
        gc.camera.zoom = 1;
        gc.server.updateVisibleChunks(gc.camera.getVisibleChunkRange());
        gc.camera.zoom = savedZoom;
      } else {
        gc.server.updateVisibleChunks(gc.camera.getVisibleChunkRange());
      }
    }
  }

  render(_alpha: number, gc: GameContext): void {
    renderWorld(gc);
    renderEntities(gc);
    drawGemHUD(gc);
    renderDebugOverlay(gc);
    gc.touchJoystick.draw(gc.ctx);
  }
}

function drawGemHUD(gc: GameContext): void {
  if (!gc.gemSpriteCanvas) return;
  const { ctx, canvas, stateView } = gc;
  const ICON_SIZE = 24;
  const PADDING = 12;
  const x = canvas.width - PADDING - ICON_SIZE - 48;
  const y = PADDING;

  // Gem icon
  ctx.drawImage(gc.gemSpriteCanvas, 0, 0, 16, 16, x, y, ICON_SIZE, ICON_SIZE);

  // Count text
  ctx.save();
  ctx.font = "bold 20px monospace";
  ctx.textBaseline = "top";
  const text = `${stateView.gemsCollected}`;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.strokeText(text, x + ICON_SIZE + 6, y + 2);
  ctx.fillStyle = "#FFD700";
  ctx.fillText(text, x + ICON_SIZE + 6, y + 2);

  // Buddy count
  let buddyCount = 0;
  for (const e of stateView.entities) {
    if (e.wanderAI?.following) buddyCount++;
  }
  if (buddyCount > 0) {
    const bx = x - 60;
    ctx.strokeStyle = "#000";
    ctx.strokeText(`\u2764 ${buddyCount}`, bx, y + 2);
    ctx.fillStyle = "#ff88aa";
    ctx.fillText(`\u2764 ${buddyCount}`, bx, y + 2);
  }
  ctx.restore();
}
