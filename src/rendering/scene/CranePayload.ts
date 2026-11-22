import { WRECKING_BALL } from "../../entities/ConstructionCargo.js";
import type { Entity } from "../../entities/Entity.js";
import { rotateBodyVector } from "../../physics/BodyRotation.js";
import { craneCargoHook } from "../../traffic/MobileCrane.js";
import type { SpriteItem } from "../SceneItem.js";
import { WRECKING_BALL_SHEAR } from "../WreckingBallProjection.js";

/** The cable is part of the crane mesh. Its payload can be outside the viewport. */
export function presentCranePayload(item: SpriteItem, payload: Entity, shown?: SpriteItem) {
  const mesh = item.mesh;
  if (!mesh) return;
  const eye = craneCargoHook(payload);
  const { wx, wy } = payload.position;
  const wz = payload.wz ?? 0;
  const eyeX = eye.wx - wx,
    eyeY = eye.wy - wy,
    eyeZ = eye.wz - wz;
  const dx = (shown?.wx ?? wx) + eyeX - item.wx;
  const dy = (shown?.wy ?? wy) + eyeY - item.wy;
  const dz = (shown?.zOffset ?? wz) + eyeZ - item.zOffset;
  const [x, y, z, w] = mesh.orientation;
  const inverse = [-x, -y, -z, w] as const;
  const end = rotateBodyVector(inverse, dx, dy, dz);
  const wrecking = payload.type === WRECKING_BALL;
  // The ball's attachment is on the far side of its centre from its base anchor.
  const offset = wrecking ? ((eyeY - eyeZ) / 2) * WRECKING_BALL_SHEAR : 0;
  // Pad the projected end for the hook and reuse a few target sizes as it swings.
  const reach = Math.max(Math.abs(dx), Math.abs(dy - dz), Math.abs(dy - dz - 2 * offset));
  const cableRadius = Math.ceil((reach + 16) / 32) * 32;
  item.mesh = {
    ...mesh,
    radius: Math.max(mesh.radius, cableRadius),
    craneCableEnd: {
      ...end,
      wrecking,
      ...(offset && { topDown: rotateBodyVector(inverse, dx, dy - offset, dz + offset) }),
    },
  };
}
