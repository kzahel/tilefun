import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { Camera } from "../rendering/Camera.js";
import { collectScene } from "../rendering/collectScene.js";
import { prepareViewTerrain, presentTerrain } from "../rendering/OutdoorPresentation.js";
import type { ParticlePresentation } from "../rendering/ParticleSystem.js";
import type { TerrainPacing } from "../rendering/PresentationSettings.js";
import { presentSurfaceScene } from "../rendering/presentSurfaceScene.js";
import type { RenderBackend } from "../rendering/RenderFrame.js";
import type { SceneFrame, SurfaceFades } from "../rendering/SceneFrame.js";
import type { SceneItem } from "../rendering/SceneItem.js";
import type { SurfaceVisibility } from "../rendering/SurfacePresentation.js";
import type { TerrainRenderWorld } from "../rendering/TerrainPresentation.js";
import type { TerrainPreparationView } from "../rendering/TerrainResidency.js";
import type { RenderRegion } from "../rendering/ViewLayout.js";
import { WorldRasterFrame } from "../rendering/WorldRasterFrame.js";
import type { World } from "../world/World.js";
import type { View } from "./View.js";

const scope = new WorldRasterFrame();
const preparation: { view: View["camera"]; visible: TerrainPreparationView["visible"] }[] = [];

/**
 * One display frame of a device's views (226): terrain is prepared once
 * over every view's range with one budget (`terrain` omitted indoors), then each
 * view draws inside its own region. Views always end, even if drawing throws.
 * Cameras must already be presented (see `CameraPolicy.present`).
 */
export function renderViews(
  host: {
    readonly renderer: RenderBackend;
    beginView(camera: Camera, region: RenderRegion): void;
    endView(): void;
  },
  views: readonly View[],
  terrain: { world: TerrainRenderWorld; pacing: TerrainPacing } | undefined,
  draw: (view: View, index: number) => void,
): void {
  if (terrain) {
    try {
      for (const { camera } of views) {
        // The world frame's own range: pixel-snapped, with the raster guard.
        scope.begin(camera);
        preparation.push({ view: camera, visible: camera.getVisibleChunkRange() });
        scope.end();
      }
      prepareViewTerrain(host.renderer, preparation, terrain.world, terrain.pacing);
    } finally {
      scope.end();
      preparation.length = 0;
    }
  }
  for (let index = 0; index < views.length; index++) {
    const view = views[index];
    if (!view) continue;
    host.beginView(view.camera, view.region);
    try {
      draw(view, index);
    } finally {
      host.endView();
    }
  }
}

/** Clear the view and draw its terrain (already prepared by `renderViews` when `prepared`). */
export function drawViewTerrain(
  renderer: RenderBackend,
  camera: Camera,
  world: TerrainRenderWorld | undefined,
  options: { background: string; pacing: TerrainPacing; prepared: boolean },
): void {
  renderer.submit(camera, { kind: "clear", color: options.background });
  if (world)
    presentTerrain(
      renderer,
      camera,
      world,
      camera.getVisibleChunkRange(),
      options.pacing,
      options.prepared,
    );
}

export interface ViewScene {
  readonly world: World;
  readonly props: readonly Prop[];
  readonly entities: readonly Entity[];
  /** Whose position decides cutaways while collecting, and while presenting slabs. */
  readonly collectObserver: Entity;
  readonly surfaceObserver: Entity;
}

/** The shared outdoor scene for one view: actors, props, grass and particles
 * collected against the device's scene frame, then presented with the view's own
 * slab fades. `collected` may append items (door overlays) before presenting.
 * Game scenes and embedded labs both draw through it. */
export function drawViewScene(
  renderer: RenderBackend,
  camera: Camera,
  frame: SceneFrame,
  /** The view's observer-local slab fades. */
  fades: SurfaceFades,
  scene: ViewScene,
  options: {
    alpha: number;
    particles: ParticlePresentation;
    grass: boolean;
    visibility: SurfaceVisibility;
    presentationTime: number;
    fadeSeconds: number;
    pixelExactShadows?: boolean;
    /** Props drawn as scene items (rooms draw the rest themselves). */
    drawProps?: ReadonlySet<number>;
    collected?(items: SceneItem[]): void;
    /** Replaces slab presentation (a lab's owned room cache). */
    present?(items: readonly SceneItem[]): void;
  },
): void {
  frame.presentationTime = options.presentationTime;
  frame.fadeSeconds = options.fadeSeconds;
  try {
    const items = collectScene(
      scene.entities,
      scene.props,
      scene.world,
      camera,
      camera.getVisibleChunkRange(),
      options.alpha,
      renderer,
      options.particles,
      options.grass,
      options.drawProps,
      frame,
      { observer: scene.collectObserver, visibility: options.visibility },
    );
    options.collected?.(items);
    if (options.present) options.present(items);
    else
      presentSurfaceScene(
        renderer,
        camera,
        frame,
        items,
        scene.props,
        scene.surfaceObserver,
        options.visibility,
        options.alpha,
        options.pixelExactShadows ?? false,
        fades,
      );
  } finally {
    frame.release();
  }
}
