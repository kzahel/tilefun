import { closeAssets, type GameAssets, loadGameAssets } from "../assets/GameAssets.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { drawLabFrame, labPresentationDiagnostics } from "../client/LabScene.js";
import { GameLoop } from "../core/GameLoop.js";
import type { Entity } from "../entities/Entity.js";
import { Camera } from "../rendering/Camera.js";
import { ParticleSystem } from "../rendering/ParticleSystem.js";
import { cameraPixelSnap, type TerrainPacing } from "../rendering/PresentationSettings.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import { selectableRenderHostFactory } from "../rendering/SelectableRenderHost.js";
import { ViewLayouts } from "../rendering/ViewLayout.js";
import { fixedCamera, followSeat, View } from "../session/View.js";
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
  /** Owned asset set; disposal closes bitmaps, leaving borrowed HTML images intact. */
  loadAssets?(graph: BlendGraph): Promise<GameAssets>;
  /** Diagnostic fixtures can replace terrain/grass with a background. */
  terrain?: boolean;
  background?: string;
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
  private lightSeconds = 0;
  private vehicleControl: VehicleControl | undefined;
  private vehicleControls: boolean;
  /** The game's controls on this canvas (226 slice 2). */
  private input: LabInput | undefined;

  constructor(
    canvas: HTMLCanvasElement,
    recipe: ScenarioRecipe,
    private readonly options: ScenarioPresentationOptions,
  ) {
    this.vehicleControls = !!recipe.parkedVehicles?.length || recipe.generation.type === "regional";
    this.session = new ScenarioClient(recipe, {
      allCars3d: new URLSearchParams(location.search).has("allcars3d"),
    });
    const fixed = options.fixedCamera;
    this.view = new View(fixed ? fixedCamera(fixed) : followSeat(), this.camera);
    this.session.device.views.push(this.view);
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
    return this.options.settings().paused || document.hidden || this.controls > 0;
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
      const tick = this.input?.tick(this.session.view, dt);
      if (!tick) return;
      for (const press of tick.before) this.session.submitPress(press);
      this.interpolate = this.session.submitInput(
        tick.movement,
        this.camera.getVisibleChunkRange(),
      );
      for (const press of tick.after) this.session.submitPress(press);
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
      drawLabFrame(this.host, this.view, this.session.device, this.effects, {
        terrain: this.options.terrain !== false,
        background: this.options.background ?? "#cbd5c3",
        pacing: this.options.settings().terrainPacing,
        visibility: "auto",
        alpha: this.alpha,
        fadeSeconds: now,
        presentationTime: this.lightSeconds,
        pixelExactShadows: false,
        entities: view.entities,
        collectObserver: view.presentedPlayerEntity,
      });
      this.input?.draw(this.host.uiContext);
      this.renderX = this.camera.x;
      this.renderY = this.camera.y;
      this.options.onFrame?.(this);
    } catch (error) {
      this.fail(error);
    } finally {
      this.camera.restoreActual();
      view.endPresentation();
    }
  }

  getDiagnostics() {
    return {
      ...labPresentationDiagnostics(this.host, this.session.device, this.effects),
      alpha: this.alpha,
      steps: this.steps,
      authority: this.session.getDiagnostics(),
      cameraX: this.renderX,
      cameraY: this.renderY,
      prediction: this.session.predictor.lastReconcileDiagnostics,
      pixelSnap: this.camera.pixelSnap,
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
    if (this.assets) closeAssets(this.assets);
    this.assets = undefined;
    this.session.dispose();
  }
}
