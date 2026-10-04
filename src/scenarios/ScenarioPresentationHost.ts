import { closeAssets, type GameAssets, loadGameAssets } from "../assets/GameAssets.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { GameLoop } from "../core/GameLoop.js";
import type { Movement } from "../input/ActionManager.js";
import { Camera } from "../rendering/Camera.js";
import { collectScene } from "../rendering/collectScene.js";
import { presentTerrain } from "../rendering/OutdoorPresentation.js";
import { beginPlayerPresentation, followPlayer } from "../rendering/PlayerPresentation.js";
import type { TerrainPacing } from "../rendering/PresentationSettings.js";
import { collectSceneOrder } from "../rendering/RenderFrame.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import { selectableRenderHostFactory } from "../rendering/SelectableRenderHost.js";
import { ScenarioClient } from "./ScenarioClient.js";
import type { ScenarioCommand } from "./ScenarioProtocol.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

export interface ScenarioPresentationOptions {
  width: number;
  height: number;
  cameraOffsetY?: number;
  input(): Movement;
  settings(): { paused: boolean; zoom: number; terrainPacing: TerrainPacing };
  onFrame?(host: ScenarioPresentationHost): void;
  onError(error: unknown): void;
}

/** Embedded outdoor gameplay, using the production clock, render host, asset
 * configuration, camera interpolation and scene/terrain presentation. The caller
 * owns DOM controls and a positioned wrapper around its input/UI canvas.
 */
export class ScenarioPresentationHost {
  readonly session: ScenarioClient;
  readonly camera = new Camera();
  readonly ready: Promise<void>;
  private readonly frame = new SceneFrame();
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

  constructor(
    canvas: HTMLCanvasElement,
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
    const loading = loadGameAssets(graph).then((assets) => {
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
    this.host.resize(this.options.width, this.options.height);
    this.snapCamera();
    this.visibilityChanged();
  }

  private visibilityChanged = () => {
    this.loop.stop();
    if (!this.disposed && this.host && !document.hidden) this.loop.start();
  };

  private get paused() {
    return this.options.settings().paused || document.hidden || this.controls > 0;
  }

  private snapCamera() {
    const p = this.session.view.playerEntity.position;
    this.camera.snapTo(p.wx, p.wy + (this.options.cameraOffsetY ?? 0));
    this.interpolate = false;
  }

  private update(dt: number) {
    if (this.disposed || this.paused) return;
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
    beginPlayerPresentation(
      this.camera,
      view.playerEntity,
      this.alpha,
      this.session.predictor,
      false,
      this.options.cameraOffsetY,
    );
    try {
      this.host.beginFrame();
      renderer.submit(this.camera, { kind: "clear", color: "#cbd5c3" });
      const range = this.camera.getVisibleChunkRange();
      presentTerrain(
        renderer,
        this.camera,
        view.world,
        range,
        this.options.settings().terrainPacing,
      );
      const items = collectScene(
        view.entities,
        view.props,
        view.world,
        this.camera,
        range,
        this.alpha,
        renderer,
        [],
        renderer.assets.has("grass-blades"),
        undefined,
        undefined,
        this.frame,
      );
      renderer.submit(this.camera, {
        kind: "scene",
        items,
        order: collectSceneOrder(items, this.frame.drawOrder),
      });
      this.renderX = this.camera.x;
      this.renderY = this.camera.y;
      this.options.onFrame?.(this);
    } catch (error) {
      this.fail(error);
    } finally {
      this.frame.release();
      this.camera.restoreActual();
    }
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
    if (this.assets) closeAssets(this.assets);
    this.assets = undefined;
    this.session.dispose();
  }
}
