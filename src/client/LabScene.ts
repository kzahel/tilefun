import type { Entity } from "../entities/Entity.js";
import type { ParticleSystem } from "../rendering/ParticleSystem.js";
import type { TerrainPacing } from "../rendering/PresentationSettings.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import type { SceneItem } from "../rendering/SceneItem.js";
import type { SurfaceVisibility } from "../rendering/SurfacePresentation.js";
import type { DeviceSession } from "../session/DeviceSession.js";
import type { View } from "../session/View.js";
import { drawViewScene, drawViewTerrain, renderViews } from "../session/ViewRender.js";
import type { PlayerPredictor } from "./PlayerPredictor.js";

export interface LabSceneOptions {
  /** Terrain and grass; otherwise the background colour alone. */
  terrain: boolean;
  background: string;
  pacing: TerrainPacing;
  visibility: SurfaceVisibility;
  alpha: number;
  /** Display seconds (slab fades) and the lab's presentation seconds (lights). */
  fadeSeconds: number;
  presentationTime: number;
  pixelExactShadows: boolean;
  /** The drawn actors; a pose-cycling lab substitutes its displayed player. */
  entities: readonly Entity[];
  collectObserver: Entity;
  /** An owned room cache: props it draws itself, and its own slab presentation. */
  room?: { drawProps: ReadonlySet<number>; present(items: readonly SceneItem[]): void };
  /** Diagnostic world overlays submitted before and after the scene. */
  underlay?(): void;
  overlay?(): void;
}

/**
 * One display frame of a lab's single view (226): terrain prepared for the
 * view, then the device's shared scene with the view's own slab fades. The
 * view's camera must be presented.
 */
export function drawLabFrame(
  host: RenderHost,
  view: View,
  device: DeviceSession,
  particles: ParticleSystem,
  options: LabSceneOptions,
): void {
  const { renderer } = host;
  const { camera } = view;
  const { replica } = device;
  const world = options.terrain ? replica.world : undefined;
  host.beginFrame();
  renderViews(host, [view], world ? { world, pacing: options.pacing } : undefined, () => {
    drawViewTerrain(renderer, camera, world, {
      background: options.background,
      pacing: options.pacing,
      prepared: true,
    });
    options.underlay?.();
    drawViewScene(
      renderer,
      camera,
      device.frame,
      view.fades,
      {
        world: replica.world,
        props: replica.props,
        entities: options.entities,
        collectObserver: options.collectObserver,
        surfaceObserver: replica.playerEntity,
      },
      {
        alpha: options.alpha,
        particles,
        grass: options.terrain && renderer.assets.has("grass-blades"),
        visibility: options.visibility,
        presentationTime: options.presentationTime,
        fadeSeconds: options.fadeSeconds,
        pixelExactShadows: options.pixelExactShadows,
        ...(options.room
          ? { drawProps: options.room.drawProps, present: options.room.present }
          : {}),
      },
    );
    options.overlay?.();
  });
}

/** What a lab reports to browser checks, including the authority's clock and
 * the outgoing channel (the traffic scheduling check). */
export type LabDiagnostics = ReturnType<typeof labPresentationDiagnostics> & {
  alpha: number;
  steps: number;
  authority: {
    clock?: { running: boolean; ticks: number } | undefined;
    channel: { highWaterCount: number };
  };
  cameraX: number;
  cameraY: number;
  prediction: PlayerPredictor["lastReconcileDiagnostics"];
  pixelSnap: boolean;
};

/** The presentation part of a lab's diagnostics. */
export function labPresentationDiagnostics(
  host: RenderHost | undefined,
  device: DeviceSession,
  effects: ParticleSystem,
) {
  const terrain = host?.renderer.getDiagnostics();
  const { replica, frame } = device;
  const playerBody = replica.physicsState?.bodies.find(
    (body) => body.id === replica.playerEntity.id,
  );
  // Optional backend diagnostics stay outside presentation policy.
  const gpu = (terrain as { gpu?: { meshDraws?: number; vehicleBedDraws?: number } } | undefined)
    ?.gpu;
  return {
    terrain,
    effects: effects.diagnostics,
    receivers: frame.receiverStats,
    playerGrounded: playerBody?.grounded ?? false,
    cameraTime: replica.cameraPresentation.time,
    carMeshOverride: frame.meshPoses.allCars3d,
    meshEligibleVehicleTypes: [
      ...new Set(
        replica.entities
          .filter((entity) => frame.meshPoses.assetFor(entity))
          .map((entity) => entity.type),
      ),
    ],
    meshDraws: gpu?.meshDraws ?? 0,
    bedMeshDraws: gpu?.vehicleBedDraws ?? 0,
  };
}
