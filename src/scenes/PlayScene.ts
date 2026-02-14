import type { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { CAMERA_LERP } from "../config/constants.js";
import type { GameContext, GameScene } from "../core/GameScene.js";
import { drawGrassBlades, renderDebugOverlay, renderEntities, renderWorld } from "./renderWorld.js";

/**
 * Play mode scene.
 * Handles: player movement input, camera follow, gem HUD, touch joystick.
 * In serialized mode, runs client-side prediction for the player entity.
 */
const HIT_SHAKE_INTENSITY = 6;

export class PlayScene implements GameScene {
  readonly transparent = false;
  private predictor: PlayerPredictor | null = null;
  private inputSeq = 0;
  private prevInvincibilityTimer = 0;

  onEnter(gc: GameContext): void {
    gc.touchJoystick.attach();
    if (gc.editorButton) gc.editorButton.textContent = "Edit";

    // Tell server we're in play mode
    if (!gc.serialized && gc.server) {
      gc.server.getLocalSession().editorEnabled = false;
    }
    gc.transport.send({ type: "set-editor-mode", enabled: false });

    // Create predictor for serialized mode
    if (gc.serialized) {
      this.predictor = new PlayerPredictor();
      const remoteView = gc.stateView as RemoteStateView;
      remoteView.setPredictor(this.predictor);
      // Initialize from current server state if available
      const serverPlayer = remoteView.serverPlayerEntity;
      if (serverPlayer.id !== -1) {
        this.predictor.reset(serverPlayer);
      }
    }
  }

  onExit(gc: GameContext): void {
    gc.touchJoystick.detach();
    if (gc.serialized && this.predictor) {
      (gc.stateView as RemoteStateView).setPredictor(null);
      this.predictor = null;
    }
  }

  onResume(gc: GameContext): void {
    console.log(
      `[tilefun:play] onResume — predictor=${!!this.predictor?.player}, editorEnabled=${gc.stateView.editorEnabled}, playerEntityId=${gc.stateView.playerEntity.id}`,
    );
    gc.touchJoystick.attach();
    // Re-send editor mode false — after realm switch the server may have a new
    // session that defaults editorEnabled=true
    gc.transport.send({ type: "set-editor-mode", enabled: false });
    if (gc.serialized && this.predictor) {
      (gc.stateView as RemoteStateView).setPredictor(this.predictor);
    }
  }

  onPause(gc: GameContext): void {
    gc.touchJoystick.detach();
  }

  update(dt: number, gc: GameContext): void {
    // Save camera state for render interpolation
    gc.camera.savePrev();

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
    const seq = ++this.inputSeq;
    gc.transport.send({
      type: "player-input",
      seq,
      dx: movement.dx,
      dy: movement.dy,
      sprinting: movement.sprinting,
      jump: movement.jump,
    });

    // Server tick + camera follow + chunk loading
    if (gc.serialized) {
      const remoteView = gc.stateView as RemoteStateView;

      if (this.predictor) {
        this.predictor.noclip = gc.debugPanel.noclip;

        // Reconcile BEFORE storing current input — replay rebuilds prediction
        // from server state + unacked inputs from previous frames only.
        // Storing current input first would cause it to be replayed AND
        // applied in update(), double-moving the player.
        if (remoteView.stateAppliedThisTick) {
          const serverPlayer = remoteView.serverPlayerEntity;
          if (serverPlayer.id !== -1) {
            if (!this.predictor.player) {
              console.log(
                `[tilefun:play] predictor.reset — serverPlayer.id=${serverPlayer.id}, pos=(${serverPlayer.position.wx.toFixed(1)}, ${serverPlayer.position.wy.toFixed(1)})`,
              );
              this.predictor.reset(serverPlayer);
            } else if (this.predictor.player.id !== serverPlayer.id) {
              console.log(
                `[tilefun:play] predictor entity ID mismatch: predicted=${this.predictor.player.id} server=${serverPlayer.id} — forcing reset`,
              );
              this.predictor.reset(serverPlayer);
            } else {
              this.predictor.reconcile(
                serverPlayer,
                remoteView.lastProcessedInputSeq,
                gc.stateView.world,
                gc.stateView.props,
                gc.stateView.entities,
              );
            }
          }
        }

        // Store current input for future reconciliation, then predict
        this.predictor.storeInput(seq, movement, dt);
        this.predictor.update(
          dt,
          movement,
          gc.stateView.world,
          gc.stateView.props,
          gc.stateView.entities,
        );
      }

      // Camera follows predicted player position (stateView.playerEntity
      // returns the predicted player when predictor is attached)
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

    // Detect player hit (invincibility transition 0 → >0) and trigger screen shake
    const invTimer = gc.stateView.invincibilityTimer;
    if (invTimer > 0 && this.prevInvincibilityTimer === 0) {
      gc.camera.shake(HIT_SHAKE_INTENSITY);
    }
    this.prevInvincibilityTimer = invTimer;

    gc.camera.updateShake();
  }

  render(alpha: number, gc: GameContext): void {
    gc.camera.applyInterpolation(alpha);

    // Override camera with exponential follow toward the interpolated player.
    // Standard linear camera interpolation creates derivative discontinuities
    // at tick boundaries (camera lerp != entity linear motion), visible as
    // jitter at high refresh rates. The exponential form matches the follow()
    // decay curve, giving smooth sub-tick motion tied to the player.
    if (gc.serialized && this.predictor?.player) {
      // Use predicted player's prevPosition for smooth camera interpolation
      const prev = this.predictor.prevPosition;
      const cur = this.predictor.player.position;
      const px = prev.wx + (cur.wx - prev.wx) * alpha;
      const py = prev.wy + (cur.wy - prev.wy) * alpha;
      const f = 1 - (1 - CAMERA_LERP) ** alpha;
      gc.camera.x = gc.camera.prevX + (px - gc.camera.prevX) * f;
      gc.camera.y = gc.camera.prevY + (py - gc.camera.prevY) * f;

      // Set prevPosition on the predicted entity so renderEntities
      // interpolates it correctly for Y-sorting and drawing
      this.predictor.player.prevPosition = prev;
    } else {
      const player = gc.stateView.playerEntity;
      if (player.prevPosition) {
        const px = player.prevPosition.wx + (player.position.wx - player.prevPosition.wx) * alpha;
        const py = player.prevPosition.wy + (player.position.wy - player.prevPosition.wy) * alpha;
        const f = 1 - (1 - CAMERA_LERP) ** alpha;
        gc.camera.x = gc.camera.prevX + (px - gc.camera.prevX) * f;
        gc.camera.y = gc.camera.prevY + (py - gc.camera.prevY) * f;
      }
    }

    // Apply screen shake after camera override so it isn't clobbered
    gc.camera.x += gc.camera.shakeOffsetX;
    gc.camera.y += gc.camera.shakeOffsetY;

    renderWorld(gc);
    drawGrassBlades(gc);
    renderEntities(gc, alpha);
    drawGemHUD(gc);
    renderDebugOverlay(gc);
    gc.touchJoystick.draw(gc.ctx);
    gc.camera.restoreActual();
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
