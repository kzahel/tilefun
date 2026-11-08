import { closeAssets, type GameAssets, loadGameAssets } from "../assets/GameAssets.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { GameLoop } from "../core/GameLoop.js";
import type { Entity } from "../entities/Entity.js";
import type { FurniturePlacement } from "../interiors/FurnitureCatalog.js";
import type { InteriorPresentation } from "../interiors/InteriorPresentation.js";
import { presentInterior } from "../interiors/presentInterior.js";
import { Camera } from "../rendering/Camera.js";
import { OverlayFrame } from "../rendering/OverlayFrame.js";
import { ParticleSystem } from "../rendering/ParticleSystem.js";
import { cameraPixelSnap, type TerrainPacing } from "../rendering/PresentationSettings.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import type { SceneItem } from "../rendering/SceneItem.js";
import { selectableRenderHostFactory } from "../rendering/SelectableRenderHost.js";
import type { SurfaceVisibility } from "../rendering/SurfacePresentation.js";
import { ViewLayouts } from "../rendering/ViewLayout.js";
import { fixedCamera, followSeat, View } from "../session/View.js";
import { drawViewScene, drawViewTerrain, renderViews } from "../session/ViewRender.js";
import type { Movement } from "../shared/Movement.js";
import { VehicleControl } from "../ui/VehicleControl.js";
import { LabInput } from "./LabInput.js";
import { ScenarioClient } from "./ScenarioClient.js";
import type { ScenarioCommand } from "./ScenarioProtocol.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

export interface ScenarioPresentationOptions {
  width: number;
  height: number;
  /** Fixed diagnostic framing; otherwise use production player follow. */
  fixedCamera?:
    | { wx: number; wy: number }
    | ((player: Entity, alpha: number) => { wx: number; wy: number });
  /** Owned room cache. Props still participate in collision/support-aware actor ordering. */
  interior?: {
    presentation: InteriorPresentation;
    placements: readonly FurniturePlacement[];
    drawProps: ReadonlySet<number>;
  };
  /** Diagnostic UI only; world content always goes through the renderer backend. */
  uiOverlay?(ctx: CanvasRenderingContext2D, host: ScenarioPresentationHost): void;
  /** Owned asset set; disposal closes bitmaps, leaving borrowed HTML images intact. */
  loadAssets?(graph: BlendGraph): Promise<GameAssets>;
  /** Diagnostic fixtures can replace terrain/grass with a grid. */
  terrain?: boolean;
  pixelExactShadows?: boolean;
  background?: string;
  /** Four-direction sprite inspection: pauses authority and overrides only the displayed pose. */
  poseCycle?(): { fps: number; frameCount: number } | undefined;
  surfaceVisibility?(): SurfaceVisibility;
  /** Borrowed frame/camera, consumed synchronously through either renderer backend. */
  underlay?(frame: OverlayFrame, host: ScenarioPresentationHost): void;
  overlay?(frame: OverlayFrame, host: ScenarioPresentationHost): void;
  /** Transitional: the interiors playtest's own input (automatic walk, place
   * mode) until its 226 slice 4a migration. Other labs get the game's controls. */
  input?(): Movement;
  settings(): { paused: boolean; zoom: number; terrainPacing: TerrainPacing };
  onFrame?(host: ScenarioPresentationHost): void;
  onError(error: unknown): void;
}

/** Embedded gameplay, using the production clock, render host, asset
 * configuration, camera interpolation and scene/terrain presentation. The caller
 * owns DOM controls and a positioned wrapper around its input/UI canvas.
 */
export class ScenarioPresentationHost {
  readonly session: ScenarioClient;
  readonly camera = new Camera();
  /** The lab's one view of its device session (226): camera policy and region. */
  private readonly view: View;
  private readonly layouts = new ViewLayouts();
  readonly ready: Promise<void>;
  private readonly overlays = new OverlayFrame();
  private readonly loop: GameLoop;
  private host: RenderHost | undefined;
  private assets: GameAssets | undefined;
  private disposed = false;
  private controls = 0;
  private interpolate = false;
  private alpha = 1;
  private renderX = 0;
  private renderY = 0;
  private steps = 0;
  private pausedViewKey = "";
  private poseSeconds = 0;
  private lightSeconds = 0;
  private displayedPlayer: Entity | undefined;
  private vehicleControl: VehicleControl | undefined;
  private vehicleControls: boolean;
  /** The game's controls on this canvas (226 slice 2). */
  private input: LabInput | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    recipe: ScenarioRecipe,
    private readonly options: ScenarioPresentationOptions,
  ) {
    this.vehicleControls = !!recipe.parkedVehicles?.length || recipe.generation.type === "regional";
    this.session = new ScenarioClient(recipe, {
      allCars3d: new URLSearchParams(location.search).has("allcars3d"),
    });
    const fixed = options.fixedCamera;
    this.view = new View(fixed ? fixedCamera(fixed) : followSeat(), this.camera);
    this.camera.pixelSnap = cameraPixelSnap(new URLSearchParams(location.search));
    this.setRegion(options.width, options.height);
    this.camera.zoom = options.settings().zoom;
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha, now) => this.render(alpha, now),
    });
    document.addEventListener("visibilitychange", this.visibilityChanged);
    this.ready = this.initialize(canvas).catch((error) => {
      this.dispose();
      throw error;
    });
  }

  private async initialize(canvas: HTMLCanvasElement) {
    const graph = new BlendGraph();
    const loading = (this.options.loadAssets ?? loadGameAssets)(graph).then((assets) => {
      if (this.disposed) closeAssets(assets);
      else this.assets = assets;
      return assets;
    });
    const [assets, , factory] = await Promise.all([
      loading,
      this.session.ready,
      selectableRenderHostFactory(new URLSearchParams(location.search), { embedded: true }),
    ]);
    if (this.disposed) return;
    this.host = factory(canvas);
    // Includes blend sheets, roads and tile variants, exactly as in GameClient.
    this.host.setAssets(assets, graph);
    this.host.resize(this.camera.viewportWidth, this.camera.viewportHeight);
    if (this.vehicleControls) {
      // Vehicle requests and scenario commands share their kinds and fields.
      this.vehicleControl = new VehicleControl(({ type, ...fields }) =>
        this.command({ kind: type, ...fields } as ScenarioCommand),
      );
      if (canvas.parentElement) this.vehicleControl.mountEmbedded(canvas.parentElement);
    }
    if (!this.options.input)
      this.input = new LabInput(canvas, {
        enter: () => this.vehicleControl?.activate(),
        recover: () => this.vehicleControl?.activateEquipment(),
      });
    this.snapCamera();
    this.visibilityChanged();
  }

  private visibilityChanged = () => {
    this.session.view.resetPresentationClock();
    this.camera.requestSnap();
    this.loop.stop();
    try {
      this.syncAuthority();
    } catch (error) {
      this.fail(error);
      return;
    }
    if (!this.disposed && this.host && !document.hidden) this.loop.start();
  };

  private get pauseRequested() {
    return (
      this.options.settings().paused ||
      !!this.options.poseCycle?.() ||
      document.hidden ||
      this.controls > 0
    );
  }

  private get paused() {
    return this.pauseRequested || this.session.busy;
  }

  private syncAuthority() {
    if (!this.disposed) this.session.setRunning(!!this.host && !this.pauseRequested);
  }

  private snapCamera() {
    const p = this.session.view.playerEntity.position;
    let x = p.wx,
      y = p.wy;
    if (this.view.policy.beforeInput) {
      this.view.policy.tick(this.camera, this.session.device);
      ({ x, y } = this.camera);
    }
    this.camera.snapTo(x, y);
    this.interpolate = false;
  }

  /** The device's frame: shared presentation and mesh poses. */
  private get frame() {
    return this.session.device.frame;
  }

  private setRegion(width: number, height: number) {
    const [whole] = this.layouts.get("1", width, height);
    if (whole) this.view.setRegion(whole.region);
  }

  private readonly effects = new ParticleSystem();

  private update(dt: number) {
    if (this.disposed || document.hidden) return;
    try {
      this.session.pump();
      this.syncAuthority();
    } catch (error) {
      this.fail(error);
      return;
    }
    this.poseSeconds = this.options.poseCycle?.() ? this.poseSeconds + dt : 0;
    this.vehicleControl?.update(this.session.view, true, this.paused);
    if (this.paused) return this.input?.skip();
    this.lightSeconds += dt;
    this.effects.observePlayer(this.session.view.playerEntity);
    this.effects.update(dt);
    try {
      this.camera.zoom = this.options.settings().zoom;
      this.camera.savePrev();
      // A fixed camera is placed before input; following waits for the predicted step.
      if (this.view.policy.beforeInput) this.view.policy.tick(this.camera, this.session.device);
      const scripted = this.options.input?.();
      const tick = scripted ? undefined : this.input?.tick(this.session.view, dt);
      const movement = scripted ?? tick?.movement;
      if (!movement) return;
      for (const press of tick?.before ?? []) this.session.submitPress(press);
      this.interpolate = this.session.submitInput(movement, this.camera.getVisibleChunkRange());
      for (const press of tick?.after ?? []) this.session.submitPress(press);
      if (this.interpolate) {
        this.steps++;
        if (!this.view.policy.beforeInput) this.view.policy.tick(this.camera, this.session.device);
      }
    } catch (error) {
      this.fail(error);
    }
  }

  private render(alpha: number, now = performance.now() / 1000) {
    if (this.disposed || !this.host) return;
    try {
      this.syncAuthority();
    } catch (error) {
      this.fail(error);
      return;
    }
    const { renderer } = this.host;
    const view = this.session.view;
    this.camera.zoom = this.options.settings().zoom;
    this.alpha = this.paused || !this.interpolate ? 1 : alpha;
    view.beginPresentation(now, this.alpha, this.paused);
    try {
      this.view.policy.present(this.camera, this.session.device, this.alpha);
      // Camera inspection while paused still needs streamed chunks and replicas,
      // but must not advance the simulation clock.
      if (this.options.settings().paused && this.controls === 0) {
        const range = this.camera.getVisibleChunkRange(),
          key = JSON.stringify(range);
        if (key !== this.pausedViewKey) {
          this.pausedViewKey = key;
          void this.command({ kind: "view-range", range }).catch((e) => this.fail(e));
        }
      }
      const player = view.presentedPlayerEntity;
      const cycle = this.options.poseCycle?.();
      const row = Math.floor(this.poseSeconds / 2) % 4;
      this.displayedPlayer =
        cycle && player.sprite
          ? {
              ...player,
              sprite: {
                ...player.sprite,
                direction: row,
                frameRow: row,
                frameCol: Math.floor(this.poseSeconds * cycle.fps) % cycle.frameCount,
                moving: true,
              },
            }
          : player;
      const entities = cycle
        ? view.entities.map((entity) => (entity.id === player.id ? this.presentedPlayer : entity))
        : view.entities;
      this.host.beginFrame();
      const terrain = !this.options.interior && this.options.terrain !== false;
      const pacing = this.options.settings().terrainPacing;
      renderViews(
        this.host,
        [this.view],
        terrain ? { world: view.world, pacing } : undefined,
        () => {
          drawViewTerrain(renderer, this.camera, terrain ? view.world : undefined, {
            background: this.options.background ?? "#cbd5c3",
            pacing,
            prepared: true,
          });
          this.drawOverlay(this.options.underlay);
          const interior = this.options.interior;
          drawViewScene(
            renderer,
            this.camera,
            this.frame,
            this.view.fades,
            {
              world: view.world,
              props: view.props,
              entities,
              collectObserver: player,
              surfaceObserver: view.playerEntity,
            },
            {
              alpha: this.alpha,
              particles: this.effects,
              grass: terrain && renderer.assets.has("grass-blades"),
              visibility: this.options.surfaceVisibility?.() ?? "auto",
              presentationTime: this.lightSeconds,
              fadeSeconds: now,
              pixelExactShadows: this.options.pixelExactShadows ?? false,
              ...(interior
                ? {
                    drawProps: interior.drawProps,
                    present: (items: readonly SceneItem[]) =>
                      presentInterior(
                        renderer,
                        this.camera,
                        interior.presentation,
                        interior.placements,
                        items,
                      ),
                  }
                : {}),
            },
          );
          this.drawOverlay(this.options.overlay);
        },
      );
      this.options.uiOverlay?.(this.host.uiContext, this);
      this.input?.draw(this.host.uiContext);
      this.renderX = this.camera.x;
      this.renderY = this.camera.y;
      this.options.onFrame?.(this);
    } catch (error) {
      this.fail(error);
    } finally {
      this.overlays.release();
      this.camera.restoreActual();
      view.endPresentation();
    }
  }

  /** Fresh, non-advancing report capture, including the GPU world and diagnostic UI. */
  captureFrame(): HTMLCanvasElement {
    if (!this.host) throw new Error("Presentation is unavailable for capture");
    this.render(1);
    if (!this.host) throw new Error("Presentation failed during capture");
    return this.host.captureFrame?.() ?? this.canvas;
  }

  /** Resize presentation without restarting the Worker or changing its world. */
  resize(width: number, height: number) {
    if (this.disposed) return;
    this.setRegion(width, height);
    this.host?.resize(width, height);
  }

  /** Borrowed current display pose; diagnostic cycling never writes into prediction/replication. */
  get presentedPlayer(): Entity {
    return this.displayedPlayer ?? this.session.view.playerEntity;
  }

  /** The same sub-tick fraction used by the scene collector this frame. */
  get presentationAlpha() {
    return this.alpha;
  }

  private drawOverlay(collect: ScenarioPresentationOptions["overlay"]) {
    if (!collect || !this.host) return;
    this.overlays.begin();
    collect(this.overlays, this);
    if (this.overlays.items.length)
      this.host.renderer.submit(this.camera, { kind: "overlay", items: this.overlays.items });
  }

  getDiagnostics() {
    const terrain = this.host?.renderer.getDiagnostics();
    const playerBody = this.session.view.physicsState?.bodies.find(
      (body) => body.id === this.session.view.playerEntity.id,
    );
    return {
      terrain,
      alpha: this.alpha,
      effects: this.effects.diagnostics,
      receivers: this.frame.receiverStats,
      playerGrounded: playerBody?.grounded ?? false,
      steps: this.steps,
      authority: this.session.getDiagnostics(),
      cameraX: this.renderX,
      cameraY: this.renderY,
      cameraTime: this.session.view.cameraPresentation.time,
      prediction: this.session.predictor.lastReconcileDiagnostics,
      pixelSnap: this.camera.pixelSnap,
      carMeshOverride: this.frame.meshPoses.allCars3d,
      meshEligibleVehicleTypes: [
        ...new Set(
          this.session.view.entities
            .filter((entity) => this.frame.meshPoses.assetFor(entity))
            .map((entity) => entity.type),
        ),
      ],
      // Optional backend diagnostics stay outside presentation policy.
      meshDraws: (terrain as typeof terrain & { gpu?: { meshDraws: number } })?.gpu?.meshDraws ?? 0,
      bedMeshDraws:
        (terrain as typeof terrain & { gpu?: { vehicleBedDraws: number } })?.gpu?.vehicleBedDraws ??
        0,
    };
  }

  async command(command: ScenarioCommand) {
    this.controls++;
    this.syncAuthority();
    try {
      await this.session.command(command);
      if (!this.disposed) this.snapCamera();
    } finally {
      this.controls--;
      this.syncAuthority();
    }
  }

  private fail(error: unknown) {
    this.dispose();
    this.options.onError(error);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    this.vehicleControl?.destroy();
    this.input?.dispose();
    this.input = undefined;
    this.host?.dispose();
    this.host = undefined;
    this.effects.clear();
    this.options.interior?.presentation.clear();
    this.displayedPlayer = undefined;
    this.overlays.clear();
    if (this.assets) closeAssets(this.assets);
    this.assets = undefined;
    this.session.dispose();
  }
}
