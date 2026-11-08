import { closeAssets, type GameAssets, loadGameAssets } from "../assets/GameAssets.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { GameLoop } from "../core/GameLoop.js";
import type { Entity } from "../entities/Entity.js";
import type { FurniturePlacement } from "../interiors/FurnitureCatalog.js";
import type { InteriorPresentation } from "../interiors/InteriorPresentation.js";
import { presentInterior } from "../interiors/presentInterior.js";
import { OverlayFrame } from "../rendering/OverlayFrame.js";
import { ParticleSystem } from "../rendering/ParticleSystem.js";
import { cameraPixelSnap, type TerrainPacing } from "../rendering/PresentationSettings.js";
import type { RenderHost, RenderHostFactory } from "../rendering/RenderHost.js";
import type { SceneItem } from "../rendering/SceneItem.js";
import { selectableRenderHostFactory } from "../rendering/SelectableRenderHost.js";
import type { SurfaceVisibility } from "../rendering/SurfacePresentation.js";
import { ViewLayouts } from "../rendering/ViewLayout.js";
import { LabInput } from "../scenarios/LabInput.js";
import type { ScenarioCommand } from "../scenarios/ScenarioProtocol.js";
import type { ScenarioRecipe } from "../scenarios/ScenarioRecipe.js";
import { type CameraPolicy, followSeat, View } from "../session/View.js";
import type { Movement } from "../shared/Movement.js";
import type { WorkerEndpoint } from "../transport/WorkerClientTransport.js";
import { VehicleControl } from "../ui/VehicleControl.js";
import { drawLabFrame, type LabDiagnostics, labPresentationDiagnostics } from "./LabScene.js";
import { RecipeWorldClient } from "./RecipeWorldClient.js";

export interface LabViewOptions {
  width: number;
  height: number;
  /** How the view frames the world; the game's player follow by default. */
  camera?: CameraPolicy;
  /** Terrain and grass; diagnostic fixtures draw the background alone. */
  terrain?: boolean;
  background?: string;
  surfaceVisibility?(): SurfaceVisibility;
  /** Shadows at whole source pixels (asset inspection). */
  pixelExactShadows?: boolean;
  /** Four-direction sprite inspection: stops the world and cycles only the drawn pose. */
  poseCycle?(): PoseCycle | undefined;
  /** An owned room cache drawn instead of terrain; its props still take part in
   * actor ordering. Disposal clears it. */
  interior?: {
    presentation: InteriorPresentation;
    placements: readonly FurniturePlacement[];
    drawProps: ReadonlySet<number>;
  };
  /** The lab's own scripted input (the Interiors playtest's walk, automatic walk
   * and place mode) in place of the game's controls. */
  input?(): Movement;
  settings(): { paused: boolean; zoom: number; terrainPacing: TerrainPacing };
  /** Diagnostic drawing in screen space, over the terrain and over the scene. */
  underlay?(frame: OverlayFrame, lab: LabView): void;
  overlay?(frame: OverlayFrame, lab: LabView): void;
  /** Diagnostic UI on the render host's UI layer, under the touch controls. */
  uiOverlay?(ctx: CanvasRenderingContext2D, lab: LabView): void;
  /** After each drawn frame: page diagnostics and datasets. */
  onFrame?(lab: LabView): void;
  onError(error: unknown): void;
  /** An owned asset set; disposal closes it. */
  loadAssets?(graph: BlendGraph): Promise<GameAssets>;
  /** Tests: the render host and the recipe world's Worker. */
  renderHost?: RenderHostFactory;
  worker?: () => WorkerEndpoint;
}

/** A sprite sheet's walk cycle: its frames and their rate. */
export interface PoseCycle {
  fps: number;
  frameCount: number;
}

/** The pose cycle's drawn copy: each direction for 2 s, walking at the sheet's rate. */
function cycledPose(player: Entity, seconds: number, { fps, frameCount }: PoseCycle): Entity {
  if (!player.sprite) return player;
  const row = Math.floor(seconds / 2) % 4;
  const frameCol = Math.floor(seconds * fps) % frameCount;
  const sprite = { ...player.sprite, direction: row, frameRow: row, frameCol, moving: true };
  return { ...player, sprite };
}

/**
 * A Workshop lab on the game's view (226): the recipe world served by the
 * game's Worker runtime (`RecipeWorldClient`), one `View` with its camera
 * policy, the game's controls (`LabInput`, `VehicleControl`; a lab with its own
 * scripted input has no `LabInput`), the production clock and the selectable
 * render host. The page owns its DOM controls and a
 * positioned wrapper around the canvas.
 */
export class LabView {
  readonly client: RecipeWorldClient;
  readonly view: View;
  readonly ready: Promise<void>;
  private readonly layouts = new ViewLayouts();
  private readonly effects = new ParticleSystem();
  private readonly overlays = new OverlayFrame();
  private readonly loop: GameLoop;
  private readonly vehicleControls: boolean;
  private host: RenderHost | undefined;
  private assets: GameAssets | undefined;
  private input: LabInput | undefined;
  private vehicleControl: VehicleControl | undefined;
  private disposed = false;
  private interpolate = false;
  private alpha = 1;
  private steps = 0;
  private lightSeconds = 0;
  private poseSeconds = 0;
  /** This frame's cycled copy of the presented player (borrowed). */
  private displayedPlayer: Entity | undefined;
  private renderX = 0;
  private renderY = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    recipe: ScenarioRecipe,
    private readonly options: LabViewOptions,
  ) {
    const params = new URLSearchParams(location.search);
    this.vehicleControls = !!recipe.parkedVehicles?.length || recipe.generation.type === "regional";
    this.client = new RecipeWorldClient(recipe, {
      allCars3d: params.has("allcars3d"),
      ...(options.worker ? { worker: options.worker } : {}),
    });
    this.client.onWorldLoaded = () => this.worldLoaded();
    this.view = new View(options.camera ?? followSeat());
    // A new world clears the device's presentation, this view's slab fades included.
    this.client.device.views.push(this.view);
    this.camera.pixelSnap = cameraPixelSnap(params);
    this.setRegion(options.width, options.height);
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha, now) => this.render(alpha, now),
    });
    document.addEventListener("visibilitychange", this.visibilityChanged);
    this.ready = this.initialize(params).catch((error) => {
      this.dispose();
      throw error;
    });
  }

  get camera() {
    return this.view.camera;
  }

  private setRegion(width: number, height: number) {
    const [whole] = this.layouts.get("1", width, height);
    if (whole) this.view.setRegion(whole.region);
  }

  private async initialize(params: URLSearchParams) {
    const graph = new BlendGraph();
    const loading = (this.options.loadAssets ?? loadGameAssets)(graph).then((assets) => {
      if (this.disposed) closeAssets(assets);
      else this.assets = assets;
      return assets;
    });
    const [assets, , factory] = await Promise.all([
      loading,
      this.client.ready,
      this.options.renderHost ?? selectableRenderHostFactory(params, { embedded: true }),
    ]);
    if (this.disposed) return;
    this.host = factory(this.canvas);
    // Blend sheets, roads and tile variants, exactly as in GameClient.
    this.host.setAssets(assets, graph);
    this.host.resize(this.camera.viewportWidth, this.camera.viewportHeight);
    if (this.vehicleControls) {
      // Vehicle requests and lab commands share their kinds and fields.
      this.vehicleControl = new VehicleControl(({ type, ...fields }) =>
        this.command({ kind: type, ...fields } as ScenarioCommand),
      );
      if (this.canvas.parentElement) this.vehicleControl.mountEmbedded(this.canvas.parentElement);
    }
    if (!this.options.input)
      this.input = new LabInput(this.canvas, {
        enter: () => this.vehicleControl?.activate(),
        recover: () => this.vehicleControl?.activateEquipment(),
      });
    this.snapCamera();
    this.visibilityChanged();
  }

  /** A hidden page pauses the lab and stops its authority's loop, as in the game. */
  private readonly visibilityChanged = () => {
    this.client.replica.resetPresentationClock();
    this.camera.requestSnap();
    this.loop.stop();
    try {
      this.client.setHidden(document.hidden);
      this.syncAuthority();
    } catch (error) {
      this.fail(error);
      return;
    }
    if (this.host && !document.hidden) this.loop.start();
  };

  private get pauseRequested() {
    return this.options.settings().paused || !!this.options.poseCycle?.() || document.hidden;
  }

  /** Not playing: paused, hidden, or a lab command or clock change in flight. */
  private get paused() {
    return this.pauseRequested || this.client.busy;
  }

  private syncAuthority() {
    this.client.setRunning(!!this.host && !this.pauseRequested);
  }

  /** A new world (reset, reload) replaces the renderer's world caches, as in
   * the game; `reload` then snaps the camera. */
  private worldLoaded() {
    this.host?.renderer.clear();
  }

  private snapCamera() {
    const { device } = this.client;
    const p = device.replica.playerEntity.position;
    let x = p.wx,
      y = p.wy;
    if (this.view.policy.beforeInput) {
      this.view.policy.tick(this.camera, device);
      ({ x, y } = this.camera);
    }
    this.camera.snapTo(x, y);
    this.interpolate = false;
  }

  private update(dt: number) {
    if (this.disposed || document.hidden) return;
    const { client, camera } = this;
    try {
      client.update();
      this.syncAuthority();
    } catch (error) {
      this.fail(error);
      return;
    }
    // The pose cycle's clock runs while it stops the world.
    this.poseSeconds = this.options.poseCycle?.() ? this.poseSeconds + dt : 0;
    const { device } = client;
    const paused = this.paused;
    this.vehicleControl?.update(device.replica, true, paused);
    camera.zoom = this.options.settings().zoom;
    if (paused) {
      this.input?.skip();
      // Paused inspection streams what the camera shows; the world stays put.
      client.setVisibleRange(camera.getVisibleChunkRange());
      return;
    }
    this.lightSeconds += dt;
    this.effects.observePlayer(device.replica.playerEntity);
    this.effects.update(dt);
    try {
      camera.savePrev();
      const { policy } = this.view;
      // A fixed camera is placed before input; following waits for the predicted step.
      if (policy.beforeInput) policy.tick(camera, device);
      // A scripted lab sends its own movement, with no presses.
      const script = this.options.input;
      const tick = script
        ? { before: [], movement: script(), after: [] }
        : this.input?.tick(device.replica, dt);
      if (!tick) return;
      for (const press of tick.before) client.submitPress(press);
      this.interpolate = client.submitInput(tick.movement, camera.getVisibleChunkRange());
      for (const press of tick.after) client.submitPress(press);
      if (!this.interpolate) return;
      this.steps++;
      if (!policy.beforeInput) policy.tick(camera, device);
    } catch (error) {
      this.fail(error);
    }
  }

  private render(alpha: number, now = performance.now() / 1000) {
    const { host, camera } = this;
    if (this.disposed || !host) return;
    try {
      this.syncAuthority();
    } catch (error) {
      this.fail(error);
      return;
    }
    const { device } = this.client;
    const { replica } = device;
    const settings = this.options.settings();
    camera.zoom = settings.zoom;
    this.alpha = this.paused || !this.interpolate ? 1 : alpha;
    replica.beginPresentation(now, this.alpha, this.paused);
    try {
      this.view.policy.present(camera, device, this.alpha);
      // A pose cycle draws a copy of the presented player; the replica keeps its own.
      const player = replica.presentedPlayerEntity;
      const cycle = this.options.poseCycle?.();
      const shown = cycle ? cycledPose(player, this.poseSeconds, cycle) : player;
      this.displayedPlayer = shown;
      const entities =
        shown === player
          ? replica.entities
          : replica.entities.map((entity) => (entity.id === player.id ? shown : entity));
      const { interior } = this.options;
      drawLabFrame(host, this.view, device, this.effects, {
        terrain: !interior && this.options.terrain !== false,
        background: this.options.background ?? "#cbd5c3",
        pacing: settings.terrainPacing,
        visibility: this.options.surfaceVisibility?.() ?? "auto",
        alpha: this.alpha,
        fadeSeconds: now,
        presentationTime: this.lightSeconds,
        pixelExactShadows: this.options.pixelExactShadows ?? false,
        entities,
        collectObserver: shown,
        underlay: () => this.drawOverlay(this.options.underlay),
        overlay: () => this.drawOverlay(this.options.overlay),
        ...(interior
          ? {
              room: {
                drawProps: interior.drawProps,
                present: (items: readonly SceneItem[]) =>
                  presentInterior(
                    host.renderer,
                    camera,
                    interior.presentation,
                    interior.placements,
                    items,
                  ),
              },
            }
          : {}),
      });
      this.options.uiOverlay?.(host.uiContext, this);
      this.input?.draw(host.uiContext);
      this.renderX = camera.x;
      this.renderY = camera.y;
      this.options.onFrame?.(this);
    } catch (error) {
      this.fail(error);
    } finally {
      this.displayedPlayer = undefined;
      this.overlays.release();
      camera.restoreActual();
      replica.endPresentation();
    }
  }

  /** A fresh frame that does not advance the world, for a report: the world
   * (GPU included) and the diagnostic UI. */
  captureFrame(): HTMLCanvasElement {
    if (!this.host) throw new Error("The lab view is unavailable for capture");
    this.render(1);
    if (!this.host) throw new Error("The lab view failed during capture");
    return this.host.captureFrame?.() ?? this.canvas;
  }

  /** The player as drawn this frame (borrowed), the pose cycle's copy included:
   * the hooks' view of it. */
  get presentedPlayer(): Entity {
    return this.displayedPlayer ?? this.client.replica.presentedPlayerEntity;
  }

  /** The view's size, without restarting the Worker or changing its world. */
  resize(width: number, height: number) {
    if (this.disposed) return;
    this.setRegion(width, height);
    this.host?.resize(width, height);
  }

  /** The sub-tick fraction the scene was collected at this frame. */
  get presentationAlpha() {
    return this.alpha;
  }

  /** One pass of a hook's drawing, in the presented camera's screen space. */
  private drawOverlay(collect: LabViewOptions["overlay"]) {
    if (!collect || !this.host) return;
    this.overlays.begin();
    collect(this.overlays, this);
    if (this.overlays.items.length)
      this.host.renderer.submit(this.camera, { kind: "overlay", items: this.overlays.items });
  }

  getDiagnostics(): LabDiagnostics {
    return {
      ...labPresentationDiagnostics(this.host, this.client.device, this.effects),
      alpha: this.alpha,
      steps: this.steps,
      authority: this.client.getDiagnostics(),
      cameraX: this.renderX,
      cameraY: this.renderY,
      prediction: this.client.predictor.lastReconcileDiagnostics,
      pixelSnap: this.camera.pixelSnap,
    };
  }

  /** A lab instrument (teleport, placement, vehicle entry); the camera snaps after it. */
  async command(command: ScenarioCommand): Promise<void> {
    await this.client.command(command);
    if (!this.disposed) this.snapCamera();
  }

  /** Reopen the saved world, or restage the recipe with `reset`. */
  async reload(reset = false): Promise<void> {
    await this.client.reload(reset);
    if (!this.disposed) this.snapCamera();
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
    this.overlays.clear();
    this.options.interior?.presentation.clear();
    if (this.assets) closeAssets(this.assets);
    this.assets = undefined;
    this.client.dispose();
  }
}
