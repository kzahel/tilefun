import type { PlayerPredictor } from "../client/PlayerPredictor.js";
import { CAMERA_LERP } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Camera } from "./Camera.js";
import type { CameraPresentationTime } from "./CameraFollow.js";

type PlayerPosePredictor = Pick<
  PlayerPredictor,
  "player" | "prevPosition" | "prevJumpZ" | "prevWz"
> &
  Partial<Pick<PlayerPredictor, "presentationPlayer">>;

/** Shared fixed-tick follow policy. Diagnostic framing is an explicit offset. */
export function followPlayer(
  camera: Camera,
  player: Entity,
  verticalFollow = false,
  offsetY = 0,
  predictor?: PlayerPosePredictor | null,
): void {
  player = bindPredictedPlayerPose(player, predictor);
  if (player.id === -1) return;
  camera.follow(
    player.position.wx,
    player.position.wy - (verticalFollow ? (player.wz ?? 0) : 0) + offsetY,
    CAMERA_LERP,
  );
}

/** Borrow the interpolated camera until restoreActual(). Prediction supplies the
 * same previous pose to the camera and scene collector, including roof/jump height.
 */
export function beginPlayerPresentation(
  camera: Camera,
  player: Entity,
  alpha: number,
  predictor?: PlayerPosePredictor | null,
  verticalFollow = false,
  offsetY = 0,
  presentation?: CameraPresentationTime,
): void {
  camera.applyInterpolation(alpha);
  player = bindPredictedPlayerPose(player, predictor);
  if (player.id === -1) return;
  const prev = player.prevPosition ?? (presentation === undefined ? undefined : player.position);
  if (prev) {
    const px = prev.wx + (player.position.wx - prev.wx) * alpha;
    let py = prev.wy + (player.position.wy - prev.wy) * alpha + offsetY;
    if (verticalFollow) {
      const prevZ = player.prevWz ?? 0;
      py -= prevZ + ((player.wz ?? 0) - prevZ) * alpha;
    }
    // Match follow()'s exponential decay between ticks, avoiding the derivative
    // discontinuities of linear interpolation of the already-followed camera.
    if (presentation) camera.presentFollow(presentation.time, px, py, presentation.domain);
    else {
      const f = 1 - (1 - CAMERA_LERP) ** alpha;
      camera.x = camera.prevX + (px - camera.prevX) * f;
      camera.y = camera.prevY + (py - camera.prevY) * f;
    }
  }
  camera.x += camera.shakeOffsetX;
  camera.y += camera.shakeOffsetY;
}

/** Bind the production prediction history for body/overlay interpolation, including fixed cameras. */
export function bindPredictedPlayerPose(
  player: Entity,
  predictor?: PlayerPosePredictor | null,
): Entity {
  const predicted = predictor?.player;
  if (predicted && predictor) {
    const shown = predictor.presentationPlayer;
    if (shown) return shown;
    player = predicted;
    player.prevPosition = predictor.prevPosition;
    player.prevJumpZ = predictor.prevJumpZ;
    player.prevWz = predictor.prevWz;
  }
  return player;
}
