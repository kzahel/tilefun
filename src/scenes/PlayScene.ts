import { AmbientSystem } from "../audio/AmbientSystem.js";
import { FootstepSystem } from "../audio/FootstepSystem.js";
import type { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { CAMERA_LERP } from "../config/constants.js";
import type { GameContext, GameScene } from "../core/GameScene.js";
import { Direction } from "../entities/Entity.js";
import { getTimeScale } from "../physics/PlayerMovement.js";
import { ParticleSystem } from "../rendering/ParticleSystem.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import { render3DDebug, renderDebugOverlay, renderEntities, renderWorld } from "./renderWorld.js";

/**
 * Play mode scene.
 * Handles: player movement input, camera follow, gem HUD, touch joystick.
 * In serialized mode, runs client-side prediction for the player entity.
 */
const HIT_SHAKE_INTENSITY = 6;
const GHOST_HIT_KEYS = [
  "ghost_hit_000",
  "ghost_hit_001",
  "ghost_hit_002",
  "ghost_hit_003",
  "ghost_hit_004",
];
const GHOST_DEATH_KEYS = [
  "ghost_death_000",
  "ghost_death_001",
  "ghost_death_002",
  "ghost_death_003",
  "ghost_death_004",
];
const GHOST_DEATH_MAX_DISTANCE = 300;
const GHOST_DEATH_VOLUME = 0.35;

/** Soft impact keys used for water splash (pitched down). */
const SPLASH_KEYS = [
  "impact_soft_heavy_000",
  "impact_soft_heavy_001",
  "impact_soft_heavy_002",
  "impact_soft_heavy_003",
  "impact_soft_heavy_004",
];
/** Distance threshold to distinguish water-respawn teleport from normal landing. */
const WATER_RESPAWN_DIST_SQ = 32 * 32;

/** Max hold time in seconds before throw force reaches 1.0. */
const THROW_CHARGE_DURATION = 1.0;

const ZOOM_PRESETS: Record<string, number> = {
  zoom_1: 0.25,
  zoom_2: 0.5,
  zoom_3: 1,
  zoom_4: 2,
};

export class PlayScene implements GameScene {
  readonly transparent = false;
  private predictor: PlayerPredictor | null = null;
  private inputSeq = 0;
  private prevInvincibilityTimer = 0;
  private zoomUnsubs: (() => void)[] = [];
  private particles = new ParticleSystem();
  private footsteps: FootstepSystem | null = null;
  private ambient: AmbientSystem | null = null;
  private wasAirborne = false;
  /** Player position last frame while airborne (for detecting water-respawn teleport). */
  private lastAirborneWx = 0;
  private lastAirborneWy = 0;
  private prevGemsCollected = 0;
  /** Entity IDs that have been seen with deathTimer (to detect ghost death onset). */
  private dyingEntities = new Set<number>();
  /** Accumulated throw charge time (seconds). 0 = not charging. */
  private throwChargeTime = 0;
  private wasThrowHeld = false;
  /** Track ball entity positions for water-splash effect on removal. */
  private ballPositions = new Map<number, { wx: number; wy: number }>();
  /** Ball IDs that had a deathTimer last frame (despawning, not water-killed). */
  private ballDying: Set<number> | undefined;

  onEnter(gc: GameContext): void {
    // Attach touch buttons before joystick so button claims are processed first
    gc.touchButtons.attach();
    gc.touchJoystick.attach();
    if (gc.editorButton) gc.editorButton.textContent = "Edit";

    // Tell server we're in play mode
    if (!gc.serialized && gc.server) {
      gc.server.getLocalSession().editorEnabled = false;
    }
    gc.transport.send({ type: "set-editor-mode", enabled: false });

    // Zoom preset hotkeys
    this.bindZoomActions(gc);

    // Audio systems
    this.footsteps = new FootstepSystem(
      gc.audioManager,
      () => gc.stateView.world,
      () => gc.camera,
      () => gc.stateView.playerEntity,
      () => gc.stateView.props,
    );
    this.ambient = new AmbientSystem(
      gc.audioManager,
      () => gc.camera,
      () => gc.stateView.playerEntity,
    );

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
    gc.touchButtons.detach();
    this.unbindZoomActions();
    this.footsteps = null;
    this.ambient = null;
    this.dyingEntities.clear();
    if (gc.serialized && this.predictor) {
      (gc.stateView as RemoteStateView).setPredictor(null);
      this.predictor = null;
    }
  }

  onResume(gc: GameContext): void {
    console.log(
      `[tilefun:play] onResume — predictor=${!!this.predictor?.player}, editorEnabled=${gc.stateView.editorEnabled}, playerEntityId=${gc.stateView.playerEntity.id}`,
    );
    gc.touchButtons.attach();
    gc.touchJoystick.attach();
    this.bindZoomActions(gc);
    // Re-send editor mode false — after realm switch the server may have a new
    // session that defaults editorEnabled=true
    gc.transport.send({ type: "set-editor-mode", enabled: false });
    if (gc.serialized && this.predictor) {
      (gc.stateView as RemoteStateView).setPredictor(this.predictor);
    }
  }

  onPause(gc: GameContext): void {
    gc.touchJoystick.detach();
    gc.touchButtons.detach();
    this.unbindZoomActions();
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

    // Update debug panel player info
    if (gc.debugEnabled && gc.profile) {
      gc.debugPanel.setPlayerInfo({
        clientId: gc.clientId,
        profileName: gc.profile.name,
        profileId: gc.profile.id,
        entityId: gc.stateView.playerEntity.id,
        worldId: gc.mainMenu.currentWorldId,
      });
    }

    // Player movement input — quantize dx/dy so prediction uses the same
    // values the server will see after binary decoding (no misprediction drift).
    const rawMovement = gc.actions.getMovement();
    const movement = {
      dx: quantizeAxis(rawMovement.dx),
      dy: quantizeAxis(rawMovement.dy),
      sprinting: rawMovement.sprinting,
      jump: rawMovement.jump,
    };
    const seq = ++this.inputSeq;
    gc.transport.send({
      type: "player-input",
      seq,
      dx: movement.dx,
      dy: movement.dy,
      sprinting: movement.sprinting,
      jump: movement.jump,
    });

    // Throw charge tracking
    const throwHeld = gc.actions.isHeld("throw");
    if (throwHeld) {
      this.throwChargeTime += dt;
    } else if (this.wasThrowHeld) {
      // Released — throw the ball
      const force = Math.min(this.throwChargeTime / THROW_CHARGE_DURATION, 1);
      let dirX = 0;
      let dirY = 0;

      // Use movement direction if player is moving (supports diagonal joystick)
      if (movement.dx !== 0 || movement.dy !== 0) {
        const len = Math.sqrt(movement.dx * movement.dx + movement.dy * movement.dy) || 1;
        dirX = movement.dx / len;
        dirY = movement.dy / len;
      } else {
        // Stationary — use sprite facing direction
        const playerSprite = gc.stateView.playerEntity.sprite;
        if (playerSprite) {
          switch (playerSprite.direction) {
            case Direction.Right:
              dirX = 1;
              break;
            case Direction.Left:
              dirX = -1;
              break;
            case Direction.Up:
              dirY = -1;
              break;
            case Direction.Down:
              dirY = 1;
              break;
          }
        } else {
          dirY = 1; // fallback: down
        }
      }
      gc.transport.send({ type: "throw-ball", dirX, dirY, force });
      this.throwChargeTime = 0;
    }
    this.wasThrowHeld = throwHeld;

    const verticalFollow = gc.console.cvars.get("cl_verticalfollow")?.get() === true;

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
              const serverMount =
                remoteView.mountEntityId !== undefined
                  ? remoteView.serverEntities.find((e) => e.id === remoteView.mountEntityId)
                  : undefined;
              console.log(
                `[tilefun:play] predictor.reset — serverPlayer.id=${serverPlayer.id}, pos=(${serverPlayer.position.wx.toFixed(1)}, ${serverPlayer.position.wy.toFixed(1)})`,
              );
              this.predictor.reset(serverPlayer, serverMount);
            } else if (this.predictor.player.id !== serverPlayer.id) {
              const serverMount =
                remoteView.mountEntityId !== undefined
                  ? remoteView.serverEntities.find((e) => e.id === remoteView.mountEntityId)
                  : undefined;
              console.log(
                `[tilefun:play] predictor entity ID mismatch: predicted=${this.predictor.player.id} server=${serverPlayer.id} — forcing reset`,
              );
              this.predictor.reset(serverPlayer, serverMount);
            } else {
              this.predictor.reconcile(
                serverPlayer,
                remoteView.lastProcessedInputSeq,
                gc.stateView.world,
                gc.stateView.props,
                remoteView.serverEntities,
                remoteView.mountEntityId,
              );
            }
          }
        }

        // Store current input for future reconciliation, then predict.
        // Scale dt by server timeScale so prediction matches server physics.
        const scaledDt = dt * getTimeScale();
        this.predictor.storeInput(seq, movement, scaledDt);
        this.predictor.update(
          scaledDt,
          movement,
          gc.stateView.world,
          gc.stateView.props,
          gc.stateView.entities,
        );
      }

      // Camera follows predicted player position (stateView.playerEntity
      // returns the predicted player when predictor is attached).
      // Skip follow when player is a placeholder (id -1) — e.g. between
      // world switch and first game-state — so camera.requestSnap() stays
      // pending until a real player position arrives.
      const playerEnt = gc.stateView.playerEntity;
      if (playerEnt.id !== -1) {
        const zOffset = verticalFollow ? (playerEnt.wz ?? 0) : 0;
        gc.camera.follow(playerEnt.position.wx, playerEnt.position.wy - zOffset, CAMERA_LERP);
      }
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

      const localZOffset = verticalFollow ? (gc.stateView.playerEntity.wz ?? 0) : 0;
      gc.camera.follow(
        gc.stateView.playerEntity.position.wx,
        gc.stateView.playerEntity.position.wy - localZOffset,
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

    // Detect player hit (invincibility transition 0 → >0) and trigger screen shake + sound.
    const invTimer = gc.stateView.invincibilityTimer;
    if (invTimer > 0 && this.prevInvincibilityTimer === 0) {
      gc.camera.shake(HIT_SHAKE_INTENSITY);
      playRandomSound(gc, GHOST_HIT_KEYS, 0.5, 0.9 + Math.random() * 0.15);
    }
    this.prevInvincibilityTimer = invTimer;

    // Gem pickup sound
    const gems = gc.stateView.gemsCollected;
    if (gems > this.prevGemsCollected && this.prevGemsCollected >= 0) {
      const buf = gc.audioManager.getBuffer("gem_pickup");
      if (buf) {
        gc.audioManager.playOneShot({ buffer: buf, volume: 0.4, pitch: 1 + Math.random() * 0.1 });
      }
    }
    this.prevGemsCollected = gems;

    gc.camera.updateShake();
    gc.chatHUD.update(dt);

    // Detect player landing (jumpVZ transitions from defined → undefined)
    const player = gc.stateView.playerEntity;
    const airborne = player.jumpVZ !== undefined;
    if (this.wasAirborne && !airborne) {
      // If position teleported far, it was a water-respawn — splash at the old position
      const dx = player.position.wx - this.lastAirborneWx;
      const dy = player.position.wy - this.lastAirborneWy;
      if (dx * dx + dy * dy > WATER_RESPAWN_DIST_SQ) {
        this.particles.spawnWaterSplash(this.lastAirborneWx, this.lastAirborneWy);
        playRandomSound(gc, SPLASH_KEYS, 0.45, 0.6 + Math.random() * 0.15);
      } else {
        this.particles.spawnLandingDust(player.position.wx, player.position.wy);
      }
    }
    if (airborne) {
      this.lastAirborneWx = player.position.wx;
      this.lastAirborneWy = player.position.wy;
    }
    this.wasAirborne = airborne;

    // Detect ball removal — spawn water splash if it disappeared over water
    this.detectBallSplashes(gc);

    // Detect ghost death (entity gains deathTimer) — play spatial bell sound
    this.detectGhostDeaths(gc);

    this.footsteps?.update(dt, gc.stateView.entities);
    this.ambient?.update(dt, gc.stateView.entities);
    this.particles.update(dt);
  }

  render(alpha: number, gc: GameContext): void {
    gc.camera.applyInterpolation(alpha);

    // Override camera with exponential follow toward the interpolated player.
    // Standard linear camera interpolation creates derivative discontinuities
    // at tick boundaries (camera lerp != entity linear motion), visible as
    // jitter at high refresh rates. The exponential form matches the follow()
    // decay curve, giving smooth sub-tick motion tied to the player.
    const verticalFollow = gc.console.cvars.get("cl_verticalfollow")?.get() === true;
    if (gc.serialized && this.predictor?.player) {
      // Use predicted player's prevPosition for smooth camera interpolation
      const prev = this.predictor.prevPosition;
      const cur = this.predictor.player.position;
      const px = prev.wx + (cur.wx - prev.wx) * alpha;
      let py = prev.wy + (cur.wy - prev.wy) * alpha;
      if (verticalFollow) {
        const prevZ = this.predictor.prevWz ?? 0;
        const curZ = this.predictor.player.wz ?? 0;
        py -= prevZ + (curZ - prevZ) * alpha;
      }
      const f = 1 - (1 - CAMERA_LERP) ** alpha;
      gc.camera.x = gc.camera.prevX + (px - gc.camera.prevX) * f;
      gc.camera.y = gc.camera.prevY + (py - gc.camera.prevY) * f;

      // Set prev state on the predicted entity so renderEntities
      // interpolates it correctly for Y-sorting and drawing
      this.predictor.player.prevPosition = prev;
      this.predictor.player.prevJumpZ = this.predictor.prevJumpZ;
      this.predictor.player.prevWz = this.predictor.prevWz;
    } else {
      const player = gc.stateView.playerEntity;
      if (player.prevPosition) {
        const px = player.prevPosition.wx + (player.position.wx - player.prevPosition.wx) * alpha;
        let py = player.prevPosition.wy + (player.position.wy - player.prevPosition.wy) * alpha;
        if (verticalFollow) {
          const prevZ = player.prevWz ?? 0;
          const curZ = player.wz ?? 0;
          py -= prevZ + (curZ - prevZ) * alpha;
        }
        const f = 1 - (1 - CAMERA_LERP) ** alpha;
        gc.camera.x = gc.camera.prevX + (px - gc.camera.prevX) * f;
        gc.camera.y = gc.camera.prevY + (py - gc.camera.prevY) * f;
      }
    }

    // Apply screen shake after camera override so it isn't clobbered
    gc.camera.x += gc.camera.shakeOffsetX;
    gc.camera.y += gc.camera.shakeOffsetY;

    renderWorld(gc);
    const particleItems = this.particles.collectItems();
    renderEntities(gc, alpha, particleItems);
    drawGemHUD(gc);
    gc.chatHUD.render(gc.ctx);
    renderDebugOverlay(gc);
    render3DDebug(gc);
    if (!gc.xrActive) {
      gc.touchJoystick.draw(gc.ctx);
      gc.touchButtons.draw(gc.ctx);
    }
    gc.camera.restoreActual();
  }

  private bindZoomActions(gc: GameContext): void {
    this.unbindZoomActions();
    for (const [action, zoom] of Object.entries(ZOOM_PRESETS)) {
      this.zoomUnsubs.push(
        gc.actions.on(action as import("../input/ActionMap.js").ActionName, () => {
          gc.debugPanel.setZoom(zoom);
        }),
      );
    }
  }

  private unbindZoomActions(): void {
    for (const unsub of this.zoomUnsubs) unsub();
    this.zoomUnsubs.length = 0;
  }

  private detectBallSplashes(gc: GameContext): void {
    const liveBalls = new Map<number, boolean>();
    for (const e of gc.stateView.entities) {
      if (e.type !== "ball") continue;
      liveBalls.set(e.id, e.deathTimer !== undefined);
      this.ballPositions.set(e.id, { wx: e.position.wx, wy: e.position.wy });
    }
    // Check for balls that disappeared — splash only if they weren't despawning
    // (water removal is instant with no deathTimer; stopped balls fade via deathTimer)
    for (const [id, pos] of this.ballPositions) {
      if (liveBalls.has(id)) continue;
      if (!this.ballDying?.has(id)) {
        this.particles.spawnWaterSplash(pos.wx, pos.wy, 0.4);
        playRandomSound(gc, SPLASH_KEYS, 0.3, 0.8 + Math.random() * 0.3);
      }
      this.ballPositions.delete(id);
    }
    // Track which balls have a deathTimer so we can distinguish water vs despawn
    this.ballDying = new Set<number>();
    for (const [id, dying] of liveBalls) {
      if (dying) this.ballDying.add(id);
    }
  }

  private detectGhostDeaths(gc: GameContext): void {
    const liveIds = new Set<number>();
    const player = gc.stateView.playerEntity;
    const airborne = player.jumpVZ !== undefined;

    for (const e of gc.stateView.entities) {
      if (e.deathTimer === undefined) continue;
      liveIds.add(e.id);
      if (this.dyingEntities.has(e.id)) continue;

      // Newly dying entity — play spatial death sound
      this.dyingEntities.add(e.id);
      const dx = e.position.wx - player.position.wx;
      const dy = e.position.wy - player.position.wy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Stomp effect: player is airborne and close → cloud puff
      if (airborne && dist < 32) {
        this.particles.spawnStompCloud(e.position.wx, e.position.wy);
      }

      if (dist > GHOST_DEATH_MAX_DISTANCE) continue;

      const distFactor = 1 - dist / GHOST_DEATH_MAX_DISTANCE;
      const camera = gc.camera;
      const screen = camera.worldToScreen(e.position.wx, e.position.wy);
      const centerX = camera.viewportWidth / 2;
      const normalizedX = camera.viewportWidth > 0 ? (screen.sx - centerX) / (centerX || 1) : 0;
      const pan = Math.max(-0.5, Math.min(0.5, normalizedX * 0.5));

      const idx = Math.floor(Math.random() * GHOST_DEATH_KEYS.length);
      const key = GHOST_DEATH_KEYS[idx];
      if (!key) continue;
      const buf = gc.audioManager.getBuffer(key);
      if (!buf) continue;
      gc.audioManager.playOneShot({
        buffer: buf,
        volume: GHOST_DEATH_VOLUME * distFactor,
        pitch: 0.8 + Math.random() * 0.3,
        pan,
      });
    }

    // Prune IDs for despawned entities
    for (const id of this.dyingEntities) {
      if (!liveIds.has(id)) this.dyingEntities.delete(id);
    }
  }
}

/** Play a random sound from a list of keys (non-spatial, centered). */
function playRandomSound(gc: GameContext, keys: string[], volume: number, pitch: number): void {
  const idx = Math.floor(Math.random() * keys.length);
  const key = keys[idx];
  if (!key) return;
  const buf = gc.audioManager.getBuffer(key);
  if (!buf) return;
  gc.audioManager.playOneShot({ buffer: buf, volume, pitch });
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
