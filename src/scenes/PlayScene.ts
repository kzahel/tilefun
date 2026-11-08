import { AmbientSystem } from "../audio/AmbientSystem.js";
import { FootstepSystem } from "../audio/FootstepSystem.js";
import type { RemoteStateView } from "../client/ClientStateView.js";
import { nextInputSequence, observeInputSequence } from "../client/InputSequence.js";
import type { GameContext, GameScene } from "../core/GameScene.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import {
  devicePacket,
  normalizesDiagonal,
  SeatComposer,
  seatPresses,
  vehicleButtons,
} from "../input/SeatComposer.js";
import { ParticleSystem } from "../rendering/ParticleSystem.js";
import { ZOOM_PRESETS } from "../rendering/PresentationSettings.js";
import { projectWorld } from "../rendering/Projection.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";
import type { IClientTransport } from "../transport/Transport.js";
import { drawPlayerMarkers } from "../ui/PlayerMarkers.js";
import {
  drawCrosshair,
  firstPersonMovement,
  firstPersonTick,
  renderFirstPerson,
} from "./firstPersonPlay.js";
import { render3DDebug, renderDebugOverlay } from "./renderDebug.js";
import { renderPlayViews } from "./renderWorld.js";

/**
 * Play mode scene.
 * Handles: player movement input, camera follow, gem HUD, touch joystick.
 * Runs client-side prediction for the player entity.
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

/** Soft impact keys used for ball-hits-entity sound. */
const BALL_HIT_KEYS = [
  "impact_soft_medium_000",
  "impact_soft_medium_001",
  "impact_soft_medium_002",
  "impact_soft_medium_003",
  "impact_soft_medium_004",
];
const BALL_HIT_MAX_DISTANCE = 300;
const BALL_HIT_VOLUME = 0.4;

export class PlayScene implements GameScene {
  readonly transparent = false;
  /** Seat 0's input composition (tactical 226); other seats join in slice 5. */
  private readonly seat = new SeatComposer();
  private prevInvincibilityTimer = 0;
  private zoomUnsubs: (() => void)[] = [];
  private particles = new ParticleSystem();
  private effectsRealmId: string | null | undefined;
  private footsteps: FootstepSystem | null = null;
  private ambient: AmbientSystem | null = null;
  /** Player position last frame while airborne (for detecting water-respawn teleport). */
  private prevGemsCollected = 0;
  /** Entity IDs that have been seen with deathTimer (to detect ghost death onset). */
  private dyingEntities = new Set<number>();
  /** Track ball entity positions for water-splash effect on removal. */
  private ballPositions = new Map<number, { wx: number; wy: number; wz: number }>();
  /** Ball IDs that had a deathTimer last frame (despawning, not water-killed). */
  private ballDying: Set<number> | undefined;
  /** Previous wander AI state per entity ID (for detecting scared transitions). */
  private prevWanderStates = new Map<number, string>();
  /** Reconciliation telemetry counters (for cl_log_reconcile summaries). */
  private reconcileSamples = 0;
  /** Likely true mismatch count (resim drift or no-replay correction over threshold). */
  private reconcileNotable = 0;
  /** Raw correction count over threshold (includes expected backlog lead corrections). */
  private reconcilePosErrSum = 0;
  private reconcilePosErrMax = 0;
  private nextReconcileLogAtMs = 0;
  private jumpPressLatched = false;
  private jumpPressUnsub: (() => void) | null = null;

  /** Seat 0's unquantized movement last tick (door walk-through reads it). */
  get lastMovement(): { dx: number; dy: number } {
    return this.seat.lastMovement;
  }

  onEnter(gc: GameContext): void {
    this.particles.clear();
    // Attach touch buttons before joystick so button claims are processed first
    gc.touchButtons.attach();
    gc.touchPinch?.attach();
    gc.touchTap?.attach();
    gc.touchHold?.attach();
    gc.touchJoystick.attach();
    if (gc.editorButton) gc.editorButton.textContent = "Edit";

    // Tell server we're in play mode
    gc.transport.send({ type: "set-editor-mode", enabled: false });

    // Zoom preset hotkeys
    this.bindZoomActions(gc);
    this.jumpPressUnsub = gc.actions.on("jump", () => {
      this.jumpPressLatched = true;
    });

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

    // Predict seat 0 against the authoritative replica, from its current pose.
    observeInputSequence(gc.transport, gc.stateView.lastProcessedInputSeq);
    gc.session.startPrediction();
  }

  onExit(gc: GameContext): void {
    this.particles.clear();
    this.stopMovement(gc);
    gc.touchPinch?.detach();
    gc.touchTap?.detach();
    gc.touchHold?.detach();
    gc.touchJoystick.detach();
    gc.touchButtons.detach();
    this.unbindZoomActions();
    this.footsteps = null;
    this.ambient = null;
    this.dyingEntities.clear();
    this.jumpPressUnsub?.();
    this.jumpPressUnsub = null;
    this.jumpPressLatched = false;
    this.seat.cancel();
    gc.session.stopPrediction();
  }

  onResume(gc: GameContext): void {
    console.log(
      `[tilefun:play] onResume — predictor=${!!gc.session.prediction?.player}, editorEnabled=${gc.stateView.editorEnabled}, playerEntityId=${gc.stateView.playerEntity.id}`,
    );
    gc.touchButtons.attach();
    gc.touchPinch?.attach();
    gc.touchTap?.attach();
    gc.touchHold?.attach();
    gc.touchJoystick.attach();
    this.bindZoomActions(gc);
    // Re-send editor mode false — after realm switch the server may have a new
    // session that defaults editorEnabled=true
    gc.transport.send({ type: "set-editor-mode", enabled: false });
    gc.session.resumePrediction();
  }

  onPause(gc: GameContext): void {
    this.stopMovement(gc);
    gc.touchPinch?.detach();
    gc.touchTap?.detach();
    gc.touchHold?.detach();
    gc.touchJoystick.detach();
    gc.touchButtons.detach();
    this.unbindZoomActions();
  }

  update(dt: number, gc: GameContext): void {
    if (this.effectsRealmId !== gc.realmId) {
      this.particles.clear();
      this.effectsRealmId = gc.realmId;
    }
    // Save camera state for render interpolation
    gc.camera.savePrev();

    // Debug panel state
    gc.camera.zoom = gc.debugPanel.zoom;
    if (gc.debugPanel.consumeBaseModeChange() || gc.debugPanel.consumeConvexChange()) {
      gc.transport.send({ type: "invalidate-all-chunks" });
    }

    gc.sendDebugState(gc.debugPanel.paused);

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

    // Seat 0's input: devices are sampled here, composed by the shared SeatComposer.
    const vehicle = occupiedVehicle(gc.stateView.playerEntity, gc.stateView.entities);
    const boarded = this.seat.board(
      vehicle,
      gc.actions.isHeld("vehicle_lights"),
      gc.actions.isHeld("vehicle_style"),
    );
    if (boarded) {
      gc.tapMovement?.cancel();
      gc.touchHold?.reset();
      gc.touchButtons.reset();
    }
    Object.assign(gc.touchButtons, vehicleButtons(vehicle));
    const inputLocked = !!(gc.storagePaused || gc.doorPresentation?.busy || gc.inputBlocked);
    gc.touchButtons.enabled = !inputLocked;
    if (inputLocked) gc.touchButtons.reset();
    gc.touchJoystick.enabled = (gc.touchMovement ?? "joystick") === "joystick" && !inputLocked;
    if (inputLocked) {
      gc.touchHold?.reset();
      gc.tapMovement?.cancel();
    }
    const steering = gc.carDriving === "steering";
    const firstPerson = firstPersonTick(gc, dt, vehicle);
    const manual = firstPersonMovement(
      gc,
      firstPerson,
      vehicle,
      inputLocked
        ? { dx: 0, dy: 0, sprinting: false, jump: false }
        : gc.actions.getMovement(normalizesDiagonal(vehicle, steering)),
    );
    let steered =
      !inputLocked && gc.touchMovement === "tap" && gc.tapMovement
        ? gc.tapMovement.sample(gc.stateView.playerEntity.position, manual, dt, vehicle ? 24 : 0)
        : manual;
    if (!inputLocked && gc.touchMovement === "hold")
      steered =
        gc.touchHold?.sample(gc.stateView.playerEntity.position, manual, vehicle ? 24 : 0) ??
        manual;
    const tick = this.seat.tick(
      { manual, steered, ...seatPresses(gc.actions), jumpPressed: this.takeJumpPress() },
      {
        vehicle,
        locked: inputLocked,
        steering,
        joystick: (gc.touchMovement ?? "joystick") === "joystick",
        facing: gc.stateView.playerEntity.sprite?.direction,
        look: firstPerson?.forward(),
      },
      dt,
    );
    for (const message of tick.before) gc.transport.send(message);
    if (inputLocked) gc.audioManager.stopHorns();
    gc.audioManager.updateSirens(
      gc.stateView.entities,
      gc.stateView.playerEntity.position,
      !inputLocked,
    );
    gc.audioManager.updateCarEngine(
      vehicle,
      !inputLocked && !gc.debugPanel.paused && !document.hidden,
    );
    gc.audioManager.updateTrains(
      gc.stateView.entities,
      gc.stateView.playerEntity.position,
      !inputLocked && !gc.debugPanel.paused,
    );
    gc.audioManager.updateCreatureCalls(
      gc.stateView.entities,
      gc.stateView.playerEntity.position,
      !inputLocked && !gc.debugPanel.paused && !document.hidden,
    );
    const movement = tick.movement;
    const commandDt = 1 / 60;
    const seq = nextInputSequence(gc.transport);
    const packet = devicePacket(seq, [
      { body: vehicle?.id ?? gc.stateView.playerEntity.id, movement },
    ]);
    gc.transport.send(packet.input);
    for (const message of tick.after) gc.transport.send(message);

    // Prediction, camera follow and chunk loading.
    const remoteView = gc.stateView;

    // Reconcile BEFORE storing current input — replay rebuilds prediction from
    // server state + unacked inputs from previous frames only. Storing current
    // input first would replay it AND apply it here, double-moving the player.
    // A door transition resets prediction (226: DeviceSession.reconcile).
    const doorBusy = !!gc.doorPresentation?.busy;
    if (remoteView.stateAppliedThisTick && gc.session.reconcile(doorBusy, remoteView.mountEntityId))
      this.maybeLogReconcile(gc, remoteView);
    // Store current input for future reconciliation, then predict.
    if (!inputLocked) gc.session.predict(seq, movement, commandDt, packet.coSeats);

    // Camera follows the predicted player (placeholder id -1 is skipped, so a
    // pending camera.requestSnap() waits for the first real position).
    gc.view.policy.tick(gc.camera, gc.session);
    if (gc.debugPanel.observer && gc.camera.zoom !== 1) {
      const savedZoom = gc.camera.zoom;
      gc.camera.zoom = 1;
      gc.sendVisibleRange();
      gc.camera.zoom = savedZoom;
    } else {
      gc.sendVisibleRange();
    }

    // Detect player hit (invincibility transition 0 → >0) and trigger screen shake + sound.
    const invTimer = gc.stateView.invincibilityTimer;
    if (invTimer > 0 && this.prevInvincibilityTimer === 0) {
      gc.touchTap?.reset();
      gc.touchHold?.reset();
      if (gc.touchMovement === "hold" || gc.tapMovement?.target) {
        gc.tapMovement?.cancel();
        this.cancelInput(gc.transport);
      }
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

    // Cosmetic transitions and contact placement are shared with embedded labs.
    if (this.particles.observePlayer(gc.stateView.playerEntity))
      playRandomSound(gc, SPLASH_KEYS, 0.45, 0.6 + Math.random() * 0.15);

    // Detect ball removal — spawn water splash if it disappeared over water
    this.detectBallSplashes(gc);

    // Detect ghost death (entity gains deathTimer) — play spatial bell sound
    this.detectGhostDeaths(gc);

    // Detect NPC scared by ball hit — play spatial impact sound
    this.detectBallHits(gc);

    this.footsteps?.update(dt, gc.stateView.entities);
    this.ambient?.update(dt, gc.stateView.entities);

    // Hostile entities emit red wisps
    for (const e of gc.stateView.entities) {
      if (e.wanderAI?.hostile && e.deathTimer === undefined) {
        this.particles.spawnHostileWisp(e.position.wx, e.position.wy, e.wz ?? 0);
      }
    }

    this.particles.update(dt);
  }

  render(alpha: number, gc: GameContext): void {
    const view = gc.stateView;
    view?.beginPresentation(gc.time.presentationSeconds, alpha, gc.debugPanel.paused);
    try {
      gc.view.policy.present(gc.camera, gc.session, alpha);

      const shown = view?.presentedPlayerEntity ?? gc.stateView.playerEntity;
      gc.tapMovement?.captureView(gc.camera, Math.max(0, (shown.wz ?? 0) - (shown.jumpZ ?? 0)));

      const firstPerson = renderFirstPerson(gc, alpha);
      if (!firstPerson) {
        renderPlayViews(gc, alpha, this.particles);
        drawPlayerMarkers(gc, alpha);
      }
      gc.chatHUD.render(gc.ctx);
      renderDebugOverlay(gc, alpha);
      render3DDebug(gc);
      if (firstPerson) drawCrosshair(gc.ctx, gc.canvas.width, gc.canvas.height);
      else this.drawDestination(gc);
      gc.touchJoystick.draw(gc.ctx);
      gc.touchButtons.draw(gc.ctx);
    } finally {
      gc.camera.restoreActual();
      view?.endPresentation();
    }
  }

  private stopMovement(gc: GameContext): void {
    gc.firstPerson?.hideView(); // Editor and other opaque scenes draw the fixed view.
    gc.audioManager.stopSirens();
    gc.audioManager.stopTrains();
    gc.audioManager.stopCarEngine();
    gc.audioManager.stopHorns();
    gc.audioManager.stopCreatureCalls();
    gc.transport.send({ type: "vehicle-horn", active: false });
    this.seat.stop();
    gc.tapMovement?.cancel();
    gc.touchHold?.reset();
    gc.actions.clearHeld();
    this.cancelInput(gc.transport);
  }

  cancelInput(transport: IClientTransport): void {
    this.seat.cancel();
    this.jumpPressLatched = false;
    transport.send({
      type: "player-input",
      seq: nextInputSequence(transport),
      dx: 0,
      dy: 0,
      sprinting: false,
      jump: false,
    });
  }

  private drawDestination(gc: GameContext): void {
    const controller = gc.tapMovement;
    const target =
      controller?.target ?? (controller?.blockedFade ? controller.blockedTarget : null);
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

  private maybeLogReconcile(gc: GameContext, remoteView: RemoteStateView): void {
    if (gc.console.cvars.get("cl_log_reconcile")?.get() !== true) return;
    const details = remoteView.predictionDiagnostics;
    if (!details) return;
    const threshold = Number(gc.console.cvars.get("cl_reconcile_log_threshold")?.get() ?? 0.5);
    this.reconcileSamples++;
    this.reconcilePosErrSum += details.resimPosErr;
    this.reconcilePosErrMax = Math.max(this.reconcilePosErrMax, details.resimPosErr);
    if (details.resimPosErr >= threshold) this.reconcileNotable++;
    remoteView.setReconcileStats({
      samples: this.reconcileSamples,
      notable: this.reconcileNotable,
      avgPosErr: this.reconcilePosErrSum / this.reconcileSamples,
      maxPosErr: this.reconcilePosErrMax,
      threshold,
    });
    const now = performance.now();
    if (now < this.nextReconcileLogAtMs) return;
    console.log(
      `[tilefun:reconcile] epoch=${details.epoch} tick=${details.physicsTick} ack=${details.ackSeq} bodies=${details.bodies} omitted=${details.omitted} replay=${details.replayCount} replayMs=${details.replayMs.toFixed(2)} pastError=${details.pastTickError?.toFixed(3) ?? "unavailable"} currentCorrection=${details.resimPosErr.toFixed(3)} status=${details.status}`,
    );
    this.nextReconcileLogAtMs =
      now + Number(gc.console.cvars.get("cl_reconcile_log_interval_ms")?.get() ?? 1000);
  }

  private bindZoomActions(gc: GameContext): void {
    this.unbindZoomActions();
    for (const { action, zoom } of ZOOM_PRESETS) {
      this.zoomUnsubs.push(
        gc.actions.on(action, () => {
          gc.debugPanel.setZoom(zoom);
        }),
      );
    }
    // Experimental first-person view (tactical 229); the cvar owns the state.
    this.zoomUnsubs.push(
      gc.actions.on("toggle_first_person", () => {
        const view = gc.console.cvars.get("r_firstperson");
        view?.set(view.get() !== true);
      }),
    );
  }

  private unbindZoomActions(): void {
    for (const unsub of this.zoomUnsubs) unsub();
    this.zoomUnsubs.length = 0;
  }

  private takeJumpPress(): boolean {
    const pressed = this.jumpPressLatched;
    this.jumpPressLatched = false;
    return pressed;
  }

  private detectBallSplashes(gc: GameContext): void {
    const liveBalls = new Map<number, boolean>();
    for (const e of gc.stateView.entities) {
      if (e.type !== "ball") continue;
      liveBalls.set(e.id, e.deathTimer !== undefined);
      this.ballPositions.set(e.id, { wx: e.position.wx, wy: e.position.wy, wz: e.wz ?? 0 });
    }
    // Check for balls that disappeared — splash only if they weren't despawning
    // (water removal is instant with no deathTimer; stopped balls fade via deathTimer)
    for (const [id, pos] of this.ballPositions) {
      if (liveBalls.has(id)) continue;
      if (!this.ballDying?.has(id)) {
        this.particles.spawnWaterSplash(pos.wx, pos.wy, 0.4, pos.wz);
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
        this.particles.spawnStompCloud(e.position.wx, e.position.wy, e.wz ?? 0);
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

  private detectBallHits(gc: GameContext): void {
    const player = gc.stateView.playerEntity;
    const liveIds = new Set<number>();

    for (const e of gc.stateView.entities) {
      if (!e.wanderAI) continue;
      liveIds.add(e.id);

      const currentState = e.wanderAI.state;
      const prevState = this.prevWanderStates.get(e.id);
      this.prevWanderStates.set(e.id, currentState);

      // Species calls are owned by shared AudioManager in both game and lab.
      if (["wildlife-robin-v1", "wildlife-frog-v1", "wildlife-mallard-v1"].includes(e.type))
        continue;
      if (currentState !== "scared" || prevState === "scared") continue;

      // Newly scared — play spatial impact sound
      const dx = e.position.wx - player.position.wx;
      const dy = e.position.wy - player.position.wy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > BALL_HIT_MAX_DISTANCE) continue;

      const distFactor = 1 - dist / BALL_HIT_MAX_DISTANCE;
      const camera = gc.camera;
      const screen = camera.worldToScreen(e.position.wx, e.position.wy);
      const centerX = camera.viewportWidth / 2;
      const normalizedX = camera.viewportWidth > 0 ? (screen.sx - centerX) / (centerX || 1) : 0;
      const pan = Math.max(-0.5, Math.min(0.5, normalizedX * 0.5));

      // Pitch based on entity weight: lighter = higher pitch
      const weight = e.weight ?? ENTITY_DEFS[e.type]?.weight ?? 10;
      const pitch =
        weight < 5
          ? 1.3 + Math.random() * 0.2
          : weight > 100
            ? 0.7 + Math.random() * 0.15
            : 0.9 + Math.random() * 0.2;

      const idx = Math.floor(Math.random() * BALL_HIT_KEYS.length);
      const key = BALL_HIT_KEYS[idx];
      if (!key) continue;
      const buf = gc.audioManager.getBuffer(key);
      if (!buf) continue;
      gc.audioManager.playOneShot({
        buffer: buf,
        volume: BALL_HIT_VOLUME * distFactor,
        pitch,
        pan,
      });
    }

    // Prune stale entries for entities that no longer exist
    for (const id of this.prevWanderStates.keys()) {
      if (!liveIds.has(id)) this.prevWanderStates.delete(id);
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
