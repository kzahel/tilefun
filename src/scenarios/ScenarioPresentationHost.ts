import { closeAssets, type GameAssets, loadGameAssets } from "../assets/GameAssets.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { GameLoop } from "../core/GameLoop.js";
import type { Entity } from "../entities/Entity.js";
import type { Movement } from "../input/ActionManager.js";
import type { FurniturePlacement } from "../interiors/FurnitureCatalog.js";
import type { InteriorPresentation } from "../interiors/InteriorPresentation.js";
import { presentInterior } from "../interiors/presentInterior.js";
import { Camera } from "../rendering/Camera.js";
import { collectScene } from "../rendering/collectScene.js";
import { presentTerrain } from "../rendering/OutdoorPresentation.js";
import { OverlayFrame } from "../rendering/OverlayFrame.js";
import {
  beginPlayerPresentation,
  bindPredictedPlayerPose,
  followPlayer,
} from "../rendering/PlayerPresentation.js";
import type { TerrainPacing } from "../rendering/PresentationSettings.js";
import { presentSurfaceScene } from "../rendering/presentSurfaceScene.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import { selectableRenderHostFactory } from "../rendering/SelectableRenderHost.js";
import type { SurfaceVisibility } from "../rendering/SurfacePresentation.js";
import { ScenarioClient } from "./ScenarioClient.js";
import type { ScenarioCommand } from "./ScenarioProtocol.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

export interface ScenarioPresentationOptions {
  width: number;
  height: number;
  cameraOffsetY?: number;
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
  input(): Movement;
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
  readonly ready: Promise<void>;
  private readonly frame = new SceneFrame();
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
  private poseSeconds = 0;
  private displayedPlayer: Entity | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    recipe: ScenarioRecipe,
    private readonly options: ScenarioPresentationOptions,
  ) {
    this.session = new ScenarioClient(recipe);
    this.camera.setViewport(options.width, options.height);
    this.camera.zoom = options.settings().zoom;
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
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
    this.snapCamera();
    this.visibilityChanged();
  }

  private visibilityChanged = () => {
    this.loop.stop();
    if (!this.disposed && this.host && !document.hidden) this.loop.start();
  };

  private get paused() {
    return (
      this.options.settings().paused ||
      !!this.options.poseCycle?.() ||
      document.hidden ||
      this.controls > 0
    );
  }

  private snapCamera() {
    const p = this.session.view.playerEntity.position;
    const fixed = this.fixedCamera(1);
    this.camera.snapTo(fixed?.wx ?? p.wx, fixed?.wy ?? p.wy + (this.options.cameraOffsetY ?? 0));
    this.interpolate = false;
  }

  private fixedCamera(alpha: number) {
    const fixed = this.options.fixedCamera;
    return typeof fixed === "function" ? fixed(this.session.view.playerEntity, alpha) : fixed;
  }

  private update(dt: number) {
    if (this.disposed || document.hidden) return;
    this.poseSeconds = this.options.poseCycle?.() ? this.poseSeconds + dt : 0;
    if (this.paused) return;
    try {
      this.camera.zoom = this.options.settings().zoom;
      this.camera.savePrev();
      this.interpolate = this.session.step(
        this.options.input(),
        dt,
        this.camera.getVisibleChunkRange(),
      );
      if (this.interpolate) {
        this.steps++;
        if (!this.options.fixedCamera)
          followPlayer(
            this.camera,
            this.session.view.playerEntity,
            false,
            this.options.cameraOffsetY,
          );
      }
    } catch (error) {
      this.fail(error);
    }
  }

  private render(alpha: number) {
    if (this.disposed || !this.host) return;
    const { renderer } = this.host;
    const view = this.session.view;
    this.camera.zoom = this.options.settings().zoom;
    this.alpha = this.paused || !this.interpolate ? 1 : alpha;
    try {
      if (this.options.fixedCamera) {
        bindPredictedPlayerPose(view.playerEntity, this.session.predictor);
        this.camera.applyInterpolation(this.alpha);
        const fixed = this.fixedCamera(this.alpha);
        if (fixed) {
          this.camera.x = fixed.wx;
          this.camera.y = fixed.wy;
        }
      } else
        beginPlayerPresentation(
          this.camera,
          view.playerEntity,
          this.alpha,
          this.session.predictor,
          false,
          this.options.cameraOffsetY,
        );
      const player = view.playerEntity;
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
      renderer.submit(this.camera, { kind: "clear", color: this.options.background ?? "#cbd5c3" });
      const range = this.camera.getVisibleChunkRange();
      if (!this.options.interior && this.options.terrain !== false)
        presentTerrain(
          renderer,
          this.camera,
          view.world,
          range,
          this.options.settings().terrainPacing,
        );
      this.drawOverlay(this.options.underlay);
      const items = collectScene(
        entities,
        view.props,
        view.world,
        this.camera,
        range,
        this.alpha,
        renderer,
        [],
        !this.options.interior &&
          this.options.terrain !== false &&
          renderer.assets.has("grass-blades"),
        undefined,
        this.options.interior?.drawProps,
        this.frame,
      );
      const interior = this.options.interior;
      if (interior)
        presentInterior(renderer, this.camera, interior.presentation, interior.placements, items);
      else
        presentSurfaceScene(
          renderer,
          this.camera,
          this.frame,
          items,
          view.props,
          view.playerEntity,
          this.options.surfaceVisibility?.() ?? "auto",
          this.alpha,
          this.options.pixelExactShadows ?? false,
        );
      this.drawOverlay(this.options.overlay);
      this.options.uiOverlay?.(this.host.uiContext, this);
      this.renderX = this.camera.x;
      this.renderY = this.camera.y;
      this.options.onFrame?.(this);
    } catch (error) {
      this.fail(error);
    } finally {
      this.frame.release();
      this.overlays.release();
      this.camera.restoreActual();
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
    this.camera.setViewport(width, height);
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
    return {
      terrain,
      alpha: this.alpha,
      steps: this.steps,
      cameraX: this.renderX,
      cameraY: this.renderY,
      // Optional backend diagnostics stay outside presentation policy.
      meshDraws: (terrain as typeof terrain & { gpu?: { meshDraws: number } })?.gpu?.meshDraws ?? 0,
    };
  }

  async command(command: ScenarioCommand) {
    this.controls++;
    try {
      await this.session.command(command);
      if (!this.disposed) this.snapCamera();
    } finally {
      this.controls--;
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
    this.host?.dispose();
    this.host = undefined;
    this.frame.clear();
    this.options.interior?.presentation.clear();
    this.displayedPlayer = undefined;
    this.overlays.clear();
    if (this.assets) closeAssets(this.assets);
    this.assets = undefined;
    this.session.dispose();
  }
}
