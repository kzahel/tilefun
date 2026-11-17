import type { ParticleSystem } from "../rendering/ParticleSystem.js";
import type { TerrainPacing } from "../rendering/PresentationSettings.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import { drawViewUnavailable } from "../rendering/ViewUnavailable.js";
import type { DeviceSession } from "../session/DeviceSession.js";
import type { View } from "../session/View.js";
import { renderViews } from "../session/ViewRender.js";
import type { PlayerPredictor } from "./PlayerPredictor.js";

/** Prepare and draw one lab through the same view orchestrator as play. */
export function drawLabFrame(
  host: RenderHost,
  view: View,
  world: import("../rendering/TerrainPresentation.js").TerrainRenderWorld | undefined,
  pacing: TerrainPacing,
  draw: (view: View) => boolean,
): void {
  host.beginFrame();
  renderViews(host.renderer, [view], world ? { world, pacing } : undefined, draw, () =>
    drawViewUnavailable(host.drawUiOverlay.bind(host), view),
  );
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
